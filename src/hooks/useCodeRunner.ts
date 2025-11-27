import { useCallback, useRef } from 'react'
import { useCodeStore } from '../store/useCodeStore'
import { useWebContainerStore } from '../store/useWebContainerStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { usePackagesStore } from '../store/usePackagesStore'
import { run, transformCode } from '../lib/code/run'
import { runInWebContainer } from '../lib/code/runWebContainer'
import { detectLanguage, isLanguageExecutable } from '../lib/languageDetector'

export function useCodeRunner () {
  const code = useCodeStore((state) => state.code)
  const setCode = useCodeStore((state) => state.setCode)
  const setResult = useCodeStore((state) => state.setResult)
  const appendResult = useCodeStore((state) => state.appendResult)
  const clearResult = useCodeStore((state) => state.clearResult)
  const language = useCodeStore((state) => state.language)
  const setLanguage = useCodeStore((state) => state.setLanguage)
  const setIsExecuting = useCodeStore((state) => state.setIsExecuting)
  const setIsPendingRun = useCodeStore((state) => state.setIsPendingRun)
  const setDetectedMissingPackages = usePackagesStore((state) => state.setDetectedMissingPackages)

  const { showTopLevelResults, loopProtection, showUndefined, internalLogLevel, npmRcContent, magicComments, executionEnvironment } =
    useSettingsStore()

  const webContainer = useWebContainerStore((state) => state.webContainer)
  const killProcessRef = useRef<(() => void) | null>(null)

  const runCode = useCallback(
    async (codeToRun?: string) => {
      const sourceCode = codeToRun ?? code

      if (killProcessRef.current) {
        killProcessRef.current()
        killProcessRef.current = null
      }

      // Detect language
      const detectedLang = detectLanguage(sourceCode)
      if (detectedLang !== language) {
        setLanguage(detectedLang)
      }

      // Validate that language is executable
      if (!isLanguageExecutable(detectedLang)) {
        setIsExecuting(false)
        setResult([
          {
            element: {
              content: `❌ Unsupported Language: ${detectedLang}\n\nThis editor can only execute JavaScript and TypeScript code.\n\nDetected language: ${detectedLang}\nSupported languages: javascript, typescript`
            },
            type: 'error'
          }
        ])
        return
      }

      clearResult()
      setIsExecuting(true)
      try {
        if (webContainer && executionEnvironment === 'node') {
          const { kill, missingPackages } = await runInWebContainer(
            webContainer,
            sourceCode,
            (result) => {
              appendResult(result)
            },
            {
              showTopLevelResults,
              loopProtection,
              showUndefined,
              internalLogLevel,
              npmRcContent,
              magicComments
            }
          )
          
          if (missingPackages.length > 0) {
            setIsPendingRun(true)
            setDetectedMissingPackages(missingPackages)
          }

          killProcessRef.current = kill
        } else {
          const transformed = transformCode(sourceCode, {
            showTopLevelResults,
            loopProtection,
            internalLogLevel,
            magicComments
          })
          const element = await run(transformed, {
            showUndefined
          })
          setResult(Array.isArray(element) ? element : [])
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'An unknown error occurred'
        setResult([{ element: { content: message }, type: 'error' }])
      } finally {
        setIsExecuting(false)
      }
      if (codeToRun !== undefined) {
        setCode(codeToRun)
      }
    },
    [
      webContainer,
      language,
      setResult,
      setCode,
      appendResult,
      clearResult,
      setLanguage,
      setIsExecuting,
      code,
      showTopLevelResults,
      loopProtection,
      showUndefined,
      internalLogLevel,
      npmRcContent,
      magicComments,
      setDetectedMissingPackages,
      setIsPendingRun
    ]
  )

  return { runCode }
}
