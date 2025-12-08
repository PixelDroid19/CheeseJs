import { useMemo, useCallback } from 'react';
import { useCodeStore } from '../store/useCodeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePackagesStore } from '../store/usePackagesStore';
import { usePythonPackagesStore } from '../store/usePythonPackagesStore';
import { themes } from '../themes';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  Download,
  AlertCircle,
  Loader2,
  Package as PackageIcon,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { usePackageMetadata } from '../hooks/usePackageMetadata';
import { usePythonPackageMetadata } from '../hooks/usePythonPackageMetadata';

function ResultDisplay() {
  const elements = useCodeStore((state) => state.result);
  const code = useCodeStore((state) => state.code);
  const { themeName, fontSize, alignResults } = useSettingsStore();
  const {
    packages,
    addPackage,
    setPackageInstalling,
    setPackageInstalled,
    setPackageError,
    detectedMissingPackages,
  } = usePackagesStore();
  const {
    packages: pythonPackages,
    addPackage: addPythonPackage,
    setPackageInstalling: setPythonPackageInstalling,
    setPackageInstalled: setPythonPackageInstalled,
    setPackageError: setPythonPackageError,
    detectedMissingPackages: detectedMissingPythonPackages,
  } = usePythonPackagesStore();
  const { t } = useTranslation();

  const { packageMetadata, dismissedPackages, setDismissedPackages } =
    usePackageMetadata(detectedMissingPackages);
  const {
    packageMetadata: pythonPackageMetadata,
    dismissedPackages: dismissedPythonPackages,
    setDismissedPackages: setDismissedPythonPackages,
  } = usePythonPackageMetadata(detectedMissingPythonPackages);

  // Handle package installation using native Electron API
  const handleInstallPackage = useCallback(
    async (packageName: string) => {
      console.log('[Result] Installing package:', packageName);
      addPackage(packageName);
      setPackageInstalling(packageName, true);

      if (window.packageManager) {
        try {
          const result = await window.packageManager.install(packageName);
          if (result.success) {
            setPackageInstalled(packageName, result.version);
          } else {
            setPackageError(packageName, result.error);
          }
        } catch (error) {
          setPackageError(
            packageName,
            error instanceof Error ? error.message : 'Installation failed'
          );
        }
      } else {
        // Fallback: just mark as installing (will be picked up by auto-install if enabled)
        console.warn('[Result] window.packageManager not available');
      }
    },
    [addPackage, setPackageInstalling, setPackageInstalled, setPackageError]
  );

  // Handle Python package installation using micropip
  const handleInstallPythonPackage = useCallback(
    async (packageName: string) => {
      console.log(
        '[Result] Installing Python package via micropip:',
        packageName
      );
      addPythonPackage(packageName);
      setPythonPackageInstalling(packageName, true);

      if (window.pythonPackageManager) {
        try {
          const result = await window.pythonPackageManager.install(packageName);
          if (result.success) {
            setPythonPackageInstalled(packageName, result.version);
          } else {
            setPythonPackageError(packageName, result.error);
          }
        } catch (error) {
          setPythonPackageError(
            packageName,
            error instanceof Error ? error.message : 'Installation failed'
          );
        }
      } else {
        console.warn('[Result] window.pythonPackageManager not available');
        setPythonPackageError(
          packageName,
          'Python package manager not available'
        );
      }
    },
    [
      addPythonPackage,
      setPythonPackageInstalling,
      setPythonPackageInstalled,
      setPythonPackageError,
    ]
  );

  function handleEditorWillMount(monaco: Monaco) {
    // Register all themes
    Object.entries(themes).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData);
    });

    // Access typescript defaults safely through type casting
    interface TSDefaults { setEagerModelSync(value: boolean): void; }
    interface TSLanguages { javascriptDefaults?: TSDefaults; }
    const ts = (monaco.languages as unknown as { typescript: TSLanguages }).typescript;
    if (ts?.javascriptDefaults) {
      ts.javascriptDefaults.setEagerModelSync(true);
    }
  }

  const displayValue = useMemo(() => {
    if (!elements || elements.length === 0) return '';

    // Filter out action results from the text display to avoid duplication/clutter
    const textElements = elements.filter((e) => !e.action);

    if (!alignResults) {
      return textElements.map((data) => data.element?.content || '').join('\n');
    }

    // Align results with source
    const sourceLineCount = code.split('\n').length;
    const maxLine = Math.max(
      sourceLineCount,
      ...textElements.map((e) => e.lineNumber || 0)
    );
    const lines = new Array(maxLine).fill('');

    textElements.forEach((data) => {
      if (data.lineNumber && data.lineNumber > 0) {
        // Line numbers are 1-based, array is 0-based
        // If multiple results on same line, join them
        const current = lines[data.lineNumber - 1];
        const content = data.element?.content || '';
        lines[data.lineNumber - 1] = current
          ? `${current} ${content}`
          : content;
      } else {
        // Append results without line numbers (like global errors) to the end
        lines.push(data.element?.content || '');
      }
    });

    return lines.join('\n');
  }, [elements, alignResults, code]);

  // Memoize action results filtering
  const actionResults = useMemo(
    () => elements.filter((e) => e.action),
    [elements]
  );

  // Memoize combined action items from multiple sources
  const allActionItems = useMemo(
    () => [
      // 1. Action results from code execution (npm)
      ...actionResults.map((r) => ({
        pkgName: r.action?.payload as string,
        message: r.element?.content || '',
        isActionResult: true,
        isPython: false,
      })),
      // 2. npm packages already managed (installing/error) - FILTER OUT INSTALLED
      ...packages
        .filter((p) => !actionResults.some((r) => r.action?.payload === p.name))
        .filter((p) => !p.isInstalled)
        .map((p) => ({
          pkgName: p.name,
          message: `Package "${p.name}"`,
          isActionResult: false,
          isPython: false,
        })),
      // 3. Detected missing npm packages
      ...detectedMissingPackages
        .filter((pkgName) => {
          if (actionResults.some((r) => r.action?.payload === pkgName))
            return false;
          const existingPkg = packages.find((p) => p.name === pkgName);
          if (existingPkg?.isInstalled) return false;
          if (existingPkg) return false;
          return true;
        })
        .map((pkgName) => ({
          pkgName,
          message: `Package "${pkgName}" is missing`,
          isActionResult: false,
          isPython: false,
        })),
      // 4. Python packages already managed (installing/error) - FILTER OUT INSTALLED
      ...pythonPackages
        .filter((p) => !p.isInstalled)
        .map((p) => ({
          pkgName: p.name,
          message: `Python package "${p.name}"`,
          isActionResult: false,
          isPython: true,
        })),
      // 5. Detected missing Python packages
      ...detectedMissingPythonPackages
        .filter((pkgName) => {
          const existingPkg = pythonPackages.find((p) => p.name === pkgName);
          if (existingPkg?.isInstalled) return false;
          if (existingPkg) return false;
          return true;
        })
        .map((pkgName) => ({
          pkgName,
          message: `Python package "${pkgName}" is missing`,
          isActionResult: false,
          isPython: true,
        })),
    ],
    [
      actionResults,
      packages,
      detectedMissingPackages,
      pythonPackages,
      detectedMissingPythonPackages,
    ]
  );

  // Memoize visible items after filtering dismissed packages (both npm and Python)
  const visibleActionItems = useMemo(
    () =>
      allActionItems.filter((item) => {
        if (item.isPython) {
          return !dismissedPythonPackages.includes(item.pkgName);
        }
        return !dismissedPackages.includes(item.pkgName);
      }),
    [allActionItems, dismissedPackages, dismissedPythonPackages]
  );

  const handleDismiss = (pkgName: string, isPython: boolean) => {
    if (isPython) {
      setDismissedPythonPackages((prev) => [...prev, pkgName]);
    } else {
      setDismissedPackages((prev) => [...prev, pkgName]);
    }
  };

  return (
    <div className="h-full flex flex-col text-foreground bg-background relative overflow-hidden">
      <div className="flex-1 relative min-h-0">
        <Editor
          theme={themeName}
          path="result-output.js"
          options={{
            automaticLayout: true,
            minimap: {
              enabled: false,
            },
            overviewRulerLanes: 0,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
            },
            fontSize,
            wordWrap: 'on',
            readOnly: true,
            lineNumbers: 'off',
            renderLineHighlight: 'none',
            showUnused: false,
            suggest: {
              selectionMode: 'never',
              previewMode: 'prefix',
            },
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
            const { pkgName, isPython } = item;
            const pkgInfo = isPython
              ? pythonPackages.find((p) => p.name === pkgName)
              : packages.find((p) => p.name === pkgName);
            const metadata = isPython
              ? pythonPackageMetadata[pkgName]
              : packageMetadata[pkgName];

            // Determine if package exists and what version
            const isUnknown = !metadata || metadata.loading;
            const doesNotExist =
              metadata?.error ||
              (metadata && !metadata.version && !metadata.name);
            const version = metadata?.version || pkgInfo?.version;

            // Handler for install button
            const handleInstall = () => {
              if (isPython) {
                handleInstallPythonPackage(pkgName);
              } else {
                handleInstallPackage(pkgName);
              }
            };

            return (
              <motion.div
                layout
                key={`${pkgName}-${index}`}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="pointer-events-auto bg-popover/95 backdrop-blur-md border border-border shadow-xl rounded-lg overflow-hidden"
              >
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-muted rounded-md">
                        {isPython ? (
                          <span className="text-lg">🐍</span>
                        ) : (
                          <PackageIcon className="size-4.5 text-primary" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground text-sm font-semibold truncate">
                            {pkgName}
                          </span>
                          {version && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                              v{version}
                            </span>
                          )}
                        </div>
                        {metadata?.description && (
                          <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                            {metadata.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDismiss(pkgName, isPython)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {pkgInfo?.installing ? (
                      <span className="text-info text-xs flex items-center gap-2 bg-info/10 px-3 py-1.5 rounded-md border border-info/20 w-full justify-center">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {t('packages.installing', 'Installing...')}
                      </span>
                    ) : pkgInfo?.error ? (
                      <div className="flex flex-col gap-2 w-full">
                        <span className="text-destructive text-xs flex items-center gap-2 bg-destructive/10 p-2 rounded border border-destructive/20">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{pkgInfo.error}</span>
                        </span>
                        <button
                          onClick={handleInstall}
                          className="w-full px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5" />{' '}
                          {t('packages.retry', 'Retry')}
                        </button>
                      </div>
                    ) : doesNotExist ? (
                      <span className="text-destructive text-xs flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-md border border-destructive/20 w-full justify-center">
                        <AlertCircle className="w-3.5 h-3.5" />{' '}
                        {t('packages.notFound', 'Package not found')}
                      </span>
                    ) : isUnknown ? (
                      <span className="text-muted-foreground text-xs flex items-center gap-2 w-full justify-center py-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />{' '}
                        {t('packages.checking', 'Checking...')}
                      </span>
                    ) : (
                      <button
                        onClick={handleInstall}
                        className="w-full px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />{' '}
                        {isPython
                          ? t('packages.installPython', 'Install via micropip')
                          : t('packages.install', 'Install Package')}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ResultDisplay;
