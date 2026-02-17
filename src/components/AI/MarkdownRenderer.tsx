// Markdown Content Renderer Component
import { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import clsx from 'clsx';
import { COPY_FEEDBACK_DURATION_MS } from '../../constants';

interface MarkdownProps {
  content: string;
  onInsertCode?: (code: string) => void;
}

type MarkdownPart =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string }
  | { type: 'inlineCode'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; content: string };

export function MarkdownContent({ content, onInsertCode }: MarkdownProps) {
  const parts = parseMarkdown(content);
  return <>{parts.map((part, i) => renderPart(part, i, onInsertCode))}</>;
}

function parseMarkdown(text: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];

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

    // Regular text
    parts.push({
      type: 'text',
      content: line + (i < lines.length - 1 ? '\n' : ''),
    });
    i++;
  }

  return parts;
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
          className="px-1.5 py-0.5 rounded bg-muted/80 text-xs font-mono text-primary"
        >
          {part.content}
        </code>
      );
    case 'heading':
      return <Heading key={key} level={part.level} content={part.content} />;
    case 'list':
      return <List key={key} items={part.items} ordered={part.ordered} />;
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-2"
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
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
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

function TextWithInline({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
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
      <span key={idx}>{formatInlineText(content.slice(lastIndex))}</span>
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
