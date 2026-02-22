/**
 * Import Validator Manager
 *
 * Manages communication with the import validator web worker.
 * Provides a simple API for validating imports asynchronously.
 */

import type {
  ValidateImportsMessage,
  ValidationResult,
  ImportMarker,
} from './importValidator.worker';

// Threshold for using worker vs sync validation (lines of code)
const WORKER_THRESHOLD_LINES = 500;

// Re-export types for consumers
export type { ImportMarker };

export interface ValidationResponse {
  missingPackages: string[];
  markers: ImportMarker[];
}

type PendingRequest = {
  resolve: (result: ValidationResponse) => void;
  reject: (error: Error) => void;
};

class ImportValidatorManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private requestId = 0;
  private isReady = false;
  private readyPromise: Promise<void> | null = null;

  /**
   * Initialize the web worker lazily
   */
  private async initWorker(): Promise<void> {
    if (this.worker) {
      if (this.isReady) return;
      if (this.readyPromise) return this.readyPromise;
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      try {
        // Use Vite's worker import syntax
        this.worker = new Worker(
          new URL('./importValidator.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event: MessageEvent) => {
          const data = event.data;

          if (data.type === 'ready') {
            this.isReady = true;
            resolve();
            return;
          }

          if (data.type === 'result') {
            const result = data as ValidationResult;
            const pending = this.pendingRequests.get(result.requestId);

            if (pending) {
              this.pendingRequests.delete(result.requestId);
              pending.resolve({
                missingPackages: result.missingPackages,
                markers: result.markers,
              });
            }
          }
        };

        this.worker.onerror = (error) => {
          console.error('[ImportValidatorManager] Worker error:', error);
          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('Worker error'));
            this.pendingRequests.delete(id);
          }
          reject(error);
        };

        // Set a timeout for worker initialization
        setTimeout(() => {
          if (!this.isReady) {
            console.warn(
              '[ImportValidatorManager] Worker initialization timeout'
            );
            this.isReady = true; // Allow fallback to work
            resolve();
          }
        }, 3000);
      } catch (error) {
        console.error(
          '[ImportValidatorManager] Failed to create worker:',
          error
        );
        reject(error);
      }
    });

    return this.readyPromise;
  }

  /**
   * Validate imports using the web worker
   */
  async validateAsync(
    code: string,
    installedPackages: string[]
  ): Promise<ValidationResponse> {
    // For small files, don't bother with worker
    const lineCount = code.split('\n').length;
    if (lineCount < WORKER_THRESHOLD_LINES) {
      return this.validateSync(code, installedPackages);
    }

    try {
      await this.initWorker();

      if (!this.worker || !this.isReady) {
        // Fallback to sync validation
        return this.validateSync(code, installedPackages);
      }

      const requestId = ++this.requestId;

      return new Promise<ValidationResponse>((resolve, reject) => {
        // Set timeout to prevent hanging
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          console.warn(
            '[ImportValidatorManager] Request timeout, falling back to sync'
          );
          resolve(this.validateSync(code, installedPackages));
        }, 5000);

        this.pendingRequests.set(requestId, {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });

        const message: ValidateImportsMessage = {
          type: 'validate',
          code,
          installedPackages,
          requestId,
        };

        this.worker!.postMessage(message);
      });
    } catch (error) {
      console.warn(
        '[ImportValidatorManager] Worker failed, using sync validation:',
        error
      );
      return this.validateSync(code, installedPackages);
    }
  }

  /**
   * Synchronous validation fallback for small files or when worker fails
   */
  validateSync(code: string, installedPackages: string[]): ValidationResponse {
    const patterns = [
      { regex: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, group: 1 },
      { regex: /import\s+['"]([^'"]+)['"]/g, group: 1 },
      { regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, group: 1 },
      { regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, group: 1 },
    ];

    const ignoredPackages = new Set([
      'from',
      'as',
      'in',
      'of',
      'export',
      'import',
      'default',
      'const',
      'var',
      'let',
      'type',
      'interface',
    ]);

    const markers: ImportMarker[] = [];
    const missingPackages: string[] = [];
    const installedSet = new Set(installedPackages);

    for (const { regex, group } of patterns) {
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(code)) !== null) {
        const packagePath = match[group];

        // Extract package name
        let packageName: string;
        if (packagePath.startsWith('.') || packagePath.startsWith('/')) {
          continue; // Skip relative imports
        }

        if (packagePath.startsWith('@')) {
          const parts = packagePath.split('/');
          packageName =
            parts.length >= 2 ? `${parts[0]}/${parts[1]}` : packagePath;
        } else {
          packageName = packagePath.split('/')[0];
        }

        if (ignoredPackages.has(packageName)) {
          continue;
        }

        if (!installedSet.has(packageName)) {
          if (!missingPackages.includes(packageName)) {
            missingPackages.push(packageName);
          }

          const fullMatch = match[0];
          const packageIndexInMatch = fullMatch.lastIndexOf(packagePath);

          if (packageIndexInMatch === -1) continue;

          const startOffset = match.index + packageIndexInMatch;
          const endOffset = startOffset + packagePath.length;

          markers.push({
            packageName,
            packagePath,
            startOffset,
            endOffset,
          });
        }
      }
    }

    return { missingPackages, markers };
  }

  /**
   * Check if we should use async validation based on code size
   */
  shouldUseAsync(code: string): boolean {
    const lineCount = code.split('\n').length;
    return lineCount >= WORKER_THRESHOLD_LINES;
  }

  /**
   * Terminate the worker
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.readyPromise = null;

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        pending.reject(new Error('Worker disposed'));
        this.pendingRequests.delete(id);
      }
    }
  }
}

// Singleton instance
export const importValidator = new ImportValidatorManager();
