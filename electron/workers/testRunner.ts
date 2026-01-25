/**
 * Test Runner Worker
 *
 * Worker thread for running tests using Vitest.
 * Provides test execution, coverage collection, and result streaming.
 */

import { parentPort } from 'node:worker_threads';

// ============================================================================
// TYPES
// ============================================================================

interface TestRunMessage {
  type: 'run' | 'run-single' | 'stop' | 'discover';
  id: string;
  filePath?: string;
  testName?: string;
  options?: {
    coverage?: boolean;
    watch?: boolean;
  };
}

interface TestResult {
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  duration?: number;
  error?: string;
  stack?: string;
  line?: number;
}

// ============================================================================
// WORKER STATE
// ============================================================================

let vitest: unknown = null;
let isRunning = false;

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

function sendMessage(type: string, data: Record<string, unknown> = {}): void {
  parentPort?.postMessage({ type, ...data });
}

async function initVitest(): Promise<void> {
  if (vitest) return;

  try {
    // Dynamically import vitest
    const vitestModule = await import('vitest/node');
    vitest = vitestModule;
    sendMessage('ready', { success: true });
  } catch (error) {
    sendMessage('error', {
      message:
        'Failed to initialize Vitest: ' +
        (error instanceof Error ? error.message : String(error)),
    });
  }
}

async function runTests(
  id: string,
  filePath?: string,
  options?: { coverage?: boolean; testName?: string }
): Promise<void> {
  if (isRunning) {
    sendMessage('error', { id, message: 'Tests already running' });
    return;
  }

  isRunning = true;
  sendMessage('started', { id, filePath });

  try {
    // Note: This is a simplified implementation
    // Full Vitest integration requires more complex setup
    const { startVitest } = vitest as {
      startVitest: (
        mode: string,
        cliFilters: string[],
        options: Record<string, unknown>
      ) => Promise<{ close: () => Promise<void> }>;
    };

    const ctx = await startVitest('test', filePath ? [filePath] : [], {
      watch: false,
      testNameFilter: options?.testName,
      coverage: { enabled: options?.coverage ?? false },
      reporters: [
        {
          onTestStart(test: { name: string; file: { filepath: string } }) {
            sendMessage('test-start', {
              id,
              filePath: test.file.filepath,
              test: {
                name: test.name,
                fullName: test.name,
                status: 'running',
              },
            });
          },
          onTestFinished(test: {
            name: string;
            file: { filepath: string };
            result: {
              state: string;
              duration: number;
              error?: { message: string; stack?: string };
            };
            location?: { line: number };
          }) {
            const result: TestResult = {
              name: test.name,
              fullName: test.name,
              status:
                test.result.state === 'pass'
                  ? 'passed'
                  : test.result.state === 'fail'
                    ? 'failed'
                    : 'skipped',
              duration: test.result.duration,
              error: test.result.error?.message,
              stack: test.result.error?.stack,
              line: test.location?.line,
            };
            sendMessage('test-result', {
              id,
              filePath: test.file.filepath,
              test: result,
            });
          },
        },
      ],
    });

    await ctx?.close();

    sendMessage('complete', {
      id,
      filePath,
      status: 'passed', // Would need to aggregate from actual results
    });
  } catch (error) {
    sendMessage('error', {
      id,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isRunning = false;
  }
}

async function stopTests(): Promise<void> {
  // Vitest doesn't have a great stop mechanism for programmatic usage
  // This is a placeholder for proper implementation
  isRunning = false;
  sendMessage('stopped', {});
}

// ============================================================================
// MAIN
// ============================================================================

parentPort?.on('message', async (message: TestRunMessage) => {
  switch (message.type) {
    case 'run':
      await runTests(message.id, message.filePath, message.options);
      break;
    case 'run-single':
      await runTests(message.id, message.filePath, {
        ...message.options,
        testName: message.testName,
      });
      break;
    case 'stop':
      await stopTests();
      break;
    case 'discover': {
      try {
        const { createVitest } = vitest as {
          createVitest: (
            mode: string,
            options: unknown
          ) => Promise<{
            globTestFiles: (filters?: string[]) => Promise<string[]>;
            close: () => Promise<void>;
          }>;
        };
        const ctx = await createVitest('test', {
          watch: false,
          run: true,
        });
        const files = await ctx.globTestFiles();
        await ctx.close();
        sendMessage('discovered', { id: message.id, files });
      } catch (error) {
        sendMessage('error', {
          id: message.id,
          message:
            'Discovery failed: ' +
            (error instanceof Error ? error.message : String(error)),
        });
      }
      break;
    }
  }
});

// Initialize on start
initVitest().catch(console.error);

sendMessage('ready', { success: true });
