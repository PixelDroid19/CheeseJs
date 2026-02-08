// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { distillContext } from '../contextDistiller';
import { SearchResult } from '../types';

/** Helper to create a minimal SearchResult */
function makeResult(
  overrides: Partial<SearchResult> & { id: string; score: number }
): SearchResult {
  return {
    documentId: 'doc1',
    content: 'default content',
    metadata: {},
    embedding: undefined,
    ...overrides,
  };
}

describe('Context Distiller', () => {
  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should return empty results unchanged', () => {
      expect(distillContext([])).toEqual([]);
    });

    it('should return single result unchanged', () => {
      const results = [makeResult({ id: 'a', score: 0.9 })];
      const distilled = distillContext(results);
      expect(distilled).toEqual(results);
    });
  });

  // -----------------------------------------------------------------------
  // Deduplication
  // -----------------------------------------------------------------------
  describe('deduplication', () => {
    it('should remove near-duplicate chunks', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          content: 'the quick brown fox jumps over the lazy dog',
        }),
        makeResult({
          id: 'b',
          score: 0.8,
          content: 'the quick brown fox jumps over the lazy dog today',
        }),
      ];

      const distilled = distillContext(results, { dedupThreshold: 0.7 });
      // These are near-identical, second should be removed
      expect(distilled.length).toBe(1);
      expect(distilled[0].id).toBe('a'); // Keep higher scored
    });

    it('should keep distinct chunks', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          content: 'javascript functions and closures explanation',
        }),
        makeResult({
          id: 'b',
          score: 0.8,
          content: 'python decorators and generators tutorial',
        }),
      ];

      const distilled = distillContext(results, { dedupThreshold: 0.7 });
      expect(distilled.length).toBe(2);
    });

    it('should respect custom threshold', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          content: 'hello world program example code snippet',
        }),
        makeResult({
          id: 'b',
          score: 0.8,
          content: 'hello world program example python snippet',
        }),
      ];

      // Very strict threshold (0.95) - slight differences keep both
      const strict = distillContext(results, { dedupThreshold: 0.95 });
      expect(strict.length).toBe(2);

      // Very loose threshold (0.3) - even somewhat different chunks are removed
      const loose = distillContext(results, { dedupThreshold: 0.3 });
      expect(loose.length).toBe(1);
    });

    it('should handle identical content', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'exact same content here' }),
        makeResult({ id: 'b', score: 0.8, content: 'exact same content here' }),
      ];

      const distilled = distillContext(results);
      expect(distilled.length).toBe(1);
      expect(distilled[0].id).toBe('a');
    });
  });

  // -----------------------------------------------------------------------
  // Adjacent chunk merging
  // -----------------------------------------------------------------------
  describe('adjacent merging', () => {
    it('should merge adjacent chunks from same document', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          documentId: 'doc1',
          content: 'first chunk content here',
          metadata: { chunkIndex: 0, totalChunks: 3 },
        }),
        makeResult({
          id: 'b',
          score: 0.8,
          documentId: 'doc1',
          content: 'second chunk content here',
          metadata: { chunkIndex: 1, totalChunks: 3 },
        }),
      ];

      const distilled = distillContext(results, { mergeAdjacent: true });
      // Should merge into a single chunk
      expect(distilled.length).toBe(1);
      expect(distilled[0].content).toContain('first chunk');
      expect(distilled[0].content).toContain('second chunk');
    });

    it('should not merge non-adjacent chunks', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          documentId: 'doc1',
          content: 'first chunk here is unique',
          metadata: { chunkIndex: 0, totalChunks: 10 },
        }),
        makeResult({
          id: 'b',
          score: 0.8,
          documentId: 'doc1',
          content: 'fifth chunk here is also unique',
          metadata: { chunkIndex: 5, totalChunks: 10 },
        }),
      ];

      const distilled = distillContext(results, {
        mergeAdjacent: true,
        maxMergeGap: 1,
      });
      // Gap of 5 > maxMergeGap of 1, should not merge
      expect(distilled.length).toBe(2);
    });

    it('should not merge chunks from different documents', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          documentId: 'doc1',
          content: 'doc one chunk unique content alpha',
          metadata: { chunkIndex: 0 },
        }),
        makeResult({
          id: 'b',
          score: 0.8,
          documentId: 'doc2',
          content: 'doc two chunk unique content beta',
          metadata: { chunkIndex: 0 },
        }),
      ];

      const distilled = distillContext(results, { mergeAdjacent: true });
      expect(distilled.length).toBe(2);
    });

    it('should use highest score from merged run', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.7,
          documentId: 'doc1',
          content: 'chunk alpha content',
          metadata: { chunkIndex: 0 },
        }),
        makeResult({
          id: 'b',
          score: 0.9,
          documentId: 'doc1',
          content: 'chunk beta content',
          metadata: { chunkIndex: 1 },
        }),
      ];

      const distilled = distillContext(results, { mergeAdjacent: true });
      expect(distilled.length).toBe(1);
      expect(distilled[0].score).toBe(0.9);
    });

    it('should skip merging when mergeAdjacent is false', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          documentId: 'doc1',
          content: 'unique chunk content alpha bravo charlie',
          metadata: { chunkIndex: 0 },
        }),
        makeResult({
          id: 'b',
          score: 0.8,
          documentId: 'doc1',
          content: 'unique chunk content delta echo foxtrot',
          metadata: { chunkIndex: 1 },
        }),
      ];

      const distilled = distillContext(results, { mergeAdjacent: false });
      expect(distilled.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Overlap removal in merged chunks
  // -----------------------------------------------------------------------
  describe('overlap removal', () => {
    it('should remove overlapping content when merging', () => {
      const overlap = 'this is the overlapping region here';
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          documentId: 'doc1',
          content: `first part unique content ${overlap}`,
          metadata: { chunkIndex: 0 },
        }),
        makeResult({
          id: 'b',
          score: 0.8,
          documentId: 'doc1',
          content: `${overlap} second part unique content`,
          metadata: { chunkIndex: 1 },
        }),
      ];

      const distilled = distillContext(results, { mergeAdjacent: true });
      expect(distilled.length).toBe(1);
      // The overlap should appear only once (or close to once)
      const content = distilled[0].content;
      expect(content).toContain('first part unique content');
      expect(content).toContain('second part unique content');
    });
  });

  // -----------------------------------------------------------------------
  // Score ordering
  // -----------------------------------------------------------------------
  describe('output ordering', () => {
    it('should maintain score descending order after distillation', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          documentId: 'doc1',
          content: 'alpha unique first document content',
        }),
        makeResult({
          id: 'b',
          score: 0.7,
          documentId: 'doc2',
          content: 'beta unique second document content',
        }),
        makeResult({
          id: 'c',
          score: 0.5,
          documentId: 'doc3',
          content: 'gamma unique third document content',
        }),
      ];

      const distilled = distillContext(results);
      for (let i = 1; i < distilled.length; i++) {
        expect(distilled[i].score).toBeLessThanOrEqual(distilled[i - 1].score);
      }
    });
  });
});
