/**
 * WASI C/C++ Executor Worker Thread
 *
 * Compiles C/C++ source code to `wasm32-wasip1` and executes the result via
 * Node's WASI runtime in an isolated worker.
 */

import { spawn, type ChildProcessByStdio } from 'node:child_process';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { WASI } from 'node:wasi';
import { parentPort } from 'worker_threads';
import { config as dotenvConfig } from 'dotenv';
import { expand as dotenvExpand } from 'dotenv-expand';
import {
  getMissingWasiToolchainMessage,
  resolveWasiToolchain,
} from './wasiToolchain.js';

type WasiLanguage = 'c' | 'cpp';
type ExecutionEnv = typeof process.env;

interface ExecuteOptions {
  timeout?: number;
  workingDirectory?: string;
}

interface ExecuteMessage {
  type: 'execute';
  id: string;
  code: string;
  language: WasiLanguage;
  options: ExecuteOptions;
}

interface CancelMessage {
  type: 'cancel';
  id: string;
}

type WorkerMessage = ExecuteMessage | CancelMessage;

interface ResultMessage {
  type: 'console' | 'error' | 'complete' | 'ready';
  id: string;
  data?: unknown;
  consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

let currentExecutionId: string | null = null;
let activeCompileProcess: ChildProcessByStdio<null, Readable, Readable> | null =
  null;

function postMessage(message: ResultMessage): void {
  parentPort?.postMessage(message);
}

function emitConsoleOutput(
  executionId: string,
  consoleType: 'log' | 'error',
  content: string
): void {
  const normalized = content.replace(/\r\n/g, '\n');
  for (const line of normalized.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    postMessage({
      type: 'console',
      id: executionId,
      consoleType,
      data: { content: line },
    });
  }
}

function loadExecutionEnv(workingDirectory?: string): ExecutionEnv {
  const processEnv = { ...process.env };
  if (!workingDirectory) {
    return processEnv;
  }

  try {
    const parsedEnv = dotenvConfig({
      path: path.join(workingDirectory, '.env'),
    });
    if (parsedEnv.parsed) {
      dotenvExpand(parsedEnv);
      return { ...processEnv, ...parsedEnv.parsed };
    }
  } catch (error) {
    console.warn('Failed to parse .env for WASI execution:', error);
  }

  return processEnv;
}

async function runCommand(
  command: string,
  args: string[],
  env: ExecutionEnv,
  workingDirectory?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const processHandle = spawn(command, args, {
      cwd: workingDirectory,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    activeCompileProcess = processHandle;

    let stdout = '';
    let stderr = '';

    processHandle.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    processHandle.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    processHandle.on('error', (error: Error) => {
      activeCompileProcess = null;
      reject(error);
    });

    processHandle.on('close', (exitCode: number | null) => {
      activeCompileProcess = null;
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          [stdout.trim(), stderr.trim()].filter(Boolean).join('\n').trim() ||
            `Compiler exited with code ${exitCode}`
        )
      );
    });
  });
}

function buildCompileCommand(
  language: WasiLanguage,
  sourcePath: string,
  outputPath: string,
  workingDirectory: string | undefined,
  env: ExecutionEnv
): { command: string; args: string[] } {
  const toolchain = resolveWasiToolchain();
  if (!toolchain) {
    throw new Error(getMissingWasiToolchainMessage());
  }

  const compiler = language === 'cpp' ? toolchain.clangxx : toolchain.clang;
  const args = [
    '--target=wasm32-wasip1',
    `--sysroot=${toolchain.sysroot}`,
    `-fuse-ld=${toolchain.wasmLd}`,
    language === 'cpp' ? '-std=c++17' : '-std=c11',
    '-O0',
  ];

  const includeDirectory = env.CHEESEJS_WASI_INCLUDE_DIR ?? workingDirectory;
  if (includeDirectory) {
    args.push('-I', includeDirectory);
  }

  args.push(sourcePath, '-o', outputPath);
  return { command: compiler, args };
}

async function runWasiModule(
  wasmPath: string,
  env: ExecutionEnv,
  workingDirectory?: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const stdoutPath = path.join(
    os.tmpdir(),
    `cheesejs-wasi-stdout-${Date.now()}.txt`
  );
  const stderrPath = path.join(
    os.tmpdir(),
    `cheesejs-wasi-stderr-${Date.now()}.txt`
  );

  const stdoutFd = fs.openSync(stdoutPath, 'w+');
  const stderrFd = fs.openSync(stderrPath, 'w+');

  try {
    const preopens = workingDirectory ? { '/workspace': workingDirectory } : {};
    const runtimeEnv = workingDirectory ? { ...env, PWD: '/workspace' } : env;

    const wasi = new WASI({
      version: 'preview1',
      args: ['program'],
      env: runtimeEnv,
      preopens,
      stdout: stdoutFd,
      stderr: stderrFd,
    });

    const wasm = await WebAssembly.compile(await fsp.readFile(wasmPath));
    const instance = await WebAssembly.instantiate(wasm, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    const exitCode = wasi.start(instance);
    return {
      exitCode,
      stdout: await fsp.readFile(stdoutPath, 'utf8'),
      stderr: await fsp.readFile(stderrPath, 'utf8'),
    };
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
    await fsp.rm(stdoutPath, { force: true }).catch(() => undefined);
    await fsp.rm(stderrPath, { force: true }).catch(() => undefined);
  }
}

async function executeCode(message: ExecuteMessage): Promise<void> {
  const { id, code, language, options } = message;
  const env = loadExecutionEnv(options.workingDirectory);
  const tempDirectory = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'cheesejs-wasi-')
  );

  currentExecutionId = id;

  try {
    const sourceFileName = language === 'cpp' ? 'program.cpp' : 'program.c';
    const sourcePath = path.join(tempDirectory, sourceFileName);
    const outputPath = path.join(tempDirectory, 'program.wasm');

    await fsp.writeFile(sourcePath, code, 'utf8');

    const compileCommand = buildCompileCommand(
      language,
      sourcePath,
      outputPath,
      options.workingDirectory,
      env
    );

    await runCommand(
      compileCommand.command,
      compileCommand.args,
      env,
      tempDirectory
    );

    const result = await runWasiModule(
      outputPath,
      env,
      options.workingDirectory
    );

    if (result.stdout) {
      emitConsoleOutput(id, 'log', result.stdout);
    }

    if (result.stderr) {
      emitConsoleOutput(id, 'error', result.stderr);
    }

    if (result.exitCode !== 0) {
      throw new Error(
        result.stderr.trim() || `Program exited with code ${result.exitCode}`
      );
    }

    postMessage({
      type: 'complete',
      id,
      data: { exitCode: result.exitCode },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    postMessage({
      type: 'error',
      id,
      data: {
        name: 'CompileError',
        message: `Compilation failed:\n${errorMessage}`,
      },
    });
  } finally {
    currentExecutionId = null;
    activeCompileProcess = null;
    await fsp
      .rm(tempDirectory, { recursive: true, force: true })
      .catch(() => undefined);
  }
}

function cancelExecution(message: CancelMessage): void {
  if (currentExecutionId !== message.id) {
    return;
  }

  if (activeCompileProcess) {
    activeCompileProcess.kill('SIGTERM');
  }
}

parentPort?.on('message', async (message: WorkerMessage) => {
  if (message.type === 'cancel') {
    cancelExecution(message);
    return;
  }

  await executeCode(message);
});

postMessage({ type: 'ready', id: 'wasi-worker' });
