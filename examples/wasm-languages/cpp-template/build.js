/**
 * Build script for C++ WASM compilation with Emscripten
 * Cross-platform build helper
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, rm } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUILD_DIR = join(__dirname, 'runtime');
const SRC_FILE = join(__dirname, 'src', 'runtime.cpp');
const OUT_FILE = join(BUILD_DIR, 'runtime.wasm');

const CXXFLAGS = [
  '-std=c++17',
  '-O3',
  '-s WASM=1',
  '-s EXPORTED_FUNCTIONS=["_create_runtime","_destroy_runtime","_run_code","_get_stdout","_get_stderr"]',
  '-s EXPORTED_RUNTIME_METHODS=["cwrap","getValue","setValue","UTF8ToString","stringToUTF8"]',
  '-s MODULARIZE=1',
  '-s EXPORT_NAME="CppRuntime"',
];

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function clean() {
  try {
    await rm(BUILD_DIR, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function build() {
  console.log('Building C++ WASM module...');

  await ensureDir(BUILD_DIR);

  const emccFlags = CXXFLAGS.join(' ');
  const command = `emcc ${emccFlags} "${SRC_FILE}" -o "${OUT_FILE}"`;

  try {
    await execAsync(command);
    console.log('✓ Build complete:', OUT_FILE);
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--clean')) {
    await clean();
    console.log('✓ Clean complete');
    return;
  }

  await build();
}

main().catch(console.error);
