/**
 * Code Card Component
 *
 * Renders code in a beautiful, shareable card format
 * inspired by Carbon.now.sh style screenshots.
 */

import React, { forwardRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface CodeCardProps {
  code: string;
  output?: string;
  language?: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
  title?: string;
  background?: string;
}

// ============================================================================
// SYNTAX HIGHLIGHTING (Simple implementation)
// ============================================================================

const TOKEN_COLORS = {
  keyword: '#c678dd',
  string: '#98c379',
  number: '#d19a66',
  comment: '#5c6370',
  function: '#61afef',
  operator: '#abb2bf',
  punctuation: '#abb2bf',
  type: '#e5c07b',
  variable: '#e06c75',
  default: '#abb2bf',
};

const KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'switch',
  'case',
  'break',
  'continue',
  'throw',
  'try',
  'catch',
  'finally',
  'class',
  'extends',
  'new',
  'this',
  'super',
  'import',
  'export',
  'from',
  'default',
  'async',
  'await',
  'typeof',
  'instanceof',
  'in',
  'of',
  'true',
  'false',
  'null',
  'undefined',
  'type',
  'interface',
  'enum',
  'void',
]);

function tokenize(code: string): Array<{ text: string; type: string }> {
  const tokens: Array<{ text: string; type: string }> = [];
  let i = 0;

  while (i < code.length) {
    // Skip whitespace - preserve it
    if (/\s/.test(code[i])) {
      let ws = '';
      while (i < code.length && /\s/.test(code[i])) {
        ws += code[i++];
      }
      tokens.push({ text: ws, type: 'default' });
      continue;
    }

    // Comments
    if (code.slice(i, i + 2) === '//') {
      let comment = '';
      while (i < code.length && code[i] !== '\n') {
        comment += code[i++];
      }
      tokens.push({ text: comment, type: 'comment' });
      continue;
    }

    // Strings
    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i];
      let str = quote;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\' && i + 1 < code.length) {
          str += code[i++];
        }
        str += code[i++];
      }
      if (i < code.length) str += code[i++];
      tokens.push({ text: str, type: 'string' });
      continue;
    }

    // Numbers
    if (/\d/.test(code[i])) {
      let num = '';
      while (i < code.length && /[\d.xXaAbBcCdDeEfF]/.test(code[i])) {
        num += code[i++];
      }
      tokens.push({ text: num, type: 'number' });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(code[i])) {
      let id = '';
      while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) {
        id += code[i++];
      }
      // Check if it's followed by ( - likely a function
      const nextNonSpace = code.slice(i).match(/^\s*\(/);
      if (nextNonSpace) {
        tokens.push({ text: id, type: 'function' });
      } else if (KEYWORDS.has(id)) {
        tokens.push({ text: id, type: 'keyword' });
      } else if (id[0] === id[0].toUpperCase() && /[a-z]/.test(id)) {
        tokens.push({ text: id, type: 'type' });
      } else {
        tokens.push({ text: id, type: 'variable' });
      }
      continue;
    }

    // Operators and punctuation
    const opMatch = code
      .slice(i)
      .match(/^(===|!==|=>|<=|>=|&&|\|\||[+\-*/%=<>!&|^~?:])/);
    if (opMatch) {
      tokens.push({ text: opMatch[0], type: 'operator' });
      i += opMatch[0].length;
      continue;
    }

    // Single char punctuation
    tokens.push({ text: code[i], type: 'punctuation' });
    i++;
  }

  return tokens;
}

function highlightCode(code: string): React.ReactNode {
  const tokens = tokenize(code);
  return tokens.map((token, idx) => (
    <span
      key={idx}
      style={{
        color:
          TOKEN_COLORS[token.type as keyof typeof TOKEN_COLORS] ||
          TOKEN_COLORS.default,
      }}
    >
      {token.text}
    </span>
  ));
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CodeCard = forwardRef<HTMLDivElement, CodeCardProps>(
  (
    { code, output, showLineNumbers = true, title = 'CheeseJS', background },
    ref
  ) => {
    const lines = code.split('\n');

    return (
      <div
        ref={ref}
        style={{
          padding: '32px',
          background:
            background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          display: 'inline-block',
          maxWidth: '100%',
        }}
      >
        {/* Horizontal Layout Container */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {/* Code Window */}
          <div
            style={{
              background: '#282c34',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              minWidth: '400px',
              maxWidth: output ? '600px' : '800px',
              flex: output ? '1 1 60%' : '1 1 100%',
            }}
          >
            {/* Window Title Bar */}
            <div
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#21252b',
              }}
            >
              {/* macOS Traffic Lights */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#ff5f56',
                  }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#ffbd2e',
                  }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#27ca3f',
                  }}
                />
              </div>
              {/* Title */}
              <span
                style={{
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  color: '#6d7280',
                  fontSize: '13px',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {title}
              </span>
            </div>

            {/* Code Content */}
            <div style={{ padding: '20px', overflowX: 'auto' }}>
              <pre
                style={{
                  margin: 0,
                  fontFamily:
                    '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: '#abb2bf',
                }}
              >
                {lines.map((line, idx) => (
                  <div key={idx} style={{ display: 'flex' }}>
                    {showLineNumbers && (
                      <span
                        style={{
                          color: '#4b5563',
                          width: '40px',
                          textAlign: 'right',
                          paddingRight: '16px',
                          userSelect: 'none',
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                    )}
                    <code style={{ flex: 1 }}>
                      {highlightCode(line) || ' '}
                    </code>
                  </div>
                ))}
              </pre>
            </div>
          </div>

          {/* Output Section (side-by-side if present) */}
          {output && (
            <div
              style={{
                background: '#1e1e1e',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                minWidth: '250px',
                maxWidth: '400px',
                flex: '1 1 40%',
              }}
            >
              {/* Output Title Bar */}
              <div
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  background: '#252526',
                }}
              >
                <span
                  style={{
                    color: '#6b7280',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Output
                </span>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <pre
                  style={{
                    margin: 0,
                    fontFamily:
                      '"JetBrains Mono", "Fira Code", Consolas, monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: '#9ca3af',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {output}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

CodeCard.displayName = 'CodeCard';

export default CodeCard;
