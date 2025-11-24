import type { TraverseOptions, Node } from '@babel/traverse'

export default function ({ types: t }: { types: any }): { visitor: TraverseOptions<Node> } {
  return {
    visitor: {
      Program (path) {
        path.traverse({
          ThisExpression (innerPath) {
            // Find the closest parent function
            const parentFn = innerPath.getFunctionParent()

            // If there is no parent function, we are at the top level
            if (!parentFn) {
              const id = t.identifier('globalThis')
              id.loc = innerPath.node.loc
              innerPath.replaceWith(id)
              return
            }

            // If we are inside an arrow function, 'this' is lexical.
            let current = parentFn
            while (current && current.isArrowFunctionExpression()) {
              current = current.parentPath.getFunctionParent()
            }

            // If we exhausted the chain of arrow functions and found no function parent,
            // it means the original 'this' refers to the top-level scope.
            if (!current) {
              const id = t.identifier('globalThis')
              id.loc = innerPath.node.loc
              innerPath.replaceWith(id)
            }
          }
        })
      }
    }
  }
}
