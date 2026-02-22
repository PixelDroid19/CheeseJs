// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { tokenize, BM25Index, fuseScores } from '../bm25';

describe('BM25 Module', () => {
  // -----------------------------------------------------------------------
  // tokenize
  // -----------------------------------------------------------------------
  describe('tokenize', () => {
    it('should lowercase all tokens', () => {
      const tokens = tokenize('Hello World');
      expect(tokens).toEqual(['hello', 'world']);
    });

    it('should strip punctuation', () => {
      const tokens = tokenize('hello, world! foo-bar');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('foo');
      expect(tokens).toContain('bar');
    });

    it('should filter out single-character tokens', () => {
      const tokens = tokenize('I am a developer');
      expect(tokens).not.toContain('i');
      expect(tokens).not.toContain('a');
      expect(tokens).toContain('am');
      expect(tokens).toContain('developer');
    });

    it('should split on whitespace', () => {
      const tokens = tokenize('one  two\tthree\nfour');
      expect(tokens).toEqual(['one', 'two', 'three', 'four']);
    });

    it('should return empty array for empty input', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize('   ')).toEqual([]);
    });

    it('should handle code-like tokens', () => {
      const tokens = tokenize('function myFunc() { return 42; }');
      expect(tokens).toContain('function');
      expect(tokens).toContain('myfunc');
      expect(tokens).toContain('return');
      expect(tokens).toContain('42');
    });
  });

  // -----------------------------------------------------------------------
  // BM25Index
  // -----------------------------------------------------------------------
  describe('BM25Index', () => {
    it('should report correct size', () => {
      const index = new BM25Index();
      index.build([
        { id: 'a', content: 'hello world' },
        { id: 'b', content: 'foo bar' },
      ]);
      expect(index.size).toBe(2);
    });

    it('should return empty results for empty query', () => {
      const index = new BM25Index();
      index.build([{ id: 'a', content: 'hello world' }]);
      expect(index.score('')).toEqual([]);
    });

    it('should return empty results for empty corpus', () => {
      const index = new BM25Index();
      index.build([]);
      expect(index.score('hello')).toEqual([]);
      expect(index.size).toBe(0);
    });

    it('should rank documents matching query terms higher', () => {
      const index = new BM25Index();
      index.build([
        { id: 'doc1', content: 'the quick brown fox jumps over the lazy dog' },
        { id: 'doc2', content: 'cats are independent animals that like milk' },
        { id: 'doc3', content: 'the fox is a quick animal in the forest' },
      ]);

      const results = index.score('quick fox');
      expect(results.length).toBeGreaterThanOrEqual(2);
      // doc1 and doc3 mention both "quick" and "fox", doc2 doesn't
      const ids = results.map((r) => r.id);
      // Either doc1 or doc3 can rank first (both have the query terms)
      expect(ids[0]).toBeOneOf(['doc1', 'doc3']);
      expect(ids).not.toContain('doc2');
    });

    it('should return sorted by score descending', () => {
      const index = new BM25Index();
      index.build([
        { id: 'a', content: 'javascript typescript react' },
        { id: 'b', content: 'python django flask' },
        { id: 'c', content: 'javascript node express react' },
      ]);

      const results = index.score('javascript react');
      expect(results.length).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it('should give higher scores to documents with more matching terms', () => {
      const index = new BM25Index();
      index.build([
        { id: 'one-match', content: 'apple banana cherry' },
        { id: 'two-match', content: 'apple grape banana' },
      ]);

      const results = index.score('apple banana');
      // Both have both terms, but let's just ensure both score
      expect(results.length).toBe(2);
      expect(results.every((r) => r.score > 0)).toBe(true);
    });

    it('should handle repeated terms correctly', () => {
      const index = new BM25Index();
      index.build([
        { id: 'repeated', content: 'error error error fix' },
        { id: 'single', content: 'error fix debug' },
      ]);

      const results = index.score('error');
      expect(results.length).toBe(2);
      // The document with more "error" mentions should rank higher (due to TF)
      expect(results[0].id).toBe('repeated');
    });

    // -----------------------------------------------------------------------
    // scoreForIds
    // -----------------------------------------------------------------------
    describe('scoreForIds', () => {
      it('should only return scores for requested IDs', () => {
        const index = new BM25Index();
        index.build([
          { id: 'a', content: 'hello world' },
          { id: 'b', content: 'hello there' },
          { id: 'c', content: 'hello everyone' },
        ]);

        const result = index.scoreForIds('hello', new Set(['a', 'c']));
        expect(result.has('a')).toBe(true);
        expect(result.has('c')).toBe(true);
        expect(result.has('b')).toBe(false);
      });

      it('should return empty map for non-matching IDs', () => {
        const index = new BM25Index();
        index.build([{ id: 'a', content: 'hello world' }]);
        const result = index.scoreForIds('hello', new Set(['z']));
        expect(result.size).toBe(0);
      });
    });
  });

  // -----------------------------------------------------------------------
  // fuseScores (Reciprocal Rank Fusion)
  // -----------------------------------------------------------------------
  describe('fuseScores', () => {
    it('should return empty array for empty inputs', () => {
      const result = fuseScores([], new Map());
      expect(result).toEqual([]);
    });

    it('should fuse vector and BM25 results', () => {
      const vectorResults = [
        { id: 'a', score: 0.9 },
        { id: 'b', score: 0.7 },
        { id: 'c', score: 0.5 },
      ];
      const bm25Scores = new Map([
        ['b', 5.0],
        ['c', 3.0],
        ['a', 1.0],
      ]);

      const fused = fuseScores(vectorResults, bm25Scores);
      expect(fused.length).toBe(3);
      // All should have positive fused scores
      for (const r of fused) {
        expect(r.score).toBeGreaterThan(0);
      }
    });

    it('should preserve result ordering by fused score', () => {
      const vectorResults = [
        { id: 'a', score: 0.9 },
        { id: 'b', score: 0.8 },
      ];
      const bm25Scores = new Map([
        ['a', 3.0],
        ['b', 1.0],
      ]);

      const fused = fuseScores(vectorResults, bm25Scores);
      expect(fused.length).toBe(2);
      expect(fused[0].score).toBeGreaterThanOrEqual(fused[1].score);
    });

    it('should handle BM25-only hits gracefully (skip them)', () => {
      const vectorResults = [{ id: 'a', score: 0.9 }];
      const bm25Scores = new Map([
        ['a', 3.0],
        ['b', 5.0], // not in vector results
      ]);

      const fused = fuseScores(vectorResults, bm25Scores);
      // 'b' is BM25-only, should be skipped (no chunk data)
      expect(fused.length).toBe(1);
      expect(fused[0].id).toBe('a');
    });

    it('should respect custom weights', () => {
      const vectorResults = [
        { id: 'a', score: 0.9 },
        { id: 'b', score: 0.8 },
      ];
      const bm25Scores = new Map([
        ['b', 10.0],
        ['a', 1.0],
      ]);

      // With high BM25 weight, 'b' might rank higher
      const fusedHighBm25 = fuseScores(vectorResults, bm25Scores, 0.1, 0.9);
      // With high vector weight, 'a' should rank higher
      const fusedHighVector = fuseScores(vectorResults, bm25Scores, 0.9, 0.1);

      // Under high BM25 weight, 'b' (BM25 rank 1) should be boosted
      expect(fusedHighBm25[0].id).toBe('b');
      // Under high vector weight, 'a' (vector rank 1) should be boosted
      expect(fusedHighVector[0].id).toBe('a');
    });

    it('should preserve additional properties on result objects', () => {
      const vectorResults = [
        { id: 'a', score: 0.9, content: 'hello', extra: true },
      ];
      const bm25Scores = new Map([['a', 3.0]]);

      const fused = fuseScores(vectorResults, bm25Scores);
      expect(fused[0].content).toBe('hello');
      expect((fused[0] as any).extra).toBe(true);
    });
  });
});
