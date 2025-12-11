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
  User,
  Sparkles,
  Wrench,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/useChatStore';
import { useAISettingsStore } from '../../store/useAISettingsStore';
import { useCodeStore } from '../../store/useCodeStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { createCodeAgent, type ToolInvocation, type AgentCallbacks } from '../../lib/ai/codeAgent';
import { ToolInvocationCard, ApprovalDialog } from './ToolInvocationUI';

// Clean EDITOR_ACTION blocks from displayed text
function cleanEditorActions(text: string): string {
  return text.replace(/<<<EDITOR_ACTION>>>[\s\S]*?<<<END_ACTION>>>/g, '').trim();
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
  let remaining = text;

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
    parts.push({ type: 'text', content: line + (i < lines.length - 1 ? '\n' : '') });
    i++;
  }

  return parts;
}

function parseTable(lines: string[], startIndex: number): { part: MarkdownPart; endIndex: number } | null {
  const headerLine = lines[startIndex];
  const separatorLine = lines[startIndex + 1];

  if (!headerLine || !separatorLine) return null;

  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
  const rows: string[][] = [];

  let i = startIndex + 2;
  while (i < lines.length && lines[i].includes('|')) {
    const row = lines[i].split('|').map(c => c.trim()).filter(c => c);
    if (row.length > 0) rows.push(row);
    i++;
  }

  return {
    part: { type: 'table', headers, rows },
    endIndex: i,
  };
}

function parseList(lines: string[], startIndex: number, ordered: boolean): { part: MarkdownPart; endIndex: number } {
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

function renderPart(part: MarkdownPart, key: number, onInsertCode?: (code: string) => void): React.ReactNode {
  switch (part.type) {
    case 'code':
      return <CodeBlock key={key} code={part.content} language={part.language} onInsert={onInsertCode} />;
    case 'inlineCode':
      return <code key={key} className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">{part.content}</code>;
    case 'table':
      return <Table key={key} headers={part.headers} rows={part.rows} />;
    case 'list':
      return <List key={key} items={part.items} ordered={part.ordered} />;
    case 'heading':
      return <Heading key={key} level={part.level} content={part.content} />;
    case 'blockquote':
      return <blockquote key={key} className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground">{part.content}</blockquote>;
    case 'text':
      return <TextWithInline key={key} content={part.content} />;
    default:
      return <span key={key}>{(part as { content: string }).content}</span>;
  }
}

function TextWithInline({ content }: { content: string }) {
  // Handle inline code, bold, italic
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let idx = 0;

  // Process inline code
  const inlineCodeRegex = /`([^`]+)`/g;
  let match;
  let lastIndex = 0;

  while ((match = inlineCodeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={idx++}>{formatInlineText(content.slice(lastIndex, match.index))}</span>);
    }
    parts.push(<code key={idx++} className="px-1.5 py-0.5 rounded bg-muted/80 text-xs font-mono text-primary">{match[1]}</code>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(<span key={idx++}>{formatInlineText(content.slice(lastIndex))}</span>);
  }

  return <span className="whitespace-pre-wrap">{parts.length > 0 ? parts : content}</span>;
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

function CodeBlock({ code, language, onInsert }: { code: string; language: string; onInsert?: (code: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{language || 'code'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
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
              <th key={i} className="px-3 py-2 text-left font-medium text-foreground border-b border-border">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
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
    <Tag className={clsx('my-2 pl-4 space-y-1', ordered ? 'list-decimal' : 'list-disc')}>
      {items.map((item, i) => (
        <li key={i} className="text-foreground/90">
          <TextWithInline content={item} />
        </li>
      ))}
    </Tag>
  );
}

function Heading({ level, content }: { level: number; content: string }) {
  const sizes = ['text-xl font-bold', 'text-lg font-bold', 'text-base font-semibold', 'text-sm font-semibold', 'text-sm font-medium', 'text-xs font-medium'];
  return <div className={clsx('my-2', sizes[level - 1] || sizes[2])}>{content}</div>;
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
  } = useChatStore();

  const { enableChat, getCurrentApiKey, getCurrentModel, provider, getLocalConfig, getCustomConfig } =
    useAISettingsStore();

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
  const handleInsertCode = useCallback((newCode: string) => {
    setCode(newCode);
  }, [setCode]);

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
        if (window.editor) {
          const position = window.editor.getPosition();
          if (position) {
            window.editor.executeEdits('ai-agent', [
              {
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
                text: newCode,
                forceMoveMarkers: true,
              },
            ]);
            return;
          }
        }
        setCode(code + '\n' + newCode);
      },
      onReplaceSelection: (newCode: string) => {
        if (window.editor) {
          const selection = window.editor.getSelection();
          if (selection) {
            window.editor.executeEdits('ai-agent', [
              {
                range: selection,
                text: newCode,
                forceMoveMarkers: true,
              },
            ]);
            return;
          }
        }
        setCode(newCode);
      },
      onReplaceAll: (newCode: string) => {
        setCode(newCode);
        if (window.editor) {
          window.editor.setValue(newCode);
        }
      },
      onToolInvocation: handleToolInvocation,
    };
  }, [code, language, setCode, handleToolInvocation]);

  // Handle send with agent
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !isConfigured) return;

    const userMessage = input.trim();
    const codeContext = includeCode ? code : undefined;

    addMessage({
      role: 'user',
      content: userMessage,
      codeContext,
    });

    setInput('');
    setStreaming(true);
    setStreamingContent('');
    setToolInvocations([]);

    try {
      const apiKey = getCurrentApiKey();
      const model = getCurrentModel();
      const localCfg = getLocalConfig();
      const customCfg = getCustomConfig();

      if (useAgent) {
        const agent = createCodeAgent(
          provider,
          apiKey,
          model,
          provider === 'local' ? { baseURL: localCfg.baseURL, modelId: localCfg.modelId } : undefined,
          createAgentCallbacks(),
          provider !== 'local' ? customCfg : undefined
        );

        const prompt = codeContext
          ? `Context - Current code in editor (${language}):\n\`\`\`${language}\n${codeContext}\n\`\`\`\n\nUser: ${userMessage}`
          : userMessage;

        try {
          const streamResult = agent.stream({ prompt });
          
          if (streamResult && streamResult.textStream) {
            let fullText = '';
            for await (const chunk of streamResult.textStream) {
              fullText += chunk;
              appendStreamingContent(chunk);
            }
            finalizeStreaming();
          } else {
            const result = await agent.generate({ prompt });
            if (result.text) {
              setStreamingContent(result.text);
              finalizeStreaming();
            } else {
              throw new Error('No response from agent');
            }
          }
        } catch (agentError) {
          console.error('[AIChat] Agent error, falling back to aiService:', agentError);
          const { aiService } = await import('../../lib/ai');

          if (!aiService.isReady()) {
            if (provider === 'local') {
              aiService.configure(provider, '', '', {
                baseURL: localCfg.baseURL,
                modelId: localCfg.modelId,
              });
            } else {
              aiService.configure(provider, apiKey, model, undefined, customCfg);
            }
          }

          const allMsgs = [
            ...messages,
            { id: '', role: 'user' as const, content: userMessage, timestamp: Date.now(), codeContext },
          ];

          await aiService.streamChat(allMsgs, codeContext, language, {
            onStart: () => setStreamingContent(''),
            onToken: (token) => appendStreamingContent(token),
            onComplete: () => finalizeStreaming(),
            onError: (err) => {
              addMessage({ role: 'assistant', content: `Error: ${err.message}` });
              setStreaming(false);
            },
          });
        }
      } else {
        const { aiService } = await import('../../lib/ai');

        if (!aiService.isReady()) {
          if (provider === 'local') {
            aiService.configure(provider, '', '', {
              baseURL: localCfg.baseURL,
              modelId: localCfg.modelId,
            });
          } else {
            aiService.configure(provider, apiKey, model, undefined, customCfg);
          }
        }

        const allMessages = [
          ...messages,
          {
            id: '',
            role: 'user' as const,
            content: userMessage,
            timestamp: Date.now(),
            codeContext,
          },
        ];

        await aiService.streamChat(allMessages, codeContext, language, {
          onStart: () => setStreamingContent(''),
          onToken: (token) => appendStreamingContent(token),
          onComplete: () => finalizeStreaming(),
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
  }, [
    input,
    isStreaming,
    isConfigured,
    includeCode,
    code,
    useAgent,
    provider,
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
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
              'fixed right-4 bottom-4 top-16 w-[420px] z-50 flex flex-col rounded-xl shadow-2xl overflow-hidden border',
              'bg-background border-border'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">AI Agent</span>
                {useAgent && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/20 text-primary">
                    Tools
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    clearChat();
                    setToolInvocations([]);
                  }}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title={t('chat.clear', 'Clear chat')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <Sparkles className="w-12 h-12 text-primary/30 mb-3" />
                  <p className="text-foreground font-medium mb-1">AI Agent Ready</p>
                  <p className="text-muted-foreground text-sm">
                    I can help you write, analyze, and modify code.
                  </p>
                  <div className="mt-3 space-y-1 text-left text-xs text-muted-foreground">
                    <p>• "Refactor this code"</p>
                    <p>• "Write a function that..."</p>
                    <p>• "Explain what this code does"</p>
                    <p>• "Fix the bugs in this code"</p>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={clsx(
                    'flex gap-3',
                    message.role === 'user' && 'flex-row-reverse'
                  )}
                >
                  <div
                    className={clsx(
                      'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div
                    className={clsx(
                      'flex-1 rounded-lg px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {message.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{message.content}</span>
                    ) : (
                      <MarkdownContent content={message.content} onInsertCode={handleInsertCode} />
                    )}
                  </div>
                </div>
              ))}

              {/* Tool Invocations */}
              {toolInvocations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
              {isStreaming && currentStreamingContent && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 rounded-lg px-3 py-2 text-sm bg-muted text-foreground">
                    <MarkdownContent content={currentStreamingContent} onInsertCode={handleInsertCode} />
                    <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-0.5" />
                  </div>
                </div>
              )}

              {isStreaming && !currentStreamingContent && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 rounded-lg px-3 py-2 text-sm bg-muted text-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 bg-muted/20">
              {/* Options Row */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setIncludeCode(!includeCode)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                    includeCode
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Code className="w-3 h-3" />
                  {t('chat.includeCode', 'Include code')}
                </button>
                <button
                  onClick={() => setUseAgent(!useAgent)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                    useAgent
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                  title="Enable agent mode with tools"
                >
                  <Wrench className="w-3 h-3" />
                  Agent
                </button>
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isConfigured
                      ? t('chat.placeholder', 'Ask about your code...')
                      : t('chat.configureFirst', 'Configure AI in Settings first')
                  }
                  disabled={!isConfigured || isStreaming}
                  rows={1}
                  className={clsx(
                    'flex-1 resize-none rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                    'bg-background border border-border text-foreground placeholder:text-muted-foreground',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'min-h-[40px] max-h-[120px]'
                  )}
                  style={{
                    height: 'auto',
                    minHeight: '40px',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming || !isConfigured}
                  className={clsx(
                    'p-2 rounded-lg transition-all',
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
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
    </>
  );
}


