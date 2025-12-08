import { transform } from '@babel/standalone';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

// Fallback function using regex when Babel fails
function extractImportsWithRegex(code: string): string[] {
  const imports: Set<string> = new Set();

  // Match ES6 imports: import ... from "package" or import "package"
  const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.add(match[1]);
  }

  // Match require(): require("package")
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(code)) !== null) {
    imports.add(match[1]);
  }

  // Filter out relative imports
  return Array.from(imports).filter(
    (pkg) => !pkg.startsWith('.') && !pkg.startsWith('/')
  );
}

export function getImports(code: string): string[] {
  const imports: Set<string> = new Set();

  try {
    transform(code, {
      filename: 'file.tsx', // Required for TypeScript preset
      presets: ['typescript'],
      plugins: [
        {
          visitor: {
            ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
              imports.add(path.node.source.value);
            },
            CallExpression(path: NodePath<t.CallExpression>) {
              if (
                path.node.callee.type === 'Identifier' &&
                path.node.callee.name === 'require' &&
                path.node.arguments.length > 0 &&
                path.node.arguments[0].type === 'StringLiteral'
              ) {
                imports.add(path.node.arguments[0].value);
              }
            },
          },
        },
      ],
    });
  } catch (_e) {
    console.warn('📦 [getImports] Babel parse error, using regex fallback');
    return extractImportsWithRegex(code);
  }

  // Filter out relative imports
  return Array.from(imports).filter(
    (pkg) => !pkg.startsWith('.') && !pkg.startsWith('/')
  );
}
