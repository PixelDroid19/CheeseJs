import {
  ipcMain,
  app,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { appLog } from '../logger.js';

const activeLspProcesses = new Map<string, ChildProcess>();

interface LspLanguageConfig {
  name: string;
  command: string;
  args: string[];
  fileExtensions: string[];
  enabled: boolean;
  initializationOptions?: Record<string, unknown>;
}

interface LspConfig {
  languages: Record<string, LspLanguageConfig>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isLspConfig(value: unknown): value is LspConfig {
  return typeof value === 'object' && value !== null && 'languages' in value;
}

export function getLspConfigPath(): string {
  return path.join(app.getPath('userData'), 'lsp.json');
}

const DEFAULT_LSP_CONFIG: LspConfig = {
  languages: {
    javascript: {
      name: 'JavaScript/TypeScript (tsls)',
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['typescript-language-server', '--stdio'],
      fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
      enabled: true,
      initializationOptions: {
        preferences: {
          includeCompletionsForModuleExports: true,
          includeCompletionsWithInsertText: true,
        },
      },
    },
    typescript: {
      name: 'TypeScript (tsls)',
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['typescript-language-server', '--stdio'],
      fileExtensions: ['.ts', '.tsx'],
      enabled: true,
      initializationOptions: {
        preferences: {
          includeCompletionsForModuleExports: true,
          includeCompletionsWithInsertText: true,
        },
      },
    },
    python: {
      name: 'Python (Pyright)',
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['pyright-langserver', '--stdio'],
      fileExtensions: ['.py'],
      enabled: true,
    },
  },
};

export function registerLspHandlers(): void {
  ipcMain.handle('get-lsp-config', async () => {
    try {
      const configPath = getLspConfigPath();
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        // Return default config and write it to disk
        await fs
          .writeFile(
            configPath,
            JSON.stringify(DEFAULT_LSP_CONFIG, null, 2),
            'utf8'
          )
          .catch(() => undefined);
        return DEFAULT_LSP_CONFIG;
      }
      const data = await fs.readFile(configPath, 'utf8');
      const parsed: unknown = JSON.parse(data);
      if (!isLspConfig(parsed) || Object.keys(parsed.languages).length === 0) {
        return DEFAULT_LSP_CONFIG;
      }
      return parsed;
    } catch (error) {
      appLog.error('[LspHandlers] Error reading LSP config:', error);
      return DEFAULT_LSP_CONFIG;
    }
  });

  ipcMain.handle(
    'save-lsp-config',
    async (_event: unknown, configData: unknown) => {
      try {
        const configPath = getLspConfigPath();
        await fs.writeFile(
          configPath,
          JSON.stringify(configData, null, 2),
          'utf8'
        );
        return { success: true };
      } catch (error: unknown) {
        appLog.error('[LspHandlers] Error saving LSP config:', error);
        return { success: false, error: getErrorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    'lsp:start',
    async (event: IpcMainInvokeEvent, langId: string) => {
      try {
        if (activeLspProcesses.has(langId)) {
          return { success: true };
        }

        const configPath = getLspConfigPath();
        const configData = await fs
          .readFile(configPath, 'utf8')
          .catch(() => null);
        let config: LspConfig = DEFAULT_LSP_CONFIG;
        if (configData) {
          try {
            const parsed: unknown = JSON.parse(configData);
            if (isLspConfig(parsed)) {
              config = parsed;
            }
          } catch {
            // Ignore malformed config and fall back to defaults.
          }
        }
        const langConfig = config.languages?.[langId];
        if (!langConfig || !langConfig.command || !langConfig.enabled) {
          return {
            success: false,
            error: `LSP for ${langId} is not configured or disabled`,
          };
        }

        appLog.info(
          `Starting LSP for ${langId}: ${langConfig.command} ${langConfig.args?.join(' ')}`
        );

        const lspProcess = spawn(langConfig.command, langConfig.args || [], {
          cwd: app.getAppPath(),
          env: process.env,
          shell: process.platform === 'win32',
        });

        activeLspProcesses.set(langId, lspProcess);

        lspProcess.stdout?.on('data', (data) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('lsp:message-reply', {
              langId,
              data: data.toString('utf8'),
            });
          }
        });

        lspProcess.stderr?.on('data', (data) => {
          appLog.warn(`[LSP ${langId}] STDERR: ${data}`);
        });

        const cleanup = () => {
          activeLspProcesses.delete(langId);
        };

        lspProcess.on('exit', cleanup);
        lspProcess.on('error', (err) => {
          appLog.error(`[LSP ${langId}] process error:`, err);
          cleanup();
        });

        return { success: true };
      } catch (err: unknown) {
        appLog.error(`Failed to start LSP for ${langId}`, err);
        return { success: false, error: getErrorMessage(err) };
      }
    }
  );

  ipcMain.on('lsp:stop', (_event: IpcMainEvent, langId: string) => {
    const proc = activeLspProcesses.get(langId);
    if (proc && !proc.killed) {
      proc.kill();
    }
    activeLspProcesses.delete(langId);
  });

  ipcMain.on(
    'lsp:message',
    (
      _event: IpcMainEvent,
      { langId, data }: { langId: string; data: string }
    ) => {
      const proc = activeLspProcesses.get(langId);
      if (proc && proc.stdin && !proc.killed) {
        proc.stdin.write(data);
      }
    }
  );
}
