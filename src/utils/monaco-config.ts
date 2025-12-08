import type { Monaco } from '@monaco-editor/react';
import type { editor, languages } from 'monaco-editor';
import { themes } from '../themes';

// TypeScript compiler options numeric values (to avoid deprecated type issues)
// These values are from the TypeScript compiler API
const ScriptTarget = {
  ESNext: 99,
};

const ModuleResolutionKind = {
  NodeJs: 2,
};

const ModuleKind = {
  ESNext: 99,
};

const JsxEmit = {
  React: 2,
};

// Interface for the TypeScript language defaults
interface LanguageServiceDefaults {
  setCompilerOptions(options: Record<string, unknown>): void;
  setDiagnosticsOptions(options: { noSemanticValidation?: boolean; noSyntaxValidation?: boolean }): void;
  setEagerModelSync(value: boolean): void;
  addExtraLib(content: string, filePath?: string): void;
}

interface TypeScriptLanguages {
  javascriptDefaults?: LanguageServiceDefaults;
  typescriptDefaults?: LanguageServiceDefaults;
}

export const configureMonaco = (monaco: Monaco) => {
  // Register all themes
  Object.entries(themes).forEach(([name, themeData]) => {
    monaco.editor.defineTheme(name, themeData as editor.IStandaloneThemeData);
  });

  // Shared language configuration
  const languageConfig: languages.LanguageConfiguration = {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
      { open: '`', close: '`', notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
    ],
    folding: {
      markers: {
        start: new RegExp('^\\s*//#region\\b'),
        end: new RegExp('^\\s*//#endregion\\b'),
      },
    },
    indentationRules: {
      increaseIndentPattern: new RegExp('^((?!//).)*({[^}"\'`]*|\\([^)"\'`]*|\\[[^\\]"\'`]*)$'),
      decreaseIndentPattern: new RegExp('^((?!.*?/\\*).*\\*/)?\\s*[}\\])].*$'),
    },
  };

  // Configure language features for JavaScript
  monaco.languages.setLanguageConfiguration('javascript', languageConfig);

  // Configure language features for TypeScript
  monaco.languages.setLanguageConfiguration('typescript', {
    ...languageConfig,
    brackets: [...(languageConfig.brackets || []), ['<', '>']],
    autoClosingPairs: [
      ...(languageConfig.autoClosingPairs || []),
      { open: '<', close: '>', notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      ...(languageConfig.surroundingPairs || []),
      { open: '<', close: '>' },
    ],
  });

  // Access typescript namespace through proper casting
  const ts = (monaco.languages as unknown as { typescript: TypeScriptLanguages }).typescript;
  if (!ts) return;

  // Compiler options using numeric values directly
  const compilerOptions = {
    target: ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: ModuleResolutionKind.NodeJs,
    module: ModuleKind.ESNext,
    allowJs: true,
    checkJs: true,
    noEmit: true,
    esModuleInterop: true,
    jsx: JsxEmit.React,
    reactNamespace: 'React',
    allowSyntheticDefaultImports: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
  };

  ts.javascriptDefaults?.setCompilerOptions(compilerOptions);
  ts.typescriptDefaults?.setCompilerOptions(compilerOptions);

  ts.javascriptDefaults?.setEagerModelSync(true);
  ts.typescriptDefaults?.setEagerModelSync(true);

  const diagnosticsOptions = {
    noSemanticValidation: false,
    noSyntaxValidation: false,
  };
  ts.javascriptDefaults?.setDiagnosticsOptions(diagnosticsOptions);
  ts.typescriptDefaults?.setDiagnosticsOptions(diagnosticsOptions);

  const nodeGlobalsLib = `
    declare function require(module: string): any;
    declare var module: { exports: any };
    declare var exports: any;
    declare var __dirname: string;
    declare var __filename: string;
    declare var process: {
      env: Record<string, string | undefined>;
      argv: string[];
      cwd(): string;
      exit(code?: number): never;
      platform: string;
      version: string;
    };
    declare var global: typeof globalThis;
    declare var Buffer: {
      from(data: string | ArrayBuffer | number[], encoding?: string): Buffer;
      alloc(size: number): Buffer;
      isBuffer(obj: any): boolean;
    };
    interface Buffer extends Uint8Array {
      toString(encoding?: string): string;
    }
    declare var console: {
      log(...args: any[]): void;
      error(...args: any[]): void;
      warn(...args: any[]): void;
      info(...args: any[]): void;
      debug(...args: any[]): void;
      table(data: any): void;
      time(label?: string): void;
      timeEnd(label?: string): void;
      clear(): void;
    };
  `;
  ts.javascriptDefaults?.addExtraLib(nodeGlobalsLib, 'ts:node-globals.d.ts');
  ts.typescriptDefaults?.addExtraLib(nodeGlobalsLib, 'ts:node-globals.d.ts');
};
