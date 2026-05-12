# CheeseJS Architecture

CheeseJS is now organized as a Zero Native application with a React/Vite workbench and a small Zig host. The active app is intentionally layered: product features live in packages, native capability is exposed through explicit bridge contracts, and optional future systems such as assistants or package/runtime extensions must enter through extension points instead of directly wiring themselves into the UI.

## Runtime Shape

```
src-native/                  Zig native host
  main.zig                   App model, bridge policies, security
  runner.zig                 Runtime/platform bootstrap
  platform/                  Local native adapters needed for platform fixes

app.zon                      Zero Native manifest
build.zig(.zon)              Zig build graph and zero-native dependency

packages/
  core/                      host contracts, shared events, extension registry
  state/                     reusable Zustand slice helpers and stores
  languages/                 language descriptors and detection
  execution/                 execution engine contracts and metrics
  editor/                    Monaco editor integration
  runtime-shell/             result and input surfaces
  package-management/        package UI/bridges
  settings/                  settings tabs
  frontend/                  application shell components
  workbench/                 layout/error boundaries
  app/                       composition root and host adapters
```

## Host Boundary

The renderer does not call native globals directly. It goes through `packages/app/src/host/hostBridge.ts`, which selects the available host:

- Zero Native: `window.zero.invoke()` and built-in window commands.
- Browser/test fallback: in-browser JavaScript/TypeScript worker runner and Pyodide-backed Python execution.
- Legacy test globals: only where tests inject `window.codeRunner` or package-manager mocks.

The shared host contract is `packages/core/src/contracts/hostBridge.ts`. New native features must add a contract first, then implement a host adapter, then consume the adapter from UI packages.

## Zero Native Policy

`app.zon` is the source of truth for native permissions and navigation:

- `web_engine = "system"` is the default because it is the supported cross-platform Zero Native route.
- Linux native builds use WebKitGTK 6.0. Run `pnpm run native:check` before `pnpm dev` to verify host libraries.
- Linux links `src-native/platform/linux_gtk_host.c`, a local Zero Native 0.1.9 adapter copy. It keeps `GtkApplication` non-unique so local dev sessions create a resident window instead of exiting after DBus single-instance handoff.
- Windows uses the Zero Native system host path. `src-native/platform/windows_webview2_host.cpp` is a local adapter copy with forward declarations required for Windows cross-compilation on Zig/clang.
- Chromium/CEF is not used on Linux in this repo. Zero Native 0.1.9's Linux CEF host is not a real long-lived WebView host, so using it would produce a process that starts and shuts down immediately.
- macOS can opt into Chromium/CEF with `-Dweb-engine=chromium` and `pnpm run native:cef` when a bundled Chromium runtime is desired.
- Dev origin is `http://127.0.0.1:5173`.
- Production origin is `zero://app`.
- Bridge commands are default-deny and must be listed in `app.zon`.
- Window permission is scoped to the built-in close command.

## Startup Performance Policy

The Vite entry script must stay small enough for the native WebView startup path. Heavy subsystems are split out:

- Monaco editor/runtime payloads load through lazy editor chunks.
- Parser and ML language detection are kept off the synchronous startup path.
- Pyodide loads only when Python execution or package management needs it.

`pnpm run bundle:check` enforces a 250 KiB budget on the entry script referenced by `dist/index.html`.

## Extension Points

`packages/core/src/coreRuntime/coreRuntime.ts` combines the shared event bus and extension registry into the small core runtime surface. It deliberately does not own UI, execution engines, editor state, package management, or assistant behavior.

`packages/core/src/extensions/extensionRegistry.ts` defines the stable extension registry. Current capabilities are:

- `runtime`
- `language`
- `editor-command`
- `settings-tab`
- `package-manager`
- `theme`
- `assistant`

The `assistant` capability is only a future extension point. There is no active AI/RAG runtime wiring in the app.

## Validation

Use these commands for the active architecture:

```bash
pnpm run arch:check
pnpm run type-check
pnpm vitest run
pnpm run native:test
pnpm exec zero-native validate app.zon
pnpm run native:doctor
pnpm run native:build:windows
pnpm run build
pnpm run package:native
pnpm run bundle:check
pnpm exec playwright test
```

`native:test` uses `/tmp/cheesejs-zig-cache` because this checkout may live on an external filesystem where Zig's default atomic cache rename can fail.

From Linux, Windows compile coverage is available with:

```bash
pnpm run native:build:windows
```

macOS package verification must run on a macOS host or CI runner because Apple frameworks such as WebKit and AppKit are not available on Linux.
