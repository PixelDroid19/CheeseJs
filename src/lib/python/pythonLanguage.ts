/**
 * Python Language Registration for Monaco Editor
 *
 * Registers Python as a first-class language with:
 * - Syntax highlighting via Monarch tokenizer
 * - Language configuration (comments, brackets, etc.)
 * - Basic completion provider
 */

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// ============================================================================
// PYTHON MONARCH TOKENIZER
// ============================================================================

const pythonLanguage: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.python',

  keywords: [
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'class',
    'continue',
    'def',
    'del',
    'elif',
    'else',
    'except',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield',
    'True',
    'False',
    'None',
  ],

  builtins: [
    'abs',
    'all',
    'any',
    'ascii',
    'bin',
    'bool',
    'bytearray',
    'bytes',
    'callable',
    'chr',
    'classmethod',
    'compile',
    'complex',
    'delattr',
    'dict',
    'dir',
    'divmod',
    'enumerate',
    'eval',
    'exec',
    'filter',
    'float',
    'format',
    'frozenset',
    'getattr',
    'globals',
    'hasattr',
    'hash',
    'help',
    'hex',
    'id',
    'input',
    'int',
    'isinstance',
    'issubclass',
    'iter',
    'len',
    'list',
    'locals',
    'map',
    'max',
    'memoryview',
    'min',
    'next',
    'object',
    'oct',
    'open',
    'ord',
    'pow',
    'print',
    'property',
    'range',
    'repr',
    'reversed',
    'round',
    'set',
    'setattr',
    'slice',
    'sorted',
    'staticmethod',
    'str',
    'sum',
    'super',
    'tuple',
    'type',
    'vars',
    'zip',
    '__import__',
  ],

  brackets: [
    { open: '{', close: '}', token: 'delimiter.curly' },
    { open: '[', close: ']', token: 'delimiter.bracket' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
  ],

  tokenizer: {
    root: [
      // Whitespace
      { include: '@whitespace' },

      // Decorators
      [/@\w+/, 'tag'],

      // Numbers
      [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/0[bB][01]+/, 'number.binary'],
      [/0[oO][0-7]+/, 'number.octal'],
      [/\d+/, 'number'],

      // Strings
      [/[fFrRbBuU]?"""/, 'string', '@string_triple_double'],
      [/[fFrRbBuU]?'''/, 'string', '@string_triple_single'],
      [/[fFrRbBuU]?"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated
      [/[fFrRbBuU]?'([^'\\]|\\.)*$/, 'string.invalid'], // non-terminated
      [/[fFrRbBuU]?"/, 'string', '@string_double'],
      [/[fFrRbBuU]?'/, 'string', '@string_single'],

      // Delimiters and operators
      [/[{}()[\]]/, '@brackets'],
      [/@symbols/, 'operator'],
      [/[,;]/, 'delimiter'],

      // Identifiers and keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'predefined',
            '@default': 'identifier',
          },
        },
      ],
    ],

    string_double: [
      [/\{[^}]*\}/, 'string.interpolation'],
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],

    string_single: [
      [/\{[^}]*\}/, 'string.interpolation'],
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],

    string_triple_double: [
      [/\{[^}]*\}/, 'string.interpolation'],
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"""/, 'string', '@pop'],
      [/"/, 'string'],
    ],

    string_triple_single: [
      [/\{[^}]*\}/, 'string.interpolation'],
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'''/, 'string', '@pop'],
      [/'/, 'string'],
    ],

    whitespace: [
      [/\s+/, 'white'],
      [/#\?.*$/, 'comment.magic'], // Magic comment for debug
      [/#.*$/, 'comment'],
    ],
  },

  symbols: /[=><!~?:&|+\-*/^%]+/,
};

// ============================================================================
// PYTHON LANGUAGE CONFIGURATION
// ============================================================================

const pythonLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '#',
    blockComment: ['"""', '"""'],
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
    { open: '"""', close: '"""' },
    { open: "'''", close: "'''" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  onEnterRules: [
    {
      beforeText: /:\s*$/,
      action: { indentAction: monaco.languages.IndentAction.Indent },
    },
  ],
  folding: {
    offSide: true,
    markers: {
      start: /^\s*#region\b/,
      end: /^\s*#endregion\b/,
    },
  },
  indentationRules: {
    increaseIndentPattern: /^.*:\s*$/,
    decreaseIndentPattern: /^\s*(elif|else|except|finally)\b.*:\s*$/,
  },
};

// ============================================================================
// PYTHON COMPLETION PROVIDER
// ============================================================================

const pythonCompletionProvider: monaco.languages.CompletionItemProvider = {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    const suggestions: monaco.languages.CompletionItem[] = [
      // Keywords
      ...[
        'def',
        'class',
        'if',
        'elif',
        'else',
        'for',
        'while',
        'try',
        'except',
        'finally',
        'with',
        'import',
        'from',
        'return',
        'yield',
        'raise',
        'break',
        'continue',
        'pass',
        'lambda',
        'async',
        'await',
      ].map((kw) => ({
        label: kw,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: kw,
        range,
      })),
      // Builtins
      ...[
        'print',
        'len',
        'range',
        'str',
        'int',
        'float',
        'list',
        'dict',
        'tuple',
        'set',
        'bool',
        'type',
        'isinstance',
        'enumerate',
        'zip',
        'map',
        'filter',
        'sorted',
        'reversed',
        'sum',
        'min',
        'max',
        'abs',
        'input',
        'open',
        'format',
      ].map((fn) => ({
        label: fn,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: fn,
        detail: 'Built-in function',
        range,
      })),
      // Common snippets
      {
        label: 'def',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'def ${1:function_name}(${2:args}):\n\t${3:pass}',
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'Function definition',
        range,
      },
      {
        label: 'class',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          'class ${1:ClassName}:\n\tdef __init__(self${2:, args}):\n\t\t${3:pass}',
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'Class definition',
        range,
      },
      {
        label: 'for',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'for ${1:item} in ${2:items}:\n\t${3:pass}',
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'For loop',
        range,
      },
      {
        label: 'if',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'if ${1:condition}:\n\t${2:pass}',
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'If statement',
        range,
      },
      {
        label: 'try',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}',
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'Try/except block',
        range,
      },
      {
        label: 'with',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'with ${1:expression} as ${2:variable}:\n\t${3:pass}',
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'With statement',
        range,
      },
      {
        label: 'print',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'print(${1:})',
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'Print statement',
        range,
      },
      {
        label: 'fstring',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'f"${1:}"',
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'f-string',
        range,
      },
      // CheeseJS specific - debug
      {
        label: '#?',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: ' #?',
        detail: 'Magic debug comment - shows value inline',
        range,
      },
    ];

    return { suggestions };
  },
};

// ============================================================================
// REGISTRATION
// ============================================================================

let isRegistered = false;

export function registerPythonLanguage(monacoInstance: typeof monaco): void {
  if (isRegistered) return;

  // Check if Python is already registered
  const languages = monacoInstance.languages.getLanguages();
  const pythonExists = languages.some((l) => l.id === 'python');

  if (!pythonExists) {
    // Register the language
    monacoInstance.languages.register({
      id: 'python',
      extensions: ['.py', '.pyw', '.pyi'],
      aliases: ['Python', 'python', 'py'],
      mimetypes: ['text/x-python', 'application/x-python'],
    });
  }

  // Set the Monarch tokenizer
  monacoInstance.languages.setMonarchTokensProvider('python', pythonLanguage);

  // Set language configuration
  monacoInstance.languages.setLanguageConfiguration(
    'python',
    pythonLanguageConfig
  );

  // Register completion provider
  monacoInstance.languages.registerCompletionItemProvider(
    'python',
    pythonCompletionProvider
  );

  isRegistered = true;
  console.log('[Python] Language registered in Monaco');
}

export function isPythonRegistered(): boolean {
  return isRegistered;
}
