/**
 * useTestDecorations Hook
 *
 * Applies Monaco editor decorations to show inline test results.
 * Shows pass/fail indicators in the gutter next to test definitions.
 */

import { useEffect, useRef, MutableRefObject } from 'react';
import type { editor } from 'monaco-editor';
import type { Monaco } from '@monaco-editor/react';
import { useTestStore, type TestResult } from '../store/useTestStore';

// ============================================================================
// DECORATION STYLES
// ============================================================================

const DECORATION_CLASSES = {
  passed: 'test-passed-line',
  failed: 'test-failed-line',
  running: 'test-running-line',
};

const GLYPH_CLASSES = {
  passed: 'test-passed-glyph',
  failed: 'test-failed-glyph',
  running: 'test-running-glyph',
};

// ============================================================================
// CSS STYLES (inject into document)
// ============================================================================

const STYLES = `
.test-passed-glyph::before {
  content: '✓';
  color: #4ade80;
  font-weight: bold;
  font-size: 12px;
}

.test-failed-glyph::before {
  content: '✗';
  color: #f87171;
  font-weight: bold;
  font-size: 12px;
}

.test-running-glyph::before {
  content: '●';
  color: #60a5fa;
  animation: pulse 1s infinite;
}

.test-passed-line {
  background: rgba(74, 222, 128, 0.05);
}

.test-failed-line {
  background: rgba(248, 113, 113, 0.08);
}

.test-running-line {
  background: rgba(96, 165, 250, 0.05);
}

.test-error-message {
  color: #f87171;
  font-style: italic;
  font-size: 12px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

// ============================================================================
// HOOK
// ============================================================================

interface UseTestDecorationsProps {
  editorRef: MutableRefObject<editor.IStandaloneCodeEditor | null>;
  monacoRef: MutableRefObject<Monaco | null>;
  filePath: string;
}

export function useTestDecorations({
  editorRef,
  monacoRef,
  filePath,
}: UseTestDecorationsProps): void {
  const decorationsRef = useRef<string[]>([]);
  const stylesInjectedRef = useRef(false);

  // Get tests for this file
  const tests = useTestStore((s) => s.files.get(filePath)?.tests ?? []);

  // Inject styles once
  useEffect(() => {
    if (stylesInjectedRef.current) return;

    const style = document.createElement('style');
    style.id = 'test-decorations-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
    stylesInjectedRef.current = true;

    return () => {
      const existing = document.getElementById('test-decorations-styles');
      if (existing) {
        document.head.removeChild(existing);
        stylesInjectedRef.current = false;
      }
    };
  }, []);

  // Apply decorations
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || tests.length === 0) {
      // Clear decorations if no tests
      if (editor && decorationsRef.current.length > 0) {
        decorationsRef.current = editor.deltaDecorations(
          decorationsRef.current,
          []
        );
      }
      return;
    }

    // Build decorations for each test with a known line
    const decorations: editor.IModelDeltaDecoration[] = [];

    for (const test of tests) {
      if (test.line === undefined || test.line <= 0) continue;
      if (test.status === 'skipped') continue;

      const status = test.status as 'passed' | 'failed' | 'running';
      const lineClass = DECORATION_CLASSES[status];
      const glyphClass = GLYPH_CLASSES[status];

      decorations.push({
        range: new monaco.Range(test.line, 1, test.line, 1),
        options: {
          isWholeLine: true,
          className: lineClass,
          glyphMarginClassName: glyphClass,
          glyphMarginHoverMessage: {
            value: getHoverMessage(test),
          },
          overviewRuler: {
            color: getOverviewRulerColor(test.status),
            position: monaco.editor.OverviewRulerLane.Right,
          },
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      // Add inline error message for failed tests
      if (test.status === 'failed' && test.error) {
        decorations.push({
          range: new monaco.Range(test.line, 1, test.line, 1),
          options: {
            after: {
              content: ` // ${truncate(test.error, 60)}`,
              inlineClassName: 'test-error-message',
            },
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    }

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [tests, editorRef, monacoRef]);

  // Cleanup on unmount
  useEffect(() => {
    const editor = editorRef.current;
    return () => {
      if (editor && decorationsRef.current.length > 0) {
        editor.deltaDecorations(decorationsRef.current, []);
      }
    };
  }, [editorRef]);
}

// ============================================================================
// HELPERS
// ============================================================================

function getHoverMessage(test: TestResult): string {
  if (test.status === 'passed') {
    return `✓ **${test.name}** passed${test.duration ? ` (${test.duration}ms)` : ''}`;
  }
  if (test.status === 'failed') {
    return `✗ **${test.name}** failed\n\n${test.error || 'Unknown error'}`;
  }
  if (test.status === 'running') {
    return `● Running **${test.name}**...`;
  }
  return test.name;
}

function getOverviewRulerColor(status: TestResult['status']): string {
  switch (status) {
    case 'passed':
      return '#4ade80';
    case 'failed':
      return '#f87171';
    case 'running':
      return '#60a5fa';
    default:
      return '#6b7280';
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export default useTestDecorations;
