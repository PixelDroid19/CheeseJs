import type { PluginObj } from '@babel/core'
import type * as BabelTypes from '@babel/types'

export default function ({ types: t }: { types: typeof BabelTypes }): PluginObj {
  return {
    visitor: {
      CallExpression (path) {
        const callee = path.node.callee

        // Check if it's a console method call: console.log(...)
        if (!t.isMemberExpression(callee)) return
        if (!t.isIdentifier(callee.object) || callee.object.name !== 'console') { return }
        if (!t.isIdentifier(callee.property)) return

        // We transform all console methods (log, warn, error, info, table, etc.)
        // to debug() so they show up with line numbers in the result view.

        if (!path.node.loc) return

        const line = path.node.loc.start.line

        // Replace with debug(line, ...args)
        path.replaceWith(
          t.callExpression(t.identifier('debug'), [
            t.numericLiteral(line),
            ...path.node.arguments
          ])
        )
      }
    }
  }
}
