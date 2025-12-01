import { useCallback, useRef, useEffect } from 'react'
import { useCodeStore } from '../store/useCodeStore'
import { useWebContainerStore } from '../store/useWebContainerStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { usePackagesStore } from '../store/usePackagesStore'
import { run, transformCode } from '../lib/code/run'
import { runInWebContainer } from '../lib/code/runWebContainer'
import { detectLanguage, isLanguageExecutable } from '../lib/languageDetector'
import { 
  logAutoRunSkipped
} from '../lib/logging/packageLogger'

export function useCodeRunner() {
  const code = useCodeStore((state) => state.code)
  const setCode = useCodeStore((state) => state.setCode)
  const setResult = useCodeStore((state) => state.setResult)
  const appendResult = useCodeStore((state) => state.appendResult)
  const clearResult = useCodeStore((state) => state.clearResult)
  const language = useCodeStore((state) => state.language)
  const setLanguage = useCodeStore((state) => state.setLanguage)
  const setIsExecuting = useCodeStore((state) => state.setIsExecuting)
  const setIsPendingRun = useCodeStore((state) => state.setIsPendingRun)
  const isPendingRun = useCodeStore((state) => state.isPendingRun)
  const setDetectedMissingPackages = usePackagesStore((state) => state.setDetectedMissingPackages)

  const { showTopLevelResults, loopProtection, showUndefined, internalLogLevel, npmRcContent, magicComments, autoRunAfterInstall } =
    useSettingsStore()

  const webContainer = useWebContainerStore((state) => state.webContainer)
  const killProcessRef = useRef<(() => void) | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runCode = useCallback(
    async (codeToRun?: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(async () => {
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
          // Always use WebContainer if available
          if (webContainer) {
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
              
              // Only auto-add packages to store if autoInstallPackages is enabled
              // Read directly from store to get the current value (not stale closure)
              const currentAutoInstall = useSettingsStore.getState().autoInstallPackages
              if (currentAutoInstall) {
                const { addPackage } = usePackagesStore.getState()
                missingPackages.forEach(pkg => addPackage(pkg))
              }
            }

            killProcessRef.current = kill
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ WebContainer not available, falling back to browser execution')
            }
            const transformed = transformCode(sourceCode, {
              showTopLevelResults,
              loopProtection,
              internalLogLevel,
              magicComments
            })
            await run(
              transformed,
              (result) => {
                appendResult(result)
              },
              {
                showUndefined
              }
            )
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
      }, 300)
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

  // Effect to auto-run after package installation
  // This effect is DISABLED here - the auto-run logic is handled in PackageInstaller.tsx
  // to avoid race conditions between two competing effects
  useEffect(() => {
    if (!isPendingRun) return
    
    if (!autoRunAfterInstall) {
      logAutoRunSkipped('Auto-run after install is disabled in settings')
      setIsPendingRun(false)
      return
    }
    
    // The actual auto-run is triggered by PackageInstaller.tsx when packages finish installing
  }, [isPendingRun, autoRunAfterInstall, setIsPendingRun])

  return {
    runCode,
    webContainer
  }
}
