/**
 * Plugin Process Manager
 *
 * Manages the UtilityProcess that runs plugins in isolation.
 * Provides crash recovery and IPC communication.
 */

import { utilityProcess, app } from 'electron';
import path from 'path';
import { createMainLogger } from '../logger.js';
import { EventEmitter } from 'events';

const log = createMainLogger('PluginProcessManager');

// Message types
interface PluginMessage {
  type: 'activate' | 'deactivate' | 'call' | 'ping' | 'shutdown';
  id: string;
  pluginId: string;
  data?: unknown;
}

interface PluginResponse {
  type: 'ready' | 'result' | 'error' | 'log' | 'pong';
  id: string;
  pluginId?: string;
  data?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Plugin Process Manager
 *
 * Manages an isolated UtilityProcess for running plugins.
 */
export class PluginProcessManager extends EventEmitter {
  private process: Electron.UtilityProcess | null = null;
  private isReady = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestId = 0;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;
  private restartDelay = 1000;

  /**
   * Start the plugin process
   */
  async start(): Promise<void> {
    if (this.process) {
      log.warn('[PluginProcessManager] Process already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Get the path to the compiled plugin worker
        const workerPath = app.isPackaged
          ? path.join(process.resourcesPath, 'dist-electron', 'pluginWorker.js')
          : path.join(__dirname, 'pluginWorker.js');

        log.info(
          `[PluginProcessManager] Starting plugin process: ${workerPath}`
        );

        const proc = utilityProcess.fork(workerPath, [], {
          serviceName: 'cheesejs-plugins',
          stdio: 'pipe',
        });
        this.process = proc;

        // Handle messages from plugin process
        proc.on('message', (message: PluginResponse) => {
          this.handleMessage(message);

          if (message.type === 'ready') {
            this.isReady = true;
            this.restartAttempts = 0;
            log.info('[PluginProcessManager] Plugin process ready');
            resolve();
          }
        });

        // Handle process exit
        proc.on('exit', (code: number) => {
          log.warn(
            `[PluginProcessManager] Plugin process exited with code ${code}`
          );
          this.isReady = false;
          this.process = null;

          // Reject pending requests
          for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timeout);
            request.reject(new Error('Plugin process exited'));
            this.pendingRequests.delete(id);
          }

          // Emit event for crash recovery
          this.emit('exit', code);

          // Auto-restart if not intentional shutdown
          if (code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
            this.restartAttempts++;
            log.info(
              `[PluginProcessManager] Attempting restart ${this.restartAttempts}/${this.maxRestartAttempts}`
            );
            setTimeout(() => this.start(), this.restartDelay);
          }
        });

        // Handle stdout/stderr
        if (proc.stdout) {
          proc.stdout.on('data', (data: Buffer) => {
            log.debug(`[PluginProcess stdout] ${data.toString().trim()}`);
          });
        }

        if (proc.stderr) {
          proc.stderr.on('data', (data: Buffer) => {
            log.error(`[PluginProcess stderr] ${data.toString().trim()}`);
          });
        }

        // Timeout for initial ready
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Plugin process failed to start within timeout'));
          }
        }, 10000);
      } catch (error) {
        log.error(
          '[PluginProcessManager] Failed to start plugin process:',
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Stop the plugin process
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    log.info('[PluginProcessManager] Stopping plugin process');

    // Send shutdown message
    await this.send({
      type: 'shutdown',
      id: this.generateId(),
      pluginId: '',
    });

    // Force kill after timeout
    setTimeout(() => {
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
    }, 5000);
  }

  /**
   * Activate a plugin in the isolated process
   */
  async activatePlugin(
    pluginId: string,
    code: string,
    permissions: string[] = ['storage']
  ): Promise<{ success: boolean }> {
    const id = this.generateId();

    const result = await this.sendAndWait<{ success: boolean }>({
      type: 'activate',
      id,
      pluginId,
      data: { code, permissions },
    });

    return result;
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<{ success: boolean }> {
    const id = this.generateId();

    const result = await this.sendAndWait<{ success: boolean }>({
      type: 'deactivate',
      id,
      pluginId,
    });

    return result;
  }

  /**
   * Check if process is healthy
   */
  async ping(): Promise<boolean> {
    if (!this.process || !this.isReady) {
      return false;
    }

    try {
      const id = this.generateId();
      await this.sendAndWait({ type: 'ping', id, pluginId: '' }, 5000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if process is ready
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Handle message from plugin process
   */
  private handleMessage(message: PluginResponse): void {
    // Handle pending request responses
    if (message.id && this.pendingRequests.has(message.id)) {
      const request = this.pendingRequests.get(message.id)!;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(message.id);

      if (message.type === 'error') {
        request.reject(new Error(message.error || 'Unknown error'));
      } else {
        request.resolve(message.data);
      }
      return;
    }

    // Handle log messages
    if (message.type === 'log' && message.data) {
      const { level, message: logMessage } = message.data as {
        level: string;
        message: string;
      };
      const prefix = `[Plugin:${message.pluginId}]`;

      switch (level) {
        case 'warn':
          log.warn(prefix, logMessage);
          break;
        case 'error':
          log.error(prefix, logMessage);
          break;
        case 'debug':
          log.debug(prefix, logMessage);
          break;
        default:
          log.info(prefix, logMessage);
      }

      // Emit for external listeners
      this.emit('plugin-log', {
        pluginId: message.pluginId,
        level,
        message: logMessage,
      });
    }
  }

  /**
   * Send message to plugin process
   */
  private send(message: PluginMessage): void {
    if (!this.process) {
      throw new Error('Plugin process not running');
    }

    this.process.postMessage(message);
  }

  /**
   * Send message and wait for response
   */
  private sendAndWait<T>(message: PluginMessage, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.isReady) {
        reject(new Error('Plugin process not ready'));
        return;
      }

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Request ${message.id} timed out`));
      }, timeout);

      this.pendingRequests.set(message.id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      this.send(message);
    });
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `req-${++this.requestId}-${Date.now()}`;
  }
}

// Export singleton instance
export const pluginProcessManager = new PluginProcessManager();
