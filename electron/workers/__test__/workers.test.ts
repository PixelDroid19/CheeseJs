/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { Worker } from 'worker_threads';
import path from 'path';

const JS_WORKER_PATH = path.resolve(
  __dirname,
  '../../../dist-electron/codeExecutor.js'
);
const PY_WORKER_PATH = path.resolve(
  __dirname,
  '../../../dist-electron/pythonExecutor.js'
);

// Helper to run code in a worker and gather results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runInWorker(workerPath: string, code: string, options: any = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Promise<any[]>((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: {
        nodeModulesPath: path.resolve(__dirname, '../../../node_modules'),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    const id = 'test-id-' + Math.random().toString(36).substring(2, 11);

    worker.on('message', (msg) => {
      if (msg.id === id) {
        if (msg.type === 'complete') {
          worker.terminate();
          resolve(results);
        } else if (msg.type === 'error') {
          results.push(msg);
          worker.terminate(); // Error is terminal
          resolve(results);
        } else {
          results.push(msg);
        }
      }
    });

    worker.on('error', (err) => {
      worker.terminate();
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0 && code !== 1) {
        // 1 is terminated
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });

    worker.postMessage({
      type: 'execute',
      id,
      code,
      options: { timeout: 5000, ...options },
    });
  });
}

describe('JS/TS Worker Integration (dist-electron)', () => {
  it('should execute simple JavaScript', async () => {
    const code = `
      const a = 10;
      const b = 20;
      console.log(a + b);
    `;
    const results = await runInWorker(JS_WORKER_PATH, code);

    const logs = results.filter((r) => r.type === 'console');
    expect(logs.length).toBe(1);
    expect(logs[0].data.content).toBe('30');
  });

  it('should handle errors gracefully', async () => {
    const code = `throw new Error('Test Error');`;
    const results = await runInWorker(JS_WORKER_PATH, code);

    const errors = results.filter((r) => r.type === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].data.message).toContain('Test Error');
  });

  it('should handle timeouts (infinite loop)', async () => {
    const code = `while(true) {}`;
    // Short timeout for test
    const results = await runInWorker(JS_WORKER_PATH, code, { timeout: 1000 });

    const errors = results.filter((r) => r.type === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].data.message).toMatch(/Time limit exceeded|timed out/i);
  }, 10000);

  it('should support debug() function', async () => {
    // The worker exposes a global debug(line, value)
    const code = `debug(1, 'test-debug');`;
    const results = await runInWorker(JS_WORKER_PATH, code);

    const debugs = results.filter((r) => r.type === 'debug');
    expect(debugs.length).toBe(1);
    expect(debugs[0].data.content).toBe('test-debug');
  });
});

describe('Python Worker Integration (dist-electron)', () => {
  // Increase timeout for Python initialization (Pyodide download/load)
  const PYTHON_TIMEOUT = 60000;

  it(
    'should execute simple Python',
    async () => {
      const code = `print(10 + 20)`;
      const results = await runInWorker(PY_WORKER_PATH, code, {
        timeout: 10000,
      });

      const logs = results.filter((r) => r.type === 'console');
      expect(logs.length).toBe(1);
      // Python print might include newline or be trimmed
      expect(logs[0].data.content.trim()).toBe('30');
    },
    PYTHON_TIMEOUT
  );

  it(
    'should handle Python syntax errors',
    async () => {
      const code = `print('unclosed string`;
      const results = await runInWorker(PY_WORKER_PATH, code);

      const errors = results.filter((r) => r.type === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].data.message || errors[0].data).toMatch(/SyntaxError/);
    },
    PYTHON_TIMEOUT
  );

  it(
    'should support standard library imports',
    async () => {
      const code = `
import math
print(math.pi)
    `;
      const results = await runInWorker(PY_WORKER_PATH, code);

      const logs = results.filter((r) => r.type === 'console');
      expect(logs.length).toBe(1);
      expect(parseFloat(logs[0].data.content)).toBeCloseTo(3.14159, 2);
    },
    PYTHON_TIMEOUT
  );
});
