import fs from 'node:fs';

export interface WasiToolchain {
  clang: string;
  clangxx: string;
  wasmLd: string;
  sysroot: string;
}

interface WasiToolchainCandidate extends WasiToolchain {
  label: string;
}

function isExecutableFile(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isReadableDirectory(directoryPath: string): boolean {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function getToolchainCandidates(): WasiToolchainCandidate[] {
  const envCandidate = {
    clang: process.env.CHEESEJS_WASI_CLANG,
    clangxx: process.env.CHEESEJS_WASI_CLANGXX,
    wasmLd: process.env.CHEESEJS_WASM_LD,
    sysroot: process.env.CHEESEJS_WASI_SYSROOT,
  };

  const candidates: WasiToolchainCandidate[] = [];

  if (
    envCandidate.clang &&
    envCandidate.clangxx &&
    envCandidate.wasmLd &&
    envCandidate.sysroot
  ) {
    candidates.push({
      label: 'CHEESEJS_WASI_* environment variables',
      clang: envCandidate.clang,
      clangxx: envCandidate.clangxx,
      wasmLd: envCandidate.wasmLd,
      sysroot: envCandidate.sysroot,
    });
  }

  candidates.push(
    {
      label: 'Homebrew Apple Silicon',
      clang: '/opt/homebrew/opt/llvm/bin/clang',
      clangxx: '/opt/homebrew/opt/llvm/bin/clang++',
      wasmLd: '/opt/homebrew/opt/lld/bin/wasm-ld',
      sysroot: '/opt/homebrew/share/wasi-sysroot',
    },
    {
      label: 'Homebrew Intel macOS',
      clang: '/usr/local/opt/llvm/bin/clang',
      clangxx: '/usr/local/opt/llvm/bin/clang++',
      wasmLd: '/usr/local/opt/lld/bin/wasm-ld',
      sysroot: '/usr/local/share/wasi-sysroot',
    },
    {
      label: 'Linux system toolchain',
      clang: '/usr/bin/clang',
      clangxx: '/usr/bin/clang++',
      wasmLd: '/usr/bin/wasm-ld',
      sysroot: '/usr/share/wasi-sysroot',
    }
  );

  return candidates;
}

export function resolveWasiToolchain(): WasiToolchain | null {
  for (const candidate of getToolchainCandidates()) {
    if (
      isExecutableFile(candidate.clang) &&
      isExecutableFile(candidate.clangxx) &&
      isExecutableFile(candidate.wasmLd) &&
      isReadableDirectory(candidate.sysroot)
    ) {
      return candidate;
    }
  }

  return null;
}

export function isWasiToolchainAvailable(): boolean {
  return resolveWasiToolchain() !== null;
}

export function getMissingWasiToolchainMessage(): string {
  return [
    'C/C++ WebAssembly toolchain not found.',
    'Install `llvm`, `lld`, `wasi-libc`, and `wasi-runtimes`, or set CHEESEJS_WASI_CLANG, CHEESEJS_WASI_CLANGXX, CHEESEJS_WASM_LD, and CHEESEJS_WASI_SYSROOT.',
  ].join(' ');
}
