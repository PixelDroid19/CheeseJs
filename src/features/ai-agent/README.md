# AI Agent Feature

## Overview

The AI Agent feature provides intelligent code assistance within CheeseJS. It is built using the Vercel AI SDK and integrates with Monaco Editor.

## Architecture

- **Feature-Based**: Located in `src/features/ai-agent`
- **Service Layer**: `aiService.ts` handles all AI provider interactions
- **Agent Runtime**: `agentRuntime.ts` resolves mode/profile, step limits, and system prompts
- **Tool Registry**: `toolRegistry.ts` contains tool definitions and permission-aware filtering
- **Agent Logic**: `codeAgent.ts` orchestrates provider + runtime + tools
- **Secure Transport**: `providers.ts` routes provider HTTP traffic through `window.aiProxy` (Electron main process)
- **Inline Completion**: `inlineCompletionProvider.ts` manages autocomplete logic

## Key Capabilities

1.  **Inline Autocomplete**: Fluid, low-latency code completion while typing.
2.  **Code Agent**: Chat interface capable of generating, refactoring, and explaining code.
3.  **Tool Usage**: The agent can perform editor/file actions (insert, replace, write/delete files).
4.  **Pre-Execution Approval**: Mutating tools (`replaceAll`, `insert`, `replaceSelection`, `writeFile`, `deleteFile`) require explicit user approval before execution.
5.  **Run Lifecycle Tracking**: Chat state tracks run status transitions (`accepted`, `running`, `completed`, `error`, `aborted`) for observability.
6.  **Policy Presets**: Runtime tool access can be constrained via presets:
  - `standard`: balanced default behavior
  - `safe`: blocks write/runtime groups
  - `readonly`: limits execution to analysis/workspace-oriented tools

## Performance Optimizations

- **Caching**: In-memory cache for inline completions (15s TTL).
- **Debouncing**: 800ms debounce on keystrokes to reduce API calls.
- **Resource Management**: Strict cleanup of AbortControllers and timers.
- **Prompt Engineering**: Optimized system prompts to reduce token usage and improve relevance.

## Ethics & Privacy

This implementation follows a "Privacy-First" approach:

- **Local LLM Support**: Fully compatible with Ollama and LM Studio. When using 'local' provider, data never leaves the user's machine.
- **User Control**: Explicit provider configuration (Local vs Cloud).
- **Transparency**: UI indicators clearly show when a cloud provider is active.
- **Safety**: Destructive actions (like "Replace All") require explicit user confirmation via a dialog.
- **Network Hardening**: Cloud provider calls are proxied via Electron main process with domain allowlisting and SSRF protections.

## Deployment

The feature is designed for:

- **Electron**: Works within the renderer process.
- **Security**: No sensitive API keys are hardcoded. Keys must be provided by the user via Settings.

## Usage

Import the public API from `index.ts`:

```typescript
import {
  createCodeAgent,
  createInlineCompletionProvider,
} from 'features/ai-agent';
```

## Testing

Run unit tests with:

```bash
npm run test
```
