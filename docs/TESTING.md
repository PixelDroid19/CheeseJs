# Testing Guide

This document describes the testing strategy and patterns used in CheeseJS.

## Overview

CheeseJS uses a multi-layer testing approach:

| Layer       | Tool       | Location                                 | Purpose                              |
| ----------- | ---------- | ---------------------------------------- | ------------------------------------ |
| Unit        | Vitest     | `src/__test__/`, `electron/**/__test__/` | Test individual functions/components |
| Integration | Vitest     | Same as unit                             | Test module interactions             |
| E2E         | Playwright | `tests/`                                 | Test full application flows          |

## Running Tests

### Quick Commands

```bash
# Run all unit/integration tests
pnpm test

# Run tests with watch mode
pnpm test -- --watch

# Run tests with coverage
pnpm run test:coverage

# Run tests with UI
pnpm run test:ui

# Run E2E tests
npx playwright test

# Run E2E with UI mode
npx playwright test --ui
```

### Running Specific Tests

```bash
# By file path
pnpm test src/__test__/babel-plugins.test.ts

# By pattern
pnpm test -- --grep "loop protection"

# By test name
pnpm test -- -t "should inject counter"
```

## Test Structure

### Unit Test Files

```
src/
├── __test__/
│   ├── babel-plugins.test.ts    # Babel plugin tests
│   ├── elementParser.test.ts    # Element parser tests
│   ├── ErrorBoundary.test.tsx   # Component tests
│   └── run.test.js              # Basic execution tests
├── store/
│   └── __tests__/
│       ├── useCodeStore.test.ts
│       └── useSettingsStore.test.ts

electron/
├── transpiler/
│   └── __test__/
│       └── transpiler.test.ts
├── workers/
│   └── __test__/
│       └── workers.test.ts
```

### E2E Test Files

```
tests/
├── app.spec.ts              # App launch, settings
├── execution.spec.ts        # Code execution
├── app-flow.spec.ts         # Cross-language workflow
├── language-detection.spec.ts
├── options.spec.ts
└── stability.spec.ts
```

## Writing Unit Tests

### Basic Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from '../myModule';

describe('myFunction', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should handle normal input', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle edge cases', () => {
    expect(myFunction('')).toBe('');
    expect(myFunction(null)).toBeNull();
  });
});
```

### Testing React Components

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Zustand Stores

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCodeStore } from '../useCodeStore';

describe('useCodeStore', () => {
  beforeEach(() => {
    // Reset store state
    useCodeStore.setState({
      code: '',
      result: [],
      isExecuting: false,
    });
    localStorage.clear();
  });

  it('should update code', () => {
    const { setCode } = useCodeStore.getState();

    setCode('const x = 5;');

    expect(useCodeStore.getState().code).toBe('const x = 5;');
  });

  it('should append results', () => {
    const { appendResult } = useCodeStore.getState();

    appendResult({
      element: { content: 'test' },
      type: 'execution',
      lineNumber: 1,
    });

    expect(useCodeStore.getState().result).toHaveLength(1);
  });
});
```

### Testing Babel Plugins

```typescript
import { describe, it, expect } from 'vitest';
import * as babel from '@babel/core';
import myPlugin from '../lib/babel/myPlugin';

function transform(code: string): string {
  const result = babel.transformSync(code, {
    plugins: [myPlugin],
    configFile: false,
  });
  return result?.code || '';
}

describe('myPlugin', () => {
  it('should transform code correctly', () => {
    const input = '
    const output = transform(input);

    expect(output).toContain('debug(');
    expect(output).not.toContain('
  });
});
```

## Writing E2E Tests

### Basic Pattern

```typescript
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

const APP_PATH = path.join(
  __dirname,
  '../release/1.1.0/win-unpacked/CheeseJS.exe'
);

test.describe('Feature', () => {
  test('should do something', async () => {
    const app = await electron.launch({ executablePath: APP_PATH });
    const window = await app.firstWindow();

    // Wait for app to load
    await window.waitForSelector('.monaco-editor');

    // Interact with the app
    await window.click('button[data-testid="run"]');

    // Assert results
    const result = await window.textContent('.result');
    expect(result).toContain('expected');

    await app.close();
  });
});
```

### Testing Code Execution

```typescript
test('should execute JavaScript', async () => {
  const app = await electron.launch({ executablePath: APP_PATH });
  const window = await app.firstWindow();

  // Clear editor and type code
  await window.keyboard.press('Control+a');
  await window.keyboard.type('

  // Run code
  await window.keyboard.press('Control+Enter');

  // Wait for result
  await window.waitForSelector('.result-line');

  const result = await window.textContent('.result');
  expect(result).toContain('Hello');

  await app.close();
});
```

## Mocking

### Mocking Modules

```typescript
import { vi, describe, it, expect } from 'vitest';

// Mock entire module
vi.mock('../myModule', () => ({
  myFunction: vi.fn(() => 'mocked'),
}));

// Mock specific export
vi.mock('../myModule', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    myFunction: vi.fn(() => 'mocked'),
  };
});
```

### Mocking Electron APIs

```typescript
// In src/__test__/__mocks__/
export const mockElectronAPI = {
  executeCode: vi.fn(),
  onExecutionResult: vi.fn(),
  installPackage: vi.fn(),
};

// In test
vi.mock('@/preload', () => ({
  electronAPI: mockElectronAPI,
}));
```

## Coverage

### Coverage Thresholds

Configured in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 70,
    statements: 70,
  },
}
```

### Viewing Coverage

```bash
# Generate coverage report
pnpm run test:coverage

# Open HTML report
open coverage/index.html
```

### Coverage Goals by Module

| Module         | Target | Priority                |
| -------------- | ------ | ----------------------- |
| Babel plugins  | 90%    | High                    |
| Zustand stores | 85%    | High                    |
| Transpilers    | 80%    | High                    |
| Utilities      | 75%    | Medium                  |
| Components     | 60%    | Medium                  |
| Workers        | 50%    | Low (hard to unit test) |

## Best Practices

### Do's

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Keep tests focused and atomic
- ✅ Test edge cases and error conditions
- ✅ Use `beforeEach` to reset state
- ✅ Mock external dependencies

### Don'ts

- ❌ Test internal implementation details
- ❌ Share state between tests
- ❌ Use arbitrary timeouts (prefer `waitFor`)
- ❌ Write flaky tests
- ❌ Ignore failing tests

### Test Naming

```typescript
// ✅ Good - describes behavior
it('should return empty array when input is null');
it('throws error when timeout exceeds limit');

// ❌ Bad - describes implementation
it('calls the map function');
it('sets isLoading to true');
```

## Debugging Tests

### Vitest

```bash
# Run with verbose output
pnpm test -- --reporter=verbose

# Run single test in debug mode
node --inspect-brk ./node_modules/vitest/vitest.mjs run src/__test__/my.test.ts
```

### Playwright

```bash
# Debug mode
npx playwright test --debug

# With trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## CI Integration

Tests run automatically on:

- Pull requests
- Push to main branch

Required checks:

- All unit tests pass
- Coverage thresholds met
- E2E tests pass

## Troubleshooting

### Common Issues

**"Cannot find module"**

- Ensure dependencies are installed: `pnpm install`
- Check import paths

**"Timeout exceeded"**

- Increase timeout: `test('name', async () => {...}, 30000)`
- Check for unresolved promises

**E2E test failures**

- Ensure app is built: `pnpm run build:win`
- Check app path in test config
- Look at screenshots in `test-results/`

### Getting Help

- Check existing tests for patterns
- Open an issue with test output
- Ask in discussions
