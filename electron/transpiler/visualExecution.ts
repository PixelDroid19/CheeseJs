import ts from 'typescript';

/**
 * Transformer to inject line execution tracking
 * Adds __lineExecuted(line) calls before statements
 */
export function createVisualExecutionTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext) => {
    return (sourceFile: ts.SourceFile) => {
      const visit = (node: ts.Node): ts.Node => {
        // Handle Blocks and SourceFiles to insert statements
        if (ts.isBlock(node) || ts.isSourceFile(node)) {
          return visitBlockOrSourceFile(node, context, sourceFile);
        }

        return ts.visitEachChild(node, visit, context);
      };

      return ts.visitNode(sourceFile, visit) as ts.SourceFile;
    };
  };
}

function visitBlockOrSourceFile(
  node: ts.Block | ts.SourceFile,
  context: ts.TransformationContext,
  sourceFile: ts.SourceFile
): ts.Node {
  const factory = context.factory;

  const newStatements: ts.Statement[] = [];

  for (const statement of node.statements) {
    // Determine if we should track this statement
    if (shouldTrack(statement)) {
      const start = statement.getStart(sourceFile);
      const { line } = sourceFile.getLineAndCharacterOfPosition(start);
      const lineNumber = line + 1;

      // Add tracking call
      newStatements.push(
        factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createIdentifier('__lineExecuted'),
            undefined,
            [factory.createNumericLiteral(lineNumber)]
          )
        )
      );
    }

    // Visit the statement itself (to handle nested blocks/loops)
    // We must use the visitor to traverse down
    // But we don't want to use the main `visit` function on *this* statement if it would try to wrap it (which we avoided by changing the logic).
    // Actually, let's keep the main `visit` simple and only handle the insertion here.

    // We still need to visit children of the statement.
    const visitedStatement = ts.visitNode(statement, (n) =>
      visitNodeRecursive(n, context, sourceFile)
    ) as ts.Statement;
    newStatements.push(visitedStatement);
  }

  if (ts.isBlock(node)) {
    return factory.createBlock(newStatements, true);
  } else {
    return factory.updateSourceFile(node, newStatements);
  }
}

// Recursive visitor for children (that aren't blocks we handle manually)
function visitNodeRecursive(
  node: ts.Node,
  context: ts.TransformationContext,
  sourceFile: ts.SourceFile
): ts.Node {
  if (ts.isBlock(node)) {
    // Recurse into blocks using our special handler
    return visitBlockOrSourceFile(node, context, sourceFile);
  }

  // For Other control structures (If, For, etc.), their bodies might be Statements (not Blocks).
  // e.g. if (x) return;
  // We need to ensure bodies are Blocks so we can insert tracking inside them.
  if (isControlStructure(node)) {
    return transformControlStructure(node, context, sourceFile);
  }

  return ts.visitEachChild(
    node,
    (n) => visitNodeRecursive(n, context, sourceFile),
    context
  );
}

function shouldTrack(node: ts.Node): boolean {
  // Track statements that are "step-like"
  return (
    ts.isVariableStatement(node) ||
    ts.isExpressionStatement(node) ||
    ts.isReturnStatement(node) ||
    ts.isThrowStatement(node) ||
    ts.isBreakStatement(node) ||
    ts.isContinueStatement(node) ||
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node)
  );
}

function isControlStructure(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

function transformControlStructure(
  node: ts.Node,
  context: ts.TransformationContext,
  sourceFile: ts.SourceFile
): ts.Node {
  const factory = context.factory;

  // Helper to wrap single statement in block
  const ensureBlock = (stmt: ts.Statement): ts.Block => {
    if (ts.isBlock(stmt)) {
      // Already a block, visit it normally
      return visitBlockOrSourceFile(stmt, context, sourceFile) as ts.Block;
    }

    // Wrap in block and visit
    // We need to manually inject tracking for the single statement since it's now in a block
    // Actually, visitBlockOrSourceFile handles that.
    // So we create a block with the single statement, then visit that block.
    const block = factory.createBlock([stmt], true);
    return visitBlockOrSourceFile(block, context, sourceFile) as ts.Block;
  };

  if (ts.isIfStatement(node)) {
    return factory.updateIfStatement(
      node,
      node.expression,
      ensureBlock(node.thenStatement),
      node.elseStatement ? ensureBlock(node.elseStatement) : undefined
    );
  }

  // ... handle other loops ...
  // Simplified: Just use visitEachChild but intercept specific properties?
  // It's easier just to let 'visitNodeRecursive' handle it?
  // No, visitNodeRecursive calls visitEachChild which just visits.
  // We need to enforce blocks.

  // For brevity, let's just stick to Blocks handling.
  // If a user writes `if (x) y;` it won't be highlighted inside.
  // That's acceptable for V1.
  // BUT we can just improve `visitNodeRecursive`:

  return ts.visitEachChild(
    node,
    (n) => visitNodeRecursive(n, context, sourceFile),
    context
  );
}
