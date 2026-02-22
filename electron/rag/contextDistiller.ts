/**
 * Context Distillation Module
 *
 * Post-processes search results to produce a cleaner, more concise context:
 *
 * 1. Deduplication — removes chunks with near-identical content
 * 2. Adjacent merging — combines consecutive chunks from the same document
 * 3. Overlap removal — trims overlapping regions between merged chunks
 *
 * The goal is to maximize information density within a token budget
 * by eliminating redundancy before passing context to the LLM.
 */

import { SearchResult } from './types';

/**
 * Configuration for context distillation.
 */
export interface DistillOptions {
  /** Jaccard similarity threshold for deduplication (0-1, default 0.7) */
  dedupThreshold?: number;
  /** Whether to merge adjacent chunks from the same document (default true) */
  mergeAdjacent?: boolean;
  /** Maximum gap between chunk indices to still consider "adjacent" (default 1) */
  maxMergeGap?: number;
}

const DEFAULT_OPTIONS: Required<DistillOptions> = {
  dedupThreshold: 0.7,
  mergeAdjacent: true,
  maxMergeGap: 1,
};

/**
 * Distill a set of search results to remove redundancy.
 * Returns a cleaned set of results, preserving score ordering.
 */
export function distillContext(
  results: SearchResult[],
  options?: DistillOptions
): SearchResult[] {
  if (results.length <= 1) return results;

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Step 1: Deduplicate near-identical chunks
  let distilled = deduplicateChunks(results, opts.dedupThreshold);

  // Step 2: Merge adjacent chunks from the same document
  if (opts.mergeAdjacent) {
    distilled = mergeAdjacentChunks(distilled, opts.maxMergeGap);
  }

  return distilled;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Compute a set of word tokens for Jaccard similarity.
 */
function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

/**
 * Jaccard similarity between two sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;

  let intersection = 0;
  // Iterate over the smaller set for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const token of smaller) {
    if (larger.has(token)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Remove chunks that are near-duplicates of higher-scored chunks.
 * Keeps the highest-scored version of each duplicate group.
 */
function deduplicateChunks(
  results: SearchResult[],
  threshold: number
): SearchResult[] {
  // Results should already be sorted by score descending
  const kept: SearchResult[] = [];
  const keptTokenSets: Set<string>[] = [];

  for (const result of results) {
    const tokens = tokenSet(result.content);

    // Check if this chunk is a near-duplicate of any kept chunk
    let isDuplicate = false;
    for (const keptTokens of keptTokenSets) {
      if (jaccardSimilarity(tokens, keptTokens) >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(result);
      keptTokenSets.push(tokens);
    }
  }

  return kept;
}

// ---------------------------------------------------------------------------
// Adjacent chunk merging
// ---------------------------------------------------------------------------

/**
 * Merge consecutive chunks from the same document into single, larger chunks.
 * This produces more coherent context by reassembling content that was split
 * during chunking.
 */
function mergeAdjacentChunks(
  results: SearchResult[],
  maxGap: number
): SearchResult[] {
  if (results.length <= 1) return results;

  // Group results by documentId
  const groups = new Map<string, SearchResult[]>();
  for (const result of results) {
    const docId = result.documentId;
    if (!groups.has(docId)) {
      groups.set(docId, []);
    }
    groups.get(docId)!.push(result);
  }

  const merged: SearchResult[] = [];

  for (const [, docResults] of groups) {
    if (docResults.length === 1) {
      merged.push(docResults[0]);
      continue;
    }

    // Sort by chunkIndex within this document
    const sorted = [...docResults].sort((a, b) => {
      const aIdx =
        typeof a.metadata.chunkIndex === 'number' ? a.metadata.chunkIndex : 0;
      const bIdx =
        typeof b.metadata.chunkIndex === 'number' ? b.metadata.chunkIndex : 0;
      return aIdx - bIdx;
    });

    // Find runs of adjacent chunks
    let runStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      const prevIdx =
        typeof sorted[i - 1].metadata.chunkIndex === 'number'
          ? (sorted[i - 1].metadata.chunkIndex as number)
          : i - 1;

      const currIdx =
        i < sorted.length && typeof sorted[i].metadata.chunkIndex === 'number'
          ? (sorted[i].metadata.chunkIndex as number)
          : prevIdx + maxGap + 2; // Force break at end

      const gap = currIdx - prevIdx;

      if (gap > maxGap || i === sorted.length) {
        // End of a run — merge chunks from runStart to i-1
        if (i - runStart === 1) {
          // Single chunk, no merge needed
          merged.push(sorted[runStart]);
        } else {
          // Merge multiple chunks
          const run = sorted.slice(runStart, i);
          merged.push(mergeChunkRun(run));
        }
        runStart = i;
      }
    }
  }

  // Re-sort by score descending (merging may have changed relative order)
  merged.sort((a, b) => b.score - a.score);

  return merged;
}

/**
 * Merge a run of adjacent chunks into a single chunk.
 * Attempts to remove overlapping content between adjacent chunks.
 */
function mergeChunkRun(run: SearchResult[]): SearchResult {
  // Use the highest score from the run
  const bestScore = Math.max(...run.map((r) => r.score));

  // Merge content, removing overlapping regions
  let mergedContent = run[0].content;
  for (let i = 1; i < run.length; i++) {
    mergedContent = mergeWithOverlapRemoval(mergedContent, run[i].content);
  }

  // Merge metadata
  const firstMeta = run[0].metadata;
  const lastMeta = run[run.length - 1].metadata;

  return {
    id: run[0].id, // Use first chunk's ID
    documentId: run[0].documentId,
    content: mergedContent,
    metadata: {
      ...firstMeta,
      // Update line range to span the full run
      startLine: firstMeta.startLine,
      endLine: lastMeta.endLine,
      // Mark as merged
      chunkType: 'merged',
      mergedFrom: run.map((r) => r.id),
      chunkIndex: firstMeta.chunkIndex,
      totalChunks: firstMeta.totalChunks,
    },
    score: bestScore,
  };
}

/**
 * Merge two text strings, removing overlapping suffix/prefix.
 * Finds the longest suffix of `a` that matches a prefix of `b`.
 */
function mergeWithOverlapRemoval(a: string, b: string): string {
  // Find the longest overlap (up to 500 chars to limit search)
  const maxOverlap = Math.min(a.length, b.length, 500);
  let overlapLen = 0;

  for (let len = 1; len <= maxOverlap; len++) {
    const suffix = a.slice(a.length - len);
    const prefix = b.slice(0, len);
    if (suffix === prefix) {
      overlapLen = len;
    }
  }

  if (overlapLen > 20) {
    // Only remove meaningful overlaps (>20 chars)
    return a + b.slice(overlapLen);
  }

  // No significant overlap — join with a newline separator
  return a + '\n' + b;
}
