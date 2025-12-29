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

  inlineCompletion: `You are an autocomplete engine. Complete the code at the cursor.

STRICT RULES:
1. Output ONLY the characters to INSERT at cursor position
2. NEVER repeat existing code - the cursor is at the END of what's shown
3. NO markdown, NO code blocks, NO backticks, NO explanations
4. Just raw code characters that continue from the cursor
5. If line has "const x = " - complete with the value, NOT "const x = value"
6. Keep it short: 1 line or a small function body
7. Match existing code style exactly`,

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

// Build inline completion prompt
export function buildInlineCompletionPrompt(context: PromptContext): string {
  const { language, codeBefore, codeAfter } = context;

  // Get just the last few lines for context - cursor is at the end of this
  const lines = codeBefore.split('\n');
  const lastLines = lines.slice(-8).join('\n');
  const currentLine = lines[lines.length - 1] || '';
  const nextLines = codeAfter.split('\n').slice(0, 2).join('\n');

  return `Language: ${language}

Code ending at cursor position (█ = cursor):
\`\`\`
${lastLines}█
\`\`\`

After cursor:
\`\`\`
${nextLines}
\`\`\`

Current incomplete line: "${currentLine}"

OUTPUT ONLY the characters that should appear RIGHT AFTER the cursor.
Do NOT repeat "${currentLine}" - just add what's missing.
No markdown. No explanation. Just the raw completion:`;
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
