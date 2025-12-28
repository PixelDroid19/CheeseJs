# Changelog

All notable changes to CheeseJS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Development Workflow Improvements**
  - Git hooks configuration with husky and lint-staged
  - Commit message validation with commitlint (conventional commits)
  - EditorConfig for cross-editor consistency
  - TypeScript type-check script (`pnpm run type-check`)
  - Test coverage reporting (`pnpm run test:coverage`)
  - Test UI mode (`pnpm run test:ui`)

- **Code Quality**
  - Extended ESLint configuration to include `electron/` directory
  - Prettier formatting for electron files
  - lint-staged pre-commit hooks for automatic formatting

- **Testing**
  - Comprehensive unit tests for Babel plugins
  - Unit tests for Zustand stores (useCodeStore)
  - Transpiler pattern tests
  - Improved test coverage infrastructure

- **Architecture**
  - Modular core modules (`electron/core/`)
    - `WorkerPoolManager`: Centralized worker lifecycle management
    - `IPCHandlers`: IPC handler registration module
    - `WindowManager`: Window creation and management
  - Shared code transforms (`electron/transpiler/codeTransforms.ts`)
    - DRY implementation for console transform, loop protection, expression wrapping

- **Documentation**
  - `docs/ARCHITECTURE.md`: Technical architecture documentation
  - `docs/CONTRIBUTING.md`: Contribution guidelines
  - `docs/TESTING.md`: Testing guide and best practices
  - `docs/CHANGELOG.md`: This changelog

### Changed

- Improved pre-commit hook to run lint-staged instead of full test suite
- Enhanced package.json scripts for better developer experience

### Fixed

- (None yet)

### Deprecated

- (None yet)

### Removed

- (None yet)

### Security

- (None yet)

---

## [1.1.0] - 2024-XX-XX

### Added

- Python support via Pyodide WASM runtime
- Language auto-detection using ML model
- Magic comments (`//?`) for inline result display
- Smart script caching with LRU-K algorithm
- Memory management for Python runtime
- Python package installation via micropip
- Input support for Python (`input()` function)
- Cooperative cancellation with forced termination fallback

### Changed

- Migrated from JSRunner codebase
- Renamed to CheeseJS
- Updated Electron to version 39
- Improved worker thread architecture

### Fixed

- Memory leaks in code execution
- Worker thread crashes on timeout

---

## [1.0.0] - Initial Release

### Added

- Monaco editor integration
- JavaScript/TypeScript code execution
- Inline result display
- Loop protection
- npm package installation
- Custom themes support
- Settings persistence
- Code snippets
- Internationalization (en/es)

---

## Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
