import { useEffect } from 'react';
import type { editor, Position } from 'monaco-editor';

export function useEditorCodeSync(
    monacoRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>,
    code: string,
    lastLocalCodeRef: React.MutableRefObject<string | null>
) {
    useEffect(() => {
        if (monacoRef.current) {
            const model = monacoRef.current.getModel();
            const currentVal = model?.getValue();

            if (model && currentVal !== code) {
                if (code === lastLocalCodeRef.current) {
                    return;
                }

                if (monacoRef.current.hasTextFocus()) {
                    return;
                }

                model.setValue(code);

                const lineCount = model.getLineCount();
                const maxCol = model.getLineMaxColumn(lineCount);
                const pos: Position = { lineNumber: lineCount, column: maxCol } as Position;

                monacoRef.current.setPosition(pos);
                monacoRef.current.revealPosition(pos);

                setTimeout(() => {
                    if (monacoRef.current) {
                        monacoRef.current.focus();
                    }
                }, 250);
            }
        }
    }, [code, monacoRef, lastLocalCodeRef]);
}
