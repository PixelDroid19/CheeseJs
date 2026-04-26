import { useEffect, type MutableRefObject } from 'react';
import type { editor } from 'monaco-editor';

/**
 * Subscribes the editor to a host-provided format request channel.
 */
export function useEditorFormat(
  monacoRef: MutableRefObject<editor.IStandaloneCodeEditor | null>,
  subscribeToFormatRequested?: (handler: () => void) => () => void
) {
  useEffect(() => {
    if (!subscribeToFormatRequested) {
      return;
    }

    const handleFormat = () => {
      monacoRef.current?.getAction('editor.action.formatDocument')?.run();
    };

    return subscribeToFormatRequested(handleFormat);
  }, [monacoRef, subscribeToFormatRequested]);
}
