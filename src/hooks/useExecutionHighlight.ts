/**
 * useExecutionHighlight Hook
 *
 * Applies Monaco editor decorations to highlight the currently executing line.
 * Uses the execution visualizer store to track active lines.
 */

import { useEffect, useRef, MutableRefObject } from 'react';
import type { editor } from 'monaco-editor';
import type { Monaco } from '@monaco-editor/react';
import {
  useExecutionVisualizerStore,
  useIsVisualizationActive,
} from '../store/useExecutionVisualizerStore';
import '../styles/execution-visualizer.css';

interface UseExecutionHighlightProps {
  editorRef: MutableRefObject<editor.IStandaloneCodeEditor | null>;
  monacoRef: MutableRefObject<Monaco | null>;
}

/**
 * Hook to apply execution highlighting decorations to Monaco editor
 */
export function useExecutionHighlight({
  editorRef,
  monacoRef,
}: UseExecutionHighlightProps): void {
  const decorationsRef = useRef<string[]>([]);
  const isActive = useIsVisualizationActive();
  const activeLine = useExecutionVisualizerStore((s) => s.activeLine);
  const previousLine = useExecutionVisualizerStore((s) => s.previousLine);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco || !isActive) {
      // Clear decorations if visualization is not active
      if (editor && decorationsRef.current.length > 0) {
        decorationsRef.current = editor.deltaDecorations(
          decorationsRef.current,
          []
        );
      }
      return;
    }

    // Build decoration list
    const decorations: editor.IModelDeltaDecoration[] = [];

    // Active line highlight
    if (activeLine !== null && activeLine > 0) {
      decorations.push({
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: 'active-execution-line',
          glyphMarginClassName: 'active-execution-glyph',
          overviewRuler: {
            color: '#4ade80',
            position: monaco.editor.OverviewRulerLane.Left,
          },
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      // Reveal the line if not visible
      editor.revealLineInCenterIfOutsideViewport(activeLine);
    }

    // Previous line fade-out effect
    if (
      previousLine !== null &&
      previousLine > 0 &&
      previousLine !== activeLine
    ) {
      decorations.push({
        range: new monaco.Range(previousLine, 1, previousLine, 1),
        options: {
          isWholeLine: true,
          className: 'previous-execution-line',
          stickiness:
            monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [activeLine, previousLine, isActive, editorRef, monacoRef]);

  // Cleanup decorations on unmount
  useEffect(() => {
    const editor = editorRef.current;
    return () => {
      if (editor && decorationsRef.current.length > 0) {
        editor.deltaDecorations(decorationsRef.current, []);
      }
    };
  }, [editorRef]);
}

/**
 * Standalone function to clear all execution decorations
 */
export function clearExecutionDecorations(
  editor: editor.IStandaloneCodeEditor | null,
  decorationsRef: MutableRefObject<string[]>
): void {
  if (editor && decorationsRef.current.length > 0) {
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      []
    );
  }
}
