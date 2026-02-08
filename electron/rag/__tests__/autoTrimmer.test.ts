// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { autoTrim } from '../autoTrimmer';
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

describe('Auto Trimmer', () => {
  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle empty results', () => {
      const result = autoTrim([]);
      expect(result.context).toBe('');
      expect(result.tokenCount).toBe(0);
      expect(result.includedChunks).toBe(0);
      expect(result.totalChunks).toBe(0);
      expect(result.hasPartial).toBe(false);
      expect(result.includedIds).toEqual([]);
    });

    it('should include single small chunk', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'hello world' }),
      ];
      const result = autoTrim(results, { maxTokens: 1000 });
      expect(result.context).toContain('hello world');
      expect(result.includedChunks).toBe(1);
      expect(result.includedIds).toEqual(['a']);
    });
  });

  // -----------------------------------------------------------------------
  // Token budget enforcement
  // -----------------------------------------------------------------------
  describe('budget enforcement', () => {
    it('should include chunks that fit within budget', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'short text' }),
        makeResult({ id: 'b', score: 0.8, content: 'another short text' }),
      ];

      const result = autoTrim(results, { maxTokens: 1000 });
      expect(result.includedIds).toContain('a');
      expect(result.includedIds).toContain('b');
    });

    it('should stop when budget is exhausted', () => {
      // Create chunks that are each ~100 tokens (400 chars)
      const content = 'x'.repeat(400);
      const results = [
        makeResult({ id: 'a', score: 0.9, content }),
        makeResult({ id: 'b', score: 0.8, content }),
        makeResult({ id: 'c', score: 0.7, content }),
        makeResult({ id: 'd', score: 0.6, content }),
        makeResult({ id: 'e', score: 0.5, content }),
      ];

      const result = autoTrim(results, {
        maxTokens: 250,
        includeAttribution: false,
      });
      // Budget is 250 tokens (~1000 chars), each chunk is ~100 tokens
      // Should fit ~2 chunks + separator
      expect(result.includedIds.length).toBeLessThan(5);
      expect(result.tokenCount).toBeLessThanOrEqual(250);
    });

    it('should respect maxTokens option', () => {
      const content = 'word '.repeat(100); // ~125 tokens
      const results = [makeResult({ id: 'a', score: 0.9, content })];

      const result = autoTrim(results, {
        maxTokens: 50,
        allowPartial: false,
        includeAttribution: false,
      });
      // Chunk needs ~125 tokens but budget is 50, and partial is disabled
      expect(result.includedChunks).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Partial inclusion
  // -----------------------------------------------------------------------
  describe('partial inclusion', () => {
    it('should partially include chunks when allowPartial is true', () => {
      const content = 'word '.repeat(200); // ~250 tokens
      const results = [makeResult({ id: 'a', score: 0.9, content })];

      const result = autoTrim(results, {
        maxTokens: 100,
        allowPartial: true,
        minPartialTokens: 10,
        includeAttribution: false,
      });

      expect(result.hasPartial).toBe(true);
      expect(result.includedIds).toContain('a');
      // Content should be truncated
      expect(result.context.length).toBeLessThan(content.length);
    });

    it('should not partially include if remaining budget < minPartialTokens', () => {
      const largeContent = 'x'.repeat(2000); // ~500 tokens
      const results = [
        makeResult({ id: 'a', score: 0.9, content: largeContent }),
      ];

      const result = autoTrim(results, {
        maxTokens: 20,
        allowPartial: true,
        minPartialTokens: 50,
        includeAttribution: false,
      });

      // Budget (20) < minPartialTokens (50), should not include
      expect(result.includedIds.length).toBe(0);
    });

    it('should not partially include when allowPartial is false', () => {
      const content = 'x'.repeat(2000);
      const results = [makeResult({ id: 'a', score: 0.9, content })];

      const result = autoTrim(results, {
        maxTokens: 100,
        allowPartial: false,
        includeAttribution: false,
      });

      expect(result.includedChunks).toBe(0);
      expect(result.hasPartial).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Source attribution
  // -----------------------------------------------------------------------
  describe('attribution', () => {
    it('should include source attribution when enabled', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          content: 'function hello() {}',
          metadata: {
            path: '/src/utils.ts',
            startLine: 10,
            endLine: 15,
            symbolName: 'hello',
          },
        }),
      ];

      const result = autoTrim(results, {
        maxTokens: 1000,
        includeAttribution: true,
      });

      expect(result.context).toContain('[Source: /src/utils.ts');
      expect(result.context).toContain('lines 10-15');
      expect(result.context).toContain('hello');
      expect(result.context).toContain('function hello() {}');
    });

    it('should skip attribution when disabled', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          content: 'function hello() {}',
          metadata: { path: '/src/utils.ts' },
        }),
      ];

      const result = autoTrim(results, {
        maxTokens: 1000,
        includeAttribution: false,
      });

      expect(result.context).not.toContain('[Source:');
      expect(result.context).toBe('function hello() {}');
    });

    it('should handle metadata with url source', () => {
      const results = [
        makeResult({
          id: 'a',
          score: 0.9,
          content: 'web content',
          metadata: { url: 'https://example.com/docs' },
        }),
      ];

      const result = autoTrim(results, {
        maxTokens: 1000,
        includeAttribution: true,
      });

      expect(result.context).toContain('https://example.com/docs');
    });
  });

  // -----------------------------------------------------------------------
  // Chunk separator
  // -----------------------------------------------------------------------
  describe('chunk separator', () => {
    it('should use default separator between chunks', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'chunk one' }),
        makeResult({ id: 'b', score: 0.8, content: 'chunk two' }),
      ];

      const result = autoTrim(results, {
        maxTokens: 1000,
        includeAttribution: false,
      });

      expect(result.context).toContain('\n\n---\n\n');
    });

    it('should use custom separator', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'chunk one' }),
        makeResult({ id: 'b', score: 0.8, content: 'chunk two' }),
      ];

      const result = autoTrim(results, {
        maxTokens: 1000,
        includeAttribution: false,
        chunkSeparator: '\n===\n',
      });

      expect(result.context).toContain('\n===\n');
      expect(result.context).not.toContain('\n\n---\n\n');
    });
  });

  // -----------------------------------------------------------------------
  // Smart truncation
  // -----------------------------------------------------------------------
  describe('smart truncation', () => {
    it('should add truncation marker when content is truncated', () => {
      const content =
        'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. '.repeat(
          20
        );
      const results = [makeResult({ id: 'a', score: 0.9, content })];

      const result = autoTrim(results, {
        maxTokens: 50,
        allowPartial: true,
        minPartialTokens: 5,
        includeAttribution: false,
      });

      if (result.hasPartial) {
        expect(result.context).toContain('truncated');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Result metadata
  // -----------------------------------------------------------------------
  describe('result metadata', () => {
    it('should report correct totalChunks', () => {
      const results = [
        makeResult({ id: 'a', score: 0.9, content: 'one' }),
        makeResult({ id: 'b', score: 0.8, content: 'two' }),
        makeResult({ id: 'c', score: 0.7, content: 'three' }),
      ];

      const result = autoTrim(results, { maxTokens: 1000 });
      expect(result.totalChunks).toBe(3);
    });

    it('should report accurate tokenCount', () => {
      const results = [makeResult({ id: 'a', score: 0.9, content: 'hello' })];

      const result = autoTrim(results, {
        maxTokens: 1000,
        includeAttribution: false,
      });

      // "hello" is 5 chars / 4 ≈ 2 tokens
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.tokenCount).toBeLessThanOrEqual(1000);
    });

    it('should track includedIds correctly', () => {
      const results = [
        makeResult({ id: 'x1', score: 0.9, content: 'first' }),
        makeResult({ id: 'x2', score: 0.8, content: 'second' }),
      ];

      const result = autoTrim(results, { maxTokens: 1000 });
      expect(result.includedIds).toContain('x1');
      expect(result.includedIds).toContain('x2');
    });
  });
});
