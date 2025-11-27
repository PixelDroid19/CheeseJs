import { transform } from '@babel/standalone'
import type { NodePath } from '@babel/traverse'
import type * as t from '@babel/types'

export function getImports (code: string): string[] {
  const imports: Set<string> = new Set()

  try {
    transform(code, {
      presets: ['typescript'],
      plugins: [
        {
          visitor: {
            ImportDeclaration (path: NodePath<t.ImportDeclaration>) {
              imports.add(path.node.source.value)
            },
            CallExpression (path: NodePath<t.CallExpression>) {
              if (
                path.node.callee.type === 'Identifier' &&
                path.node.callee.name === 'require' &&
                path.node.arguments.length > 0 &&
                path.node.arguments[0].type === 'StringLiteral'
              ) {
                imports.add(path.node.arguments[0].value)
              }
            }
          }
        }
      ]
    })
  } catch {
    // ignore parse errors
  }

  // Filter out relative imports and built-in modules (simple check)
  // We can't easily know all built-ins, but we can filter '.' and '/'
  // Also 'util' is built-in, but npm install util works too (polyfill).
  // Let's just filter relative paths for now.
  return Array.from(imports).filter(
    (pkg) => !pkg.startsWith('.') && !pkg.startsWith('/')
  )
}
