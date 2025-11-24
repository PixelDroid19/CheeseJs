import { useCallback, useRef } from 'react'
import { useCodeStore } from '../store/useCodeStore'
import { useWebContainerStore } from '../store/useWebContainerStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { run, transformCode } from '../lib/code/run'
import { runInWebContainer } from '../lib/code/runWebContainer'
import { detectLanguage } from '../lib/languageDetector'

export function useCodeRunner () {
  const code = useCodeStore((state) => state.code)
  const setCode = useCodeStore((state) => state.setCode)
  const setResult = useCodeStore((state) => state.setResult)
  const appendResult = useCodeStore((state) => state.appendResult)
  const clearResult = useCodeStore((state) => state.clearResult)
  const language = useCodeStore((state) => state.language)
  const setLanguage = useCodeStore((state) => state.setLanguage)

  const { showTopLevelResults, loopProtection, showUndefined } = useSettingsStore()

  const webContainer = useWebContainerStore((state) => state.webContainer)
  const killProcessRef = useRef<(() => void) | null>(null)

  const runCode = useCallback(async (codeToRun?: string) => {
    const sourceCode = codeToRun ?? code

    if (killProcessRef.current) {
      killProcessRef.current()
      killProcessRef.current = null
    }

    // Detect language
    const detectedLang = await detectLanguage(sourceCode)
    if (detectedLang !== language) {
      setLanguage(detectedLang)
    }

    clearResult()
    try {
      if (webContainer) {
        const kill = await runInWebContainer(webContainer, sourceCode, (result) => {
          appendResult(result)
        })
        killProcessRef.current = kill
      } else {
        const transformed = transformCode(sourceCode, {
          showTopLevelResults,
          loopProtection
        })
        const element = await run(transformed, {
          showUndefined
        })
        setResult(Array.isArray(element) ? element : [])
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Execution error:', error)
      setResult([{ element: { content: message }, type: 'error' }])
    }
    if (codeToRun !== undefined) {
      setCode(codeToRun)
    }
  }, [webContainer, language, setResult, setCode, appendResult, clearResult, setLanguage, code, showTopLevelResults, loopProtection, showUndefined])

  return { runCode }
}
