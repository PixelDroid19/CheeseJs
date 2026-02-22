// AI Prompt Templates for CheeseJS

export const SYSTEM_PROMPTS = {
  codeAssistant: `You are an expert coding assistant integrated into CheeseJS, a JavaScript/TypeScript playground.
Your role is to help users write, understand, and improve their code directly in the editor.

Guidelines:
- You are an AGENT, not just a chatbot. You have the power to edit the code.
- Provide concise, accurate code suggestions.
- Use modern TypeScript/JavaScript best practices.
- ALWAYS use the "function" keyword for standalone/top-level functions (e.g., "function myFunc() {}"), NOT method syntax.
- Use TypeScript syntax by default (interfaces, types).
- Omit semicolons where possible.
- When generating code, ensure it's runnable in a browser or Node.js environment.
- Format code properly with consistent indentation.
- Include brief explanations when helpful.
- If the user is working with a specific library, follow its conventions.`,

  inlineCompletion: `You are a code completion engine (like GitHub Copilot). You fill in code at the cursor position using the surrounding context.

RULES — follow ALL of them exactly:
1. Output ONLY the raw code that goes at the <CURSOR> position. Nothing else.
2. NEVER repeat code that already exists before or after the cursor.
3. NO markdown, NO code fences, NO backticks, NO natural language, NO explanations.
4. Match the existing indentation, naming conventions, and code style exactly.
5. Prefer completing the current statement/expression first, then optionally add 1-3 more lines if they are a natural continuation.
6. If the cursor is mid-expression (e.g. after "const x = "), complete the expression — do NOT re-state the left-hand side.
7. If there is code after the cursor, make sure your completion flows into it naturally. Do not duplicate it.
8. If you cannot produce a confident completion, output nothing (empty string).`,

  codeExplanation: `Explain this code clearly and concisely:
- What it does
- Key concepts used
- Any potential issues or improvements`,

  codeRefactor: `Refactor this code to be cleaner and more efficient:
- Improve readability
- Follow best practices
- Maintain the same functionality
- Add comments for complex parts`,

  codeDocument: `Add documentation to this code:
- JSDoc comments for functions
- Inline comments for complex logic
- Type annotations if missing`,

  codeFix: `Fix issues in this code:
- Identify bugs or potential problems
- Provide corrected code
- Explain what was wrong`,
};

export interface PromptContext {
  language: string;
  codeBefore: string;
  codeAfter: string;
  selectedCode?: string;
  userPrompt?: string;
}

// Build inline completion prompt — FIM (Fill-in-the-Middle) style
export function buildInlineCompletionPrompt(context: PromptContext): string {
  const { language, codeBefore, codeAfter } = context;

  // Use generous context: last ~40 lines before, ~10 lines after
  const prefixLines = codeBefore.split('\n');
  const prefix = prefixLines.slice(-40).join('\n');
  const suffix = codeAfter.split('\n').slice(0, 10).join('\n');

  // Current line helps the model understand what the user is typing right now
  const currentLine = prefixLines[prefixLines.length - 1] || '';

  // FIM-style prompt: clear separation of prefix / cursor / suffix
  return `[LANG] ${language}
[PREFIX]
${prefix}<CURSOR>[SUFFIX]
${suffix}
[END]

The cursor is at <CURSOR>, right after: "${currentLine}"
Fill in the code at the cursor position. Output ONLY the inserted code:`;
}

// Build chat prompt with code context
export function buildChatPrompt(
  userMessage: string,
  codeContext?: string,
  language?: string
): string {
  if (!codeContext) {
    return userMessage;
  }

  return `${userMessage}

Current code context (${language || 'unknown'}):
\`\`\`${language || ''}
${codeContext}
\`\`\``;
}

// Build refactoring prompt
export function buildRefactorPrompt(
  action: 'explain' | 'refactor' | 'document' | 'fix',
  code: string,
  language: string
): string {
  const actionPrompts = {
    explain: SYSTEM_PROMPTS.codeExplanation,
    refactor: SYSTEM_PROMPTS.codeRefactor,
    document: SYSTEM_PROMPTS.codeDocument,
    fix: SYSTEM_PROMPTS.codeFix,
  };

  return `${actionPrompts[action]}

Code (${language}):
\`\`\`${language}
${code}
\`\`\``;
}
