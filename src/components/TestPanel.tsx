/**
 * Test Panel Component
 *
 * Enhanced test runner panel for learning testing in the playground.
 * Features inline code execution, test templates, and helpful guidance.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  RefreshCw,
  ChevronRight,
  FileText,
  FlaskConical,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import clsx from 'clsx';
import {
  useTestStore,
  useTestCounts,
  type TestResult,
  type TestFile,
} from '../store/useTestStore';

// ============================================================================
// TEST TEMPLATES FOR LEARNING
// ============================================================================

const TEST_TEMPLATES = [
  {
    name: 'Basic Test',
    description: 'Simple test with expect',
    code: `describe('My Feature', () => {
  it('should work correctly', () => {
    expect(1 + 1).toBe(2);
  });
});`,
  },
  {
    name: 'Multiple Assertions',
    description: 'Test with multiple checks',
    code: `describe('Calculator', () => {
  it('performs basic math', () => {
    expect(2 + 2).toBe(4);
    expect(10 - 5).toBe(5);
    expect(3 * 4).toBe(12);
    expect(15 / 3).toBe(5);
  });
});`,
  },
  {
    name: 'Testing Objects',
    description: 'Compare objects and arrays',
    code: `describe('Data Structures', () => {
  it('compares objects', () => {
    const user = { name: 'Alice', age: 25 };
    expect(user).toEqual({ name: 'Alice', age: 25 });
    expect(user).toHaveProperty('name');
  });

  it('compares arrays', () => {
    const items = [1, 2, 3];
    expect(items).toContain(2);
    expect(items).toHaveLength(3);
  });
});`,
  },
  {
    name: 'Async Test',
    description: 'Testing async functions',
    code: `describe('Async Operations', () => {
  it('waits for promises', async () => {
    const fetchData = () => Promise.resolve('data');
    const result = await fetchData();
    expect(result).toBe('data');
  });
});`,
  },
  {
    name: 'Error Testing',
    description: 'Test that errors are thrown',
    code: `describe('Error Handling', () => {
  it('throws on invalid input', () => {
    const validate = (x) => {
      if (x < 0) throw new Error('Must be positive');
      return x;
    };

    expect(() => validate(-1)).toThrow('Must be positive');
    expect(() => validate(5)).not.toThrow();
  });
});`,
  },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface TestResultItemProps {
  test: TestResult;
  onRun?: () => void;
}

function TestResultItem({ test, onRun }: TestResultItemProps) {
  const statusConfig = {
    passed: {
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
    skipped: {
      icon: SkipForward,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    running: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  };

  const { icon: Icon, color, bg } = statusConfig[test.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
        'hover:bg-white/5 group cursor-pointer'
      )}
      onClick={onRun}
    >
      <div className={clsx('p-1 rounded', bg)}>
        <Icon
          className={clsx(
            'w-4 h-4',
            color,
            test.status === 'running' && 'animate-spin'
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 truncate">{test.name}</p>
        {test.error && (
          <p className="text-xs text-red-400 truncate mt-0.5">{test.error}</p>
        )}
      </div>

      {test.duration !== undefined && (
        <span className="text-xs text-white/40">{test.duration}ms</span>
      )}
    </motion.div>
  );
}

interface TestFileSectionProps {
  file: TestFile;
  isExpanded: boolean;
  onToggle: () => void;
  onRunFile: () => void;
  onRunTest: (testName: string) => void;
}

function TestFileSection({
  file,
  isExpanded,
  onToggle,
  onRunFile,
  onRunTest,
}: TestFileSectionProps) {
  const passedCount = file.tests.filter((t) => t.status === 'passed').length;
  const failedCount = file.tests.filter((t) => t.status === 'failed').length;

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={onToggle}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 transition-colors',
          'hover:bg-white/5 text-left'
        )}
      >
        <ChevronRight
          className={clsx(
            'w-4 h-4 text-white/40 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
        <FileText className="w-4 h-4 text-white/40" />
        <span className="flex-1 text-sm text-white/70 truncate">
          {file.path.split('/').pop() || 'Inline Tests'}
        </span>

        <div className="flex items-center gap-2">
          {passedCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              {passedCount}
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <XCircle className="w-3 h-3" />
              {failedCount}
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRunFile();
          }}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="Run file tests"
        >
          <Play className="w-3.5 h-3.5 text-white/50" />
        </button>
      </button>

      <AnimatePresence>
        {isExpanded && file.tests.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white/[0.02]"
          >
            <div className="pl-8 pr-2 py-1">
              {file.tests.map((test) => (
                <TestResultItem
                  key={test.fullName}
                  test={test}
                  onRun={() => onRunTest(test.fullName)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// TEMPLATE SELECTOR
// ============================================================================

interface TemplateSelectorProps {
  onSelect: (code: string) => void;
  onClose: () => void;
}

function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 mt-2 bg-[#252629] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
    >
      <div className="p-2 border-b border-white/10">
        <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide">
          Test Templates
        </h4>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {TEST_TEMPLATES.map((template, idx) => (
          <button
            key={idx}
            onClick={() => {
              onSelect(template.code);
              onClose();
            }}
            className="w-full flex items-start gap-3 px-3 py-2 hover:bg-white/5 text-left transition-colors"
          >
            <BookOpen className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-white/80">{template.name}</p>
              <p className="text-xs text-white/40">{template.description}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// EMPTY STATE / LEARNING GUIDE
// ============================================================================

interface EmptyStateProps {
  onInsertTemplate: (code: string) => void;
  onRunFromEditor: () => void;
}

function EmptyState({ onInsertTemplate, onRunFromEditor }: EmptyStateProps) {
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 mb-4">
        <FlaskConical className="w-8 h-8 text-purple-400" />
      </div>

      <h3 className="text-sm font-medium text-white/80 mb-2">Learn Testing!</h3>
      <p className="text-xs text-white/40 mb-6 max-w-[200px]">
        Write tests in the editor using{' '}
        <code className="text-purple-400">describe</code> and{' '}
        <code className="text-purple-400">it</code> blocks
      </p>

      {/* Quick Actions */}
      <div className="space-y-2 w-full max-w-[200px]">
        <button
          onClick={onRunFromEditor}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" />
          Run Current Code
        </button>

        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 text-sm rounded-lg transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            Insert Template
          </button>

          <AnimatePresence>
            {showTemplates && (
              <TemplateSelector
                onSelect={onInsertTemplate}
                onClose={() => setShowTemplates(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Quick Tip */}
      <div className="mt-6 p-3 bg-white/5 rounded-lg max-w-[220px]">
        <p className="text-xs text-white/50">
          <span className="text-purple-400 font-medium">Tip:</span> Tests run in
          an isolated environment with automatic imports.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TestPanel() {
  const { files, status, error, clearResults } = useTestStore();
  const { passed, failed, total } = useTestCounts();
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);

  // Subscribe to test results and errors
  useEffect(() => {
    if (!window.testRunner) return;

    const unsubResult = window.testRunner.onResult?.(({ filePath, test }) => {
      setIsRunning(true);
      useTestStore.getState().updateTestResult(filePath, test);
    });

    const unsubComplete = window.testRunner.onComplete?.(
      ({ filePath, status: fileStatus }) => {
        setIsRunning(false);
        useTestStore.getState().updateFileStatus(filePath, fileStatus);
      }
    );

    const unsubError = window.testRunner.onError?.((err) => {
      setIsRunning(false);
      useTestStore.setState({ error: err.message, status: 'failed' });
    });

    return () => {
      unsubResult?.();
      unsubComplete?.();
      unsubError?.();
    };
  }, []);

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const runFromEditor = useCallback(async () => {
    // Get code from the active Monaco editor
    const editorCode = (
      window as unknown as { __getEditorCode?: () => string }
    ).__getEditorCode?.();
    if (!editorCode) {
      useTestStore.setState({ error: 'No code in editor' });
      return;
    }

    // Clear previous results and add an "inline" test file
    clearResults();
    useTestStore.getState().addTestFile('inline');

    setIsRunning(true);
    try {
      await window.testRunner?.runInline?.(editorCode);
    } catch (err) {
      useTestStore.setState({
        error: err instanceof Error ? err.message : 'Failed to run tests',
        status: 'failed',
      });
      setIsRunning(false);
    }
  }, [clearResults]);

  const insertTemplate = useCallback((code: string) => {
    // Dispatch event to insert code into editor
    window.dispatchEvent(new CustomEvent('insert-code', { detail: { code } }));
  }, []);

  const handleRunFile = useCallback((filePath: string) => {
    useTestStore.getState().runTests(filePath);
  }, []);

  const handleRunSingle = useCallback((filePath: string, testName: string) => {
    useTestStore.getState().runSingleTest(filePath, testName);
  }, []);

  const filesArray = useMemo(() => Array.from(files.values()), [files]);

  const stopTests = useCallback(() => {
    window.testRunner?.stop();
    setIsRunning(false);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#1a1b1e] border-l border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Tests</h3>

          {total > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-400">{passed} ✓</span>
              {failed > 0 && <span className="text-red-400">{failed} ✗</span>}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {isRunning || status === 'running' ? (
            <button
              onClick={stopTests}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Stop"
            >
              <Square className="w-4 h-4 text-red-400" />
            </button>
          ) : (
            <button
              onClick={runFromEditor}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Run Tests from Editor"
            >
              <Play className="w-4 h-4 text-green-400" />
            </button>
          )}

          <button
            onClick={clearResults}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Clear Results"
          >
            <RefreshCw className="w-4 h-4 text-white/50" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-red-500/10 text-red-400 text-xs border-b border-red-500/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filesArray.length === 0 ||
        (filesArray.length === 1 && filesArray[0].tests.length === 0) ? (
          <EmptyState
            onInsertTemplate={insertTemplate}
            onRunFromEditor={runFromEditor}
          />
        ) : (
          <div>
            {filesArray.map((file) => (
              <TestFileSection
                key={file.path}
                file={file}
                isExpanded={expandedFiles.has(file.path)}
                onToggle={() => toggleFile(file.path)}
                onRunFile={() => handleRunFile(file.path)}
                onRunTest={(testName) => handleRunSingle(file.path, testName)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Export CoverageSummary for future use
export function CoverageSummary({
  lines,
  statements,
  functions,
  branches,
}: {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}) {
  const metrics = [
    { label: 'Lines', value: lines },
    { label: 'Statements', value: statements },
    { label: 'Functions', value: functions },
    { label: 'Branches', value: branches },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 p-3 bg-white/[0.02] rounded-lg">
      {metrics.map(({ label, value }) => (
        <div key={label} className="text-center">
          <div
            className={clsx(
              'text-lg font-bold',
              value >= 80
                ? 'text-green-400'
                : value >= 50
                  ? 'text-yellow-400'
                  : 'text-red-400'
            )}
          >
            {value.toFixed(0)}%
          </div>
          <div className="text-xs text-white/40">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default TestPanel;
