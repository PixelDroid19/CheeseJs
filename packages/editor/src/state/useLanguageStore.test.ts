import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';
import {
  clearDetectionCache,
  createLanguageSlice,
  type LanguageState,
} from './useLanguageStore';

function createLanguageStore() {
  return create<LanguageState>()(createLanguageSlice);
}

describe('createLanguageSlice synchronous detection', () => {
  beforeEach(() => {
    clearDetectionCache();
  });

  it('uses lightweight patterns for immediate JavaScript and TypeScript feedback', () => {
    const useStore = createLanguageStore();

    expect(
      useStore.getState().detectLanguage('console.log("ready")')
    ).toMatchObject({
      monacoId: 'javascript',
      isExecutable: true,
      source: 'parser',
    });

    expect(
      useStore.getState().detectLanguage('interface User { name: string }')
    ).toMatchObject({
      monacoId: 'typescript',
      isExecutable: true,
      source: 'parser',
    });
  });

  it('detects Python, C, and C++ without enabling inactive native runtimes', () => {
    const useStore = createLanguageStore();

    expect(useStore.getState().detectLanguage('print("hola")')).toMatchObject({
      monacoId: 'python',
      isExecutable: true,
      source: 'parser',
    });

    expect(
      useStore
        .getState()
        .detectLanguage('#include <stdio.h>\nint main(){ printf("hi"); }')
    ).toMatchObject({
      monacoId: 'c',
      isExecutable: false,
      source: 'parser',
    });

    expect(
      useStore
        .getState()
        .detectLanguage('#include <iostream>\nint main(){ std::cout << "hi"; }')
    ).toMatchObject({
      monacoId: 'cpp',
      isExecutable: false,
      source: 'parser',
    });
  });

  it('keeps empty input sticky to the current language', () => {
    const useStore = createLanguageStore();

    useStore.getState().setLanguage('python');

    expect(useStore.getState().detectLanguage('   ')).toMatchObject({
      monacoId: 'python',
      confidence: 0.5,
      source: 'sticky',
    });
  });
});
