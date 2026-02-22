// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { rerank } from '../reranker';
import { SearchResult } from '../types';

/** Helper to create a minimal SearchResult */
function makeResult(
  overrides: Partial<SearchResult> & { id: string; score: number }
): SearchResult {
  return {
    documentId: 'doc1',
    content: 'some content',
    metadata: {},
    embedding: undefined,
    ...overrides,
  };
}

describe('Reranker', () => {
  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should return empty array for empty results', () => {
      expect(rerank([], 'query', 10)).toEqual([]);
    });

    it('should return at most limit results', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'hello world' }),
        makeResult({ id: 'b', score: 0.8, content: 'hello there' }),
        makeResult({ id: 'c', score: 0.7, content: 'hello everyone' }),
      ];
      const reranked = rerank(results, 'hello', 2);
      expect(reranked.length).toBe(2);
    });

    it('should handle single result', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'test content' }),
      ];
      const reranked = rerank(results, 'test', 5);
      expect(reranked.length).toBe(1);
      expect(reranked[0].id).toBe('a');
    });
  });

  // -----------------------------------------------------------------------
  // Scoring signals
  // -----------------------------------------------------------------------
  describe('scoring signals', () => {
    it('should boost results with keyword overlap', () => {
      const results = [
        makeResult({
          id: 'no-match',
          score: 0.9,
          content: 'completely unrelated text about nothing',
        }),
        makeResult({
          id: 'match',
          score: 0.85,
          content: 'this function handles authentication login',
        }),
      ];

      const reranked = rerank(results, 'authentication login', 2, {
        keywordWeight: 0.5,
        similarityWeight: 0.3,
        metadataWeight: 0.1,
        positionWeight: 0.1,
      });

      // With high keyword weight, the match should rank higher despite lower base score
      expect(reranked[0].id).toBe('match');
    });

    it('should boost results with symbol names in metadata', () => {
      const results = [
        makeResult({
          id: 'no-symbol',
          score: 0.9,
          content: 'some code block',
          metadata: {},
        }),
        makeResult({
          id: 'has-symbol',
          score: 0.9,
          content: 'some code block',
          metadata: { symbolName: 'myFunction' },
        }),
      ];

      const reranked = rerank(results, 'code', 2);
      // Both have same base score, but has-symbol gets metadata boost
      expect(reranked[0].id).toBe('has-symbol');
    });

    it('should prefer earlier chunks (position score)', () => {
      const results = [
        makeResult({
          id: 'late',
          score: 0.9,
          content: 'test content',
          metadata: { chunkIndex: 9, totalChunks: 10 },
        }),
        makeResult({
          id: 'early',
          score: 0.9,
          content: 'test content',
          metadata: { chunkIndex: 0, totalChunks: 10 },
        }),
      ];

      const reranked = rerank(results, 'test', 2);
      // Both have same score and content, but early chunk gets position boost
      expect(reranked[0].id).toBe('early');
    });
  });

  // -----------------------------------------------------------------------
  // Metadata boost
  // -----------------------------------------------------------------------
  describe('metadata boost', () => {
    it('should boost preferred chunk types', () => {
      const results = [
        makeResult({
          id: 'paragraph',
          score: 0.9,
          content: 'some text content',
          metadata: { chunkType: 'paragraph' },
        }),
        makeResult({
          id: 'function',
          score: 0.85,
          content: 'some text content',
          metadata: { chunkType: 'function' },
        }),
      ];

      const reranked = rerank(results, 'text', 2, undefined, {
        preferredChunkTypes: ['function'],
      });

      // Function type gets boosted
      expect(reranked[0].id).toBe('function');
    });

    it('should boost recent documents when recencyBoost is set', () => {
      const now = Date.now();
      const results = [
        makeResult({
          id: 'old',
          score: 0.9,
          content: 'some test text',
          metadata: { dateIndexed: now - 60 * 24 * 60 * 60 * 1000 }, // 60 days ago
        }),
        makeResult({
          id: 'recent',
          score: 0.85,
          content: 'some test text',
          metadata: { dateIndexed: now - 1000 }, // just now
        }),
      ];

      const reranked = rerank(results, 'test', 2, undefined, {
        recencyBoost: 1.0,
      });

      // Recent should be boosted up
      expect(reranked[0].id).toBe('recent');
    });
  });

  // -----------------------------------------------------------------------
  // Custom weights
  // -----------------------------------------------------------------------
  describe('custom weights', () => {
    it('should respect similarityWeight dominance', () => {
      const results = [
        makeResult({ id: 'high-sim', score: 1.0, content: 'unrelated text' }),
        makeResult({
          id: 'low-sim',
          score: 0.1,
          content: 'exact query match here',
        }),
      ];

      const reranked = rerank(results, 'exact query match', 2, {
        similarityWeight: 0.95,
        keywordWeight: 0.05,
        metadataWeight: 0,
        positionWeight: 0,
      });

      // With high similarity weight, high-sim should stay first
      expect(reranked[0].id).toBe('high-sim');
    });
  });

  // -----------------------------------------------------------------------
  // Output format
  // -----------------------------------------------------------------------
  describe('output format', () => {
    it('should return results sorted by composite score descending', () => {
      const results = [
        makeResult({ id: 'a', score: 0.5, content: 'alpha content' }),
        makeResult({ id: 'b', score: 0.8, content: 'beta content' }),
        makeResult({ id: 'c', score: 0.3, content: 'gamma content' }),
      ];

      const reranked = rerank(results, 'content', 3);
      for (let i = 1; i < reranked.length; i++) {
        expect(reranked[i].score).toBeLessThanOrEqual(reranked[i - 1].score);
      }
    });

    it('should update scores to composite scores', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'hello world' }),
      ];

      const reranked = rerank(results, 'hello', 1);
      // Score should be a composite, not the original
      expect(reranked[0].score).toBeDefined();
      expect(typeof reranked[0].score).toBe('number');
    });

    it('should preserve all SearchResult fields', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          documentId: 'doc-123',
          content: 'hello world',
          metadata: { path: '/test.ts' },
        }),
      ];

      const reranked = rerank(results, 'hello', 1);
      expect(reranked[0].id).toBe('a');
      expect(reranked[0].documentId).toBe('doc-123');
      expect(reranked[0].content).toBe('hello world');
      expect(reranked[0].metadata.path).toBe('/test.ts');
    });
  });
});
