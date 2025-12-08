import type { PluginObj } from '@babel/core';
import type * as BabelTypes from '@babel/types';

export default function ({
  types: t,
}: {
  types: typeof BabelTypes;
}): PluginObj {
  return {
    visitor: {
      // Visit all nodes that can have comments
      Expression(path) {
        const { node } = path;
        if (!node.trailingComments) return;

        const magicCommentIndex = node.trailingComments.findIndex(
          (comment) =>
            comment.value.trim().startsWith('?') || comment.value.trim() === '?'
        );

        if (magicCommentIndex === -1) return;

        // Remove the comment so it doesn't get processed again or clutter output
        node.trailingComments.splice(magicCommentIndex, 1);

        const line = node.loc?.start.line;
        if (!line) return;

        // If it's already a debug call, don't wrap it again
        if (
          t.isCallExpression(node) &&
          t.isIdentifier(node.callee) &&
          node.callee.name === 'debug'
        ) {
          return;
        }

        // Check if expression is a statement (top-level) or part of another expression
        // If it's a statement, stray-expression might handle it, but magic comments
        // are specific, so we should prioritize them.

        // However, if we wrap it in debug(line, expr), debug returns expr, so it's safe.
        // We just need to make sure we don't break the AST.

        // Special case: AssignmentExpression
        // x = 5 //?  -> debug(line, x = 5)  -> returns 5, assigns 5 to x. Correct.

        // Special case: VariableDeclaration
        // const x = 5 //?
        // VariableDeclaration is not an Expression. It's a Statement.
        // We need to handle VariableDeclarator separately or visit Statement.

        path.replaceWith(
          t.callExpression(t.identifier('debug'), [
            t.numericLiteral(line),
            node,
          ])
        );

        path.skip();
      },

      VariableDeclaration(path) {
        const { node } = path;
        // Check for comments on the declaration itself: const x = 1 //?
        if (!node.trailingComments) return;

        const magicCommentIndex = node.trailingComments.findIndex(
          (comment) =>
            comment.value.trim().startsWith('?') || comment.value.trim() === '?'
        );

        if (magicCommentIndex === -1) return;

        node.trailingComments.splice(magicCommentIndex, 1);

        // For variable declaration, we can't wrap it. We have to insert a debug call after it.
        // const x = 1; debug(line, x);

        // We need to identify which variable to log.
        // If there's only one declarator, log it.
        if (node.declarations.length === 1) {
          const decl = node.declarations[0];
          if (t.isIdentifier(decl.id)) {
            const line = node.loc?.start.line;
            if (line) {
              path.insertAfter(
                t.expressionStatement(
                  t.callExpression(t.identifier('debug'), [
                    t.numericLiteral(line),
                    t.identifier(decl.id.name),
                  ])
                )
              );
            }
          }
        }
      },
    },
  };
}
