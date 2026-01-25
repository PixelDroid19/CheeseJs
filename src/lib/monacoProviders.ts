import type { Monaco } from '@monaco-editor/react';
import type {
  editor,
  languages,
  IDisposable,
  IRange,
  Position,
  CancellationToken,
} from 'monaco-editor';
import { usePackagesStore } from '../store/usePackagesStore';
import {
  fetchPackageInfo,
  getCachedPackageInfo,
  clearPackageInfoCache,
} from './npm';
import { importValidator } from './workers/importValidatorManager';

let hoverProvider: IDisposable | null = null;
let codeActionProvider: IDisposable | null = null;
let completionProvider: IDisposable | null = null;

// Track pending validation and queued request
let pendingValidation: Promise<void> | null = null;
let queuedValidation: { model: editor.ITextModel; monaco: Monaco } | null =
  null;

// Extract package name from import statement at cursor position
function getPackageAtPosition(
  model: editor.ITextModel,
  position: Position
): { packageName: string; range: IRange } | null {
  const lineContent = model.getLineContent(position.lineNumber);

  // Match various import patterns
  const patterns = [
    { regex: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, group: 1 },
    { regex: /import\s+['"]([^'"]+)['"]/g, group: 1 },
    { regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, group: 1 },
    { regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, group: 1 }, // dynamic import
  ];

  for (const { regex, group } of patterns) {
    regex.lastIndex = 0; // Reset regex
    let match;
    while ((match = regex.exec(lineContent)) !== null) {
      const packagePath = match[group];

      // Find the exact position of the package name in quotes
      const quoteMatch = lineContent
        .substring(match.index)
        .match(/['"]([^'"]+)['"]/);
      if (!quoteMatch) continue;

      const quoteStart =
        match.index + lineContent.substring(match.index).indexOf(quoteMatch[0]);
      const packageStart = quoteStart + 1; // After opening quote
      const packageEnd = packageStart + packagePath.length;

      // Check if cursor is within the package name (between quotes)
      if (position.column > packageStart && position.column <= packageEnd + 1) {
        // Extract base package name (handle scoped packages and subpaths)
        let packageName = packagePath;
        if (packagePath.startsWith('@')) {
          const parts = packagePath.split('/');
          packageName =
            parts.length >= 2 ? `${parts[0]}/${parts[1]}` : packagePath;
        } else {
          packageName = packagePath.split('/')[0];
        }

        // Skip relative imports
        if (packageName.startsWith('.') || packageName.startsWith('/')) {
          return null;
        }

        return {
          packageName,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: packageStart,
            endLineNumber: position.lineNumber,
            endColumn: packageEnd + 1,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Validate imports and set markers for missing packages.
 * Uses a Web Worker for large files to prevent UI blocking.
 */
async function validateImportsAsync(
  model: editor.ITextModel,
  monaco: Monaco
): Promise<void> {
  const code = model.getValue();
  const packages = usePackagesStore.getState().packages;

  // Get list of installed package names
  const installedPackages = packages
    .filter((p) => p.isInstalled)
    .map((p) => p.name);

  try {
    // Use the worker manager (it handles sync/async decision internally)
    const result = await importValidator.validateAsync(code, installedPackages);

    // Check if model is still valid (might have been disposed during async operation)
    if (model.isDisposed()) {
      return;
    }

    // Convert markers to Monaco format
    const markers: editor.IMarkerData[] = result.markers.map((marker) => {
      const startPos = model.getPositionAt(marker.startOffset);
      const endPos = model.getPositionAt(marker.endOffset);

      return {
        severity: monaco.MarkerSeverity.Warning,
        message: `Package "${marker.packageName}" is not installed.`,
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
        code: 'missing-package',
        source: 'Package Manager',
      };
    });

    monaco.editor.setModelMarkers(model, 'package-manager', markers);

    // Update detected missing packages in store
    const currentMissing = usePackagesStore.getState().detectedMissingPackages;
    const hasChanged =
      result.missingPackages.length !== currentMissing.length ||
      !result.missingPackages.every((p) => currentMissing.includes(p));

    if (hasChanged) {
      usePackagesStore
        .getState()
        .setDetectedMissingPackages(result.missingPackages);
    }
  } catch (error) {
    console.error('[MonacoProviders] Import validation failed:', error);
  }
}

/**
 * Wrapper to handle concurrent validation requests.
 * Ensures only one validation runs at a time and queues the latest request.
 * When a validation completes, it checks for queued requests and processes them.
 */
function validateImports(model: editor.ITextModel, monaco: Monaco): void {
  // If a validation is already pending, queue this request (replacing any previous queued)
  if (pendingValidation) {
    queuedValidation = { model, monaco };
    return;
  }

  const runValidation = (): Promise<void> => {
    return validateImportsAsync(model, monaco).finally(() => {
      pendingValidation = null;

      // Check if there's a queued request to process
      if (queuedValidation) {
        const { model: queuedModel, monaco: queuedMonaco } = queuedValidation;
        queuedValidation = null;

        // Only process if model is still valid
        if (!queuedModel.isDisposed()) {
          pendingValidation = validateImportsAsync(
            queuedModel,
            queuedMonaco
          ).finally(() => {
            pendingValidation = null;
            // Recursively check for more queued requests
            if (queuedValidation) {
              validateImports(queuedValidation.model, queuedValidation.monaco);
            }
          });
        }
      }
    });
  };

  pendingValidation = runValidation();
}

export function registerMonacoProviders(
  monaco: Monaco,
  editorInstance: editor.IStandaloneCodeEditor
) {
  // Dispose previous providers if they exist
  disposeMonacoProviders();

  // Use lazy loading with onLanguage for better performance
  // Only register providers when JavaScript or TypeScript is activated
  const languageDisposables: IDisposable[] = [];

  // Subscribe to package store changes to re-validate
  const unsubscribePackages = usePackagesStore.subscribe(() => {
    const model = editorInstance.getModel();
    if (model) {
      validateImports(model, monaco);
    }
  });

  // Validate on content change (debounced)
  let debounceTimer: ReturnType<typeof setTimeout>;
  const contentChangeDisposable = editorInstance.onDidChangeModelContent(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const model = editorInstance.getModel();
      if (model) {
        validateImports(model, monaco);
      }
    }, 1000); // Wait 1 second after typing stops
  });

  // Validate initially
  const model = editorInstance.getModel();
  if (model) {
    validateImports(model, monaco);
  }

  // Add subscription to disposables (we wrap it in an IDisposable)
  languageDisposables.push({ dispose: unsubscribePackages });
  languageDisposables.push(contentChangeDisposable);

  const registerProviders = () => {
    // Register Enhanced Hover Provider with IntelliSense
    hoverProvider = monaco.languages.registerHoverProvider(
      ['javascript', 'typescript'],
      {
        provideHover: (
          model: editor.ITextModel,
          position: Position,
          token: CancellationToken
        ): languages.ProviderResult<languages.Hover> => {
          // Check if operation was cancelled
          if (token.isCancellationRequested) {
            return null;
          }

          const packageInfo = getPackageAtPosition(model, position);
          if (!packageInfo) {
            return null;
          }

          const { packageName, range } = packageInfo;

          // Check cancellation again
          if (token.isCancellationRequested) {
            return null;
          }

          const packages = usePackagesStore.getState().packages;
          const installedPkg = packages.find((p) => p.name === packageName);

          const contents: {
            value: string;
            isTrusted?: boolean;
            supportHtml?: boolean;
          }[] = [];

          // Header with package name
          contents.push({
            value: `### 📦 \`${packageName}\``,
            isTrusted: true,
          });

          // Installation status with color coding
          let statusText = '';
          if (installedPkg) {
            if (installedPkg.installing) {
              statusText = '**Status:** ⏳ Installing...';
            } else if (installedPkg.error) {
              statusText = `**Status:** ❌ Error: ${installedPkg.error}`;
            } else {
              statusText = '**Status:** ✅ Installed';
              if (installedPkg.version) {
                statusText += `\n\n**Version:** \`${installedPkg.version}\``;
              }
            }
          } else {
            statusText =
              '**Status:** ⚠️ Not installed\n\n*Use Quick Fix (Ctrl+.) or Install button in output*';
          }

          contents.push({
            value: statusText,
            isTrusted: true,
          });

          // Try to get cached info from npm
          const pkgInfo = getCachedPackageInfo(packageName);
          if (pkgInfo && !('error' in pkgInfo)) {
            contents.push({ value: '---', isTrusted: true });

            if (pkgInfo.description) {
              contents.push({
                value: pkgInfo.description,
                isTrusted: true,
              });
            }

            const detailParts: string[] = [];
            if (pkgInfo.version) {
              detailParts.push(`**Latest:** \`${pkgInfo.version}\``);
            }

            if (pkgInfo.author) {
              const authorName =
                typeof pkgInfo.author === 'string'
                  ? pkgInfo.author
                  : pkgInfo.author?.name;
              if (authorName) {
                detailParts.push(`**Author:** ${authorName}`);
              }
            }

            if (pkgInfo.license) {
              detailParts.push(`**License:** \`${pkgInfo.license}\``);
            }

            if (detailParts.length > 0) {
              contents.push({
                value: detailParts.join(' • '),
                isTrusted: true,
              });
            }

            if (pkgInfo.homepage) {
              contents.push({
                value: `[📄 Homepage](${pkgInfo.homepage})`,
                isTrusted: true,
                supportHtml: true,
              });
            }

            if (pkgInfo.repository?.url) {
              const repoUrl = pkgInfo.repository.url
                .replace(/^git\+/, '')
                .replace(/\.git$/, '')
                .replace(/^git:\/\//, 'https://');
              contents.push({
                value: `[📦 Repository](${repoUrl})`,
                isTrusted: true,
                supportHtml: true,
              });
            }

            contents.push({
              value: `[🔍 View on npm](https://www.npmjs.com/package/${packageName})`,
              isTrusted: true,
              supportHtml: true,
            });
          } else {
            // Fetch package info asynchronously for next hover
            fetchPackageInfo(packageName).catch(() => {
              // Silent fail
            });

            contents.push({
              value: '\n\n*Loading package information...*',
              isTrusted: true,
            });
          }

          // Quick actions hint
          contents.push({
            value: '\n\n---\n\n💡 Press **Ctrl+.** for quick actions',
            isTrusted: true,
          });

          return {
            contents,
            range,
          };
        },
      }
    );

    // Register Code Action Provider with Quick Fixes
    codeActionProvider = monaco.languages.registerCodeActionProvider(
      ['javascript', 'typescript'],
      {
        provideCodeActions: (
          model: editor.ITextModel,
          range: IRange,
          _context: languages.CodeActionContext,
          token: CancellationToken
        ): languages.ProviderResult<languages.CodeActionList> => {
          if (token.isCancellationRequested) {
            return {
              actions: [],
              dispose: () => {
                /* no-op */
              },
            };
          }

          const actions: languages.CodeAction[] = [];
          const position = model.getPositionAt(
            model.getOffsetAt({
              lineNumber: range.startLineNumber,
              column: range.startColumn,
            })
          );
          let packageInfo = getPackageAtPosition(model, position);

          // Fallback: Check markers if getPackageAtPosition failed
          if (!packageInfo) {
            const marker = _context.markers.find(
              (m) => m.code === 'missing-package'
            );
            if (marker) {
              // Extract package name from message: Package "packageName" is not installed.
              const match = marker.message.match(
                /Package "([^"]+)" is not installed/
              );
              if (match) {
                packageInfo = {
                  packageName: match[1],
                  range: {
                    startLineNumber: marker.startLineNumber,
                    startColumn: marker.startColumn,
                    endLineNumber: marker.endLineNumber,
                    endColumn: marker.endColumn,
                  },
                };
              }
            }
          }

          if (!packageInfo) {
            return {
              actions: [],
              dispose: () => {
                /* no-op */
              },
            };
          }

          const { packageName } = packageInfo;
          const packages = usePackagesStore.getState().packages;
          const pkg = packages.find((p) => p.name === packageName);

          // Find relevant diagnostics
          const diagnostics = _context.markers.filter(
            (m) =>
              m.code === 'missing-package' &&
              m.message.includes(`"${packageName}"`)
          );

          if (!pkg) {
            // Package not installed
            actions.push({
              title: `$(cloud-download) Install "${packageName}"`,
              kind: 'quickfix',
              diagnostics,
              isPreferred: true,
              command: {
                id: 'cheeseJS.installPackage',
                title: 'Install Package',
                arguments: [packageName],
              },
            });

            actions.push({
              title: `$(play) Install "${packageName}" and run code`,
              kind: 'quickfix',
              diagnostics,
              command: {
                id: 'cheeseJS.installAndRun',
                title: 'Install Package and Run',
                arguments: [packageName],
              },
            });

            actions.push({
              title: `$(link-external) View "${packageName}" on npm`,
              kind: 'quickfix',
              diagnostics,
              command: {
                id: 'cheeseJS.viewOnNpm',
                title: 'View on npm',
                arguments: [packageName],
              },
            });
          } else if (pkg.error) {
            // Package has error
            actions.push({
              title: `$(refresh) Retry installing "${packageName}"`,
              kind: 'quickfix',
              diagnostics,
              isPreferred: true,
              command: {
                id: 'cheeseJS.retryInstall',
                title: 'Retry Install',
                arguments: [packageName],
              },
            });

            actions.push({
              title: `$(link-external) View "${packageName}" on npm`,
              kind: 'quickfix',
              diagnostics,
              command: {
                id: 'cheeseJS.viewOnNpm',
                title: 'View on npm',
                arguments: [packageName],
              },
            });
          } else if (pkg.installing) {
            // Package is installing
            actions.push({
              title: `$(sync~spin) "${packageName}" is being installed...`,
              kind: 'empty',
              diagnostics,
            });
          } else {
            // Package is installed
            actions.push({
              title: `$(check) "${packageName}" is installed${pkg.version ? ` (v${pkg.version})` : ''}`,
              kind: 'empty',
              diagnostics,
            });

            actions.push({
              title: `$(trash) Uninstall "${packageName}"`,
              kind: 'refactor',
              diagnostics,
              command: {
                id: 'cheeseJS.uninstallPackage',
                title: 'Uninstall Package',
                arguments: [packageName],
              },
            });

            actions.push({
              title: `$(link-external) View "${packageName}" on npm`,
              kind: 'quickfix',
              diagnostics,
              command: {
                id: 'cheeseJS.viewOnNpm',
                title: 'View on npm',
                arguments: [packageName],
              },
            });
          }

          return {
            actions,
            dispose: () => {
              /* no-op */
            },
          };
        },
      }
    );

    // Register Completion Provider for npm packages
    completionProvider = monaco.languages.registerCompletionItemProvider(
      ['javascript', 'typescript'],
      {
        triggerCharacters: ["'", '"', '/'],
        provideCompletionItems: (
          model: editor.ITextModel,
          position: Position,
          _context: languages.CompletionContext,
          token: CancellationToken
        ): languages.ProviderResult<languages.CompletionList> => {
          if (token.isCancellationRequested) {
            return { suggestions: [] };
          }

          const lineContent = model.getLineContent(position.lineNumber);
          const textUntilPosition = lineContent.substring(
            0,
            position.column - 1
          );

          // Check if we're in an import/require statement
          const isImport =
            /import\s+.*?\s+from\s+['"]/.test(textUntilPosition) ||
            /require\s*\(\s*['"]/.test(textUntilPosition) ||
            /import\s*\(\s*['"]/.test(textUntilPosition);

          if (!isImport) {
            return { suggestions: [] };
          }

          const packages = usePackagesStore.getState().packages;
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions: languages.CompletionItem[] = packages.map(
            (pkg) => ({
              label: {
                label: pkg.name,
                description: pkg.version ? `v${pkg.version}` : undefined,
              },
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: pkg.name,
              detail: pkg.installing ? 'Installing...' : 'Installed',
              documentation: pkg.error
                ? `Error: ${pkg.error}`
                : `Installed package: ${pkg.name}`,
              range,
              sortText: pkg.installing ? 'z' + pkg.name : 'a' + pkg.name, // Prioritize installed packages
            })
          );

          return {
            suggestions,
            incomplete: false,
          };
        },
      }
    );
  };

  // Register providers immediately since we know we're using JS/TS
  registerProviders();

  // Also set up lazy loading listeners for language activation
  languageDisposables.push(
    monaco.languages.onLanguage('javascript', () => {
      if (!hoverProvider) {
        registerProviders();
      }
    })
  );

  languageDisposables.push(
    monaco.languages.onLanguage('typescript', () => {
      if (!hoverProvider) {
        registerProviders();
      }
    })
  );

  // Store language disposables for cleanup
  const originalHoverDispose = hoverProvider;
  hoverProvider = {
    dispose: () => {
      originalHoverDispose?.dispose();
      languageDisposables.forEach((d) => d.dispose());
    },
  } as IDisposable;
}

export function disposeMonacoProviders() {
  hoverProvider?.dispose();
  codeActionProvider?.dispose();
  completionProvider?.dispose();
  hoverProvider = null;
  codeActionProvider = null;
  completionProvider = null;
  pendingValidation = null;
  queuedValidation = null;
  clearPackageInfoCache();
  // Note: We don't dispose the worker here as it's a singleton
  // that can be reused. It will be disposed when the page unloads.
}
