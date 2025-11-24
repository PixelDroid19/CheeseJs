import type { PluginObj } from '@babel/core'
import type * as BabelTypes from '@babel/types'

export default function ({ types: t }: { types: typeof BabelTypes }): PluginObj {
  return {
    visitor: {
      ExpressionStatement (path) {
        // Only transform top-level expressions (Program body)
        if (!t.isProgram(path.parent)) return

        const expression = path.node.expression

        // Skip 'use strict' and other directives
        if (
          t.isStringLiteral(expression) &&
          (expression.value === 'use strict' ||
            expression.value.startsWith('use '))
        ) { return }

        // Skip console method calls
        if (
          t.isCallExpression(expression) &&
          t.isMemberExpression(expression.callee) &&
          t.isIdentifier(expression.callee.object, { name: 'console' })
        ) {
          return
        }

        // Skip if it's already a debug call (safety check)
        if (
          t.isCallExpression(expression) &&
          t.isIdentifier(expression.callee) &&
          expression.callee.name === 'debug'
        ) { return }

        // Handle 'this' expression specifically if it was transformed to 'globalThis'
        // or if it is a raw 'this' expression
        if (
          t.isThisExpression(expression) ||
          (t.isIdentifier(expression) && expression.name === 'globalThis')
        ) {
          let line = expression.loc?.start.line
          if (!line && path.node.loc) {
            line = path.node.loc.start.line
          }

          if (!line) return

          path.replaceWith(
            t.expressionStatement(
              t.callExpression(t.identifier('debug'), [
                t.numericLiteral(line),
                expression
              ])
            )
          )
          path.skip()
          return
        }

        // Skip console logs if they are at the top level (handled by log-babel or runtime)
        // But actually, we might want to capture the return value of console.log (which is undefined)
        // RunJS usually prints 'undefined' for console.log statements if they are expressions.

        if (!expression.loc) return

        const line = expression.loc.start.line

        // Replace: expr -> debug(line, expr)
        path.replaceWith(
          t.expressionStatement(
            t.callExpression(t.identifier('debug'), [
              t.numericLiteral(line),
              expression
            ])
          )
        )

        path.skip() // Don't process the new node
      },

      VariableDeclaration (path) {
        // Only transform top-level declarations
        if (!t.isProgram(path.parent)) return

        const declarations = path.node.declarations
        // We only care about the last declaration in a statement (e.g. let a=1, b=2; -> we log b)
        // Or maybe we should log all of them? RunJS usually logs the last one if on the same line.

        declarations.forEach((decl) => {
          if (!decl.id || !decl.loc) return

          // Only handle simple identifiers (const x = 1)
          if (t.isIdentifier(decl.id)) {
            const line = decl.loc.start.line
            const name = decl.id.name

            // Insert debug(line, x) AFTER the declaration
            path.insertAfter(
              t.expressionStatement(
                t.callExpression(t.identifier('debug'), [
                  t.numericLiteral(line),
                  t.identifier(name)
                ])
              )
            )
          }
        })
      }
    }
  }
}
