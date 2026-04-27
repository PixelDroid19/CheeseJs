import ts from 'typescript';
import { parser as pythonParser } from '@lezer/python';
import type {
  DetectionContext,
  DetectionResult,
  ParserDetectionCandidate,
} from '../types';
import { isExecutableLanguage, toDetectionResult } from '../registry';

interface PythonTreeCursorLike {
  nextSibling(): boolean;
  firstChild(): boolean;
  parent(): boolean;
  type: { isError?: boolean };
}

const PYTHON_SEMANTIC_PATTERNS: Array<[RegExp, number]> = [
  [/\bprint\s*\(/, 40],
  [/\bdef\s+[A-Za-z_]\w*\s*\(/, 60],
  [/\bclass\s+[A-Za-z_]\w*\s*:/, 60],
  [/\bfrom\s+[A-Za-z_][\w.]*\s+import\b/, 50],
  [/\bimport\s+[A-Za-z_][\w.]*/, 35],
  [/\b(True|False|None)\b/, 25],
  [/\b(lambda|yield|async\s+def|await)\b/, 25],
  [/\b(range|len|enumerate|zip|sum|min|max|abs|input|open)\s*\(/, 20],
];

const JAVASCRIPT_SEMANTIC_PATTERNS: Array<[RegExp, number]> = [
  [/\bconsole\s*\./, 40],
  [/\b(let|const|var)\b/, 50],
  [/=>/, 40],
  [/\bfunction\b/, 35],
  [/\b(import|export)\b/, 35],
  [/===|!==|&&|\|\|/, 25],
  [/\b(window|document|process)\b/, 25],
  [/require\s*\(/, 25],
];

const C_SEMANTIC_PATTERNS: Array<[RegExp, number]> = [
  [/^\s*#include\s*<stdio\.h>/m, 80],
  [/\bprintf\s*\(/, 50],
  [/\bscanf\s*\(/, 40],
  [/\btypedef\s+struct\b/, 50],
  [/\bstruct\s+[A-Za-z_]\w*\s*\{/, 40],
  [/\bmalloc\s*\(/, 25],
  [/\bfree\s*\(/, 25],
  [/\bint\s+main\s*\(/, 60],
  [/\b#define\b/, 20],
  [/\bNULL\b/, 10],
];

const CPP_SEMANTIC_PATTERNS: Array<[RegExp, number]> = [
  [/^\s*#include\s*<iostream>/m, 90],
  [/\bstd::/, 70],
  [/\bcout\s*<</, 55],
  [/\bcin\s*>>/, 45],
  [/\bclass\s+[A-Za-z_]\w*\s*\{/, 60],
  [/\btemplate\s*</, 60],
  [/\bnamespace\s+[A-Za-z_]\w*/, 50],
  [/\busing\s+namespace\b/, 40],
  [/\bnew\s+[A-Za-z_]/, 20],
  [/\bdelete\b/, 20],
  [/\bauto\s+[A-Za-z_]\w*\s*=/, 20],
  [/\bint\s+main\s*\(/, 35],
];

function scoreSemanticPatterns(
  content: string,
  patterns: Array<[RegExp, number]>
): number {
  return patterns.reduce(
    (score, [pattern, weight]) =>
      pattern.test(content) ? score + weight : score,
    0
  );
}

function countPythonParseErrors(content: string): number {
  const tree = pythonParser.parse(content);
  let errors = 0;
  const cursor = tree.cursor() as PythonTreeCursorLike;

  const visit = (): void => {
    if (cursor.type.isError) {
      errors += 1;
    }
    if (cursor.firstChild()) {
      do {
        visit();
      } while (cursor.nextSibling());
      cursor.parent();
    }
  };

  visit();
  return errors;
}

function countTypeScriptSpecificSyntax(sourceFile: ts.SourceFile): number {
  let count = 0;

  const visit = (node: ts.Node): void => {
    if (
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isTypeParameterDeclaration(node) ||
      ts.isImportTypeNode(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      count += 2;
    }

    if (
      (ts.isParameter(node) ||
        ts.isVariableDeclaration(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isPropertySignature(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node)) &&
      node.type
    ) {
      count += 1;
    }

    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node)) &&
      node.type
    ) {
      count += 1;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return count;
}

function analyzeTypeScript(content: string): ParserDetectionCandidate {
  const sourceFile = ts.createSourceFile(
    'inline.tsx',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & {
      parseDiagnostics?: readonly ts.DiagnosticWithLocation[];
    }
  ).parseDiagnostics;
  const errors = parseDiagnostics?.length ?? 0;
  const tsSpecificCount = countTypeScriptSpecificSyntax(sourceFile);
  const tsSpecificSyntax = tsSpecificCount > 0;
  const score = Math.max(
    0,
    100 - errors * 20 + (tsSpecificSyntax ? 40 + tsSpecificCount * 5 : 0)
  );

  return {
    monacoId: 'typescript',
    confidence: Math.min(0.99, score / 100),
    score,
    errors,
    executable: isExecutableLanguage('typescript'),
    tsSpecificSyntax,
  };
}

function analyzeJavaScript(content: string): ParserDetectionCandidate {
  const sourceFile = ts.createSourceFile(
    'inline.jsx',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JSX
  );
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & {
      parseDiagnostics?: readonly ts.DiagnosticWithLocation[];
    }
  ).parseDiagnostics;
  const errors = parseDiagnostics?.length ?? 0;
  const semanticScore = scoreSemanticPatterns(
    content,
    JAVASCRIPT_SEMANTIC_PATTERNS
  );
  const score = Math.max(0, 100 - errors * 20 + semanticScore);

  return {
    monacoId: 'javascript',
    confidence: Math.min(0.99, score / 100),
    score,
    errors,
    executable: isExecutableLanguage('javascript'),
  };
}

function analyzePython(content: string): ParserDetectionCandidate {
  const errors = countPythonParseErrors(content);
  const semanticScore = scoreSemanticPatterns(
    content,
    PYTHON_SEMANTIC_PATTERNS
  );
  const score = Math.max(0, 100 - errors * 20 + semanticScore);

  return {
    monacoId: 'python',
    confidence: Math.min(0.99, score / 100),
    score,
    errors,
    executable: isExecutableLanguage('python'),
  };
}

function analyzeC(content: string): ParserDetectionCandidate {
  const score = scoreSemanticPatterns(content, C_SEMANTIC_PATTERNS);
  const errors = score > 0 ? 0 : 3;

  return {
    monacoId: 'c',
    confidence: Math.min(0.99, score / 100),
    score,
    errors,
    executable: isExecutableLanguage('c'),
  };
}

function analyzeCpp(content: string): ParserDetectionCandidate {
  const score = scoreSemanticPatterns(content, CPP_SEMANTIC_PATTERNS);
  const errors = score > 0 ? 0 : 3;

  return {
    monacoId: 'cpp',
    confidence: Math.min(0.99, score / 100),
    score,
    errors,
    executable: isExecutableLanguage('cpp'),
  };
}

function getStickyScriptLanguage(
  context?: DetectionContext
): 'javascript' | 'typescript' | null {
  if (
    context?.currentLanguage === 'javascript' ||
    context?.currentLanguage === 'typescript'
  ) {
    return context.currentLanguage;
  }

  return null;
}

function getStickyNativeLanguage(
  context?: DetectionContext
): 'c' | 'cpp' | null {
  if (context?.currentLanguage === 'c' || context?.currentLanguage === 'cpp') {
    return context.currentLanguage;
  }

  return null;
}

export function detectWithParsers(
  content: string,
  context?: DetectionContext
): DetectionResult | null {
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    const sticky =
      getStickyNativeLanguage(context) ??
      getStickyScriptLanguage(context) ??
      'typescript';
    return toDetectionResult(sticky, 1, 'sticky');
  }

  const python = analyzePython(content);
  const javascript = analyzeJavaScript(content);
  const typescript = analyzeTypeScript(content);
  const c = analyzeC(content);
  const cpp = analyzeCpp(content);

  if (typescript.errors === 0 && typescript.tsSpecificSyntax) {
    return toDetectionResult(
      'typescript',
      Math.max(0.92, typescript.confidence),
      'parser'
    );
  }

  if (
    python.errors === 0 &&
    python.score > javascript.score + 15 &&
    python.score > typescript.score + 15
  ) {
    return toDetectionResult(
      'python',
      Math.max(0.92, python.confidence),
      'parser'
    );
  }

  if (
    cpp.errors === 0 &&
    cpp.score > 0 &&
    cpp.score >= c.score + 10 &&
    cpp.score > python.score + 15 &&
    cpp.score > javascript.score + 15 &&
    cpp.score > typescript.score + 15
  ) {
    return toDetectionResult('cpp', Math.max(0.92, cpp.confidence), 'parser');
  }

  if (
    c.errors === 0 &&
    c.score > 0 &&
    c.score > cpp.score + 10 &&
    c.score > python.score + 15 &&
    c.score > javascript.score + 15 &&
    c.score > typescript.score + 15
  ) {
    return toDetectionResult('c', Math.max(0.92, c.confidence), 'parser');
  }

  if (
    javascript.errors === 0 &&
    javascript.score > python.score + 15 &&
    javascript.score >= typescript.score
  ) {
    return toDetectionResult(
      'javascript',
      Math.max(0.9, javascript.confidence),
      'parser'
    );
  }

  if (python.errors === 0 && javascript.errors > 0 && typescript.errors > 0) {
    return toDetectionResult(
      'python',
      Math.max(0.92, python.confidence),
      'parser'
    );
  }

  if (javascript.errors === 0 && python.errors > 0 && typescript.errors > 0) {
    return toDetectionResult(
      'javascript',
      Math.max(0.92, javascript.confidence),
      'parser'
    );
  }

  if (
    cpp.errors === 0 &&
    cpp.score > 0 &&
    python.errors > 0 &&
    javascript.errors > 0 &&
    typescript.errors > 0
  ) {
    return toDetectionResult('cpp', Math.max(0.92, cpp.confidence), 'parser');
  }

  if (
    c.errors === 0 &&
    c.score > 0 &&
    python.errors > 0 &&
    javascript.errors > 0 &&
    typescript.errors > 0
  ) {
    const sticky = getStickyNativeLanguage(context);
    return toDetectionResult(
      sticky ?? 'c',
      Math.max(0.92, c.confidence),
      sticky ? 'sticky' : 'parser'
    );
  }

  if (javascript.errors === 0 && typescript.errors === 0 && python.errors > 0) {
    const sticky = getStickyScriptLanguage(context);
    return toDetectionResult(
      sticky ?? 'javascript',
      0.7,
      sticky ? 'sticky' : 'parser'
    );
  }

  const candidates = [python, typescript, javascript, cpp, c].sort(
    (a, b) => b.score - a.score
  );
  const winner = candidates[0];
  const runnerUp = candidates[1];

  if (winner && runnerUp && winner.score - runnerUp.score >= 20) {
    return {
      monacoId: winner.monacoId,
      confidence: Math.max(0.6, winner.confidence),
      isExecutable: winner.executable,
      source: 'parser',
    };
  }

  return null;
}
