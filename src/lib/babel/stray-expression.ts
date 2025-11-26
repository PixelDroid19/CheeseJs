import type { PluginObj } from '@babel/core'
import type * as BabelTypes from '@babel/types'

export default function ({ types: t }: { types: typeof BabelTypes }): PluginObj {
  return {
    visitor: {
      ExpressionStatement (path, state: any) {
        // Only transform top-level expressions (Program body)
        if (!t.isProgram(path.parent)) return

        const { internalLogLevel = 'none' } = state.opts || {}
        const showInternal = internalLogLevel !== 'none'

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

        // Skip setTimeout and setInterval calls (when used as statements)
        if (
          t.isCallExpression(expression) &&
          (
            (t.isIdentifier(expression.callee) && 
             (expression.callee.name === 'setTimeout' || expression.callee.name === 'setInterval')) ||
            (t.isMemberExpression(expression.callee) && 
             t.isIdentifier(expression.callee.property) &&
             (expression.callee.property.name === 'setTimeout' || expression.callee.property.name === 'setInterval'))
          )
        ) {
          return
        }

        // Skip assignment expressions (e.g. x = 10 or window.x = {})
        // UNLESS internal logs are enabled
        if (!showInternal && t.isAssignmentExpression(expression)) {
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

        // Check if expression is a promise chain with console methods
        const isPromiseChainWithConsole =
          t.isCallExpression(expression) &&
          t.isMemberExpression(expression.callee) &&
          t.isIdentifier(expression.callee.property) &&
          (expression.callee.property.name === 'then' ||
           expression.callee.property.name === 'catch' ||
           expression.callee.property.name === 'finally') &&
          expression.arguments.some(arg =>
            t.isMemberExpression(arg) &&
            t.isIdentifier((arg as BabelTypes.MemberExpression).object, { name: 'console' })
          )

        // Check if expression is a promise chain (has .then, .catch, .finally)
        const isPromiseChain =
          t.isCallExpression(expression) &&
          t.isMemberExpression(expression.callee) &&
          t.isIdentifier(expression.callee.property) &&
          (expression.callee.property.name === 'then' ||
           expression.callee.property.name === 'catch' ||
           expression.callee.property.name === 'finally')

        // Check if expression might be a Promise (async call, fetch(), etc.)
        const mightBePromise =
          t.isAwaitExpression(expression) ||
          isPromiseChain ||
          (t.isCallExpression(expression) &&
            (t.isIdentifier(expression.callee) &&
             (expression.callee.name === 'fetch'))) ||
          (t.isCallExpression(expression) &&
           t.isMemberExpression(expression.callee) &&
           t.isIdentifier(expression.callee.object) &&
           expression.callee.object.name === 'Promise')

        let expressionToLog = expression

        if (isPromiseChainWithConsole) {
          // Find the root of the promise chain (before the first .then/.catch/.finally)
          let root: BabelTypes.Expression = expression
          while (
            t.isCallExpression(root) &&
            t.isMemberExpression(root.callee) &&
            t.isIdentifier(root.callee.property) &&
            (root.callee.property.name === 'then' ||
             root.callee.property.name === 'catch' ||
             root.callee.property.name === 'finally')
          ) {
            root = root.callee.object as BabelTypes.Expression
          }

          // Instead of awaiting the chain that ends with console.log (returns undefined),
          // await the root promise directly to show the actual resolved value
          expressionToLog = t.awaitExpression(root)
        } else if (mightBePromise) {
          expressionToLog = t.awaitExpression(expression)
        }

        // Replace: expr -> debug(line, await expr) or debug(line, expr)
        path.replaceWith(
          t.expressionStatement(
            t.callExpression(t.identifier('debug'), [
              t.numericLiteral(line),
              expressionToLog
            ])
          )
        )

        path.skip() // Don't process the new node
      },
      VariableDeclaration (path, state: any) {
        const { internalLogLevel = 'none' } = state.opts || {}
        if (internalLogLevel === 'none') return

        if (!t.isProgram(path.parent)) return
        if (path.node.declarations.length === 0) return

        const debugCalls: BabelTypes.ExpressionStatement[] = []

        path.node.declarations.forEach((decl) => {
          if (!decl.init) return
          if (!t.isIdentifier(decl.id)) return

          const name = decl.id.name
          const line = decl.loc?.start.line
          if (!line) return

          debugCalls.push(
            t.expressionStatement(
              t.callExpression(t.identifier('debug'), [
                t.numericLiteral(line),
                t.identifier(name)
              ])
            )
          )
        })

        if (debugCalls.length > 0) {
          path.insertAfter(debugCalls)
        }
      }
    }
  }
}
