# CheeseJS Agent Notes

## Toolchain truth

- Use `pnpm` (repo is pinned to `pnpm@10.30.0` in `package.json`; workspace now includes root app plus `packages/*`).
- Use Node 20 when reproducing CI behavior (`.github/workflows/build.yml`).
- Root README files show `npm` examples; prefer `pnpm` commands from scripts/CI.

## Runtime map (entrypoints that matter)

- Renderer app starts at `packages/app/src/main.tsx` -> `packages/app/src/AppWrapper.tsx` -> `packages/app/src/App.tsx`.
- Electron main process starts at `electron/main.ts` (window creation, worker pool, IPC registration).
- Renderer/main bridge is `electron/preload.ts` (defines `window.codeRunner`, `window.packageManager`, `window.pythonPackageManager`, `window.lspConfig`, `window.lspBridge`, `window.electronAPI`).
- Package ownership is now centered under `packages/*`; renderer host composition lives in `packages/app/src/`.

## Verified dev commands

- Install: `pnpm install`
- Dev app: `pnpm dev`
- Lint: `pnpm lint`
- Type-check: `pnpm type-check`
- Format check: `pnpm format:check`
- Unit tests (one-shot): `pnpm vitest run`
- Single unit test file: `pnpm vitest run path/to/file.test.ts`
- Coverage gate: `pnpm test:coverage`
- Built worker integration tests: `pnpm test:workers`
- E2E (Playwright Electron): build first, then run tests
  - `pnpm build:dist`
  - `pnpm exec playwright test` (or pass a specific `tests/*.spec.ts` file)

## Gotchas that prevent common breakage

- `pnpm quality` ends with `vitest` (watch mode locally). For non-interactive runs, use `pnpm vitest run` (or `CI=1 pnpm quality`).
- Local builds need extra heap. Use repo scripts (`build:vite`, `build:dist`, `build`) instead of raw `vite build`.
- Keep explicit `.js` import extensions in `electron/**/*.ts` local imports (ESM output expects this).
- When changing IPC/preload APIs, update both implementation and renderer typings:
  - main/preload side: `electron/preload.ts` and `electron/core/handlers/*`
  - renderer typing side: `packages/app/src/types.d.ts` and related files under `packages/app/src/types/`
- The AI and RAG subsystems have been removed from the active app/runtime; do not reintroduce old AI/knowledge-base renderer flows or Electron wiring unless explicitly requested.
- Root legacy `src/` renderer shims have been removed; new renderer code belongs in `packages/app/src/` or another dedicated package, not in a recreated root `src/`.
- Filesystem IPC is intentionally workspace-scoped and blocks sensitive files (`electron/core/handlers/FilesystemHandlers.ts`); preserve these restrictions.
- `.env` loading for executed JS/Python code depends on Settings `workingDirectory` and is applied inside workers (`electron/workers/codeExecutor.ts`, `electron/workers/pythonExecutor.ts`).

## Commit/CI constraints

- Pre-commit hook runs `lint-staged` (`.husky/pre-commit`).
- Commit messages must satisfy conventional commitlint (`.husky/commit-msg`, `commitlint.config.js`).
- CI quality gate runs `lint` -> `type-check` -> `test:coverage` (then release job).

## Existing instruction files

- `.github/copilot-instructions.md` is Copilot-specific SDD orchestration guidance; for OpenCode work, treat repo scripts and CI config as source of truth.
