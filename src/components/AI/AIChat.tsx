// AI Chat Panel with Agent Integration
// Using AI SDK 6 with simple streaming agent
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  X,
  Trash2,
  Code,
  Copy,
  Check,
  Loader2,
  Bot,
  Sparkles,
  Wrench,
  Database,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { useAISettingsStore } from '../../store/useAISettingsStore';
import { useCodeStore } from '../../store/useCodeStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useRagStore } from '../../store/useRagStore';
import {
  createCodeAgent,
  type ToolInvocation,
  type AgentCallbacks,
  processEditorActions,
} from '../../features/ai-agent/codeAgent';
import { ToolInvocationCard, ApprovalDialog } from './ToolInvocationUI';
import { AgentThinkingIndicator } from './AgentThinkingIndicator';
import { DiffView } from './DiffView';
import { QuickActions } from './QuickActions';
import { CloudWarningDialog } from './CloudWarningDialog';
import { ChatToolsMenu } from './ChatToolsMenu';
import {
  scrubSensitiveData,
  getSensitiveDataSummary,
} from '../../features/ai-agent/scrubber';

// Clean EDITOR_ACTION blocks from displayed text
function cleanEditorActions(text: string): string {
  return text
    .replace(/<<<EDITOR_ACTION>>>[\s\S]*?<<<END_ACTION>>>/g, '')
    .trim();
}

// ========== MARKDOWN RENDERER ==========

interface MarkdownProps {
  content: string;
  onInsertCode?: (code: string) => void;
}

function MarkdownContent({ content, onInsertCode }: MarkdownProps) {
  // Clean editor action blocks before rendering
  const cleanContent = cleanEditorActions(content);
  const parts = parseMarkdown(cleanContent);
  return <>{parts.map((part, i) => renderPart(part, i, onInsertCode))}</>;
}

type MarkdownPart =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string }
  | { type: 'inlineCode'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'heading'; level: number; content: string }
  | { type: 'bold'; content: string }
  | { type: 'blockquote'; content: string };

function parseMarkdown(text: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  const _remaining = text;

  // Process code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      parts.push(...parseInlineMarkdown(textBefore));
    }

    // Code block
    parts.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(...parseInlineMarkdown(text.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

function parseInlineMarkdown(text: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Tables
    if (line.includes('|') && lines[i + 1]?.match(/^\|?[\s\-:|]+\|?$/)) {
      const table = parseTable(lines, i);
      if (table) {
        parts.push(table.part);
        i = table.endIndex;
        continue;
      }
    }

    // Unordered lists
    if (line.match(/^[\s]*[-*]\s/)) {
      const list = parseList(lines, i, false);
      parts.push(list.part);
      i = list.endIndex;
      continue;
    }

    // Ordered lists
    if (line.match(/^[\s]*\d+\.\s/)) {
      const list = parseList(lines, i, true);
      parts.push(list.part);
      i = list.endIndex;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      parts.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // Blockquotes
    if (line.startsWith('>')) {
      const content = line.replace(/^>\s?/, '');
      parts.push({ type: 'blockquote', content });
      i++;
      continue;
    }

    // Regular text with inline formatting
    parts.push({
      type: 'text',
      content: line + (i < lines.length - 1 ? '\n' : ''),
    });
    i++;
  }

  return parts;
}

function parseTable(
  lines: string[],
  startIndex: number
): { part: MarkdownPart; endIndex: number } | null {
  const headerLine = lines[startIndex];
  const separatorLine = lines[startIndex + 1];

  if (!headerLine || !separatorLine) return null;

  const headers = headerLine
    .split('|')
    .map((h) => h.trim())
    .filter((h) => h);
  const rows: string[][] = [];

  let i = startIndex + 2;
  while (i < lines.length && lines[i].includes('|')) {
    const row = lines[i]
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c);
    if (row.length > 0) rows.push(row);
    i++;
  }

  return {
    part: { type: 'table', headers, rows },
    endIndex: i,
  };
}

function parseList(
  lines: string[],
  startIndex: number,
  ordered: boolean
): { part: MarkdownPart; endIndex: number } {
  const items: string[] = [];
  const pattern = ordered ? /^[\s]*\d+\.\s(.+)$/ : /^[\s]*[-*]\s(.+)$/;

  let i = startIndex;
  while (i < lines.length) {
    const match = lines[i].match(pattern);
    if (match) {
      items.push(match[1]);
      i++;
    } else if (lines[i].trim() === '') {
      i++;
    } else {
      break;
    }
  }

  return {
    part: { type: 'list', ordered, items },
    endIndex: i,
  };
}

function renderPart(
  part: MarkdownPart,
  key: number,
  onInsertCode?: (code: string) => void
): React.ReactNode {
  switch (part.type) {
    case 'code':
      return (
        <CodeBlock
          key={key}
          code={part.content}
          language={part.language}
          onInsert={onInsertCode}
        />
      );
    case 'inlineCode':
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
        >
          {part.content}
        </code>
      );
    case 'table':
      return <Table key={key} headers={part.headers} rows={part.rows} />;
    case 'list':
      return <List key={key} items={part.items} ordered={part.ordered} />;
    case 'heading':
      return <Heading key={key} level={part.level} content={part.content} />;
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground"
        >
          {part.content}
        </blockquote>
      );
    case 'text':
      return <TextWithInline key={key} content={part.content} />;
    default:
      return <span key={key}>{(part as { content: string }).content}</span>;
  }
}

function TextWithInline({ content }: { content: string }) {
  // Handle inline code, bold, italic
  const parts: React.ReactNode[] = [];
  const _remaining = content;
  let idx = 0;

  // Process inline code
  const inlineCodeRegex = /`([^`]+)`/g;
  let match;
  let lastIndex = 0;

  while ((match = inlineCodeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={idx++}>
          {formatInlineText(content.slice(lastIndex, match.index))}
        </span>
      );
    }
    parts.push(
      <code
        key={idx++}
        className="px-1.5 py-0.5 rounded bg-muted/80 text-xs font-mono text-primary"
      >
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key={idx++}>{formatInlineText(content.slice(lastIndex))}</span>
    );
  }

  return (
    <span className="whitespace-pre-wrap">
      {parts.length > 0 ? parts : content}
    </span>
  );
}

function formatInlineText(text: string): React.ReactNode {
  // Bold
  const boldParts = text.split(/\*\*([^*]+)\*\*/g);
  if (boldParts.length > 1) {
    return boldParts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  }
  return text;
}

function CodeBlock({
  code,
  language,
  onInsert,
}: {
  code: string;
  language: string;
  onInsert?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">
          {language || 'code'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          {onInsert && (
            <button
              onClick={() => onInsert(code)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Insert into editor"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <pre className="p-3 text-sm overflow-x-auto">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-medium text-foreground border-b border-border"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border last:border-0 hover:bg-muted/20"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-foreground/90">
                  <TextWithInline content={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function List({ items, ordered }: { items: string[]; ordered: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag
      className={clsx(
        'my-2 pl-4 space-y-1',
        ordered ? 'list-decimal' : 'list-disc'
      )}
    >
      {items.map((item, i) => (
        <li key={i} className="text-foreground/90">
          <TextWithInline content={item} />
        </li>
      ))}
    </Tag>
  );
}

function Heading({ level, content }: { level: number; content: string }) {
  const sizes = [
    'text-xl font-bold',
    'text-lg font-bold',
    'text-base font-semibold',
    'text-sm font-semibold',
    'text-sm font-medium',
    'text-xs font-medium',
  ];
  return (
    <div className={clsx('my-2', sizes[level - 1] || sizes[2])}>{content}</div>
  );
}

// ========== CHAT COMPONENT ==========

export function AIChat() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [includeCode, setIncludeCode] = useState(true);
  const [useAgent, setUseAgent] = useState(true);
  const [toolInvocations, setToolInvocations] = useState<ToolInvocation[]>([]);
  const [pendingApproval, setPendingApproval] = useState<{
    id: string;
    toolName: string;
    input: Record<string, unknown>;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [cloudWarning, setCloudWarning] = useState<{
    pending: boolean;
    sensitiveItems: string[];
    pendingMessage: string;
    pendingCode?: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isStreaming,
    currentStreamingContent,
    isChatOpen,
    addMessage,
    clearChat,
    setStreaming,
    setStreamingContent,
    appendStreamingContent,
    finalizeStreaming,
    setChatOpen,
    toggleChat,
    agentPhase,
    thinkingMessage,
    pendingChange,
    setAgentPhase,
    setPendingChange,
    clearPendingChange,
  } = useChatStore();

  const {
    enableChat,
    getCurrentApiKey,
    getCurrentModel,
    provider,
    getLocalConfig,
    getCustomConfig,
    strictLocalMode,
    setProvider,
  } = useAISettingsStore();

  const code = useCodeStore((state) => state.code);
  const setCode = useCodeStore((state) => state.setCode);
  const language = useLanguageStore((state) => state.currentLanguage);

  const isConfigured = Boolean(getCurrentApiKey());

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingContent, toolInvocations]);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isChatOpen]);

  // Handle tool invocation updates
  const handleToolInvocation = useCallback((invocation: ToolInvocation) => {
    setToolInvocations((prev) => {
      const existing = prev.findIndex((t) => t.id === invocation.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = invocation;
        return updated;
      }
      return [...prev, invocation];
    });
  }, []);

  // Handle code insertion
  const handleInsertCode = useCallback(
    (newCode: string) => {
      setCode(newCode);
    },
    [setCode]
  );

  const { setModalOpen, getPinnedDocsContext, pinnedDocIds } = useRagStore();

  const handleIndexCodebase = useCallback(async () => {
    setModalOpen(true);
  }, [setModalOpen]);

  // Create agent callbacks
  const createAgentCallbacks = useCallback((): AgentCallbacks => {
    return {
      getEditorContent: () => code,
      getSelectedCode: () => {
        if (window.editor) {
          const selection = window.editor.getSelection();
          if (selection) {
            const model = window.editor.getModel();
            if (model) {
              return model.getValueInRange(selection);
            }
          }
        }
        return '';
      },
      getLanguage: () => language,
      onExecuteCode: async (codeToRun: string) => {
        return {
          success: true,
          output: `Code: ${codeToRun.slice(0, 100)}...`,
        };
      },
      onInsertCode: (newCode: string) => {
        console.log('[AIChat] onInsertCode triggered - setting pending change');
        setAgentPhase('applying', 'Review changes...');
        setPendingChange({
          action: 'insert',
          originalCode: '', // For insertion, we just show the new code
          newCode: newCode,
          description: 'Content to be inserted at cursor',
        });
      },
      onReplaceSelection: (newCode: string) => {
        console.log(
          '[AIChat] onReplaceSelection triggered - setting pending change'
        );
        let originalCode = '';
        if (window.editor) {
          const selection = window.editor.getSelection();
          if (selection) {
            const model = window.editor.getModel();
            if (model) {
              originalCode = model.getValueInRange(selection);
            }
          }
        }

        setAgentPhase('applying', 'Review changes...');
        setPendingChange({
          action: 'replaceSelection',
          originalCode,
          newCode,
          description: 'Replacement for selected code',
        });
      },
      onReplaceAll: (newCode: string) => {
        console.log('[AIChat] onReplaceAll triggered - setting pending change');
        setAgentPhase('applying', 'Review changes...');
        setPendingChange({
          action: 'replaceAll',
          originalCode: code,
          newCode,
          description: 'Complete file refactor',
        });
      },
      onToolInvocation: handleToolInvocation,
    };
  }, [code, language, handleToolInvocation, setAgentPhase, setPendingChange]);

  // Handle send with agent
  const handleSend = useCallback(
    async (textInput?: string, isAutoCorrection: boolean = false) => {
      const messageToSend = textInput || input;
      if (!messageToSend.trim() || isStreaming || !isConfigured) return;

      const userMessage = messageToSend.trim();
      const codeContext = includeCode ? code : undefined;

      // Cloud provider warning check (only if NOT strictLocalMode and NOT local provider)
      if (provider !== 'local' && !strictLocalMode && !isAutoCorrection) {
        // Check for sensitive data in code context
        const sensitiveItems = codeContext
          ? getSensitiveDataSummary(codeContext)
          : [];

        // Show warning dialog
        setCloudWarning({
          pending: true,
          sensitiveItems,
          pendingMessage: userMessage,
          pendingCode: codeContext,
        });
        return; // Dialog will re-call handleSend with skipCloudWarning flag
      }

      // Proceed with message sending
      addMessage({
        role: 'user',
        content: userMessage,
        codeContext,
      });

      if (!isAutoCorrection) {
        setInput('');
      }
      setStreaming(true);
      setStreamingContent('');
      setToolInvocations([]);

      try {
        const apiKey = getCurrentApiKey();
        const model = getCurrentModel();
        const localCfg = getLocalConfig();
        const customCfg = getCustomConfig();

        // Apply data scrubbing for cloud providers
        const safeCodeContext =
          provider !== 'local' && codeContext
            ? scrubSensitiveData(codeContext)
            : codeContext;

        if (useAgent) {
          const runAgent = async (disableTools: boolean) => {
            const currentAgent = createCodeAgent(
              provider,
              apiKey,
              model,
              provider === 'local'
                ? { baseURL: localCfg.baseURL, modelId: localCfg.modelId }
                : undefined,
              createAgentCallbacks(),
              provider !== 'local' ? customCfg : undefined,
              disableTools
            );

            // Enhance prompt for auto-correction
            let fullPrompt = userMessage;
            if (isAutoCorrection) {
              fullPrompt = `Review and fix the following code based on this error:\n\n${userMessage}\n\nIMPORTANT: Return the FULL corrected code using the appropriate tool.`;
            }

            // Check for @docs or @kb reference and search RAG
            let ragContext = '';
            const docsMatch = userMessage.match(
              /@(docs|kb)\s*(?:\(([^)]+)\))?/i
            );
            if (docsMatch && window.rag) {
              const searchQuery =
                docsMatch[2] ||
                userMessage.replace(/@(docs|kb)\s*(?:\([^)]+\))?/i, '').trim();
              if (searchQuery) {
                try {
                  setAgentPhase('thinking', 'Searching knowledge base...');
                  const searchResult = await window.rag.search(searchQuery, 5);
                  if (
                    searchResult.success &&
                    searchResult.results &&
                    searchResult.results.length > 0
                  ) {
                    ragContext = '\n\n--- Knowledge Base Context ---\n';
                    ragContext += searchResult.results
                      .map((r, i) => `[Document ${i + 1}]:\n${r.content}`)
                      .join('\n\n');
                    ragContext += '\n--- End Knowledge Base Context ---\n\n';
                  }
                } catch (e) {
                  console.warn('RAG search failed:', e);
                }
              }
              // Remove the @docs/@kb reference from the message
              fullPrompt = userMessage
                .replace(/@(docs|kb)\s*(?:\([^)]+\))?/i, '')
                .trim();
            }

            // Get pinned docs context (always included if there are pinned docs)
            let pinnedContext = '';
            if (pinnedDocIds.length > 0) {
              try {
                setAgentPhase('thinking', 'Loading pinned documentation...');
                pinnedContext = await getPinnedDocsContext();
              } catch (e) {
                console.warn('Failed to get pinned docs:', e);
              }
            }

            const allContext = pinnedContext + ragContext;
            let prompt = safeCodeContext
              ? `Context - Current code in editor (${language}):\n\`\`\`${language}\n${safeCodeContext}\n\`\`\`${allContext}\n\nUser: ${fullPrompt}`
              : allContext
                ? `${allContext}User: ${fullPrompt}`
                : fullPrompt;

            // Start thinking phase
            setAgentPhase('thinking', 'Analyzing your request...');

            const streamResult = currentAgent.stream({ prompt });

            // Switch to generating phase once stream starts
            setAgentPhase('generating', 'Generating response...');
            console.log(
              `[AIChat] Stream started (disableTools: ${disableTools})`
            );
            let fullText = '';

            if (streamResult && streamResult.textStream) {
              for await (const chunk of streamResult.textStream) {
                fullText += chunk;
                appendStreamingContent(chunk);
              }
              console.log(
                '[AIChat] Stream finished. Full text length:',
                fullText.length
              );

              // Process legacy editor actions if present
              if (disableTools || fullText.includes('<<<EDITOR_ACTION>>>')) {
                console.log('[AIChat] Processing legacy editor actions...');
                await processEditorActions(fullText, createAgentCallbacks());
              }

              if (!fullText && !disableTools) {
                if (fullText.length === 0) {
                  throw new Error('Empty response');
                }
              }

              finalizeStreaming();
            } else {
              // Fallback for non-streaming response
              const result = await currentAgent.generate({ prompt });
              console.log(
                '[AIChat] Generate finished. Text length:',
                result.text?.length
              );

              if (result.text) {
                setStreamingContent(result.text);

                // Process legacy editor actions if present
                if (
                  disableTools ||
                  result.text.includes('<<<EDITOR_ACTION>>>')
                ) {
                  console.log(
                    '[AIChat] Processing legacy editor actions (non-streaming)...'
                  );
                  await processEditorActions(
                    result.text,
                    createAgentCallbacks()
                  );
                }

                finalizeStreaming();
              } else {
                throw new Error('No response from agent');
              }
            }
          };

          try {
            await runAgent(false);
          } catch (agentError) {
            console.warn(
              '[AIChat] Standard agent failed, retrying with legacy mode...',
              agentError
            );

            try {
              // Clear any partial content from first attempt
              setStreamingContent('');
              // Retry with legacy mode (no native tools)
              await runAgent(true);
            } catch (retryError) {
              console.error('[AIChat] Legacy retry failed:', retryError);
              addMessage({
                role: 'assistant',
                content: `Error: ${agentError instanceof Error ? agentError.message : 'Unknown error'}. \n\nRetry failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
              });
              setStreaming(false);
            }
          }
        } else {
          const { aiService } = await import('../../features/ai-agent');

          if (!aiService.isReady()) {
            if (provider === 'local') {
              aiService.configure(provider, '', '', {
                baseURL: localCfg.baseURL,
                modelId: localCfg.modelId,
              });
            } else {
              aiService.configure(
                provider,
                apiKey,
                model,
                undefined,
                customCfg
              );
            }
          }

          const allMessages = [
            ...messages,
            {
              id: '',
              role: 'user' as const,
              content: userMessage,
              timestamp: Date.now(),
              codeContext: safeCodeContext,
            },
          ];

          let fullResponse = '';
          const callbacks = createAgentCallbacks();

          await aiService.streamChat(allMessages, safeCodeContext, language, {
            onStart: () => setStreamingContent(''),
            onToken: (token) => {
              fullResponse += token;
              appendStreamingContent(token);
            },
            onComplete: () => {
              processEditorActions(fullResponse, callbacks);
              finalizeStreaming();
            },
            onError: (error) => {
              addMessage({
                role: 'assistant',
                content: `Error: ${error.message}`,
              });
              setStreaming(false);
            },
          });
        }
      } catch (error) {
        console.error('[AIChat] Send error:', error);
        addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        setStreaming(false);
      }
    },
    [
      input,
      isStreaming,
      isConfigured,
      includeCode,
      code,
      useAgent,
      provider,
      strictLocalMode,
      language,
      messages,
      addMessage,
      setStreaming,
      setStreamingContent,
      appendStreamingContent,
      finalizeStreaming,
      getCurrentApiKey,
      getCurrentModel,
      getLocalConfig,
      getCustomConfig,
      createAgentCallbacks,
      setAgentPhase,
      getPinnedDocsContext,
      pinnedDocIds,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Expose auto-correction function globally for the console/result component to use
  useEffect(() => {
    (
      window as Window & {
        triggerAIAutoCorrection?: (errorMessage: string) => void;
      }
    ).triggerAIAutoCorrection = (errorMessage: string) => {
      if (!isChatOpen) {
        setChatOpen(true);
      }
      // Small delay to ensure state updates
      setTimeout(() => {
        handleSend(`Fix this error: ${errorMessage}`, true);
      }, 100);
    };

    return () => {
      delete (
        window as Window & {
          triggerAIAutoCorrection?: (errorMessage: string) => void;
        }
      ).triggerAIAutoCorrection;
    };
  }, [handleSend, isChatOpen, setChatOpen]);

  const handleApprove = useCallback(() => {
    if (pendingApproval) {
      pendingApproval.resolve(true);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  const handleDeny = useCallback(() => {
    if (pendingApproval) {
      pendingApproval.resolve(false);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  if (!enableChat) return null;

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        onClick={toggleChat}
        data-testid="toggle-chat"
        className={clsx(
          'fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          isChatOpen && 'opacity-0 pointer-events-none'
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageSquare className="w-5 h-5" />
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={clsx(
              'fixed right-6 bottom-6 top-20 w-[450px] z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden font-sans',
              'bg-background/95 backdrop-blur-xl border border-white/10 ring-1 ring-white/5'
            )}
          >
            {/* Header - Premium Design */}
            <div className="relative px-4 py-3 border-b border-white/5">
              {/* Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5" />

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Animated Logo */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md animate-pulse" />
                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                  </div>

                  <div>
                    <h2 className="font-bold text-base text-foreground tracking-tight">
                      Code Assistant
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      {/* Live Status Indicator */}
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <span className="absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                        </div>
                        <span className="text-[10px] font-semibold text-green-500 uppercase tracking-wider">
                          {isStreaming ? 'Generating' : 'Ready'}
                        </span>
                      </div>
                      <span className="text-border">•</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {provider === 'local' ? 'Local AI' : 'Cloud'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={handleIndexCodebase}
                    className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition-all"
                    title="Knowledge Base"
                  >
                    <Database className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      clearChat();
                      setToolInvocations([]);
                    }}
                    className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
                    title={t('chat.clear', 'New conversation')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChatOpen(false)}
                    data-testid="close-ai-chat"
                    className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Agent Thinking Indicator */}
              <AnimatePresence>
                {agentPhase !== 'idle' && (
                  <AgentThinkingIndicator
                    phase={agentPhase}
                    message={thinkingMessage}
                    className="mb-2"
                  />
                )}
              </AnimatePresence>

              {!isConfigured && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <Bot className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {t(
                      'chat.notConfigured',
                      'Configure your AI provider in Settings to start chatting.'
                    )}
                  </p>
                </div>
              )}

              {isConfigured && messages.length === 0 && !isStreaming && (
                <div className="flex flex-col h-full px-4 py-6">
                  {/* Welcome Header */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-6"
                  >
                    <h3 className="text-xl font-bold text-foreground mb-1">
                      What can I build for you?
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Select an action or type your request below
                    </p>
                  </motion.div>

                  {/* Quick Actions - Horizontal Pills */}
                  <div className="flex flex-wrap gap-2 justify-center mb-6">
                    {[
                      {
                        icon: Wrench,
                        label: 'Refactor',
                        prompt: 'Refactor this code to follow best practices',
                        color: 'from-blue-500/20 to-blue-500/5',
                      },
                      {
                        icon: Code,
                        label: 'Generate',
                        prompt: 'Write a function that...',
                        color: 'from-green-500/20 to-green-500/5',
                      },
                      {
                        icon: MessageSquare,
                        label: 'Explain',
                        prompt: 'Explain what this code does',
                        color: 'from-purple-500/20 to-purple-500/5',
                      },
                      {
                        icon: Database,
                        label: '@docs',
                        prompt: '@docs How do I...',
                        color: 'from-amber-500/20 to-amber-500/5',
                      },
                    ].map((item, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setInput(item.prompt)}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 rounded-full',
                          'bg-gradient-to-r border border-white/10',
                          item.color,
                          'hover:border-white/20 hover:scale-105 transition-all'
                        )}
                      >
                        <item.icon className="w-4 h-4 text-foreground/80" />
                        <span className="text-sm font-medium text-foreground/90">
                          {item.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Capabilities Cards */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid gap-3">
                      {[
                        {
                          title: 'Code Generation',
                          desc: 'Write functions, classes, and complete modules',
                          icon: '⚡',
                        },
                        {
                          title: 'Bug Fixing',
                          desc: 'Identify and fix issues in your code',
                          icon: '🔧',
                        },
                        {
                          title: 'Documentation',
                          desc: 'Search pinned docs for context-aware help',
                          icon: '📚',
                        },
                      ].map((cap, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.1 }}
                          className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
                        >
                          <span className="text-lg">{cap.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {cap.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {cap.desc}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={message.id}
                  className={clsx(
                    'group',
                    message.role === 'user' ? 'flex justify-end' : ''
                  )}
                >
                  {message.role === 'user' ? (
                    /* User Message - Right aligned, minimal */
                    <div className="max-w-[85%] px-4 py-2.5 bg-primary/10 text-foreground rounded-2xl rounded-br-md border border-primary/10">
                      <span className="whitespace-pre-wrap leading-relaxed text-sm">
                        {message.content}
                      </span>
                    </div>
                  ) : (
                    /* AI Message - Full width, clean */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          Assistant
                        </span>
                      </div>
                      <div className="pl-8 text-sm text-foreground/90">
                        <MarkdownContent
                          content={
                            message.content
                              .replace(/<<<EDITOR_ACTION>>>[\s\S]*$/, '')
                              .trim() ||
                            (message.content.includes('<<<EDITOR_ACTION>>>')
                              ? 'Applying changes...'
                              : '')
                          }
                          onInsertCode={handleInsertCode}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Tool Invocations */}
              {toolInvocations.length > 0 && (
                <div className="space-y-3 px-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Tool Activity</span>
                  </div>
                  {toolInvocations.map((invocation) => (
                    <ToolInvocationCard
                      key={invocation.id}
                      invocation={invocation}
                    />
                  ))}
                </div>
              )}

              {/* Streaming message */}
              {isStreaming && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full border border-border/50 flex items-center justify-center bg-background text-foreground/70">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    {currentStreamingContent && (
                      <div className="rounded-xl px-0 py-1 text-sm text-foreground">
                        <MarkdownContent
                          content={currentStreamingContent.replace(
                            /<<<EDITOR_ACTION>>>[\s\S]*$/,
                            ''
                          )}
                          onInsertCode={handleInsertCode}
                        />
                        <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
                      </div>
                    )}
                    {!currentStreamingContent && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-transparent">
              {/* Quick Actions */}
              <QuickActions
                onAction={(prompt) => handleSend(prompt, false)}
                disabled={!isConfigured || isStreaming}
                className="mb-3"
              />

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl blur opacity-20 group-hover:opacity-100 transition duration-700"></div>
                <div className="relative flex flex-col bg-background/50 backdrop-blur-md border border-border/40 rounded-xl shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/20 focus-within:bg-background/80">
                  <textarea
                    data-testid="ai-chat-input"
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isConfigured
                        ? t('chat.placeholder', 'Ask about your code...')
                        : t(
                            'chat.configureFirst',
                            'Configure AI in Settings first'
                          )
                    }
                    disabled={!isConfigured || isStreaming}
                    rows={1}
                    className="w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] max-h-[150px] placeholder:text-muted-foreground/70 font-sans"
                    style={{
                      height: 'auto',
                      minHeight: '48px',
                      color: 'var(--color-foreground)',
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                    }}
                  />

                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-2 pb-2">
                    <ChatToolsMenu
                      includeCode={includeCode}
                      setIncludeCode={setIncludeCode}
                      useAgent={useAgent}
                      setUseAgent={setUseAgent}
                      onInsertDocs={() => {
                        const currentInput = input.trim();
                        if (!currentInput.includes('@docs')) {
                          setInput(`@docs ${currentInput}`);
                          inputRef.current?.focus();
                        }
                      }}
                      inputHasDocs={input.includes('@docs')}
                    />

                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isStreaming || !isConfigured}
                      className={clsx(
                        'p-2 rounded-lg transition-all duration-300 shadow-sm',
                        !input.trim() || isStreaming || !isConfigured
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:scale-105 hover:shadow-md'
                      )}
                    >
                      {isStreaming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Approval Dialog */}
      <AnimatePresence>
        {pendingApproval && (
          <ApprovalDialog
            isOpen={true}
            toolName={pendingApproval.toolName}
            input={pendingApproval.input}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        )}
      </AnimatePresence>

      {/* Diff View Modal */}
      <AnimatePresence>
        {pendingChange && (
          <DiffView
            change={pendingChange}
            onAccept={() => {
              // Apply the change based on action type
              if (pendingChange.action === 'replaceAll') {
                setCode(pendingChange.newCode);
                if (window.editor) {
                  window.editor.setValue(pendingChange.newCode);
                }
              } else if (pendingChange.action === 'insert') {
                if (window.editor) {
                  const position = window.editor.getPosition();
                  if (position) {
                    window.editor.executeEdits('ai-agent-diff', [
                      {
                        range: {
                          startLineNumber: position.lineNumber,
                          startColumn: position.column,
                          endLineNumber: position.lineNumber,
                          endColumn: position.column,
                        },
                        text: pendingChange.newCode,
                        forceMoveMarkers: true,
                      },
                    ]);
                  }
                } else {
                  setCode(code + '\n' + pendingChange.newCode);
                }
              } else if (pendingChange.action === 'replaceSelection') {
                if (window.editor) {
                  const selection = window.editor.getSelection();
                  if (selection) {
                    window.editor.executeEdits('ai-agent-diff', [
                      {
                        range: selection,
                        text: pendingChange.newCode,
                        forceMoveMarkers: true,
                      },
                    ]);
                  }
                } else {
                  setCode(pendingChange.newCode);
                }
              }
              clearPendingChange();
            }}
            onReject={() => {
              clearPendingChange();
            }}
          />
        )}
      </AnimatePresence>

      {/* Cloud Warning Dialog */}
      <CloudWarningDialog
        isOpen={cloudWarning?.pending ?? false}
        providerName={
          provider === 'openai'
            ? 'OpenAI'
            : provider === 'anthropic'
              ? 'Anthropic'
              : provider === 'google'
                ? 'Google AI'
                : provider
        }
        sensitiveItems={cloudWarning?.sensitiveItems ?? []}
        onConfirm={() => {
          if (cloudWarning) {
            // Clear warning and proceed by calling handleSend with isAutoCorrection=true to skip warning
            const pendingMsg = cloudWarning.pendingMessage;
            setCloudWarning(null);
            // Use timeout to ensure state is updated before calling handleSend
            setTimeout(() => handleSend(pendingMsg, true), 0);
          }
        }}
        onCancel={() => setCloudWarning(null)}
        onEnableLocalMode={() => {
          setProvider('local');
          setCloudWarning(null);
        }}
      />
    </>
  );
}
