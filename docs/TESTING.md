# Testing Strategy and Quality Assurance

## Overview

This document outlines the testing strategy for CheeseJS after the Zero Native migration. The active quality gate focuses on package-level unit tests, architecture boundaries, the Vite frontend build, and headless Zig validation.

## Test Environment

- **Unit framework**: Vitest
- **Native framework**: Zero Native `NullPlatform` through `zig build test`
- **Manifest validation**: `zero-native validate app.zon`
- **Native diagnostics**: `zero-native doctor --manifest app.zon`
- **Frontend build**: Vite production build into `dist/`
- **Bundle budget**: entry script size guard after frontend build
- **Native packaging**: Zero Native package output under `release/<platform>/`; Windows may use the repo fallback directory writer when the host-side Zero Native package shortcut exits without an artifact.

## Test Cases & Acceptance Criteria

### 1. Host Bridge

- **Objective**: Validate that renderer code consumes native capabilities through `hostBridge`.
- **Steps**:
  1. Run `pnpm vitest run packages/app/src/host/hostBridge.test.ts`.
  2. Verify host globals can be swapped in tests.
  3. Verify external links route through the host adapter.
- **Acceptance Criteria**:
  - Components do not import native globals directly.
  - Browser/test fallback remains usable.

### 2. Extension Registry

- **Objective**: Validate modular contribution registration.
- **Steps**:
  1. Run `pnpm vitest run packages/core/src/extensions/extensionRegistry.test.ts`.
  2. Verify duplicate identifiers are rejected.
  3. Verify extensions can be disabled without removal.
- **Acceptance Criteria**:
  - Extension IDs remain unique.
  - Capability filtering is deterministic.

### 3. Native Host

- **Objective**: Validate the Zig app model and bridge metadata without launching a GUI.
- **Steps**:
  1. Run `pnpm run native:test`.
  2. Run `pnpm exec zero-native validate app.zon`.
  3. Run `pnpm run native:doctor`.
- **Acceptance Criteria**:
  - `app.zon` is valid.
  - Zero Native reports the platform WebView environment as available.
  - Headless Zig tests pass on `NullPlatform`.

### 4. Frontend Build

- **Objective**: Ensure the workbench bundles as Zero Native frontend assets.
- **Steps**:
  1. Run `pnpm run build:frontend`.
  2. Confirm `dist/index.html` and asset chunks are generated.
- **Acceptance Criteria**:
  - Vite build exits successfully.
  - The output directory matches `app.zon` `.frontend.dist`.

### 5. Native Package

- **Objective**: Ensure a runner can produce the native distributable for its platform.
- **Steps**:
  1. Run `pnpm run package:native`.
  2. Run `pnpm run native:package:check`.
  3. Confirm `release/<platform>/` contains the native executable and packaged frontend resources.
- **Acceptance Criteria**:
  - Build and package commands exit successfully.
  - Linux output contains `release/linux/bin/cheesejs` and `release/linux/resources/dist/index.html`.
  - Windows output contains `release/windows/bin/cheesejs.exe`.
  - macOS output contains `release/macos/CheeseJS.app/Contents/MacOS/cheesejs`.
  - Package manifest includes the target, app id, system web engine, and bridge/webview capabilities.

### 6. Bundle Budget

- **Objective**: Keep heavy editor/runtime dependencies off the startup path.
- **Steps**:
  1. Run `pnpm run build:frontend`.
  2. Run `pnpm run bundle:check`.
- **Acceptance Criteria**:
  - The Vite entry script referenced by `dist/index.html` stays below 250 KiB.
  - Monaco, parser, Pyodide, and VS Code/LSP payloads remain split into lazy/vendor chunks.

### 7. Cross-Platform Compile Checks

- **Objective**: Catch native source breakage before platform-specific release jobs.
- **Steps**:
  1. On Linux, run `zig build -Dtarget=x86_64-windows-gnu -Dplatform=windows -Dweb-engine=system --cache-dir /tmp/cheesejs-zig-cache --global-cache-dir /tmp/cheesejs-zig-global-cache`.
  2. On Linux, run `pnpm run native:package:windows` to build the frontend, cross-compile the Windows binary, package it with Zero Native, and verify the Windows artifact layout.
  3. Use the GitHub Actions release matrix for real Linux, macOS, and Windows package verification.
  4. After GitHub authentication is available, run `pnpm run ci:platforms:check` to verify that the latest `build.yml` run completed successfully for `ubuntu-latest`, `macos-latest`, and `windows-latest`.
- **Acceptance Criteria**:
  - Windows cross-compile succeeds from Linux.
  - Windows directory packaging passes `scripts/check-native-package.mjs windows`.
  - macOS is verified on the `macos-latest` runner because Apple frameworks are not available on Linux.
  - `pnpm run ci:platforms:check` passes against a completed GitHub Actions run before claiming cross-platform release readiness.

## Quality Metrics

The following metrics are implicitly validated during test execution:

- **Success Rate**: 100% (All tests must pass).
- **Architecture**: host globals are confined to `packages/app/src/host/`.
- **Native policy**: `app.zon` validates before packaging.
- **Build integrity**: Vite emits production assets into `dist/`.
- **Release integrity**: native package output is generated by Zero Native or the Windows fallback package writer, not Electron Builder.
- **Regression control**: focused unit tests cover host bridge and extension registry behavior.

## Running Tests

```bash
pnpm run quality
pnpm run native:build:windows
pnpm run native:package:windows
pnpm run package:native
pnpm run native:package:check
pnpm run bundle:check
pnpm exec playwright test
pnpm run ci:platforms:check
```

Use `pnpm run release:check` when you want the local release gate in one command. It runs the quality gate, builds and packages the native app for the current host, verifies the native package artifact, cross-builds and verifies the Windows package from Linux, checks the startup bundle budget, and runs the Playwright E2E smoke against the built frontend.
