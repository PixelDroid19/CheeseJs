/**
 * Monaco Providers for Python
 * 
 * Provides IntelliSense features for Python code:
 * - Import detection and validation
 * - Missing package markers
 * - Hover information for packages
 * - Quick fix actions for installation
 */

import type { Monaco } from '@monaco-editor/react'
import type { editor, languages, IDisposable, IRange, Position, CancellationToken } from 'monaco-editor'
import { usePythonPackagesStore } from '../../store/usePythonPackagesStore'
import { isPythonStdlibModule, extractPythonPackageName } from './pythonStdlib'

let pythonHoverProvider: IDisposable | null = null
let pythonCodeActionProvider: IDisposable | null = null

// ============================================================================
// PYTHON IMPORT EXTRACTION
// ============================================================================

/**
 * Extract package name from Python import statement at cursor position
 */
function getPythonPackageAtPosition(model: editor.ITextModel, position: Position): { packageName: string; range: IRange } | null {
  const lineContent = model.getLineContent(position.lineNumber)
  
  // Python import patterns
  const patterns = [
    // from package import something
    { regex: /^\s*from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/g, group: 1 },
    // import package
    { regex: /^\s*import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/g, group: 1 },
    // import package as alias
    { regex: /^\s*import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+as\s+/g, group: 1 },
  ]
  
  for (const { regex, group } of patterns) {
    regex.lastIndex = 0
    let match
    while ((match = regex.exec(lineContent)) !== null) {
      const fullImport = match[group]
      const packageName = extractPythonPackageName(fullImport)
      
      // Skip stdlib modules
      if (isPythonStdlibModule(packageName)) {
        continue
      }
      
      // Find the position of the package name in the line
      const importKeywordEnd = lineContent.indexOf(fullImport)
      if (importKeywordEnd === -1) continue
      
      const packageStart = importKeywordEnd + 1
      const packageEnd = packageStart + fullImport.length
      
      // Check if cursor is within the package name
      if (position.column >= packageStart && position.column <= packageEnd + 1) {
        return {
          packageName,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: packageStart,
            endLineNumber: position.lineNumber,
            endColumn: packageEnd + 1
          }
        }
      }
    }
  }
  
  return null
}

// ============================================================================
// PYTHON IMPORT VALIDATION
// ============================================================================

/**
 * Scan for Python imports and set markers for missing packages
 */
export function validatePythonImports(model: editor.ITextModel, monaco: Monaco) {
  const code = model.getValue()
  const markers: editor.IMarkerData[] = []
  const packages = usePythonPackagesStore.getState().packages
  const missingPackages: string[] = []
  
  // Split by lines for accurate position tracking
  const lines = code.split('\n')
  
  // Python import patterns
  const patterns = [
    // from package import something (including multiline)
    { regex: /^\s*from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/, group: 1 },
    // import package (can have multiple comma-separated)
    { regex: /^\s*import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/, group: 1 },
  ]
  
  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 1
    
    for (const { regex, group } of patterns) {
      regex.lastIndex = 0
      const match = regex.exec(line)
      if (!match) continue
      
      const fullImport = match[group]
      const packageName = extractPythonPackageName(fullImport)
      
      // Skip stdlib modules
      if (isPythonStdlibModule(packageName)) {
        continue
      }
      
      // Check if installed
      const isInstalled = packages.some(p => p.name === packageName && p.isInstalled)
      
      if (!isInstalled) {
        // Add to missing packages list
        if (!missingPackages.includes(packageName)) {
          missingPackages.push(packageName)
        }
        
        // Find the position of the package name in the line
        const importStart = line.indexOf(fullImport)
        if (importStart === -1) continue
        
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: `Python package "${packageName}" is not installed. Use micropip to install it.`,
          startLineNumber: lineNumber,
          startColumn: importStart + 1,
          endLineNumber: lineNumber,
          endColumn: importStart + fullImport.length + 1,
          code: 'missing-python-package',
          source: 'Python Package Manager'
        })
      }
    }
    
    // Handle comma-separated imports: import pkg1, pkg2, pkg3
    const multiImportMatch = line.match(/^\s*import\s+(.+)$/)
    if (multiImportMatch) {
      const importsPart = multiImportMatch[1]
      const imports = importsPart.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())
      
      let currentOffset = line.indexOf(importsPart)
      
      for (const imp of imports) {
        if (!imp) continue
        
        const packageName = extractPythonPackageName(imp)
        
        // Skip stdlib modules
        if (isPythonStdlibModule(packageName)) {
          currentOffset = line.indexOf(imp, currentOffset) + imp.length
          continue
        }
        
        // Check if installed
        const isInstalled = packages.some(p => p.name === packageName && p.isInstalled)
        
        if (!isInstalled && !missingPackages.includes(packageName)) {
          missingPackages.push(packageName)
          
          const importStart = line.indexOf(imp, currentOffset)
          if (importStart !== -1) {
            markers.push({
              severity: monaco.MarkerSeverity.Warning,
              message: `Python package "${packageName}" is not installed.`,
              startLineNumber: lineNumber,
              startColumn: importStart + 1,
              endLineNumber: lineNumber,
              endColumn: importStart + imp.length + 1,
              code: 'missing-python-package',
              source: 'Python Package Manager'
            })
          }
        }
        
        currentOffset = line.indexOf(imp, currentOffset) + imp.length
      }
    }
  })
  
  monaco.editor.setModelMarkers(model, 'python-package-manager', markers)
  
  // Update detected missing packages in store
  const currentMissing = usePythonPackagesStore.getState().detectedMissingPackages
  const hasChanged = missingPackages.length !== currentMissing.length ||
                     !missingPackages.every(p => currentMissing.includes(p))
  
  if (hasChanged) {
    usePythonPackagesStore.getState().setDetectedMissingPackages(missingPackages)
  }
}

// ============================================================================
// PYTHON MONACO PROVIDERS
// ============================================================================

export function registerPythonMonacoProviders(monaco: Monaco, editorInstance: editor.IStandaloneCodeEditor) {
  // Dispose previous providers if they exist
  disposePythonMonacoProviders()
  
  const languageDisposables: IDisposable[] = []
  
  // Subscribe to package store changes to re-validate
  const unsubscribePackages = usePythonPackagesStore.subscribe(() => {
    const model = editorInstance.getModel()
    if (model && model.getLanguageId() === 'python') {
      validatePythonImports(model, monaco)
    }
  })
  
  // Validate on content change (debounced)
  let debounceTimer: ReturnType<typeof setTimeout>
  const contentChangeDisposable = editorInstance.onDidChangeModelContent(() => {
    const model = editorInstance.getModel()
    if (!model || model.getLanguageId() !== 'python') return
    
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      validatePythonImports(model, monaco)
    }, 1000)
  })
  
  // Validate on language change
  const languageChangeDisposable = editorInstance.onDidChangeModelLanguage((e) => {
    if (e.newLanguage === 'python') {
      const model = editorInstance.getModel()
      if (model) {
        validatePythonImports(model, monaco)
      }
    } else {
      // Clear Python markers when switching away from Python
      const model = editorInstance.getModel()
      if (model) {
        monaco.editor.setModelMarkers(model, 'python-package-manager', [])
      }
    }
  })
  
  languageDisposables.push({ dispose: unsubscribePackages })
  languageDisposables.push(contentChangeDisposable)
  languageDisposables.push(languageChangeDisposable)
  
  // Register Hover Provider for Python packages
  pythonHoverProvider = monaco.languages.registerHoverProvider('python', {
    provideHover: (model: editor.ITextModel, position: Position, token: CancellationToken): languages.ProviderResult<languages.Hover> => {
      if (token.isCancellationRequested) {
        return null
      }
      
      const packageInfo = getPythonPackageAtPosition(model, position)
      if (!packageInfo) {
        return null
      }
      
      const { packageName, range } = packageInfo
      const packages = usePythonPackagesStore.getState().packages
      const installedPkg = packages.find(p => p.name === packageName)
      
      const contents: { value: string; isTrusted?: boolean }[] = []
      
      // Header with package name
      contents.push({
        value: `### 🐍 \`${packageName}\``,
        isTrusted: true
      })
      
      // Installation status
      let statusText = ''
      if (installedPkg) {
        if (installedPkg.installing) {
          statusText = '**Status:** ⏳ Installing via micropip...'
        } else if (installedPkg.error) {
          statusText = `**Status:** ❌ Error: ${installedPkg.error}`
        } else {
          statusText = '**Status:** ✅ Installed'
          if (installedPkg.version) {
            statusText += `\n\n**Version:** \`${installedPkg.version}\``
          }
        }
      } else {
        statusText = '**Status:** ⚠️ Not installed\n\n*Use Quick Fix (Ctrl+.) to install via micropip*'
      }
      
      contents.push({
        value: statusText,
        isTrusted: true
      })
      
      // PyPI link
      contents.push({
        value: `\n\n[🔍 View on PyPI](https://pypi.org/project/${packageName}/)`,
        isTrusted: true
      })
      
      // Quick actions hint
      contents.push({
        value: '\n\n---\n\n💡 Press **Ctrl+.** for quick actions',
        isTrusted: true
      })
      
      return {
        contents,
        range
      }
    }
  })
  
  // Register Code Action Provider for Python packages
  pythonCodeActionProvider = monaco.languages.registerCodeActionProvider('python', {
    provideCodeActions: (
      model: editor.ITextModel,
      range: IRange,
      context: languages.CodeActionContext,
      token: CancellationToken
    ): languages.ProviderResult<languages.CodeActionList> => {
      if (token.isCancellationRequested) {
        return { actions: [], dispose: () => { /* no-op */ } }
      }
      
      const actions: languages.CodeAction[] = []
      const position = model.getPositionAt(model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn }))
      let packageInfo = getPythonPackageAtPosition(model, position)
      
      // Fallback: Check markers if getPythonPackageAtPosition failed
      if (!packageInfo) {
        const marker = context.markers.find(m => m.code === 'missing-python-package')
        if (marker) {
          const match = marker.message.match(/Python package "([^"]+)" is not installed/)
          if (match) {
            packageInfo = {
              packageName: match[1],
              range: {
                startLineNumber: marker.startLineNumber,
                startColumn: marker.startColumn,
                endLineNumber: marker.endLineNumber,
                endColumn: marker.endColumn
              }
            }
          }
        }
      }
      
      if (!packageInfo) {
        return { actions: [], dispose: () => { /* no-op */ } }
      }
      
      const { packageName } = packageInfo
      const packages = usePythonPackagesStore.getState().packages
      const pkg = packages.find(p => p.name === packageName)
      
      // Find relevant diagnostics
      const diagnostics = context.markers.filter(m =>
        m.code === 'missing-python-package' && m.message.includes(`"${packageName}"`)
      )
      
      if (!pkg || (!pkg.isInstalled && !pkg.installing)) {
        // Package not installed
        actions.push({
          title: `$(cloud-download) Install "${packageName}" (micropip)`,
          kind: 'quickfix',
          diagnostics,
          isPreferred: true,
          command: {
            id: 'cheeseJS.installPythonPackage',
            title: 'Install Python Package',
            arguments: [packageName]
          }
        })
        
        actions.push({
          title: `$(play) Install "${packageName}" and run code`,
          kind: 'quickfix',
          diagnostics,
          command: {
            id: 'cheeseJS.installPythonPackageAndRun',
            title: 'Install Python Package and Run',
            arguments: [packageName]
          }
        })
        
        actions.push({
          title: `$(link-external) View "${packageName}" on PyPI`,
          kind: 'quickfix',
          diagnostics,
          command: {
            id: 'cheeseJS.viewOnPyPI',
            title: 'View on PyPI',
            arguments: [packageName]
          }
        })
      } else if (pkg.error) {
        // Package has error
        actions.push({
          title: `$(refresh) Retry installing "${packageName}"`,
          kind: 'quickfix',
          diagnostics,
          isPreferred: true,
          command: {
            id: 'cheeseJS.retryPythonInstall',
            title: 'Retry Install',
            arguments: [packageName]
          }
        })
        
        actions.push({
          title: `$(link-external) View "${packageName}" on PyPI`,
          kind: 'quickfix',
          diagnostics,
          command: {
            id: 'cheeseJS.viewOnPyPI',
            title: 'View on PyPI',
            arguments: [packageName]
          }
        })
      } else if (pkg.installing) {
        // Package is installing
        actions.push({
          title: `$(sync~spin) "${packageName}" is being installed...`,
          kind: 'empty',
          diagnostics
        })
      } else {
        // Package is installed
        actions.push({
          title: `$(check) "${packageName}" is installed${pkg.version ? ` (v${pkg.version})` : ''}`,
          kind: 'empty',
          diagnostics
        })
        
        actions.push({
          title: `$(link-external) View "${packageName}" on PyPI`,
          kind: 'quickfix',
          diagnostics,
          command: {
            id: 'cheeseJS.viewOnPyPI',
            title: 'View on PyPI',
            arguments: [packageName]
          }
        })
      }
      
      return {
        actions,
        dispose: () => { /* no-op */ }
      }
    }
  })
  
  // Validate initially if Python
  const model = editorInstance.getModel()
  if (model && model.getLanguageId() === 'python') {
    validatePythonImports(model, monaco)
  }
  
  // Store disposables for cleanup
  const originalHoverDispose = pythonHoverProvider
  pythonHoverProvider = {
    dispose: () => {
      originalHoverDispose?.dispose()
      languageDisposables.forEach(d => d.dispose())
    }
  } as IDisposable
}

export function disposePythonMonacoProviders() {
  pythonHoverProvider?.dispose()
  pythonCodeActionProvider?.dispose()
  pythonHoverProvider = null
  pythonCodeActionProvider = null
}
