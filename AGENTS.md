# CheeseJS Agent Notes

## Toolchain truth

- Use `pnpm` (repo is pinned to `pnpm@10.30.0` in `package.json`).
- Use Node 20 when reproducing CI behavior (`.github/workflows/build.yml`).
- Use Zero Native plus Zig for the native shell. Do not add another desktop shell.

## Runtime map

- Renderer app starts at `packages/app/src/main.tsx` -> `packages/app/src/AppWrapper.tsx` -> `packages/app/src/App.tsx`.
- Native shell starts at `src-native/main.zig`; reusable host setup lives in `src-native/runner.zig`.
- Host access goes through `packages/app/src/host/hostBridge.ts` and the shared contract in `packages/core/src/contracts/hostBridge.ts`.
- Browser/runtime fallback execution lives in `packages/app/src/host/browserRuntimeBridge.ts`.
- Core extension and event composition lives in `packages/core/src/coreRuntime/coreRuntime.ts`.
- Shared Zustand helpers and persisted app slices live in `packages/state/src/`; do not put app state back into `packages/core/src/`.
- Package ownership is centered under `packages/*`; renderer composition lives in `packages/app/src/`.

## Verified commands

- Install: `pnpm install`
- Native host prerequisite check: `pnpm run native:check`
- Dev app: `pnpm dev`
- Lint: `pnpm lint`
- Type-check: `pnpm type-check`
- Format check: `pnpm format:check`
- Unit tests: `pnpm vitest run`
- Coverage gate: `pnpm test:coverage`
- Native headless tests: `pnpm run native:test`
- Windows native cross-build from Linux: `pnpm run native:build:windows`
- Windows native package from Linux: `pnpm run native:package:windows`
- Native manifest validation: `pnpm run native:validate`
- Native doctor: `pnpm run native:doctor`
- Release build: `pnpm run build`
- Native package: `pnpm run package:native`
- Native package artifact check: `pnpm run native:package:check`
- Bundle budget check: `pnpm run bundle:check`
- Full release verification: `pnpm run release:check`
- GitHub Actions platform evidence: `pnpm run ci:platforms:check`
- E2E against built `dist`: `pnpm exec playwright test`

## Architecture constraints

- Keep new renderer code in `packages/app/src/` or another dedicated package. Do not recreate root `src/` shims.
- Keep host capabilities behind `HostBridge`; UI code should not read native globals directly.
- Keep `@cheesejs/core` focused on contracts, events, extension metadata, logging, persistence adapters, and small cross-cutting utilities.
- Put reusable state stores and state helpers in `@cheesejs/state`; feature packages may depend on that package when they need shared store types.
- Active executable runtimes are JavaScript, TypeScript, and Python. Other languages may be detected for editor support without promising execution.
- AI/RAG is not part of the active runtime. Future assistant behavior must enter through extension contracts, not direct UI/runtime wiring.
- Run `pnpm run arch:check` after changing package boundaries, host access, or extension capability definitions.
- `native:test` intentionally uses `-Dplatform=null`; desktop web engines must not be required for headless native tests.

## Build notes

- The default native build uses Zero Native's system WebView route.
- Linux requires GTK4 and WebKitGTK 6.0 development libraries. `pnpm run native:check` gives distro-specific install hints.
- Do not use Chromium/CEF on Linux with Zero Native 0.1.9; its Linux CEF host is not a real long-lived WebView host.
- `pnpm run native:cef` is only for optional macOS Chromium-backed builds.
- Local builds need extra heap. Use repo scripts (`build:vite`, `build:frontend`, `build`) instead of raw `vite build`.
- Packaging uses Zero Native artifacts under `release/<platform>/`; Windows may use the repo fallback directory writer if the host-side Zero Native package shortcut exits without an artifact. Do not restore Electron Builder release paths.
- Keep the Vite entry script below the bundle budget. Heavy editor/runtime dependencies must stay lazy or vendor-split.

## Commit/CI constraints

- Pre-commit hook runs `lint-staged` (`.husky/pre-commit`).
- Commit messages must satisfy conventional commitlint (`.husky/commit-msg`, `commitlint.config.js`).
- CI quality gate and local `pnpm run quality` run native prerequisite validation, manifest validation, Zero Native doctor diagnostics, lint, architecture, format, type-check, coverage, and native headless tests.
- CI release matrix runs `pnpm run package:native` on Linux, macOS, and Windows runners. Use `pnpm run ci:platforms:check` after GitHub authentication is valid to verify the latest matrix run.

## Existing instruction files

- `.github/copilot-instructions.md` is Copilot-specific SDD orchestration guidance; for OpenCode work, treat repo scripts and CI config as source of truth.
