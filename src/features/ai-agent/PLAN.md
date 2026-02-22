# AI Agent Implementation Plan

## 1. Objectives and Functionality

The primary goal is to provide a robust, privacy-focused, and intelligent coding assistant for CheeseJS.

### Core Objectives

- **Code Autocomplete**: Low-latency, inline code suggestions using local or cloud models.
- **Intelligent Chat**: Context-aware chat agent capable of explaining, refactoring, and fixing code.
- **Agentic Capabilities**: Ability to perform actions on the editor (insert, replace, analyze) autonomously.
- **Privacy First**: Strong support for local LLMs (Ollama, LM Studio) ensuring code never leaves the machine if desired.
- **Performance**: Minimal impact on the editor's responsiveness.

### Specific Functionalities

- **Inline Completion**:
  - Debounced typing detection.
  - Caching of recent completions.
  - Clean text insertion (no markdown artifacts).
- **Chat Agent**:
  - Streaming responses.
  - Multi-turn conversation history.
  - Context injection (current file content, selected code).
- **Tools & Actions**:
  - `insertCode`: Insert code at cursor.
  - `replaceSelection`: Replace selected text.
  - `analyzeCode`: Read and analyze current editor content.
  - **Approval Workflow**: Explicit user approval for destructive actions.

## 2. Implementation Roadmap

### Phase 1: Foundation (Completed)

- [x] Feature-based architecture setup (`src/features/ai-agent`).
- [x] AI Service implementation using Vercel AI SDK.
- [x] Basic Agent Logic (`codeAgent.ts`).
- [x] Inline Completion Provider (`inlineCompletionProvider.ts`).
- [x] Unit Tests for core logic.

### Phase 2: Integration & UI (In Progress)

- [x] Connect `AIChat.tsx` to `codeAgent.ts`.
- [ ] Refine Tool Invocation UI (Approval flows).
- [ ] Add Privacy/Ethics indicators in UI.
- [ ] Implement "Stop Generation" functionality.

### Phase 3: Advanced Features (Planned)

- [ ] **RAG (Retrieval Augmented Generation)**: Index project files for better context.
- [ ] **Multi-file editing**: Allow agent to edit multiple files (requires architecture update).
- [ ] **Slash Commands**: `/explain`, `/fix`, `/refactor` shortcuts in chat.

### Phase 4: Production Readiness

- [ ] Deployment verification (Electron build).
- [ ] End-to-end testing.
- [ ] Performance profiling.

## 3. Algorithms & Models

### Model Strategy

- **Local (Recommended)**:
  - Model: `qwen2.5-coder-7b` or `deepseek-coder-v2`.
  - Server: Ollama or LM Studio compatible server.
  - Benefits: 100% Privacy, Free, Low latency (hardware dependent).
- **Cloud (Optional)**:
  - Providers: OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet).
  - Benefits: Higher reasoning capability for complex tasks.

### Algorithms

- **Completion Cleaning**: Heuristic-based cleaning to remove "Here is the code" prefixes and markdown blocks.
- **Context Management**: Sliding window context for chat history to manage token limits.
- **Debouncing**: Adaptive debouncing for inline completion (800ms wait time).

## 4. Validation & Testing Strategy

- **Unit Tests**: Vitest for utility functions (cleaning, prompts).
- **Integration Tests**: Mocked AI provider tests to verify agent tool calling flow.
- **Manual Verification**:
  - Check latency of inline completion.
  - Verify tool approval dialogs appear.
  - Verify "Deny" action prevents code changes.

## 5. Ethics & Privacy

### Principles

1.  **User Control**: User explicitly chooses the provider.
2.  **Transparency**: UI clearly indicates if code is being sent to a cloud provider.
3.  **Safety**: Destructive actions (code replacement) require explicit user approval (Human-in-the-loop).

### Implementation

- Default to `local` provider.
- Visual indicator for "Offline/Local" vs "Cloud" mode.
- System prompts include instructions to avoid generating malicious code.

## 6. Deployment Environment

- **Target**: Electron (Windows/macOS/Linux).
- **Requirements**:
  - Node.js environment in Main process.
  - Network access for Cloud providers (if enabled).
  - Localhost access for Local providers.
- **Packaging**:
  - `electron-builder` handles bundling.
  - Secrets (API Keys) are stored in user's local storage (encrypted if possible, currently local storage).
