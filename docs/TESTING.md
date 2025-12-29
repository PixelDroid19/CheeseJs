# Testing Strategy and Quality Assurance

## Overview

This document outlines the End-to-End (E2E) testing strategy for the JS Runner application, focusing on AI integration, Code Execution (Prompt/Alert), and System Performance.

## Test Environment

- **Framework**: Playwright (Electron)
- **File**: `tests/e2e-scenarios.spec.ts`
- **Execution**: `npx playwright test tests/e2e-scenarios.spec.ts`

## Test Cases & Acceptance Criteria

### 1. AI Interaction Flow (UI Validation)

- **Objective**: Verify that the AI Chat interface is accessible and responsive.
- **Steps**:
  1. Locate the AI/Chat toggle button.
  2. Click to open the panel.
  3. Verify the input area is visible.
- **Acceptance Criteria**:
  - AI Button is visible.
  - Chat panel opens with animation.
  - Input field (`data-testid="ai-chat-input"`) is visible and focused.

### 2. Prompt and Alert Flow (ConsoleInput)

- **Objective**: Validate the synchronous `prompt()` implementation using SharedArrayBuffer/Atomics.
- **Steps**:
  1. Execute JS code: `const name = prompt("Name?"); console.log("Welcome " + name);`
  2. Verify `ConsoleInput` component appears with the correct message.
  3. Enter text "PlaywrightUser" and submit.
  4. Verify the script resumes and outputs "Welcome PlaywrightUser".
- **Acceptance Criteria**:
  - Prompt UI replaces the blocking native prompt.
  - Input submission unblocks the worker thread.
  - Output matches the entered value.

### 3. Alert Flow

- **Objective**: Validate the synchronous `alert()` implementation.
- **Steps**:
  1. Execute JS code: `alert("Msg"); console.log("Done");`
  2. Verify `ConsoleInput` appears in Alert mode (distinct style).
  3. Click "OK" (Submit).
  4. Verify script resumes.
- **Acceptance Criteria**:
  - Alert UI is distinct (Amber color).
  - Script is paused until dismissal.
  - Script resumes immediately after dismissal.

### 4. Unicode Support (Python)

- **Objective**: Ensure multi-language and unicode character support.
- **Steps**:
  1. Execute Python code printing unicode characters (e.g., "🐍").
  2. Verify output in the console.
- **Acceptance Criteria**:
  - Output correctly renders "🐍" without encoding errors.

### 5. System Performance (Load Test)

- **Objective**: Validate renderer performance under high output load.
- **Steps**:
  1. Execute a script generating 10,000 lines of output.
  2. Measure time to render.
  3. Verify the last line is present.
- **Acceptance Criteria**:
  - Application does not crash.
  - Output is complete.
  - Rendering handles large buffers gracefully.

### 6. AI Chat Interaction (Mocked)

- **Objective**: Test the full AI response flow including tool usage.
- **Steps**:
  1. Open AI Chat.
  2. Type a query.
  3. Mock the AI response (since we can't rely on real API keys in CI).
  4. Verify the message appears in the chat list.
- **Acceptance Criteria**:
  - User message appears immediately.
  - AI response appears after generation.
  - Chat state is preserved or handled correctly.

## Quality Metrics

The following metrics are implicitly validated during test execution:

- **Success Rate**: 100% (All tests must pass).
- **Response Time**:
  - AI UI Open: < 1000ms
  - Prompt Appearance: < 500ms
  - Script Resume: < 200ms
- **Precision**: Output content must match expected strings exactly.
- **Error Handling**: System recovers from reloading and state clearing (`localStorage.clear()`).

## Running Tests

```bash
npm run test:e2e
# or
npx playwright test tests/e2e-scenarios.spec.ts
```
