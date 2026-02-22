/**
 * Diff View Component
 * Shows code changes side-by-side for user approval
 */
import { useState, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import { COPY_FEEDBACK_DURATION_MS } from '../../constants';
import type { PendingCodeChange } from '../../store/storeHooks';

interface DiffViewProps {
  change: PendingCodeChange;
  onAccept: () => void;
  onReject: () => void;
}

interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber: { old?: number; new?: number };
}

/**
 * Simple diff algorithm - computes line-by-line differences
 */
function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = computeLCS(originalLines, modifiedLines);

  let oldIndex = 0;
  let newIndex = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const match of lcs) {
    // Add removed lines
    while (oldIndex < match.oldIndex) {
      result.push({
        type: 'remove',
        content: originalLines[oldIndex],
        lineNumber: { old: oldLineNum++ },
      });
      oldIndex++;
    }

    // Add added lines
    while (newIndex < match.newIndex) {
      result.push({
        type: 'add',
        content: modifiedLines[newIndex],
        lineNumber: { new: newLineNum++ },
      });
      newIndex++;
    }

    // Add unchanged line
    result.push({
      type: 'unchanged',
      content: originalLines[oldIndex],
      lineNumber: { old: oldLineNum++, new: newLineNum++ },
    });
    oldIndex++;
    newIndex++;
  }

  // Add remaining removed lines
  while (oldIndex < originalLines.length) {
    result.push({
      type: 'remove',
      content: originalLines[oldIndex],
      lineNumber: { old: oldLineNum++ },
    });
    oldIndex++;
  }

  // Add remaining added lines
  while (newIndex < modifiedLines.length) {
    result.push({
      type: 'add',
      content: modifiedLines[newIndex],
      lineNumber: { new: newLineNum++ },
    });
    newIndex++;
  }

  return result;
}

interface LCSMatch {
  oldIndex: number;
  newIndex: number;
}

function computeLCS(a: string[], b: string[]): LCSMatch[] {
  const m = a.length;
  const n = b.length;

  // Build LCS table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matches
  const matches: LCSMatch[] = [];
  let i = m,
    j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}

export function DiffView({ change, onAccept, onReject }: DiffViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const diff = useMemo(
    () => computeDiff(change.originalCode, change.newCode),
    [change.originalCode, change.newCode]
  );

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const line of diff) {
      if (line.type === 'add') additions++;
      if (line.type === 'remove') deletions++;
    }
    return { additions, deletions };
  }, [diff]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(change.newCode);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
  };

  const actionLabel = {
    insert: 'Insert Code',
    replaceSelection: 'Replace Selection',
    replaceAll: 'Replace All',
  }[change.action];

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onReject()}
    >
      <m.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="w-full max-w-4xl max-h-[80vh] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-foreground">Review Changes</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-primary/20 text-primary">
              {actionLabel}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-500">+{stats.additions}</span>
              <span className="text-red-500">-{stats.deletions}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Copy new code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Description */}
        {change.description && (
          <div className="px-4 py-2 text-sm text-muted-foreground bg-muted/10 border-b border-border">
            {change.description}
          </div>
        )}

        {/* Diff Content */}
        <AnimatePresence>
          {isExpanded && (
            <m.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="flex-1 overflow-auto"
            >
              <div className="font-mono text-sm">
                {diff.map((line, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'flex items-stretch border-b border-border/30 last:border-0',
                      line.type === 'add' && 'bg-green-500/10',
                      line.type === 'remove' && 'bg-red-500/10'
                    )}
                  >
                    {/* Line numbers */}
                    <div className="flex-shrink-0 w-20 flex text-xs text-muted-foreground select-none border-r border-border/30">
                      <span className="w-10 px-2 py-1 text-right bg-muted/20">
                        {line.lineNumber.old ?? ''}
                      </span>
                      <span className="w-10 px-2 py-1 text-right bg-muted/10">
                        {line.lineNumber.new ?? ''}
                      </span>
                    </div>

                    {/* Change indicator */}
                    <div className="flex-shrink-0 w-6 flex items-center justify-center">
                      {line.type === 'add' && (
                        <span className="text-green-500 font-bold">+</span>
                      )}
                      {line.type === 'remove' && (
                        <span className="text-red-500 font-bold">-</span>
                      )}
                    </div>

                    {/* Content */}
                    <pre className="flex-1 px-2 py-1 overflow-x-auto whitespace-pre">
                      <code
                        className={clsx(
                          line.type === 'add' && 'text-green-500',
                          line.type === 'remove' && 'text-red-500',
                          line.type === 'unchanged' && 'text-foreground/80'
                        )}
                      >
                        {line.content}
                      </code>
                    </pre>
                  </div>
                ))}
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Footer with actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowRight className="w-4 h-4" />
            <span>Review the changes before applying</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
            >
              <span className="flex items-center gap-2">
                <X className="w-4 h-4" />
                Reject
              </span>
            </button>
            <button
              onClick={onAccept}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Accept Changes
              </span>
            </button>
          </div>
        </div>
      </m.div>
    </m.div>
  );
}
