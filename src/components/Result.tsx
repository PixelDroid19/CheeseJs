import { useMemo, useState, useEffect } from 'react'
import { useCodeStore } from '../store/useCodeStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { usePackagesStore } from '../store/usePackagesStore'
import { themes } from '../themes'
import Editor, { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import LoadingIndicator from './LoadingIndicator'
import { Download, AlertCircle, Loader2, Package as PackageIcon, X } from 'lucide-react'
import { fetchPackageInfo } from '../lib/npm'
import { AnimatePresence, motion } from 'framer-motion'

function ResultDisplay () {
  const elements = useCodeStore((state) => state.result)
  const code = useCodeStore((state) => state.code)
  const isExecuting = useCodeStore((state) => state.isExecuting)
  const { themeName, fontSize, alignResults } = useSettingsStore()
  const { packages, addPackage, detectedMissingPackages } = usePackagesStore()

  // Local state to store fetched package metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [packageMetadata, setPackageMetadata] = useState<Record<string, any>>({})

  // Local state for dismissed packages (toasts)
  const [dismissedPackages, setDismissedPackages] = useState<string[]>([])

  // Fetch metadata for missing packages
  useEffect(() => {
    const fetchMetadata = async () => {
      for (const pkgName of detectedMissingPackages) {
        if (!packageMetadata[pkgName]) {
          // Set a loading state or placeholder first
          setPackageMetadata(prev => ({ ...prev, [pkgName]: { loading: true } }))

          const info = await fetchPackageInfo(pkgName)

          setPackageMetadata(prev => ({
            ...prev,
            [pkgName]: info || { error: 'Failed to fetch info' }
          }))
        }
      }
    }

    if (detectedMissingPackages.length > 0) {
      fetchMetadata()
    }
  }, [detectedMissingPackages, packageMetadata])

  function handleEditorWillMount (monaco: Monaco) {
    // Register all themes
    Object.entries(themes).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData)
    })
    // @ts-expect-error - Accessing new top-level typescript namespace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = (monaco as any).typescript
    ts.javascriptDefaults.setEagerModelSync(true)
  }

  const displayValue = useMemo(() => {
    if (!elements || elements.length === 0) return ''

    // Filter out action results from the text display to avoid duplication/clutter
    const textElements = elements.filter(e => !e.action)

    if (!alignResults) {
      return textElements.map((data) => data.element?.content || '').join('\n')
    }

    // Align results with source
    const sourceLineCount = code.split('\n').length
    const maxLine = Math.max(
      sourceLineCount,
      ...textElements.map((e) => e.lineNumber || 0)
    )
    const lines = new Array(maxLine).fill('')

    textElements.forEach((data) => {
      if (data.lineNumber && data.lineNumber > 0) {
        // Line numbers are 1-based, array is 0-based
        // If multiple results on same line, join them
        const current = lines[data.lineNumber - 1]
        const content = data.element?.content || ''
        lines[data.lineNumber - 1] = current
          ? `${current} ${content}`
          : content
      } else {
        // Append results without line numbers (like global errors) to the end
        lines.push(data.element?.content || '')
      }
    })

    return lines.join('\n')
  }, [elements, alignResults, code])

  const actionResults = elements.filter(e => e.action)

  // Combine actionResults, packages (managed), and detectedMissingPackages
  const allActionItems = [
    // 1. Action results from code execution
    ...actionResults.map(r => ({
      pkgName: r.action?.payload as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message: (r.element as any).content || '',
      isActionResult: true
    })),
    // 2. Packages already managed (installing/error) - FILTER OUT INSTALLED
    ...packages
      .filter(p => !actionResults.some(r => r.action?.payload === p.name))
      // Hide installed packages from the interface as requested
      .filter(p => !p.isInstalled)
      .map(p => ({
        pkgName: p.name,
        message: `Package "${p.name}"`,
        isActionResult: false
      })),
    // 3. Detected missing packages (not in packages store yet)
    ...detectedMissingPackages
      .filter(pkgName =>
        !actionResults.some(r => r.action?.payload === pkgName) &&
        !packages.some(p => p.name === pkgName)
      )
      .map(pkgName => ({
        pkgName,
        message: `Package "${pkgName}" is missing`,
        isActionResult: false
      }))
  ]

  // Filter out dismissed packages
  const visibleActionItems = allActionItems.filter(item => !dismissedPackages.includes(item.pkgName))

  const handleDismiss = (pkgName: string) => {
    setDismissedPackages(prev => [...prev, pkgName])
  }

  return (
    <div className="h-full flex flex-col text-cyan-50 bg-[#1e1e1e] relative overflow-hidden">
      <div className="flex-1 relative min-h-0">
        {isExecuting && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-10 flex items-center justify-center">
            <LoadingIndicator message="Executing code..." size="md" />
          </div>
        )}
        <Editor
          theme={themeName}
          path="result-output.js"
          options={{
            automaticLayout: true,
            minimap: {
              enabled: false
            },
            overviewRulerLanes: 0,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto'
            },
            fontSize,
            wordWrap: 'on',
            readOnly: true,
            lineNumbers: 'off',
            renderLineHighlight: 'none',
            showUnused: false,
            suggest: {
              selectionMode: 'never',
              previewMode: 'prefix'
            }
          }}
          defaultLanguage="javascript"
          value={displayValue || '// Waiting for output...'}
          beforeMount={handleEditorWillMount}
        />
      </div>

      {/* Floating Toasts Container */}
      <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence mode="popLayout">
          {visibleActionItems.map((item, index) => {
            const { pkgName } = item
            const pkgInfo = packages.find(p => p.name === pkgName)
            const metadata = packageMetadata[pkgName]

            // Determine if package exists and what version
            const isUnknown = !metadata || metadata.loading
            const doesNotExist = metadata?.error || (metadata && !metadata.version && !metadata.name)
            const version = metadata?.version || pkgInfo?.version

            return (
              <motion.div
                layout
                key={`${pkgName}-${index}`}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="pointer-events-auto bg-[#252526]/95 backdrop-blur-md border border-[#3e3e42] shadow-xl rounded-lg overflow-hidden"
              >
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-[#3e3e42]/50 rounded-md">
                        <PackageIcon className="w-[1.125rem] h-[1.125rem] text-blue-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-100 text-sm font-semibold truncate">{pkgName}</span>
                          {version && (
                            <span className="text-[10px] bg-[#3e3e42] text-gray-400 px-1.5 py-0.5 rounded border border-[#4e4e52]">
                              v{version}
                            </span>
                          )}
                        </div>
                        {metadata?.description && (
                          <span className="text-gray-500 text-xs truncate max-w-[200px]">
                            {metadata.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDismiss(pkgName)}
                      className="text-gray-500 hover:text-gray-300 transition-colors p-1 hover:bg-[#3e3e42] rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {pkgInfo?.installing
                      ? (
                      <span className="text-blue-400 text-xs flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-md border border-blue-500/20 w-full justify-center">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Installing...
                      </span>
                        )
                      : pkgInfo?.error
                        ? (
                      <div className="flex flex-col gap-2 w-full">
                         <span className="text-red-400 text-xs flex items-center gap-2 bg-red-500/10 p-2 rounded border border-red-500/20">
                           <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                           <span className="truncate">{pkgInfo.error}</span>
                         </span>
                         <button
                           onClick={() => pkgName && addPackage(pkgName)}
                           className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                         >
                           <Download className="w-3.5 h-3.5" /> Retry
                         </button>
                      </div>
                          )
                        : doesNotExist
                          ? (
                      <span className="text-red-400 text-xs flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-md border border-red-500/20 w-full justify-center">
                        <AlertCircle className="w-3.5 h-3.5" /> Package not found
                      </span>
                            )
                          : isUnknown
                            ? (
                      <span className="text-gray-400 text-xs flex items-center gap-2 w-full justify-center py-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...
                      </span>
                              )
                            : (
                      <button
                        onClick={() => pkgName && addPackage(pkgName)}
                        className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" /> Install Package
                      </button>
                              )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default ResultDisplay
