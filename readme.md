# CheeseJS

CheeseJS is a modular native code workbench built with Zero Native, Zig, React, Vite, and Monaco. The project is structured around small packages, explicit host contracts, and extension points so runtimes, languages, themes, settings, package managers, and future assistant features can be added without coupling them directly to the UI.

## Features

- Native desktop shell through Zero Native and the platform system WebView.
- Layered package architecture under `packages/*`.
- Host bridge contract in `@cheesejs/core` with a Zero Native/browser adapter in `packages/app`.
- JavaScript, TypeScript, and Python execution through the host/browser runtime.
- Monaco editor, language detection, tabs, settings, snippets, package prompts, and result panel.
- Extension registry for runtimes, languages, editor commands, settings tabs, package managers, themes, and future assistant modules.
- No active AI/RAG runtime wiring.

## Requirements

- Node.js 20
- pnpm 10.30.0
- Zig 0.16.0+
- Linux native builds require WebKitGTK 6.0 development libraries (`webkitgtk-6.0` / `libwebkitgtk-6.0-dev`, depending on distro).
- Windows native builds use Zero Native's system host and are verified by the Windows CI runner.
- macOS can opt into Chromium/CEF with `pnpm run native:cef` and `-Dweb-engine=chromium`.

## Development

```bash
pnpm install
pnpm run native:check
pnpm run dev
```

`pnpm run dev` starts the Zero Native dev flow. Use `pnpm run dev:web` when you only need the web frontend or when a Linux machine is missing WebKitGTK 6.0.

The Vite dev command reuses an existing `http://127.0.0.1:5173/` server when one is already running, so rerunning the native shell does not fail on a busy port.

## Validation

```bash
pnpm run arch:check
pnpm run type-check
pnpm run test:coverage
pnpm run native:test
pnpm run native:validate
pnpm run native:doctor
pnpm run native:build:windows
pnpm run build
pnpm run package:native
pnpm run native:package:check
pnpm run bundle:check
pnpm exec playwright test
```

The native test command uses `/tmp/cheesejs-zig-cache` to avoid cache rename issues on external filesystems.

`pnpm run package:native` builds the frontend/native binary and writes a Zero Native artifact to `release/<platform>/`.

Use `pnpm run release:check` for the full local gate. macOS packaging still requires a macOS host or CI runner because Apple frameworks are not available on Linux.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
