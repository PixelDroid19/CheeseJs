# AI Agent Feature

## Overview

The AI Agent feature provides intelligent code assistance within CheeseJS. It is built using the Vercel AI SDK and integrates with Monaco Editor.

## Architecture

- **Feature-Based**: Located in `src/features/ai-agent`
- **Service Layer**: `aiService.ts` handles all AI provider interactions
- **Agent Logic**: `codeAgent.ts` implements the agentic behavior (tools, actions)
- **Inline Completion**: `inlineCompletionProvider.ts` manages autocomplete logic

## Key Capabilities

1.  **Inline Autocomplete**: Fluid, low-latency code completion while typing.
2.  **Code Agent**: Chat interface capable of generating, refactoring, and explaining code.
3.  **Tool Usage**: The agent can perform editor actions (insert, replace).

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
