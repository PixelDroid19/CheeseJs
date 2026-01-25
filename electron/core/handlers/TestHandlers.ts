/**
 * Test Handlers
 *
 * IPC handlers for the integrated test runner.
 * Supports inline test execution from playground editor.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  duration?: number;
  error?: string;
  stack?: string;
  line?: number;
}

interface WorkerMessage {
  type: string;
  id?: string;
  filePath?: string;
  test?: TestResult;
  status?: 'passed' | 'failed';
  message?: string;
  success?: boolean;
}

// ============================================================================
// STATE
// ============================================================================

let testWorker: Worker | null = null;
let isReady = false;
let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

// Temp directory for inline tests
const TEMP_TEST_DIR = join(tmpdir(), 'cheesejs-tests');

// ============================================================================
// WORKER MANAGEMENT
// ============================================================================

function getWorkerPath(): string {
  // In development, worker is in dist-electron
  // In production, it's in resources/app
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return join(__dirname, 'testRunner.js');
  }
  return join(process.resourcesPath, 'app', 'dist-electron', 'testRunner.js');
}

async function ensureWorker(): Promise<Worker> {
  if (testWorker) return testWorker;

  // Ensure temp directory exists
  await mkdir(TEMP_TEST_DIR, { recursive: true });

  const workerPath = getWorkerPath();

  testWorker = new Worker(workerPath, {
    workerData: { tempDir: TEMP_TEST_DIR },
  });

  testWorker.on('message', handleWorkerMessage);

  testWorker.on('error', (err: Error) => {
    console.error('[TestHandlers] Worker error:', err);
    sendToRenderer('test-runner:error', { message: err.message });
  });

  testWorker.on('exit', (code) => {
    console.log('[TestHandlers] Worker exited with code:', code);
    testWorker = null;
    isReady = false;
  });

  return testWorker;
}

function handleWorkerMessage(message: WorkerMessage): void {
  switch (message.type) {
    case 'ready':
      isReady = message.success ?? true;
      break;

    case 'test-start':
    case 'test-result':
      sendToRenderer('test-runner:result', {
        filePath: message.filePath ?? 'inline',
        test: message.test,
      });
      break;

    case 'complete':
      sendToRenderer('test-runner:complete', {
        filePath: message.filePath ?? 'inline',
        status: message.status,
      });
      break;

    case 'error':
      sendToRenderer('test-runner:error', {
        message: message.message,
      });
      break;

    case 'stopped':
      sendToRenderer('test-runner:stopped', {});
      break;
  }
}

function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ============================================================================
// INLINE TEST EXECUTION
// ============================================================================

/**
 * Run tests from inline code (playground mode)
 * Creates a temporary file with the test code and executes it
 */
async function runInlineTests(code: string): Promise<void> {
  const worker = await ensureWorker();

  // Create a unique temp file for this test run
  const testId = randomUUID();
  const tempFilePath = join(TEMP_TEST_DIR, `test-${testId}.test.ts`);

  try {
    // Wrap the code with necessary imports if not present
    let testCode = code;
    if (!code.includes("from 'vitest'") && !code.includes('from "vitest"')) {
      testCode = `import { describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';\n\n${code}`;
    }

    // Write the test file
    await writeFile(tempFilePath, testCode, 'utf-8');

    // Send to worker
    worker.postMessage({
      type: 'run',
      id: testId,
      filePath: tempFilePath,
      options: { coverage: false },
    });
  } catch (error) {
    sendToRenderer('test-runner:error', {
      message: `Failed to create test file: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Clean up temp test files
 */
async function cleanupTempTests(): Promise<void> {
  // Note: Full implementation would track and clean all temp files
  // For now, we rely on OS temp cleanup
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

export function registerTestHandlers(
  window: InstanceType<typeof BrowserWindow>
): void {
  mainWindow = window;

  /**
   * Run inline tests from editor code
   */
  ipcMain.handle(
    'test-runner:run-inline',
    async (_event: Electron.IpcMainInvokeEvent, code: string) => {
      await runInlineTests(code);
      return { success: true };
    }
  );

  /**
   * Run tests from a file path
   */
  ipcMain.handle(
    'test-runner:run',
    async (_event: Electron.IpcMainInvokeEvent, filePath?: string) => {
      const worker = await ensureWorker();
      const testId = randomUUID();

      worker.postMessage({
        type: 'run',
        id: testId,
        filePath,
        options: { coverage: false },
      });

      return { success: true, id: testId };
    }
  );

  /**
   * Run a single test by name
   */
  ipcMain.handle(
    'test-runner:run-single',
    async (
      _event: Electron.IpcMainInvokeEvent,
      filePath: string,
      testName: string
    ) => {
      const worker = await ensureWorker();
      const testId = randomUUID();

      worker.postMessage({
        type: 'run-single',
        id: testId,
        filePath,
        testName,
      });

      return { success: true, id: testId };
    }
  );

  /**
   * Stop running tests
   */
  ipcMain.on('test-runner:stop', async () => {
    if (testWorker) {
      testWorker.postMessage({ type: 'stop' });
    }
  });

  /**
   * Check if test runner is ready
   */
  ipcMain.handle('test-runner:is-ready', async () => {
    return { ready: isReady };
  });

  /**
   * Cleanup on app quit
   */
  ipcMain.on('test-runner:cleanup', async () => {
    await cleanupTempTests();
    if (testWorker) {
      testWorker.terminate();
      testWorker = null;
    }
  });

  console.log('[TestHandlers] Registered test runner IPC handlers');
}

/**
 * Shutdown test runner (call on app quit)
 */
export async function shutdownTestRunner(): Promise<void> {
  await cleanupTempTests();
  if (testWorker) {
    testWorker.terminate();
    testWorker = null;
  }
}
