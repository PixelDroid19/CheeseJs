import { useEffect, useRef } from 'react';
import { useLspStore } from '../../store/storeHooks';
import {
  startLspClient,
  stopLspClient,
  isLspClientActive,
} from '../../lib/lsp/monacoClient';

export function useLspIntegration(language: string) {
  const { languages, setLspStatus } = useLspStore();
  const prevLangRef = useRef<string | null>(null);

  useEffect(() => {
    const langConfig = languages[language];
    const shouldBeActive = !!(langConfig && langConfig.enabled);

    // If the language changed, stop the old language's client
    if (prevLangRef.current && prevLangRef.current !== language) {
      const oldLang = prevLangRef.current;
      if (isLspClientActive(oldLang)) {
        stopLspClient(oldLang);
        setLspStatus(oldLang, 'stopped');
      }
    }
    prevLangRef.current = language;

    if (shouldBeActive && !isLspClientActive(language)) {
      setLspStatus(language, 'starting');
      startLspClient(language, langConfig.fileExtensions)
        .then(() => {
          setLspStatus(language, 'running');
        })
        .catch((err) => {
          console.error(`Failed to start LSP for ${language}:`, err);
          setLspStatus(language, 'error');
        });
    } else if (!shouldBeActive && isLspClientActive(language)) {
      stopLspClient(language);
      setLspStatus(language, 'stopped');
    }

    // Cleanup on unmount
    return () => {
      if (isLspClientActive(language)) {
        stopLspClient(language);
        setLspStatus(language, 'stopped');
      }
    };
  }, [language, languages, setLspStatus]);
}
