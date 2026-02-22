import { useEffect } from 'react';
import type { editor } from 'monaco-editor';

export function useEditorFormat(monacoRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>) {
    useEffect(() => {
        const handleFormat = () => {
            monacoRef.current?.getAction('editor.action.formatDocument')?.run();
        };
        window.addEventListener('trigger-format', handleFormat);

        return () => {
            window.removeEventListener('trigger-format', handleFormat);
        };
    }, [monacoRef]);
}
