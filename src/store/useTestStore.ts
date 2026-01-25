/**
 * Test Store
 *
 * Zustand store for managing test runner state.
 * Tracks test results, coverage, and test file associations.
 */

import { create } from 'zustand';
import { useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface TestResult {
  /** Test name */
  name: string;
  /** Full test path (describe > it) */
  fullName: string;
  /** Test outcome */
  status: 'passed' | 'failed' | 'skipped' | 'running';
  /** Duration in ms */
  duration?: number;
  /** Error message if failed */
  error?: string;
  /** Stack trace if failed */
  stack?: string;
  /** Line number in source file */
  line?: number;
}

export interface TestFile {
  /** File path */
  path: string;
  /** Test results */
  tests: TestResult[];
  /** File status */
  status: 'idle' | 'running' | 'passed' | 'failed';
  /** Last run timestamp */
  lastRun?: number;
}

export interface CoverageData {
  /** Lines covered percentage */
  lines: number;
  /** Statements covered percentage */
  statements: number;
  /** Functions covered percentage */
  functions: number;
  /** Branches covered percentage */
  branches: number;
  /** Uncovered line numbers */
  uncoveredLines: number[];
}

export interface TestState {
  /** Test files */
  files: Map<string, TestFile>;
  /** Currently running test file */
  activeFile: string | null;
  /** Coverage data per file */
  coverage: Map<string, CoverageData>;
  /** Overall status */
  status: 'idle' | 'running' | 'passed' | 'failed';
  /** Is test runner ready */
  isReady: boolean;
  /** Error message */
  error: string | null;

  // Actions
  setReady: (ready: boolean) => void;
  runTests: (filePath?: string) => Promise<void>;
  runSingleTest: (filePath: string, testName: string) => Promise<void>;
  stopTests: () => void;
  updateTestResult: (filePath: string, result: TestResult) => void;
  updateFileStatus: (filePath: string, status: TestFile['status']) => void;
  setCoverage: (filePath: string, coverage: CoverageData) => void;
  clearResults: () => void;
  addTestFile: (filePath: string) => void;
  removeTestFile: (filePath: string) => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useTestStore = create<TestState>((set, get) => ({
  files: new Map(),
  activeFile: null,
  coverage: new Map(),
  status: 'idle',
  isReady: false,
  error: null,

  setReady: (isReady) => set({ isReady }),

  runTests: async (filePath?: string) => {
    if (!window.testRunner) {
      set({ error: 'Test runner not available' });
      return;
    }

    set({ status: 'running', error: null });

    try {
      if (filePath) {
        set({ activeFile: filePath });
        get().updateFileStatus(filePath, 'running');
      }

      await window.testRunner.run(filePath);
    } catch (error) {
      set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Test run failed',
      });
    }
  },

  runSingleTest: async (filePath: string, testName: string) => {
    if (!window.testRunner) {
      set({ error: 'Test runner not available' });
      return;
    }

    set({ status: 'running', activeFile: filePath, error: null });

    try {
      await window.testRunner.runSingle(filePath, testName);
    } catch (error) {
      set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Test run failed',
      });
    }
  },

  stopTests: () => {
    window.testRunner?.stop();
    set({ status: 'idle', activeFile: null });
  },

  updateTestResult: (filePath: string, result: TestResult) => {
    const files = new Map(get().files);
    const file = files.get(filePath);

    if (file) {
      const existingIndex = file.tests.findIndex(
        (t) => t.fullName === result.fullName
      );
      if (existingIndex >= 0) {
        file.tests[existingIndex] = result;
      } else {
        file.tests.push(result);
      }
      files.set(filePath, { ...file });
    }

    set({ files });
  },

  updateFileStatus: (filePath: string, status: TestFile['status']) => {
    const files = new Map(get().files);
    const file = files.get(filePath);

    if (file) {
      files.set(filePath, {
        ...file,
        status,
        lastRun: status !== 'running' ? Date.now() : file.lastRun,
      });
    }

    // Update overall status
    const allFiles = Array.from(files.values());
    const hasRunning = allFiles.some((f) => f.status === 'running');
    const hasFailed = allFiles.some((f) => f.status === 'failed');

    set({
      files,
      status: hasRunning ? 'running' : hasFailed ? 'failed' : 'passed',
    });
  },

  setCoverage: (filePath: string, coverage: CoverageData) => {
    const newCoverage = new Map(get().coverage);
    newCoverage.set(filePath, coverage);
    set({ coverage: newCoverage });
  },

  clearResults: () => {
    const files = new Map(get().files);
    for (const [path, file] of files) {
      files.set(path, { ...file, tests: [], status: 'idle' });
    }
    set({ files, coverage: new Map(), status: 'idle', error: null });
  },

  addTestFile: (filePath: string) => {
    const files = new Map(get().files);
    if (!files.has(filePath)) {
      files.set(filePath, {
        path: filePath,
        tests: [],
        status: 'idle',
      });
      set({ files });
    }
  },

  removeTestFile: (filePath: string) => {
    const files = new Map(get().files);
    files.delete(filePath);
    const coverage = new Map(get().coverage);
    coverage.delete(filePath);
    set({ files, coverage });
  },
}));

// ============================================================================
// TYPE DECLARATIONS
// ============================================================================

declare global {
  interface Window {
    testRunner?: {
      run: (filePath?: string) => Promise<void>;
      runInline: (code: string) => Promise<void>;
      runSingle: (filePath: string, testName: string) => Promise<void>;
      stop: () => void;
      isReady: () => Promise<boolean>;
      onResult: (
        callback: (result: { filePath: string; test: TestResult }) => void
      ) => () => void;
      onComplete: (
        callback: (result: {
          filePath: string;
          status: 'passed' | 'failed';
          coverage?: CoverageData;
        }) => void
      ) => () => void;
      onError: (callback: (error: { message: string }) => void) => () => void;
    };
  }
}

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get test results for a specific file
 */
export function useFileTests(filePath: string): TestResult[] {
  return useTestStore((s) => s.files.get(filePath)?.tests ?? []);
}

/**
 * Get pass/fail counts
 * Uses useMemo to avoid returning new object references on each render
 */
export function useTestCounts(): {
  passed: number;
  failed: number;
  total: number;
} {
  const files = useTestStore((s) => s.files);

  return useMemo(() => {
    let passed = 0;
    let failed = 0;

    for (const file of files.values()) {
      for (const test of file.tests) {
        if (test.status === 'passed') passed++;
        if (test.status === 'failed') failed++;
      }
    }

    return { passed, failed, total: passed + failed };
  }, [files]);
}

/**
 * Get test at a specific line
 */
export function useTestAtLine(
  filePath: string,
  line: number
): TestResult | undefined {
  return useTestStore((s) => {
    const file = s.files.get(filePath);
    return file?.tests.find((t) => t.line === line);
  });
}
