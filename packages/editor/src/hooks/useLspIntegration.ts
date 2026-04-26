import { useEffect, useRef } from 'react';

/** Shared shape expected from an LSP language configuration entry. */
export interface EditorLspLanguageConfig {
  enabled?: boolean;
  fileExtensions: string[];
}

/** Minimal status set supported by the reusable LSP hook. */
export type EditorLspStatus = 'stopped' | 'starting' | 'running' | 'error';

/** Dependencies needed to connect editor language changes to LSP clients. */
export interface UseLspIntegrationParams {
  language: string;
  languages: Record<string, EditorLspLanguageConfig>;
  setLspStatus: (language: string, status: EditorLspStatus) => void;
  startClient: (language: string, fileExtensions: string[]) => Promise<void>;
  stopClient: (language: string) => void;
  isClientActive: (language: string) => boolean;
}

/**
 * Synchronizes active Monaco language with the host application's LSP runtime.
 */
export function useLspIntegration({
  language,
  languages,
  setLspStatus,
  startClient,
  stopClient,
  isClientActive,
}: UseLspIntegrationParams) {
  const prevLangRef = useRef<string | null>(null);

  useEffect(() => {
    const langConfig = languages[language];
    const shouldBeActive = !!(langConfig && langConfig.enabled);

    if (prevLangRef.current && prevLangRef.current !== language) {
      const oldLang = prevLangRef.current;
      if (isClientActive(oldLang)) {
        stopClient(oldLang);
        setLspStatus(oldLang, 'stopped');
      }
    }
    prevLangRef.current = language;

    if (shouldBeActive && !isClientActive(language)) {
      setLspStatus(language, 'starting');
      startClient(language, langConfig.fileExtensions)
        .then(() => {
          setLspStatus(language, 'running');
        })
        .catch((err) => {
          console.error(`Failed to start LSP for ${language}:`, err);
          setLspStatus(language, 'error');
        });
    } else if (!shouldBeActive && isClientActive(language)) {
      stopClient(language);
      setLspStatus(language, 'stopped');
    }

    return () => {
      if (isClientActive(language)) {
        stopClient(language);
        setLspStatus(language, 'stopped');
      }
    };
  }, [
    language,
    languages,
    setLspStatus,
    startClient,
    stopClient,
    isClientActive,
  ]);
}
