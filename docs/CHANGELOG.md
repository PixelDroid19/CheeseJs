# Changelog

All notable changes to CheeseJS will be documented in this file.

## [Unreleased]

### Added

- Zero Native app manifest in `app.zon`.
- Zig native shell in `src-native/main.zig` and `src-native/runner.zig`.
- Zig package dependency on `zero-native` v0.1.9 through `build.zig.zon`.
- Host bridge contract in `packages/core/src/contracts/hostBridge.ts`.
- Zero Native/browser host adapter in `packages/app/src/host/hostBridge.ts`.
- Browser-worker JavaScript/TypeScript execution fallback for development and tests.
- Core extension registry for runtimes, languages, editor commands, settings tabs, package managers, themes, and future assistant modules.
- Architecture guard script: `pnpm run arch:check`.
- Native prerequisite check: `pnpm run native:check`.
- Web-only development fallback: `pnpm run dev:web`.
- Cross-platform release helpers: `pnpm run native:build:windows` and `pnpm run release:check`.
- Platform icon assets for macOS, Windows, and Linux packaging.
- Local Linux GTK host adapter for Zero Native 0.1.9 so Linux dev windows stay resident instead of exiting after DBus single-instance handoff.
- Vite dev server wrapper that reuses an existing `127.0.0.1:5173` server instead of failing the native dev flow on reruns.
- Native package artifact verifier for executable, frontend assets, manifests, and core Zero Native metadata.
- macOS package output now uses `release/macos/CheeseJS.app`, matching the native app bundle layout.

### Changed

- Active development flow now targets Zero Native instead of a bundled browser runtime.
- Linux native builds now target Zero Native's supported system WebView route instead of the incomplete Linux CEF shim.
- Vite config is frontend-only and emits production assets to `dist/`.
- Quality script now runs native prerequisite validation, manifest validation, lint, architecture checks, formatting, type checks, coverage, and headless native tests.
- Documentation now describes the Zero Native layered architecture.

### Removed

- Active package scripts and dependencies for the previous desktop host.
- Public README references to the previous project origin.

### Security

- Native bridge commands are default-deny through `app.zon`.
- App navigation is allowlisted to `zero://app` and `http://127.0.0.1:5173`.
- Future assistant support is represented only as an extension capability, with no active AI/RAG runtime wiring.
