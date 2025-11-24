import type { TraverseOptions, Node } from '@babel/traverse'

export default function ({ types: t }: { types: any }): { visitor: TraverseOptions<Node> } {
  const MAX_ITERATIONS = 10000

  return {
    visitor: {
      'WhileStatement|DoWhileStatement|ForStatement' (path) {
        // Create a unique identifier for the loop counter
        const counterId = path.scope.generateUidIdentifier('loopCounter')

        // Create the counter declaration: let _loopCounter = 0;
        const counterDeclaration = t.variableDeclaration('let', [
          t.variableDeclarator(counterId, t.numericLiteral(0))
        ])

        // Insert the declaration before the loop
        path.insertBefore(counterDeclaration)

        // Create the check: if (_loopCounter++ > 10000) throw new Error("Loop limit exceeded");
        const checkStatement = t.ifStatement(
          t.binaryExpression(
            '>',
            t.updateExpression('++', counterId, false),
            t.numericLiteral(MAX_ITERATIONS)
          ),
          t.throwStatement(t.newExpression(t.identifier('Error'), [t.stringLiteral('Loop limit exceeded')]))
        )

        // Insert the check inside the loop body
        const body = path.get('body')
        if (body.isBlockStatement()) {
          body.unshiftContainer('body', checkStatement)
        } else {
          // If the body is a single statement, wrap it in a block
          path.node.body = t.blockStatement([checkStatement, path.node.body])
        }
      }
    }
  }
}
