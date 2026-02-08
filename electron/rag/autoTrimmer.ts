/**
 * Auto-Trimming Module
 *
 * Assembles the final context within a token budget by:
 *
 * 1. Score-based selection — greedily packs highest-scored chunks first
 * 2. Token-budget enforcement — stops when budget is exhausted
 * 3. Smart truncation — if a chunk doesn't fit fully, truncates at
 *    semantic boundaries (paragraph, sentence, line) rather than mid-word
 *
 * This is the last step before context is injected into the LLM prompt.
 */

import { SearchResult } from './types';
import { tokenCounter } from './tokenCounter';

/**
 * Options for auto-trimming.
 */
export interface TrimOptions {
  /** Maximum tokens for the assembled context (default 4000) */
  maxTokens?: number;
  /** Whether to attempt partial inclusion of a chunk that doesn't fully fit (default true) */
  allowPartial?: boolean;
  /** Minimum tokens a partial chunk must have to be included (default 50) */
  minPartialTokens?: number;
  /** Separator between chunks in the assembled output (default '\n\n---\n\n') */
  chunkSeparator?: string;
  /** Whether to include source attribution headers (default true) */
  includeAttribution?: boolean;
}

const DEFAULT_OPTIONS: Required<TrimOptions> = {
  maxTokens: 4000,
  allowPartial: true,
  minPartialTokens: 50,
  chunkSeparator: '\n\n---\n\n',
  includeAttribution: true,
};

/**
 * Result of auto-trimming.
 */
export interface TrimResult {
  /** The assembled context string, ready for LLM injection */
  context: string;
  /** How many tokens the assembled context uses */
  tokenCount: number;
  /** How many chunks were fully included */
  includedChunks: number;
  /** Total chunks that were considered */
  totalChunks: number;
  /** Whether any chunk was partially included */
  hasPartial: boolean;
  /** IDs of included chunks for traceability */
  includedIds: string[];
}

/**
 * Assemble search results into a context string that fits within a token budget.
 * Results should already be sorted by relevance (score descending).
 */
export function autoTrim(
  results: SearchResult[],
  options?: TrimOptions
): TrimResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (results.length === 0) {
    return {
      context: '',
      tokenCount: 0,
      includedChunks: 0,
      totalChunks: 0,
      hasPartial: false,
      includedIds: [],
    };
  }

  const separatorTokens = tokenCounter.estimateTokens(opts.chunkSeparator);
  let remainingTokens = opts.maxTokens;
  const includedParts: string[] = [];
  const includedIds: string[] = [];
  let hasPartial = false;

  for (const result of results) {
    const formatted = formatChunk(result, opts.includeAttribution);
    const chunkTokens = tokenCounter.estimateTokens(formatted);

    // Account for separator (except for the first chunk)
    const overheadTokens = includedParts.length > 0 ? separatorTokens : 0;
    const totalNeeded = chunkTokens + overheadTokens;

    if (totalNeeded <= remainingTokens) {
      // Chunk fits fully
      includedParts.push(formatted);
      includedIds.push(result.id);
      remainingTokens -= totalNeeded;
    } else if (
      opts.allowPartial &&
      remainingTokens > opts.minPartialTokens + overheadTokens
    ) {
      // Try partial inclusion
      const availableTokens = remainingTokens - overheadTokens;
      const partial = smartTruncate(formatted, availableTokens);

      if (
        partial &&
        tokenCounter.estimateTokens(partial) >= opts.minPartialTokens
      ) {
        includedParts.push(partial);
        includedIds.push(result.id);
        hasPartial = true;
        remainingTokens = 0; // Budget exhausted
      }
      break; // No more room
    } else {
      break; // No more room
    }
  }

  const context = includedParts.join(opts.chunkSeparator);

  return {
    context,
    tokenCount: tokenCounter.estimateTokens(context),
    includedChunks: includedIds.length - (hasPartial ? 1 : 0),
    totalChunks: results.length,
    hasPartial,
    includedIds,
  };
}

/**
 * Format a chunk for inclusion in the context.
 * Optionally adds a source attribution header.
 */
function formatChunk(
  result: SearchResult,
  includeAttribution: boolean
): string {
  if (!includeAttribution) return result.content;

  const meta = result.metadata;
  const parts: string[] = [];

  // Build attribution line
  const source = meta.path || meta.filePath || meta.url || meta.source;
  if (source) {
    let attribution = `[Source: ${source}`;
    if (
      typeof meta.startLine === 'number' &&
      typeof meta.endLine === 'number'
    ) {
      attribution += ` (lines ${meta.startLine}-${meta.endLine})`;
    }
    if (typeof meta.symbolName === 'string') {
      attribution += ` - ${meta.symbolName}`;
    }
    attribution += ']';
    parts.push(attribution);
  }

  parts.push(result.content);
  return parts.join('\n');
}

/**
 * Truncate text to fit within a token budget, cutting at semantic boundaries.
 * Priority: paragraph break > sentence end > line break > word boundary.
 * Returns null if no meaningful truncation is possible.
 */
function smartTruncate(text: string, maxTokens: number): string | null {
  const maxChars = maxTokens * 4; // ~4 chars per token heuristic
  if (text.length <= maxChars) return text;

  const truncated = text.slice(0, maxChars);

  // Try to find a good break point, working backwards from the end
  // 1. Paragraph break
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > maxChars * 0.5) {
    return truncated.slice(0, lastParagraph).trimEnd() + '\n[...truncated]';
  }

  // 2. Sentence end (period/question/exclamation followed by space or newline)
  const sentenceEnd = truncated.search(/[.!?]\s[^.!?]*$/);
  if (sentenceEnd > maxChars * 0.5) {
    return truncated.slice(0, sentenceEnd + 1).trimEnd() + ' [...truncated]';
  }

  // 3. Line break
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > maxChars * 0.3) {
    return truncated.slice(0, lastNewline).trimEnd() + '\n[...truncated]';
  }

  // 4. Word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.3) {
    return truncated.slice(0, lastSpace).trimEnd() + ' [...truncated]';
  }

  // Last resort: hard cut
  return truncated.trimEnd() + '...[truncated]';
}
