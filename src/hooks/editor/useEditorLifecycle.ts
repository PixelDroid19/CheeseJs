import { useCallback, useEffect, useRef } from 'react';
import type { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';
import { configureMonaco } from '../../utils/monaco-config';
import { registerPythonLanguage } from '../../lib/python';
import { registerMonacoProviders, disposeMonacoProviders } from '../../lib/monacoProviders';
import { registerPythonMonacoProviders, disposePythonMonacoProviders } from '../../lib/python/pythonMonacoProviders';
import { registerPackageCommands } from '../../lib/monacoCommands';
import { setupTypeAcquisition } from '../../lib/ata';
import { createInlineCompletionProvider, registerAICodeActions } from '../../features/ai-agent';
import { useEditorTabsStore, useCodeStore } from '../../store/storeHooks';

export function useEditorLifecycle({
    setMonacoInstance,
    initializeModel,
    applyLanguageToMonaco,
    setLanguage,
    detectLanguageAsync,
    runCode,
    cleanupModels,
}: {
    setMonacoInstance: (instance: Monaco) => void;
    initializeModel: () => Promise<void>;
    applyLanguageToMonaco: (model: editor.ITextModel) => void;
    setLanguage: (lang: string) => void;
    detectLanguageAsync: (code: string) => Promise<{ monacoId: string; confidence: number }>;
    runCode: (code: string) => void;
    cleanupModels: (editorInstance: editor.IStandaloneCodeEditor) => void;
}) {
    const ataDisposeRef = useRef<(() => void) | null>(null);
    const inlineCompletionDisposableRef = useRef<monaco.IDisposable | null>(null);
    const aiCodeActionsDisposablesRef = useRef<monaco.IDisposable[]>([]);

    useEffect(() => {
        return () => {
            disposeMonacoProviders();
            disposePythonMonacoProviders();
            if (ataDisposeRef.current) {
                ataDisposeRef.current();
            }
            if (inlineCompletionDisposableRef.current) {
                inlineCompletionDisposableRef.current.dispose();
            }
            aiCodeActionsDisposablesRef.current.forEach((d) => d.dispose());
        };
    }, []);

    const handleEditorWillMount = useCallback(
        (monacoInstance: Monaco) => {
            configureMonaco(monacoInstance);

            setMonacoInstance(monacoInstance);
            registerPythonLanguage(monacoInstance);

            initializeModel().catch((err: unknown) => {
                console.warn('[Editor] Language detection model initialization failed:', err);
            });
        },
        [setMonacoInstance, initializeModel]
    );

    const handleEditorDidMount = useCallback(
        (editorInstance: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
            const model = editorInstance.getModel();
            if (model) {
                applyLanguageToMonaco(model);
            }

            Object.assign(window, {
                monaco: monacoInstance,
                editor: editorInstance,
                useCodeStore: useCodeStore,
                useEditorTabsStore: useEditorTabsStore
            });

            const initialCode = editorInstance.getValue();
            if (initialCode && initialCode.trim().length > 10) {
                detectLanguageAsync(initialCode)
                    .then((detected: { monacoId: string; confidence: number }) => {
                        const currentModel = editorInstance.getModel();
                        if (
                            currentModel &&
                            !currentModel.isDisposed() &&
                            detected.monacoId !== currentModel.getLanguageId()
                        ) {
                            monacoInstance.editor.setModelLanguage(currentModel, detected.monacoId);
                            setLanguage(detected.monacoId);
                        }
                    })
                    .catch((err: unknown) => console.error(err));
            }

            ataDisposeRef.current = setupTypeAcquisition(monacoInstance);
            registerMonacoProviders(monacoInstance, editorInstance);
            registerPythonMonacoProviders(monacoInstance, editorInstance);

            cleanupModels(editorInstance);
            registerPackageCommands(monacoInstance, editorInstance, runCode);

            try {
                const inlineProvider = createInlineCompletionProvider(
                    monacoInstance as unknown as typeof import('monaco-editor')
                );
                inlineCompletionDisposableRef.current =
                    monacoInstance.languages.registerInlineCompletionsProvider(
                        { pattern: '**' },
                        inlineProvider
                    );
            } catch (err) {
                console.warn('[Editor] Failed to register AI inline completion provider:', err);
            }

            try {
                aiCodeActionsDisposablesRef.current = registerAICodeActions(
                    monacoInstance as unknown as typeof import('monaco-editor'),
                    editorInstance
                );
            } catch (err) {
                console.warn('[Editor] Failed to register AI code actions:', err);
            }
        },
        [
            runCode,
            cleanupModels,
            detectLanguageAsync,
            setLanguage,
            applyLanguageToMonaco
        ]
    );

    return {
        handleEditorWillMount,
        handleEditorDidMount
    };
}
