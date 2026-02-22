import { useRef, useCallback } from 'react';
import type { editor } from 'monaco-editor';
import { useDebouncedFunction } from '../useDebounce';

interface DetectionResult {
    monacoId: string;
    confidence: number;
    isStale?: boolean;
}

export function useEditorChangeHandler({
    monacoRef,
    setCode,
    lastLocalCodeRef,
    lastCursorPositionRef,
    debouncedRunner,
    language,
    setLanguage,
    detectLanguageSync,
    detectLanguageAsync,
    incrementDetectionVersion,
    getDetectionVersion
}: {
    monacoRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
    setCode: (code: string) => void;
    lastLocalCodeRef: React.MutableRefObject<string | null>;
    lastCursorPositionRef: React.MutableRefObject<any>;
    debouncedRunner: (code: string) => void;
    language: string;
    setLanguage: (lang: string) => void;
    detectLanguageSync: (code: string) => DetectionResult;
    detectLanguageAsync: (code: string) => Promise<DetectionResult>;
    incrementDetectionVersion: () => number;
    getDetectionVersion: () => number;
}) {
    const lastDetectedRef = useRef<string>('typescript');
    const detectionInProgressRef = useRef<boolean>(false);

    const languageRef = useRef(language);
    languageRef.current = language;

    const setLanguageRef = useRef(setLanguage);
    setLanguageRef.current = setLanguage;

    const detectLanguageAsyncRef = useRef(detectLanguageAsync);
    detectLanguageAsyncRef.current = detectLanguageAsync;

    const detectLanguageSyncRef = useRef(detectLanguageSync);
    detectLanguageSyncRef.current = detectLanguageSync;

    const incrementDetectionVersionRef = useRef(incrementDetectionVersion);
    incrementDetectionVersionRef.current = incrementDetectionVersion;

    const getDetectionVersionRef = useRef(getDetectionVersion);
    getDetectionVersionRef.current = getDetectionVersion;

    const debouncedLanguageDetection = useDebouncedFunction(
        async (value: string, versionAtStart: number) => {
            if (detectionInProgressRef.current || !value || value.trim().length === 0)
                return;

            detectionInProgressRef.current = true;
            try {
                const detected = await detectLanguageAsyncRef.current(value);
                const currentLang = languageRef.current;
                const currentVersion = getDetectionVersionRef.current();

                if (currentVersion !== versionAtStart) {
                    return;
                }

                if (detected.isStale) {
                    return;
                }

                if (detected.monacoId !== currentLang && detected.confidence > 0.7) {
                    lastDetectedRef.current = detected.monacoId;
                    setLanguageRef.current(detected.monacoId);
                }
            } catch (error) {
                console.error('[Editor] ML detection failed:', error);
            } finally {
                detectionInProgressRef.current = false;
            }
        },
        250
    );

    const handler = useCallback(
        (value: string | undefined) => {
            if (value !== undefined) {
                if (monacoRef.current) {
                    lastCursorPositionRef.current = monacoRef.current.getPosition();
                }
                lastLocalCodeRef.current = value;
                setCode(value);

                const newVersion = incrementDetectionVersionRef.current();

                try {
                    const quick = detectLanguageSyncRef.current(value);
                    const currentLang = languageRef.current;
                    const hasEditorFocus = monacoRef.current?.hasTextFocus() ?? false;

                    if (
                        quick &&
                        quick.monacoId !== currentLang &&
                        quick.confidence >= 0.9 &&
                        !hasEditorFocus
                    ) {
                        lastDetectedRef.current = quick.monacoId;
                        setLanguageRef.current(quick.monacoId);
                    }
                } catch (e) {
                    console.warn('[Editor] Heuristic failed:', e);
                }

                debouncedLanguageDetection(value, newVersion);
                debouncedRunner(value);
            }
        },
        [debouncedRunner, debouncedLanguageDetection, setCode, monacoRef, lastLocalCodeRef, lastCursorPositionRef]
    );

    return handler;
}
