import * as jsonrpc from 'vscode-jsonrpc/browser.js';
import * as monaco from 'monaco-editor';
import type { LspBridgeApi, LspConfigApi } from '@cheesejs/core';
import { IpcMessageReader } from './IpcMessageReader';
import { IpcMessageWriter } from './IpcMessageWriter';

interface LspClient {
  connection: jsonrpc.MessageConnection;
  disposables: monaco.IDisposable[];
  langId: string;
}

interface LspConfigResponse {
  languages?: Record<string, { initializationOptions?: unknown }>;
}

interface LspPosition {
  line?: number;
  character?: number;
}

interface LspRange {
  start?: LspPosition;
  end?: LspPosition;
}

interface LspDiagnostic {
  severity?: number;
  message: string;
  range?: LspRange;
  source?: string;
}

interface LspPublishDiagnosticsParams {
  uri: string;
  diagnostics?: LspDiagnostic[];
}

interface LspCompletionItem {
  label: string;
  kind?: number;
  insertText?: string;
  detail?: string;
  documentation?: unknown;
  sortText?: string;
  filterText?: string;
}

type LspCompletionResponse =
  | LspCompletionItem[]
  | { items?: LspCompletionItem[] };

interface LspHoverResponse {
  contents?: unknown | unknown[];
  range?: LspRange;
}

interface LspSignatureParameter {
  label: string | [number, number];
  documentation?: unknown;
}

interface LspSignature {
  label: string;
  documentation?: unknown;
  parameters?: LspSignatureParameter[];
}

interface LspSignatureHelpResponse {
  signatures?: LspSignature[];
  activeSignature?: number;
  activeParameter?: number;
}

export interface MonacoLspClientDependencies {
  getLspBridge: () => LspBridgeApi | undefined;
  getLspConfig: () => LspConfigApi | undefined;
}

export function createMonacoLspClient({
  getLspBridge,
  getLspConfig,
}: MonacoLspClientDependencies) {
  let activeClients: Record<string, LspClient> = {};

  function isLspClientActive(langId: string): boolean {
    return !!activeClients[langId];
  }

  async function startLspClient(langId: string, _documentSelector: string[]) {
    if (activeClients[langId]) {
      return;
    }

    const lspBridge = getLspBridge();
    if (!lspBridge) {
      throw new Error('LSP bridge not available');
    }

    const res = await lspBridge.start(langId);
    if (!res.success) {
      throw new Error(`Failed to start LSP backend: ${res.error}`);
    }

    const reader = new IpcMessageReader(langId, lspBridge);
    const writer = new IpcMessageWriter(langId, lspBridge);
    const connection = jsonrpc.createMessageConnection(reader, writer);

    connection.listen();

    let initializationOptions: unknown = undefined;
    try {
      const fullConfig = (await getLspConfig()?.getConfig()) as
        | LspConfigResponse
        | undefined;
      initializationOptions =
        fullConfig?.languages?.[langId]?.initializationOptions;
    } catch {
      // Ignore config read errors and continue without initialization options.
    }

    await connection.sendRequest('initialize', {
      processId: null,
      rootUri: null,
      capabilities: {
        textDocument: {
          completion: {
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          hover: {
            contentFormat: ['markdown', 'plaintext'],
          },
          publishDiagnostics: {
            relatedInformation: true,
          },
          signatureHelp: {
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
              parameterInformation: {
                labelOffsetSupport: true,
              },
            },
          },
        },
      },
      initializationOptions,
    });

    connection.sendNotification('initialized', {});

    const disposables: monaco.IDisposable[] = [];
    const lspLangId = langId;

    connection.onNotification(
      'textDocument/publishDiagnostics',
      (params: LspPublishDiagnosticsParams) => {
        const uri = monaco.Uri.parse(params.uri);
        const model = monaco.editor
          .getModels()
          .find((m) => m.uri.toString() === uri.toString());
        if (model) {
          const markers: monaco.editor.IMarkerData[] = (
            params.diagnostics || []
          ).map((d: LspDiagnostic) => ({
            severity: mapSeverity(d.severity),
            message: d.message,
            startLineNumber: (d.range?.start?.line ?? 0) + 1,
            startColumn: (d.range?.start?.character ?? 0) + 1,
            endLineNumber: (d.range?.end?.line ?? 0) + 1,
            endColumn: (d.range?.end?.character ?? 0) + 1,
            source: d.source || langId,
          }));
          monaco.editor.setModelMarkers(model, `lsp-${langId}`, markers);
        }
      }
    );

    const hasBuiltInIntelligence =
      langId === 'javascript' || langId === 'typescript';

    if (!hasBuiltInIntelligence) {
      const completionProvider =
        monaco.languages.registerCompletionItemProvider(lspLangId, {
          triggerCharacters: ['.', '/', '<', '"', "'", '`', '@'],
          provideCompletionItems: async (model, position) => {
            try {
              sendDidOpen(connection, model, lspLangId);
              const wordUntil = model.getWordUntilPosition(position);
              const range = new monaco.Range(
                position.lineNumber,
                wordUntil.startColumn,
                position.lineNumber,
                wordUntil.endColumn
              );
              const result = (await connection.sendRequest(
                'textDocument/completion',
                {
                  textDocument: { uri: model.uri.toString() },
                  position: {
                    line: position.lineNumber - 1,
                    character: position.column - 1,
                  },
                }
              )) as LspCompletionResponse;

              const items = Array.isArray(result)
                ? result
                : result?.items || [];
              return {
                suggestions: items.map((item: LspCompletionItem) => ({
                  label: item.label,
                  kind: mapCompletionKind(item.kind),
                  insertText: item.insertText || item.label,
                  range,
                  detail: item.detail,
                  documentation:
                    item.documentation !== undefined
                      ? toMarkdown(item.documentation)
                      : undefined,
                  sortText: item.sortText,
                  filterText: item.filterText,
                })),
              };
            } catch {
              return { suggestions: [] };
            }
          },
        });
      disposables.push(completionProvider);
    }

    if (!hasBuiltInIntelligence) {
      const hoverProvider = monaco.languages.registerHoverProvider(lspLangId, {
        provideHover: async (model, position) => {
          try {
            sendDidOpen(connection, model, lspLangId);
            const result = (await connection.sendRequest('textDocument/hover', {
              textDocument: { uri: model.uri.toString() },
              position: {
                line: position.lineNumber - 1,
                character: position.column - 1,
              },
            })) as LspHoverResponse | null;

            if (!result?.contents) return null;

            const contents = Array.isArray(result.contents)
              ? result.contents.map(toMarkdown)
              : [toMarkdown(result.contents)];

            return {
              contents,
              range: result.range ? lspRangeToMonaco(result.range) : undefined,
            };
          } catch {
            return null;
          }
        },
      });
      disposables.push(hoverProvider);
    }

    if (!hasBuiltInIntelligence) {
      const signatureProvider = monaco.languages.registerSignatureHelpProvider(
        lspLangId,
        {
          signatureHelpTriggerCharacters: ['(', ','],
          provideSignatureHelp: async (model, position) => {
            try {
              sendDidOpen(connection, model, lspLangId);
              const result = (await connection.sendRequest(
                'textDocument/signatureHelp',
                {
                  textDocument: { uri: model.uri.toString() },
                  position: {
                    line: position.lineNumber - 1,
                    character: position.column - 1,
                  },
                }
              )) as LspSignatureHelpResponse | null;

              if (!result) return null;

              return {
                value: {
                  signatures: (result.signatures || []).map(
                    (sig: LspSignature) => ({
                      label: sig.label,
                      documentation: sig.documentation
                        ? toMarkdown(sig.documentation)
                        : undefined,
                      parameters: (sig.parameters || []).map(
                        (p: LspSignatureParameter) => ({
                          label: p.label,
                          documentation: p.documentation
                            ? toMarkdown(p.documentation)
                            : undefined,
                        })
                      ),
                    })
                  ),
                  activeSignature: result.activeSignature ?? 0,
                  activeParameter: result.activeParameter ?? 0,
                },
                dispose: () => undefined,
              };
            } catch {
              return null;
            }
          },
        }
      );
      disposables.push(signatureProvider);
    }

    const openDocs = new Set<string>();

    monaco.editor.getModels().forEach((model) => {
      const modelDisposable = model.onDidChangeContent(() => {
        const uri = model.uri.toString();
        if (!openDocs.has(uri)) {
          sendDidOpenNotification(connection, model, lspLangId);
          openDocs.add(uri);
        } else {
          connection.sendNotification('textDocument/didChange', {
            textDocument: { uri, version: model.getVersionId() },
            contentChanges: [{ text: model.getValue() }],
          });
        }
      });
      disposables.push(modelDisposable);
    });

    activeClients[langId] = { connection, disposables, langId };
  }

  function stopLspClient(langId: string) {
    const client = activeClients[langId];
    if (client) {
      try {
        client.connection.sendRequest('shutdown').catch(() => undefined);
        client.connection.sendNotification('exit');
        client.connection.dispose();
      } catch (error) {
        console.warn(`Error disposing LSP client for ${langId}:`, error);
      }

      client.disposables.forEach((disposable) => {
        try {
          disposable.dispose();
        } catch {
          // Ignore individual dispose failures.
        }
      });

      monaco.editor.getModels().forEach((model) => {
        monaco.editor.setModelMarkers(model, `lsp-${langId}`, []);
      });

      delete activeClients[langId];
    }

    try {
      getLspBridge()?.stop(langId);
    } catch (error) {
      console.warn(`Error stopping LSP bridge for ${langId}:`, error);
    }
  }

  return {
    isLspClientActive,
    startLspClient,
    stopLspClient,
  };
}

const sentDocs = new Set<string>();

function sendDidOpen(
  connection: jsonrpc.MessageConnection,
  model: monaco.editor.ITextModel,
  languageId: string
) {
  const uri = model.uri.toString();
  if (!sentDocs.has(uri)) {
    sendDidOpenNotification(connection, model, languageId);
    sentDocs.add(uri);
  }
}

function sendDidOpenNotification(
  connection: jsonrpc.MessageConnection,
  model: monaco.editor.ITextModel,
  languageId: string
) {
  connection.sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: model.uri.toString(),
      languageId,
      version: model.getVersionId(),
      text: model.getValue(),
    },
  });
}

function mapSeverity(severity?: number): monaco.MarkerSeverity {
  switch (severity) {
    case 1:
      return monaco.MarkerSeverity.Error;
    case 2:
      return monaco.MarkerSeverity.Warning;
    case 3:
      return monaco.MarkerSeverity.Info;
    case 4:
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Info;
  }
}

function mapCompletionKind(kind?: number): monaco.languages.CompletionItemKind {
  const map: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    11: monaco.languages.CompletionItemKind.Unit,
    12: monaco.languages.CompletionItemKind.Value,
    13: monaco.languages.CompletionItemKind.Enum,
    14: monaco.languages.CompletionItemKind.Keyword,
    15: monaco.languages.CompletionItemKind.Snippet,
    16: monaco.languages.CompletionItemKind.Color,
    17: monaco.languages.CompletionItemKind.File,
    18: monaco.languages.CompletionItemKind.Reference,
    19: monaco.languages.CompletionItemKind.Folder,
    20: monaco.languages.CompletionItemKind.EnumMember,
    21: monaco.languages.CompletionItemKind.Constant,
    22: monaco.languages.CompletionItemKind.Struct,
    23: monaco.languages.CompletionItemKind.Event,
    24: monaco.languages.CompletionItemKind.Operator,
    25: monaco.languages.CompletionItemKind.TypeParameter,
  };

  return kind && map[kind]
    ? map[kind]
    : monaco.languages.CompletionItemKind.Text;
}

function toMarkdown(content: unknown): monaco.IMarkdownString {
  if (typeof content === 'string') {
    return { value: content };
  }

  if (typeof content === 'object' && content !== null) {
    const richContent = content as {
      kind?: unknown;
      value?: unknown;
      language?: unknown;
    };

    if (
      richContent.kind === 'markdown' &&
      typeof richContent.value === 'string'
    ) {
      return { value: richContent.value };
    }

    if (typeof richContent.language === 'string') {
      return {
        value:
          '```' +
          richContent.language +
          '\n' +
          String(richContent.value ?? '') +
          '\n```',
      };
    }

    if (typeof richContent.value === 'string') {
      return { value: richContent.value };
    }
  }

  return { value: String(content) };
}

function lspRangeToMonaco(range: LspRange): monaco.IRange {
  return {
    startLineNumber: (range.start?.line ?? 0) + 1,
    startColumn: (range.start?.character ?? 0) + 1,
    endLineNumber: (range.end?.line ?? 0) + 1,
    endColumn: (range.end?.character ?? 0) + 1,
  };
}
