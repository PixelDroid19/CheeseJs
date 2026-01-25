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
  Filter,
  Trash2,
  Copy,
  Terminal,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { usePackageMetadata } from '../hooks/usePackageMetadata';
import { usePythonPackageMetadata } from '../hooks/usePythonPackageMetadata';

function ResultDisplay() {
  const elements = useCodeStore((state) => state.result);
  const clearResult = useCodeStore((state) => state.clearResult);
  const code = useCodeStore((state) => state.code);
  const {
    themeName,
    fontSize,
    alignResults,
    consoleFilters,
    setConsoleFilters,
  } = useSettingsStore();
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

  // Use filters from store (persisted) instead of local state
  const filters = consoleFilters;

  const toggleFilter = (type: keyof typeof filters) => {
    setConsoleFilters({ [type]: !filters[type] });
  };

  // Copy install command to clipboard
  const copyInstallCommand = useCallback(
    (pkgName: string, isPython: boolean) => {
      const command = isPython
        ? `pip install ${pkgName}`
        : `npm install ${pkgName}`;
      navigator.clipboard.writeText(command);
    },
    []
  );

  // Handle package installation using native Electron API
  const handleInstallPackage = useCallback(
    async (packageName: string) => {
      addPackage(packageName);

      // Check if packageManager is available
      if (!window.packageManager) {
        // Fallback: show clear error message with manual command hint
        setPackageError(
          packageName,
          t(
            'packages.managerUnavailable',
            'Package manager not available. Copy the command to install manually.'
          )
        );
        return;
      }

      setPackageInstalling(packageName, true);

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
    },
    [addPackage, setPackageInstalling, setPackageInstalled, setPackageError, t]
  );

  // Handle Python package installation using micropip
  const handleInstallPythonPackage = useCallback(
    async (packageName: string) => {
      addPythonPackage(packageName);

      // Check if pythonPackageManager is available
      if (!window.pythonPackageManager) {
        setPythonPackageError(
          packageName,
          t(
            'packages.managerUnavailable',
            'Package manager not available. Copy the command to install manually.'
          )
        );
        return;
      }

      setPythonPackageInstalling(packageName, true);

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
    },
    [
      addPythonPackage,
      setPythonPackageInstalling,
      setPythonPackageInstalled,
      setPythonPackageError,
      t,
    ]
  );

  function handleEditorWillMount(monaco: Monaco) {
    // Register all themes
    Object.entries(themes).forEach(([name, themeData]) => {
      monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData);
    });

    // Access typescript defaults safely through type casting
    interface TSDefaults {
      setEagerModelSync(value: boolean): void;
    }
    interface TSLanguages {
      javascriptDefaults?: TSDefaults;
    }
    const ts = (monaco.languages as unknown as { typescript: TSLanguages })
      .typescript;
    if (ts?.javascriptDefaults) {
      ts.javascriptDefaults.setEagerModelSync(true);
    }
  }

  const displayValue = useMemo(() => {
    if (!elements || elements.length === 0) return '';

    // Filter elements based on type
    const filteredElements = elements.filter((e) => {
      if (e.action) return false; // Filter out actions (handled separately)

      if (e.type === 'error') return filters.error;

      // Handle console types
      const consoleType = e.element?.consoleType || 'log';
      if (consoleType === 'warn') return filters.warn;
      if (consoleType === 'error') return filters.error;
      if (consoleType === 'info') return filters.info;

      // Default to log
      return filters.log;
    });

    if (!alignResults) {
      return filteredElements
        .map((data) => data.element?.content || '')
        .join('\n');
    }

    // Align results with source (keep alignment for filtered items if they persist?
    // Actually if we filter out, we probably shouldn't show them at all,
    // but for 'align', we need to respect the line number.
    // If a line is filtered, it should be empty on that line.)

    // To maintain alignment, we iterate original lines, but only content from filtered elements.

    // Better approach: Use filteredElements.
    // If aligned mode is ON, and I filter out errors, the error on line 5 disappears, line 5 has no result.

    const sourceLineCount = code.split('\n').length;
    const maxLine = Math.max(
      sourceLineCount,
      ...filteredElements.map((e) => e.lineNumber || 0)
    );
    const lines = new Array(maxLine).fill('');

    filteredElements.forEach((data) => {
      if (data.lineNumber && data.lineNumber > 0) {
        // Line numbers are 1-based, array is 0-based
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

    // Trim empty lines at the end if they exceed source code
    // (Optional, but keeps it clean)
    return lines.join('\n');
  }, [elements, alignResults, code, filters]);

  // Memoize action results filtering
  const actionResults = useMemo(
    () => elements.filter((e) => e.action),
    [elements]
  );

  // Memoize combined action items from multiple sources - DEDUPLICATED by pkgName
  const allActionItems = useMemo(() => {
    // Use Map to deduplicate by pkgName+isPython key
    const itemMap = new Map<
      string,
      {
        pkgName: string;
        message: string;
        isActionResult: boolean;
        isPython: boolean;
      }
    >();

    // Process in reverse priority order (later entries override earlier ones)

    // 1. Detected missing npm packages (lowest priority)
    detectedMissingPackages.forEach((pkgName) => {
      const existingPkg = packages.find((p) => p.name === pkgName);
      if (existingPkg?.isInstalled) return;
      if (existingPkg) return; // Already managed
      if (actionResults.some((r) => r.action?.payload === pkgName)) return;

      itemMap.set(`npm:${pkgName}`, {
        pkgName,
        message: `Package "${pkgName}" is missing`,
        isActionResult: false,
        isPython: false,
      });
    });

    // 2. npm packages already managed (installing/error)
    packages.forEach((p) => {
      if (p.isInstalled) return;
      if (actionResults.some((r) => r.action?.payload === p.name)) return;

      itemMap.set(`npm:${p.name}`, {
        pkgName: p.name,
        message: `Package "${p.name}"`,
        isActionResult: false,
        isPython: false,
      });
    });

    // 3. Action results from code execution (highest priority for npm)
    actionResults.forEach((r) => {
      const pkgName = r.action?.payload as string;
      if (pkgName) {
        itemMap.set(`npm:${pkgName}`, {
          pkgName,
          message: String(r.element?.content || ''),
          isActionResult: true,
          isPython: false,
        });
      }
    });

    // 4. Detected missing Python packages (lowest priority for Python)
    detectedMissingPythonPackages.forEach((pkgName) => {
      const existingPkg = pythonPackages.find((p) => p.name === pkgName);
      if (existingPkg?.isInstalled) return;
      if (existingPkg) return;

      itemMap.set(`python:${pkgName}`, {
        pkgName,
        message: `Python package "${pkgName}" is missing`,
        isActionResult: false,
        isPython: true,
      });
    });

    // 5. Python packages already managed (higher priority)
    pythonPackages.forEach((p) => {
      if (p.isInstalled) return;

      itemMap.set(`python:${p.name}`, {
        pkgName: p.name,
        message: `Python package "${p.name}"`,
        isActionResult: false,
        isPython: true,
      });
    });

    return Array.from(itemMap.values());
  }, [
    actionResults,
    packages,
    detectedMissingPackages,
    pythonPackages,
    detectedMissingPythonPackages,
  ]);

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
    <div className="result-container h-full flex flex-col text-foreground bg-background relative overflow-hidden">
      {/* Console Toolbar */}
      <div className="result-toolbar flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="mr-2 flex items-center text-muted-foreground">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs font-medium">
              {t('result.filters', 'Filters')}:
            </span>
          </div>

          <FilterToggle
            active={filters.log}
            onClick={() => toggleFilter('log')}
            label="Log"
            count={
              elements.filter(
                (e) =>
                  !e.action &&
                  (e.element?.consoleType === 'log' ||
                    (!e.element?.consoleType && e.type !== 'error'))
              ).length
            }
          />
          <FilterToggle
            active={filters.info}
            onClick={() => toggleFilter('info')}
            label="Info"
            color="text-info"
            count={
              elements.filter((e) => e.element?.consoleType === 'info').length
            }
          />
          <FilterToggle
            active={filters.warn}
            onClick={() => toggleFilter('warn')}
            label="Warn"
            color="text-amber-500"
            count={
              elements.filter((e) => e.element?.consoleType === 'warn').length
            }
          />
          <FilterToggle
            active={filters.error}
            onClick={() => toggleFilter('error')}
            label="Error"
            color="text-destructive"
            count={
              elements.filter(
                (e) => e.type === 'error' || e.element?.consoleType === 'error'
              ).length
            }
          />
        </div>

        {/* Clear Output Button */}
        <button
          onClick={clearResult}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title={t('result.clear', 'Clear Output')}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('result.clear', 'Clear')}</span>
        </button>
      </div>

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
            fontFamily:
              themeName === 'sketchy'
                ? "'Courier Prime', 'Courier New', monospace"
                : "'Fira Code', 'Cascadia Code', Consolas, monospace",
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
                      title={t('packages.dismiss', 'Dismiss')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Copy command button */}
                  <div className="flex items-center gap-2 px-1">
                    <button
                      onClick={() => copyInstallCommand(pkgName, isPython)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title={t('packages.copyCommand', 'Copy install command')}
                    >
                      <Terminal className="w-3 h-3" />
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                        {isPython
                          ? `pip install ${pkgName}`
                          : `npm i ${pkgName}`}
                      </code>
                      <Copy className="w-3 h-3" />
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

function FilterToggle({
  active,
  onClick,
  label,
  color,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  count: number;
}) {
  // Only show count if > 0
  const showCount = count > 0;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2 py-1 rounded text-xs font-medium border flex items-center gap-1.5 transition-all select-none',
        active
          ? 'bg-background border-border shadow-sm text-foreground'
          : 'bg-muted/50 border-transparent text-muted-foreground opacity-70 hover:opacity-100'
      )}
    >
      <div
        className={clsx(
          'w-2 h-2 rounded-full',
          active ? color || 'bg-foreground' : 'bg-muted-foreground/50'
        )}
      />
      {label}
      {showCount && (
        <span className="text-[10px] opacity-60 bg-muted px-1 rounded-sm min-w-[14px] text-center">
          {count}
        </span>
      )}
    </button>
  );
}
