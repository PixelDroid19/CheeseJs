import { Monaco } from '@monaco-editor/react';
import { languages } from 'monaco-editor';
import { themes } from '../themes';
import { editor } from 'monaco-editor';

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
        start: /^\s*\/\/#region\b/,
        end: /^\s*\/\/#endregion\b/,
      },
    },
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=[{\]}\\|;:'",.<>/?\s]+)/g,
    indentationRules: {
      increaseIndentPattern:
        /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
      decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[}\])].*$/,
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

  const ts = monaco.languages.typescript;
  if (!ts) return;

  // Compiler options for both JS and TS
  const compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    module: ts.ModuleKind.ESNext,
    allowJs: true,
    checkJs: true,
    noEmit: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.React,
    reactNamespace: 'React',
    allowSyntheticDefaultImports: true,
    // Disable unused warnings as per user request
    noUnusedLocals: false,
    noUnusedParameters: false,
  };

  ts.javascriptDefaults.setCompilerOptions(compilerOptions);
  ts.typescriptDefaults.setCompilerOptions(compilerOptions);

  // Eager sync for better performance in small files
  ts.javascriptDefaults.setEagerModelSync(true);
  ts.typescriptDefaults.setEagerModelSync(true);

  // Diagnostics options
  const diagnosticsOptions = {
    noSemanticValidation: false,
    noSyntaxValidation: false,
  };
  ts.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
  ts.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);

  // Add Node.js globals (require, module, exports, etc.) to avoid TypeScript errors
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
  ts.javascriptDefaults.addExtraLib(nodeGlobalsLib, 'ts:node-globals.d.ts');
  ts.typescriptDefaults.addExtraLib(nodeGlobalsLib, 'ts:node-globals.d.ts');
};
