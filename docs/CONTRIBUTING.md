# Contributing to CheeseJS

Thank you for your interest in contributing to CheeseJS! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Code Style](#code-style)

## Code of Conduct

Please read and follow our [Code of Conduct](../CODE_OF_CONDUCT.md).

## Development Setup

### Prerequisites

- **Node.js** 20.x or higher
- **pnpm** 9.x or higher
- **Git**

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/PixelDroid19/CheeseJs.git
cd CheeseJs

# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

### Development Commands

| Command                  | Description                      |
| ------------------------ | -------------------------------- |
| `pnpm run dev`           | Start Vite dev server + Electron |
| `pnpm run build:dist`    | Build Vite only                  |
| `pnpm run build:win`     | Build Windows installer          |
| `pnpm test`              | Run Vitest tests                 |
| `pnpm run test:ui`       | Run tests with UI                |
| `pnpm run test:coverage` | Run tests with coverage          |
| `pnpm run lint`          | Run ESLint                       |
| `pnpm run lint:fix`      | Fix ESLint issues                |
| `pnpm run format`        | Format code with Prettier        |
| `pnpm run type-check`    | TypeScript type checking         |
| `pnpm run quality`       | Run lint + format check + test   |

## Project Structure

```
├── electron/           # Main process code
│   ├── main.ts         # Entry point
│   ├── preload.ts      # Context bridge
│   ├── core/           # Core modules
│   ├── transpiler/     # Code transformation
│   ├── workers/        # Execution workers
│   └── packages/       # Package management
├── src/                # Renderer process (React)
│   ├── components/     # UI components
│   ├── hooks/          # Custom hooks
│   ├── store/          # Zustand stores
│   ├── lib/            # Utilities
│   │   └── babel/      # Babel plugins
│   └── themes/         # Editor themes
├── tests/              # E2E tests (Playwright)
└── docs/               # Documentation
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feat/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring
- `test/description` - Test additions/changes
- `chore/description` - Maintenance tasks

### Making Changes

1. Create a branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes following the [code style](#code-style)

3. Write tests for new functionality

4. Ensure all checks pass:

   ```bash
   pnpm run quality
   ```

5. Commit your changes following [commit guidelines](#commit-guidelines)

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/). All commits must follow this format:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type       | Description                         |
| ---------- | ----------------------------------- |
| `feat`     | New feature                         |
| `fix`      | Bug fix                             |
| `docs`     | Documentation only                  |
| `style`    | Code style (formatting, semicolons) |
| `refactor` | Code refactoring                    |
| `perf`     | Performance improvement             |
| `test`     | Adding/updating tests               |
| `build`    | Build system changes                |
| `ci`       | CI/CD changes                       |
| `chore`    | Maintenance                         |
| `revert`   | Revert a commit                     |

### Examples

```bash
# Feature
git commit -m "feat(editor): add syntax highlighting for Python"

# Bug fix
git commit -m "fix(worker): prevent memory leak in code executor"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Breaking change
git commit -m "feat(api)!: change execution result format

BREAKING CHANGE: Result object structure has changed"
```

### Pre-commit Hooks

Commits are automatically validated:

1. **lint-staged**: Runs ESLint and Prettier on staged files
2. **commitlint**: Validates commit message format

If a hook fails, fix the issues and try again.

## Pull Request Process

1. **Update documentation** if adding/changing features

2. **Add tests** for new functionality

3. **Ensure CI passes**:
   - All tests pass
   - No lint errors
   - Type checking passes

4. **Request review** from maintainers

5. **Address feedback** promptly

### PR Title Format

Follow the same format as commits:

```
feat(scope): description
```

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)
```

## Testing

### Unit Tests

Located in `src/__test__/` and `electron/**/__test__/`:

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm run test:coverage

# Run specific test file
pnpm test src/__test__/babel-plugins.test.ts

# Run with UI
pnpm run test:ui
```

### E2E Tests

Located in `tests/`:

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npx playwright test

# Run with UI mode
npx playwright test --ui
```

### Writing Tests

```typescript
// Unit test example
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myModule';

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

See [TESTING.md](./TESTING.md) for detailed testing guidelines.

## Code Style

### TypeScript

- Use TypeScript for all new code
- Enable strict type checking
- Prefer interfaces over types for object shapes
- Use explicit return types for exported functions

### React

- Functional components only
- Use hooks for state and effects
- Extract reusable logic into custom hooks
- Lazy load heavy components

### Naming Conventions

| Element          | Convention      | Example            |
| ---------------- | --------------- | ------------------ |
| Files            | kebab-case      | `my-component.tsx` |
| Components       | PascalCase      | `MyComponent`      |
| Functions        | camelCase       | `myFunction`       |
| Constants        | SCREAMING_SNAKE | `MAX_RESULTS`      |
| Types/Interfaces | PascalCase      | `MyInterface`      |

### Import Order

1. Node.js built-ins
2. External packages
3. Internal modules (absolute)
4. Relative imports
5. Type imports

```typescript
import path from 'node:path';

import { useState } from 'react';
import { create } from 'zustand';

import { WorkerPoolManager } from '@/core';

import { myUtil } from '../utils';

import type { MyType } from './types';
```

### File Organization

```typescript
// 1. Imports
import ...

// 2. Types/Interfaces
interface Props { ... }

// 3. Constants
const MAX_VALUE = 100;

// 4. Helper functions
function helper() { ... }

// 5. Main export
export function Component() { ... }
```

## Questions?

- Open an [issue](https://github.com/PixelDroid19/CheeseJs/issues) for bugs or features
- Start a [discussion](https://github.com/PixelDroid19/CheeseJs/discussions) for questions

Thank you for contributing! 🧀
