import type { LspLanguageConfig } from '@cheesejs/core';
import type {
  DetectionResult,
  ExecutionLanguageId,
  LanguageDescriptor,
  LanguageId,
  RuntimeProviderId,
} from './types';

const NPX =
  typeof process !== 'undefined' && process.platform === 'win32'
    ? 'npx.cmd'
    : 'npx';

const CLANGD = 'clangd';

export const LANGUAGE_DESCRIPTORS: Record<LanguageId, LanguageDescriptor> = {
  javascript: {
    id: 'javascript',
    monacoId: 'javascript',
    displayName: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs'],
    executable: true,
    executionLanguage: 'javascript',
    runtimeProvider: 'node-vm',
    packageEcosystem: 'npm',
    lsp: {
      name: 'JavaScript/TypeScript (tsls)',
      command: NPX,
      args: ['typescript-language-server', '--stdio'],
      fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
      enabled: true,
      initializationOptions: {
        preferences: {
          includeCompletionsForModuleExports: true,
          includeCompletionsWithInsertText: true,
        },
      },
    },
  },
  typescript: {
    id: 'typescript',
    monacoId: 'typescript',
    displayName: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    executable: true,
    executionLanguage: 'typescript',
    runtimeProvider: 'node-vm',
    packageEcosystem: 'npm',
    lsp: {
      name: 'TypeScript (tsls)',
      command: NPX,
      args: ['typescript-language-server', '--stdio'],
      fileExtensions: ['.ts', '.tsx'],
      enabled: true,
      initializationOptions: {
        preferences: {
          includeCompletionsForModuleExports: true,
          includeCompletionsWithInsertText: true,
        },
      },
    },
  },
  python: {
    id: 'python',
    monacoId: 'python',
    displayName: 'Python',
    extensions: ['.py', '.pyw'],
    executable: true,
    executionLanguage: 'python',
    runtimeProvider: 'pyodide',
    packageEcosystem: 'pypi',
    lsp: {
      name: 'Python (Pyright)',
      command: NPX,
      args: ['pyright-langserver', '--stdio'],
      fileExtensions: ['.py'],
      enabled: true,
    },
  },
  c: {
    id: 'c',
    monacoId: 'c',
    displayName: 'C',
    extensions: ['.c', '.h'],
    executable: true,
    executionLanguage: 'c',
    runtimeProvider: 'wasi-clang',
    lsp: {
      name: 'C/C++ (clangd)',
      command: CLANGD,
      args: [],
      fileExtensions: ['.c', '.h'],
      enabled: true,
    },
  },
  cpp: {
    id: 'cpp',
    monacoId: 'cpp',
    displayName: 'C++',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.ipp'],
    executable: true,
    executionLanguage: 'cpp',
    runtimeProvider: 'wasi-clang',
    lsp: {
      name: 'C/C++ (clangd)',
      command: CLANGD,
      args: [],
      fileExtensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.ipp'],
      enabled: true,
    },
  },
  html: {
    id: 'html',
    monacoId: 'html',
    displayName: 'HTML',
    extensions: ['.html', '.htm'],
    executable: false,
  },
  css: {
    id: 'css',
    monacoId: 'css',
    displayName: 'CSS',
    extensions: ['.css'],
    executable: false,
  },
  json: {
    id: 'json',
    monacoId: 'json',
    displayName: 'JSON',
    extensions: ['.json'],
    executable: false,
  },
  markdown: {
    id: 'markdown',
    monacoId: 'markdown',
    displayName: 'Markdown',
    extensions: ['.md', '.markdown'],
    executable: false,
  },
};

export const DETECTION_TO_MONACO: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  php: 'php',
  swift: 'swift',
  sh: 'shell',
  ps1: 'powershell',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  sql: 'sql',
  yaml: 'yaml',
  xml: 'xml',
};

export function getLanguageDescriptor(languageId: string) {
  return LANGUAGE_DESCRIPTORS[languageId];
}

export function getLanguageInfo(languageId: string) {
  return LANGUAGE_DESCRIPTORS[languageId];
}

export function getLanguageDisplayName(languageId: string): string {
  return LANGUAGE_DESCRIPTORS[languageId]?.displayName ?? languageId;
}

export function isExecutableLanguage(languageId: string): boolean {
  return LANGUAGE_DESCRIPTORS[languageId]?.executable ?? false;
}

export function getRuntimeProviderId(
  languageId: string
): RuntimeProviderId | undefined {
  return LANGUAGE_DESCRIPTORS[languageId]?.runtimeProvider;
}

export function getExecutionLanguage(
  languageId: string
): ExecutionLanguageId | undefined {
  return LANGUAGE_DESCRIPTORS[languageId]?.executionLanguage;
}

export function getDefaultLspConfig(): {
  languages: Record<string, LspLanguageConfig>;
} {
  return {
    languages: Object.fromEntries(
      Object.entries(LANGUAGE_DESCRIPTORS)
        .filter(([, descriptor]) => descriptor.lsp)
        .map(([languageId, descriptor]) => [languageId, descriptor.lsp!])
    ),
  };
}

export function toDetectionResult(
  languageId: string,
  confidence: number,
  source: DetectionResult['source']
): DetectionResult {
  return {
    monacoId: languageId,
    confidence,
    isExecutable: isExecutableLanguage(languageId),
    source,
  };
}
