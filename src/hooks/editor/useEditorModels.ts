import { useCallback, useEffect } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export function useEditorModels(
    monacoRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>,
    monacoInstanceRef: React.MutableRefObject<Monaco | null>,
    language: string,
    applyLanguageToMonaco: (model: editor.ITextModel) => void
) {
    const cleanupModels = useCallback(
        (editorInstance: editor.IStandaloneCodeEditor) => {
            const PROTECTED_URIS = [
                'result-output.js',
                'code.txt',
                'ts:node-globals.d.ts',
                'inmemory://model/',
            ];

            const currentModel = editorInstance.getModel();
            const currentUri = currentModel?.uri.toString();

            if (!monacoInstanceRef.current) {
                return;
            }

            const models = monacoInstanceRef.current.editor.getModels();
            const modelsToDispose: editor.ITextModel[] = [];

            models.forEach((m: editor.ITextModel) => {
                const uri = m.uri.toString();

                if (m.isDisposed()) {
                    return;
                }

                if (uri === currentUri) {
                    return;
                }

                if (PROTECTED_URIS.some((protected_uri) => uri.includes(protected_uri))) {
                    return;
                }

                if (!uri.startsWith('inmemory') && !uri.startsWith('file:')) {
                    return;
                }

                try {
                    m.getValue();
                    modelsToDispose.push(m);
                } catch {
                    console.warn(`[Editor] Skipping model ${uri} - may be in invalid state`);
                }
            });

            if (modelsToDispose.length > 0) {
                setTimeout(() => {
                    modelsToDispose.forEach((m) => {
                        try {
                            if (!m.isDisposed()) {
                                m.dispose();
                            }
                        } catch (e) {
                            console.debug('[Editor] Error disposing model (may be expected):', e);
                        }
                    });
                }, 100);
            }
        },
        [monacoInstanceRef]
    );

    useEffect(() => {
        if (monacoRef.current && monacoInstanceRef.current) {
            const model = monacoRef.current.getModel();
            if (model && !model.isDisposed()) {
                applyLanguageToMonaco(model);
            }
            cleanupModels(monacoRef.current);
        }
    }, [language, applyLanguageToMonaco, cleanupModels, monacoRef, monacoInstanceRef]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (monacoRef.current) {
                cleanupModels(monacoRef.current);
            }
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [cleanupModels, monacoRef]);

    return { cleanupModels };
}
