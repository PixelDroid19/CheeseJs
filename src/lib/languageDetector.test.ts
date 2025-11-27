
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { detectLanguage, initLanguageDetector } from './languageDetector';

// Mock monaco-editor
vi.mock('monaco-editor', () => ({
  languages: {
    getLanguages: () => [
      { id: 'typescript', extensions: ['.ts', '.tsx'], aliases: ['TypeScript', 'ts'] },
      { id: 'javascript', extensions: ['.js', '.jsx'], aliases: ['JavaScript', 'js'] }
    ]
  }
}));

describe('Language Detector', () => {
  beforeAll(() => {
    initLanguageDetector();
  });

  it('detects typescript with generics and spaces', () => {
    const code = `function concat< N extends number[], S extends string[] >(nums: [...N], strs: [...S]): [...N, ...S] { return [...nums, ...strs]; }`;
    const lang = detectLanguage(code);
    expect(lang).toBe('typescript');
  });

  it('detects simple typescript function', () => {
    const code = `function add(a: number, b: number): number { return a + b; }`;
    const lang = detectLanguage(code);
    expect(lang).toBe('typescript');
  });

  it('detects javascript function', () => {
    const code = `function add(a, b) { return a + b; }`;
    const lang = detectLanguage(code);
    expect(lang).toBe('javascript');
  });
});
