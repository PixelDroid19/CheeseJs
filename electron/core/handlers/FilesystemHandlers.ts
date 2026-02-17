/**
 * Filesystem Handlers Module (SECURITY HARDENED)
 *
 * Provides IPC handlers for filesystem operations used by the AI agent.
 * SECURITY: All file operations are restricted to a designated workspace directory.
 * COMMAND EXECUTION HAS BEEN REMOVED - Use only for code execution sandbox.
 */

import { ipcMain, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

let workspaceRoot: string | null = null;

export function initWorkspace(): string {
  if (!workspaceRoot) {
    workspaceRoot = path.join(app.getPath('userData'), 'workspace');
    fs.mkdir(workspaceRoot, { recursive: true }).catch(() => {});
  }
  return workspaceRoot;
}

export function getWorkspaceRoot(): string {
  if (!workspaceRoot) {
    return initWorkspace();
  }
  return workspaceRoot;
}

function sanitizePath(userPath: string): string {
  const workspace = getWorkspaceRoot();
  const resolved = path.resolve(workspace, userPath);

  if (!resolved.startsWith(workspace)) {
    throw new SecurityError('Path traversal detected: access denied');
  }
  return resolved;
}

class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

const BLOCKED_FILES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  'credentials.json',
  'secrets.json',
  '.npmrc',
  '.yarnrc',
  '.gitconfig',
  '.netrc',
  '_netrc',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  '.keystore',
]);

function isBlockedPath(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  if (BLOCKED_FILES.has(basename)) return true;
  if (BLOCKED_EXTENSIONS.has(ext)) return true;
  if (basename.startsWith('id_') && !basename.includes('.')) return true;
  if (basename.includes('private') && ext === '.key') return true;

  return false;
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
}

async function getFilesRecursive(
  dirPath: string,
  workspaceRoot: string
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name !== 'node_modules' &&
          entry.name !== '.git' &&
          entry.name !== 'dist' &&
          entry.name !== 'build' &&
          entry.name !== '.next' &&
          entry.name !== '__pycache__' &&
          entry.name !== '.venv' &&
          entry.name !== 'venv'
        ) {
          const subFiles = await getFilesRecursive(fullPath, workspaceRoot);
          files.push(...subFiles);
        }
      } else {
        if (!isBlockedPath(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files;
}

async function searchInFile(
  filePath: string,
  pattern: RegExp
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        results.push({
          file: filePath,
          line: i + 1,
          content: lines[i].trim().substring(0, 200),
        });
      }
    }
  } catch {
    // Skip files that can't be read
  }

  return results;
}

export function registerFilesystemHandlers(): void {
  initWorkspace();

  // --------------------------------------------------------------------------
  // GET WORKSPACE PATH - Returns the workspace root for the renderer
  // --------------------------------------------------------------------------
  ipcMain.handle('fs:getWorkspacePath', async () => {
    return getWorkspaceRoot();
  });

  // --------------------------------------------------------------------------
  // READ FILE - Restricted to workspace directory
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:readFile',
    async (
      _event,
      filePath: string,
      options?: { startLine?: number; endLine?: number }
    ) => {
      try {
        const safePath = sanitizePath(filePath);

        if (isBlockedPath(safePath)) {
          return {
            success: false,
            error:
              'Access denied: this file type is not allowed for security reasons',
          };
        }

        const content = await fs.readFile(safePath, 'utf-8');

        if (
          options?.startLine !== undefined ||
          options?.endLine !== undefined
        ) {
          const lines = content.split('\n');
          const start = (options.startLine ?? 1) - 1;
          const end = options.endLine ?? lines.length;
          const selectedLines = lines.slice(start, end);
          return { success: true, content: selectedLines.join('\n') };
        }

        return { success: true, content };
      } catch (error) {
        if (error instanceof SecurityError) {
          return { success: false, error: error.message };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // WRITE FILE - Restricted to workspace directory
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:writeFile',
    async (_event, filePath: string, content: string) => {
      try {
        const safePath = sanitizePath(filePath);

        if (isBlockedPath(safePath)) {
          return {
            success: false,
            error: 'Access denied: cannot write to this file type',
          };
        }

        await fs.mkdir(path.dirname(safePath), { recursive: true });

        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
        if (content.length > MAX_FILE_SIZE) {
          return {
            success: false,
            error: 'File size exceeds maximum allowed (10MB)',
          };
        }

        await fs.writeFile(safePath, content, 'utf-8');
        return { success: true };
      } catch (error) {
        if (error instanceof SecurityError) {
          return { success: false, error: error.message };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // LIST FILES - Restricted to workspace directory
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:listFiles',
    async (_event, dirPath: string, recursive: boolean = false) => {
      try {
        const safePath = sanitizePath(dirPath);
        const workspace = getWorkspaceRoot();

        if (recursive) {
          const files = await getFilesRecursive(safePath, workspace);
          return { success: true, files };
        } else {
          const entries = await fs.readdir(safePath, { withFileTypes: true });
          const files = entries
            .filter((entry) => !isBlockedPath(path.join(safePath, entry.name)))
            .map((entry) => {
              const fullPath = path.join(safePath, entry.name);
              return entry.isDirectory() ? fullPath + path.sep : fullPath;
            });
          return { success: true, files };
        }
      } catch (error) {
        if (error instanceof SecurityError) {
          return { success: false, error: error.message };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // SEARCH IN FILES - Restricted to workspace directory
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:searchInFiles',
    async (_event, pattern: string, directory: string) => {
      try {
        const safeDir = sanitizePath(directory);
        const workspace = getWorkspaceRoot();

        // Validate regex pattern to prevent ReDoS
        let regex: RegExp;
        try {
          regex = new RegExp(pattern, 'gi');
          // Test the regex with a simple string to check for catastrophic backtracking
          const testStart = Date.now();
          regex.test('a'.repeat(100));
          if (Date.now() - testStart > 100) {
            throw new Error(
              'Regex pattern is too complex and may cause performance issues'
            );
          }
          regex.lastIndex = 0; // Reset
        } catch (regexError) {
          return {
            success: false,
            error: `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : String(regexError)}`,
          };
        }

        const files = await getFilesRecursive(safeDir, workspace);
        const allResults: SearchResult[] = [];

        const textExtensions = new Set([
          '.ts',
          '.tsx',
          '.js',
          '.jsx',
          '.json',
          '.md',
          '.txt',
          '.html',
          '.css',
          '.scss',
          '.less',
          '.yaml',
          '.yml',
          '.xml',
          '.py',
          '.sh',
          '.bash',
          '.zsh',
          '.config',
          '.gitignore',
          '.eslintrc',
          '.prettierrc',
          '.toml',
          '.ini',
          '.cfg',
          '.conf',
        ]);

        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          const basename = path.basename(file);

          if (textExtensions.has(ext) || !ext) {
            if (
              basename !== 'package-lock.json' &&
              basename !== 'yarn.lock' &&
              basename !== 'pnpm-lock.yaml'
            ) {
              const results = await searchInFile(file, regex);
              allResults.push(...results);

              if (allResults.length >= 100) break;
            }
          }
        }

        const limitedResults = allResults.slice(0, 100);

        return {
          success: true,
          results: limitedResults,
          totalMatches: allResults.length,
          truncated: allResults.length > 100,
        };
      } catch (error) {
        if (error instanceof SecurityError) {
          return { success: false, error: error.message };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // DELETE FILE - Restricted to workspace directory
  // --------------------------------------------------------------------------
  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    try {
      const safePath = sanitizePath(filePath);

      // Extra check: don't allow deleting the workspace root itself
      if (safePath === getWorkspaceRoot()) {
        return {
          success: false,
          error: 'Cannot delete the workspace root directory',
        };
      }

      await fs.rm(safePath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      if (error instanceof SecurityError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // --------------------------------------------------------------------------
  // EXECUTE COMMAND - REMOVED FOR SECURITY
  // This handler has been intentionally removed to prevent arbitrary code
  // execution. Code execution should only happen through the sandboxed
  // code executor workers.
  // --------------------------------------------------------------------------

  // If you need command execution, use the code executor sandbox instead.
  // Example: In the renderer, use codeRunner.execute() to run safe code.

  console.log(
    '[FilesystemHandlers] Registered (command execution disabled for security)'
  );
}
