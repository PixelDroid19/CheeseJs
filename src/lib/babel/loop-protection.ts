import type { NodePath, PluginObj } from '@babel/core';
import type * as BabelTypes from '@babel/types';

/**
 * Loop Protection Plugin
 *
 * Injects protection against infinite loops and adds cancellation checkpoints.
 * Features:
 * - Maximum iteration limit (default: 10000)
 * - Cancellation checkpoint every N iterations for cooperative cancellation
 * - Works with while, do-while, and for loops
 */
export default function ({
  types: t,
}: {
  types: typeof BabelTypes;
}): PluginObj {
  const MAX_ITERATIONS = 10000;
  const CANCELLATION_CHECK_INTERVAL = 100; // Check for cancellation every 100 iterations

  return {
    visitor: {
      'WhileStatement|DoWhileStatement|ForStatement|ForInStatement|ForOfStatement'(
        path
      ) {
        // Create a unique identifier for the loop counter
        const counterId = path.scope.generateUidIdentifier('loopCounter');

        // Create the counter declaration: let _loopCounter = 0;
        const counterDeclaration = t.variableDeclaration('let', [
          t.variableDeclarator(counterId, t.numericLiteral(0)),
        ]);

        // Insert the declaration before the loop
        path.insertBefore(counterDeclaration);

        // Create the combined check for both loop limit and cancellation:
        // if (++_loopCounter > MAX_ITERATIONS) throw new Error("Loop limit exceeded");
        // if (_loopCounter % CHECK_INTERVAL === 0 && typeof __checkCancellation__ !== 'undefined' && __checkCancellation__()) {
        //   throw new Error("Execution cancelled");
        // }

        // Loop limit check
        const loopLimitCheck = t.ifStatement(
          t.binaryExpression(
            '>',
            t.updateExpression('++', t.cloneNode(counterId), false),
            t.numericLiteral(MAX_ITERATIONS)
          ),
          t.throwStatement(
            t.newExpression(t.identifier('Error'), [
              t.stringLiteral('Loop limit exceeded'),
            ])
          )
        );

        // Cancellation checkpoint check (cooperative cancellation)
        // Only check every N iterations for performance
        const cancellationCheck = t.ifStatement(
          t.logicalExpression(
            '&&',
            t.logicalExpression(
              '&&',
              t.binaryExpression(
                '===',
                t.binaryExpression(
                  '%',
                  t.cloneNode(counterId),
                  t.numericLiteral(CANCELLATION_CHECK_INTERVAL)
                ),
                t.numericLiteral(0)
              ),
              t.binaryExpression(
                '!==',
                t.unaryExpression(
                  'typeof',
                  t.identifier('__checkCancellation__')
                ),
                t.stringLiteral('undefined')
              )
            ),
            t.callExpression(t.identifier('__checkCancellation__'), [])
          ),
          t.throwStatement(
            t.newExpression(t.identifier('Error'), [
              t.stringLiteral('Execution cancelled'),
            ])
          )
        );

        // Insert both checks inside the loop body
        const body = path.get('body');

        if (Array.isArray(body)) return;

        if (body.isBlockStatement()) {
          // Insert cancellation check first, then loop limit check
          (body as NodePath<BabelTypes.BlockStatement>).unshiftContainer(
            'body',
            cancellationCheck
          );
          (body as NodePath<BabelTypes.BlockStatement>).unshiftContainer(
            'body',
            loopLimitCheck
          );
        } else {
          // If the body is a single statement, wrap it in a block
          const node = path.node as
            | BabelTypes.WhileStatement
            | BabelTypes.DoWhileStatement
            | BabelTypes.ForStatement
            | BabelTypes.ForInStatement
            | BabelTypes.ForOfStatement;
          node.body = t.blockStatement([
            loopLimitCheck,
            cancellationCheck,
            node.body as BabelTypes.Statement,
          ]);
        }
      },
    },
  };
}
