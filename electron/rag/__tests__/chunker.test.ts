// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { smartChunk } from '../chunker';

describe('Smart Chunker', () => {
  // -----------------------------------------------------------------------
  // smartChunk dispatcher
  // -----------------------------------------------------------------------
  describe('smartChunk dispatcher', () => {
    it('should return empty array for empty input', () => {
      expect(smartChunk('')).toEqual([]);
      expect(smartChunk('   ')).toEqual([]);
      expect(smartChunk('\n\n')).toEqual([]);
    });

    it('should use code chunker for code extensions', () => {
      const code = `function hello() {\n  return 'hi';\n}\n\nfunction world() {\n  return 'world';\n}`;
      const chunks = smartChunk(code, '.ts');
      expect(chunks.length).toBeGreaterThan(0);
      // Code chunks get 'function' or 'code-block' types
      for (const c of chunks) {
        expect(['function', 'code-block', 'fallback']).toContain(
          c.meta.chunkType
        );
      }
    });

    it('should use prose chunker for markdown extensions', () => {
      const md = `# Heading One\n\nParagraph one.\n\n# Heading Two\n\nParagraph two.`;
      const chunks = smartChunk(md, '.md');
      expect(chunks.length).toBeGreaterThan(0);
      for (const c of chunks) {
        expect(['section', 'paragraph', 'fallback']).toContain(
          c.meta.chunkType
        );
      }
    });

    it('should use fallback chunker for unknown extensions', () => {
      const text = 'Some text content without special formatting.';
      const chunks = smartChunk(text, '.xyz');
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].meta.chunkType).toBe('fallback');
    });

    it('should use fallback chunker when no extension provided', () => {
      const text = 'Some text content without extension.';
      const chunks = smartChunk(text);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].meta.chunkType).toBe('fallback');
    });

    it('should handle all supported code extensions', () => {
      const exts = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.mjs',
        '.cjs',
        '.py',
        '.java',
        '.go',
        '.rs',
        '.c',
        '.cpp',
        '.h',
        '.hpp',
        '.cs',
        '.rb',
        '.php',
        '.swift',
        '.kt',
      ];
      const code = 'const x = 1;';
      for (const ext of exts) {
        const chunks = smartChunk(code, ext);
        expect(chunks.length).toBeGreaterThan(0);
      }
    });

    it('should handle prose extensions', () => {
      const exts = ['.md', '.mdx', '.txt', '.rst'];
      const text = 'Hello world';
      for (const ext of exts) {
        const chunks = smartChunk(text, ext);
        expect(chunks.length).toBeGreaterThan(0);
      }
    });

    it('should be case-insensitive for extensions', () => {
      const code = 'const x = 1;';
      const chunks = smartChunk(code, '.TS');
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Code chunker
  // -----------------------------------------------------------------------
  describe('code chunker', () => {
    it('should detect function boundaries', () => {
      const code = [
        'function alpha() {',
        '  return 1;',
        '}',
        '',
        'function beta() {',
        '  return 2;',
        '}',
      ].join('\n');

      const chunks = smartChunk(code, '.js');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // At least one chunk should have a symbolName
      const symbols = chunks.map((c) => c.meta.symbolName).filter(Boolean);
      expect(symbols.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect class boundaries', () => {
      const code = [
        'class MyClass {',
        '  constructor() {}',
        '  method() {}',
        '}',
        '',
        'class AnotherClass {',
        '  doSomething() {}',
        '}',
      ].join('\n');

      const chunks = smartChunk(code, '.ts');
      const hasClass = chunks.some(
        (c) =>
          c.meta.symbolName === 'MyClass' ||
          c.meta.symbolName === 'AnotherClass'
      );
      expect(hasClass).toBe(true);
    });

    it('should detect export declarations', () => {
      const code = [
        'export function greet() {',
        '  return "hello";',
        '}',
        '',
        'export const VALUE = 42;',
      ].join('\n');

      const chunks = smartChunk(code, '.ts');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect Python def and class', () => {
      const code = [
        'class Animal:',
        '    def __init__(self):',
        '        self.name = ""',
        '',
        'def create_animal():',
        '    return Animal()',
      ].join('\n');

      const chunks = smartChunk(code, '.py');
      const symbols = chunks.map((c) => c.meta.symbolName).filter(Boolean);
      expect(symbols.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect Rust fn and struct', () => {
      const code = [
        'pub struct Point {',
        '    x: f64,',
        '    y: f64,',
        '}',
        '',
        'pub fn distance(a: &Point, b: &Point) -> f64 {',
        '    ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt()',
        '}',
      ].join('\n');

      const chunks = smartChunk(code, '.rs');
      const symbols = chunks.map((c) => c.meta.symbolName).filter(Boolean);
      expect(symbols.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect Go func and type', () => {
      const code = [
        'type Config struct {',
        '    Host string',
        '    Port int',
        '}',
        '',
        'func NewConfig() *Config {',
        '    return &Config{Host: "localhost", Port: 8080}',
        '}',
      ].join('\n');

      const chunks = smartChunk(code, '.go');
      const symbols = chunks.map((c) => c.meta.symbolName).filter(Boolean);
      expect(symbols.length).toBeGreaterThanOrEqual(1);
    });

    it('should include line number metadata', () => {
      const code = [
        'const a = 1;',
        '',
        'function foo() {',
        '  return a;',
        '}',
      ].join('\n');

      const chunks = smartChunk(code, '.js');
      for (const c of chunks) {
        expect(c.meta.startLine).toBeGreaterThanOrEqual(1);
        expect(c.meta.endLine).toBeGreaterThanOrEqual(c.meta.startLine);
      }
    });

    it('should split oversized code blocks with fallback', () => {
      // Create a single giant function that exceeds chunk size
      const lines = ['function bigFunc() {'];
      for (let i = 0; i < 200; i++) {
        lines.push(`  const var${i} = ${i}; // padding line to make this big`);
      }
      lines.push('}');

      const chunks = smartChunk(lines.join('\n'), '.js', 500, 50);
      // Should produce multiple chunks since the function is too large
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  // -----------------------------------------------------------------------
  // Prose chunker
  // -----------------------------------------------------------------------
  describe('prose chunker', () => {
    it('should split on markdown headings', () => {
      const md = [
        '# Introduction',
        '',
        'This is the intro section.',
        '',
        '# Methods',
        '',
        'These are the methods.',
        '',
        '# Conclusion',
        '',
        'The conclusion.',
      ].join('\n');

      const chunks = smartChunk(md, '.md');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // Should detect headings
      const headings = chunks.map((c) => c.meta.heading).filter(Boolean);
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect heading text', () => {
      const md = '# My Title\n\nContent here.';
      const chunks = smartChunk(md, '.md');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].meta.heading).toBe('My Title');
    });

    it('should handle multiple heading levels', () => {
      const md = [
        '## Section A',
        'Content A',
        '### Subsection A1',
        'Content A1',
        '## Section B',
        'Content B',
      ].join('\n');

      const chunks = smartChunk(md, '.md');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should set section type for chunks under headings', () => {
      const md = '# Overview\n\nSome content about the overview.';
      const chunks = smartChunk(md, '.md');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].meta.chunkType).toBe('section');
    });

    it('should set paragraph type for chunks without headings', () => {
      const md = 'Just some text without any heading markers.';
      const chunks = smartChunk(md, '.md');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].meta.chunkType).toBe('paragraph');
    });
  });

  // -----------------------------------------------------------------------
  // Fallback chunker
  // -----------------------------------------------------------------------
  describe('fallback chunker', () => {
    it('should produce a single chunk for short text', () => {
      const text = 'Short text.';
      const chunks = smartChunk(text, '.xyz');
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('Short text.');
      expect(chunks[0].meta.chunkType).toBe('fallback');
    });

    it('should split long text into multiple chunks', () => {
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(
          `Line number ${i}: This is some padding text to fill content.`
        );
      }
      const text = lines.join('\n');
      const chunks = smartChunk(text, '.xyz', 500, 50);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should include overlap between chunks', () => {
      const lines: string[] = [];
      for (let i = 0; i < 50; i++) {
        lines.push(`Line ${i}: some content here that fills the chunk.`);
      }
      const text = lines.join('\n');
      const chunks = smartChunk(text, '.xyz', 300, 100);

      if (chunks.length >= 2) {
        // Last lines of chunk 0 should appear at start of chunk 1
        const chunk0Lines = chunks[0].content.split('\n');
        const chunk1Lines = chunks[1].content.split('\n');
        const lastLineOfChunk0 = chunk0Lines[chunk0Lines.length - 1];
        // Check the overlap line exists somewhere in the next chunk
        const found = chunk1Lines.some((l) => l === lastLineOfChunk0);
        expect(found).toBe(true);
      }
    });

    it('should track line numbers', () => {
      const text = 'Line 0\nLine 1\nLine 2\nLine 3\nLine 4';
      const chunks = smartChunk(text, '.xyz');
      expect(chunks[0].meta.startLine).toBeDefined();
      expect(chunks[0].meta.endLine).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Merge and split segments
  // -----------------------------------------------------------------------
  describe('merge and split behavior', () => {
    it('should merge small adjacent code segments', () => {
      // Several tiny declarations that should merge into one chunk
      const code = [
        'const a = 1;',
        '',
        'const b = 2;',
        '',
        'const c = 3;',
      ].join('\n');

      const chunks = smartChunk(code, '.ts', 2000);
      // All are tiny, should merge into 1 chunk
      expect(chunks.length).toBe(1);
    });

    it('should not produce empty chunks', () => {
      const code = '\n\n\nfunction foo() {}\n\n\n';
      const chunks = smartChunk(code, '.ts');
      for (const c of chunks) {
        expect(c.content.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
