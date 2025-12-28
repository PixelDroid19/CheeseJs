import ts from 'typescript';

/**
 * Options for loop protection
 */
export interface LoopProtectionOptions {
  /** Maximum number of iterations before throwing */
  maxIterations?: number;
  /** Check for cancellation every N iterations */
  cancellationCheckInterval?: number;
  /** Whether to include cancellation check */
  includeCancellationCheck?: boolean;
}

/**
 * Create a TypeScript transformer for loop protection
 */
export function createLoopProtectionTransformer(
  options: LoopProtectionOptions = {}
): ts.TransformerFactory<ts.SourceFile> {
  const {
    maxIterations = 10000,
    cancellationCheckInterval = 100,
    includeCancellationCheck = true,
  } = options;

  return (context: ts.TransformationContext) => {
    const factory = context.factory;

    // Counter for unique variable names
    let loopId = 0;

    const visit = (node: ts.Node): ts.Node => {
      // Handle loops
      if (
        ts.isForStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isForInStatement(node)
      ) {
        return transformLoop(node);
      }

      return ts.visitEachChild(node, visit, context);
    };

    const transformLoop = (
      node:
        | ts.ForStatement
        | ts.WhileStatement
        | ts.DoStatement
        | ts.ForOfStatement
        | ts.ForInStatement
    ): ts.Node => {
      const counterName = factory.createUniqueName(`__loop_${loopId++}`);

      // Create statements to check limits inside the loop
      const checkStatements = createCheckStatements(counterName);

      // Transform the loop body
      let newBody: ts.Statement;

      if (ts.isBlock(node.statement)) {
        // If body is already a block, prepend our checks
        newBody = factory.createBlock(
          [
            ...checkStatements,
            ...ts.visitEachChild(node.statement, visit, context).statements,
          ],
          true
        );
      } else {
        // If body is a single statement, wrap it in a block
        newBody = factory.createBlock(
          [
            ...checkStatements,
            ts.visitNode(node.statement, visit) as ts.Statement,
          ],
          true
        );
      }

      // Create the new loop node with the modified body
      let newLoop: ts.Statement;

      if (ts.isForStatement(node)) {
        newLoop = factory.updateForStatement(
          node,
          node.initializer,
          node.condition,
          node.incrementor,
          newBody
        );
      } else if (ts.isWhileStatement(node)) {
        newLoop = factory.updateWhileStatement(node, node.expression, newBody);
      } else if (ts.isDoStatement(node)) {
        newLoop = factory.updateDoStatement(node, newBody, node.expression);
      } else if (ts.isForOfStatement(node)) {
        newLoop = factory.updateForOfStatement(
          node,
          node.awaitModifier,
          node.initializer,
          node.expression,
          newBody
        );
      } else {
        // ForInStatement
        newLoop = factory.updateForInStatement(
          node,
          node.initializer,
          node.expression,
          newBody
        );
      }

      // Wrap the loop in a block with the counter initialization
      // {
      //   let __loop_0 = 0;
      //   for (...) { ... }
      // }
      return factory.createBlock(
        [
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  counterName,
                  undefined,
                  undefined,
                  factory.createNumericLiteral(0)
                ),
              ],
              ts.NodeFlags.Let
            )
          ),
          newLoop,
        ],
        true
      );
    };

    const createCheckStatements = (
      counterName: ts.Identifier
    ): ts.Statement[] => {
      const statements: ts.Statement[] = [];

      // if (++counter > MAX) throw new Error(...)
      statements.push(
        factory.createIfStatement(
          factory.createBinaryExpression(
            factory.createPrefixUnaryExpression(
              ts.SyntaxKind.PlusPlusToken,
              counterName
            ),
            factory.createToken(ts.SyntaxKind.GreaterThanToken),
            factory.createNumericLiteral(maxIterations)
          ),
          factory.createThrowStatement(
            factory.createNewExpression(
              factory.createIdentifier('Error'),
              undefined,
              [
                factory.createStringLiteral(
                  `Loop limit exceeded (${maxIterations} iterations)`
                ),
              ]
            )
          )
        )
      );

      // Cancellation check
      if (includeCancellationCheck) {
        // if (counter % INTERVAL === 0 && ...) throw new Error("Execution cancelled")
        statements.push(
          factory.createIfStatement(
            factory.createBinaryExpression(
              factory.createBinaryExpression(
                factory.createBinaryExpression(
                  counterName,
                  factory.createToken(ts.SyntaxKind.PercentToken),
                  factory.createNumericLiteral(cancellationCheckInterval)
                ),
                factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
                factory.createNumericLiteral(0)
              ),
              factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
              factory.createCallExpression(
                factory.createIdentifier('__checkCancellation__'),
                undefined,
                []
              )
            ),
            factory.createThrowStatement(
              factory.createNewExpression(
                factory.createIdentifier('Error'),
                undefined,
                [factory.createStringLiteral('Execution cancelled')]
              )
            )
          )
        );
      }

      return statements;
    };

    return (node: ts.SourceFile) => ts.visitNode(node, visit) as ts.SourceFile;
  };
}
