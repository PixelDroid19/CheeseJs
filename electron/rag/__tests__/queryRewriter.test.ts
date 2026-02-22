// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { rewriteQuery } from '../queryRewriter';

describe('Query Rewriter', () => {
  // -----------------------------------------------------------------------
  // Empty / edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle empty query', () => {
      const result = rewriteQuery('');
      expect(result.primary).toBe('');
      expect(result.expanded).toBe('');
      expect(result.subQueries).toEqual([]);
      expect(result.wasRewritten).toBe(false);
    });

    it('should handle whitespace-only query', () => {
      const result = rewriteQuery('   ');
      expect(result.primary).toBe('');
      expect(result.wasRewritten).toBe(false);
    });

    it('should handle single word query', () => {
      const result = rewriteQuery('hello');
      expect(result.primary).toBe('hello');
    });
  });

  // -----------------------------------------------------------------------
  // Typo correction
  // -----------------------------------------------------------------------
  describe('typo correction', () => {
    it('should fix common JavaScript typos', () => {
      const result = rewriteQuery('javasript function');
      expect(result.primary).toContain('javascript');
    });

    it('should fix TypeScript typos', () => {
      const result = rewriteQuery('typescipt interface');
      expect(result.primary).toContain('typescript');
    });

    it('should fix function typos', () => {
      const result = rewriteQuery('fucntion declaration');
      expect(result.primary).toContain('function');
    });

    it('should fix React typos', () => {
      const result = rewriteQuery('recat component');
      expect(result.primary).toContain('react');
    });

    it('should fix async/await typos', () => {
      const result1 = rewriteQuery('aysnc function');
      expect(result1.primary).toContain('async');

      const result2 = rewriteQuery('awiat promise');
      expect(result2.primary).toContain('await');
    });

    it('should fix import/export typos', () => {
      const result1 = rewriteQuery('improt module');
      expect(result1.primary).toContain('import');

      const result2 = rewriteQuery('exoprt default');
      expect(result2.primary).toContain('export');
    });

    it('should preserve capitalization pattern when fixing typos', () => {
      const result = rewriteQuery('Javasript is great');
      expect(result.primary).toContain('Javascript');
    });

    it('should not alter correctly spelled words', () => {
      const result = rewriteQuery('function component');
      expect(result.primary).toContain('function');
      expect(result.primary).toContain('component');
    });
  });

  // -----------------------------------------------------------------------
  // Synonym expansion
  // -----------------------------------------------------------------------
  describe('synonym expansion', () => {
    it('should expand function synonyms', () => {
      const result = rewriteQuery('function declaration');
      expect(result.expanded).toContain('function');
      // Should add synonyms like func, fn, method, def
      expect(result.expanded).toContain('func');
    });

    it('should expand class synonyms', () => {
      const result = rewriteQuery('class definition');
      expect(result.expanded).toContain('class');
      // Should include struct, type, interface
      expect(result.expanded).toContain('struct');
    });

    it('should expand error synonyms', () => {
      const result = rewriteQuery('error handling');
      expect(result.expanded).toContain('error');
      expect(result.expanded).toContain('exception');
    });

    it('should expand database synonyms', () => {
      const result = rewriteQuery('database connection');
      expect(result.expanded).toContain('database');
      expect(result.expanded).toContain('db');
    });

    it('should not duplicate terms already in query', () => {
      const result = rewriteQuery('function method');
      // Both "function" and "method" are in the same synonym group
      // Expansion should not duplicate them
      const words = result.expanded.split(/\s+/);
      const functionCount = words.filter((w) => w === 'function').length;
      expect(functionCount).toBeLessThanOrEqual(1);
    });

    it('should not expand terms with no synonyms', () => {
      const result = rewriteQuery('foobar bazzle');
      expect(result.expanded).toBe(result.primary);
    });
  });

  // -----------------------------------------------------------------------
  // Query normalization
  // -----------------------------------------------------------------------
  describe('normalization', () => {
    it('should trim whitespace', () => {
      const result = rewriteQuery('  hello world  ');
      expect(result.primary).toBe('hello world');
    });

    it('should collapse multiple spaces', () => {
      const result = rewriteQuery('hello   world');
      expect(result.primary).toBe('hello world');
    });

    it('should remove question prefixes', () => {
      const r1 = rewriteQuery('how do I create a function');
      expect(r1.primary).toBe('create a function');

      const r2 = rewriteQuery('what is a promise');
      expect(r2.primary).toBe('a promise');

      const r3 = rewriteQuery('where is the config');
      expect(r3.primary).toBe('the config');

      const r4 = rewriteQuery('can I use async await');
      expect(r4.primary).toBe('use async await');

      const r5 = rewriteQuery('please help me fix this');
      // "please" prefix is removed, then "help me" is also a prefix
      expect(r5.primary.length).toBeLessThan('please help me fix this'.length);
    });
  });

  // -----------------------------------------------------------------------
  // Query decomposition
  // -----------------------------------------------------------------------
  describe('decomposition', () => {
    it('should decompose compound queries with "and"', () => {
      const result = rewriteQuery('create a function and export it as default');
      expect(result.subQueries.length).toBeGreaterThan(1);
      expect(result.subQueries[0]).toBe(result.primary); // original included
    });

    it('should decompose compound queries with "or"', () => {
      const result = rewriteQuery('use promises or async await for handling');
      expect(result.subQueries.length).toBeGreaterThan(1);
    });

    it('should not decompose short queries', () => {
      const result = rewriteQuery('fix and test');
      // 3 words, should not decompose
      expect(result.subQueries).toEqual([result.primary]);
    });

    it('should not decompose queries without compound patterns', () => {
      const result = rewriteQuery('create typescript function declaration');
      expect(result.subQueries).toEqual([result.primary]);
    });
  });

  // -----------------------------------------------------------------------
  // wasRewritten flag
  // -----------------------------------------------------------------------
  describe('wasRewritten', () => {
    it('should be true when typos are fixed', () => {
      const result = rewriteQuery('javasript');
      expect(result.wasRewritten).toBe(true);
    });

    it('should be true when synonyms are expanded', () => {
      const result = rewriteQuery('function');
      expect(result.wasRewritten).toBe(true);
    });

    it('should be true when question prefix is removed', () => {
      const result = rewriteQuery('how to create components');
      expect(result.wasRewritten).toBe(true);
    });

    it('should be false for a simple unrecognized query', () => {
      const result = rewriteQuery('xyzzy');
      expect(result.wasRewritten).toBe(false);
    });
  });
});
