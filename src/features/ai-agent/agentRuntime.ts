import type { AgentProfile } from './agentProfiles';
import { getDefaultProfileForMode } from './agentProfiles';
import { SYSTEM_PROMPTS } from './prompts';
import type { ToolAccessPolicy } from './toolPolicy';

export type AgentExecutionMode = 'agent' | 'plan' | 'verifier';

export interface AgentRuntimeOptions {
  mode?: AgentExecutionMode;
  disableTools?: boolean;
  profile?: AgentProfile;
  toolPolicyLayers?: ToolAccessPolicy[];
}

export interface ResolvedAgentRuntime {
  mode: AgentExecutionMode;
  disableTools: boolean;
  profile: AgentProfile;
  systemPrompt: string;
  maxSteps: number;
  toolPolicyLayers: ToolAccessPolicy[];
}

const AGENT_SYSTEM_PROMPT = `${SYSTEM_PROMPTS.codeAssistant}

You have access to powerful tools to help the user with coding tasks.

## Editor Tools
Use these tools to manipulate the code editor directly:
- **replaceAll**: Replace the entire code in the editor with new content
- **insert**: Insert code at the current cursor position
- **replaceSelection**: Replace the currently selected code
- **searchDocumentation**: Search the documentation (RAG) for relevant information

## Filesystem Tools
You have full access to the user's filesystem (when running in Electron):
- **readFile**: Read the contents of any file. Supports optional line ranges (startLine, endLine)
- **writeFile**: Create or overwrite a file with new content
- **listFiles**: List files and directories in a path. Set recursive=true for deep listing
- **searchInFiles**: Search for text or regex patterns across files in a directory
- **deleteFile**: Delete a file or directory (use with caution)
- **getWorkspacePath**: Get the current workspace/project root path

## Guidelines
- Use tools whenever you need to write, modify, or analyze code
- Don't just output code in markdown unless specifically asked for an explanation
- For filesystem operations, always confirm with the user before destructive actions
- When exploring a project, start with getWorkspacePath and listFiles to understand the structure
- Use readFile to examine specific files, and writeFile to make changes
- Use searchInFiles to find code patterns, function definitions, or usages
`;

const PLAN_SYSTEM_PROMPT = `${SYSTEM_PROMPTS.codeAssistant}

You are in PLAN MODE (read-only strategy mode).

Rules:
- DO NOT modify code directly.
- DO NOT call code-editing tools.
- Build an actionable implementation plan based on current code context.

Output format:
1) Goal summary
2) Affected files/modules
3) Step-by-step implementation plan
4) Risks / edge cases
5) Validation checklist (tests/manual checks)
`;

const VERIFIER_SYSTEM_PROMPT = `${SYSTEM_PROMPTS.codeAssistant}

You are @verifier, a specialized validation subagent.

Rules:
- Read/analyze only, do not change files.
- Focus on correctness, safety, regressions, and requirements coverage.
- Provide concise findings with severity.

Output format:
1) Verdict (pass / needs-fixes)
2) Findings (critical/high/medium/low)
3) Recommended fixes
4) Quick verification steps
`;

const LEGACY_SYSTEM_PROMPT = `${SYSTEM_PROMPTS.codeAssistant}

You have DIRECT ACCESS to the code editor.
The current code in the editor is provided to you in the context.

Your PRIMARY GOAL is to help the user by WRITING CODE DIRECTLY into the editor.

To perform actions, you MUST use the following JSON block format:

<<<EDITOR_ACTION>>>
{
  "action": "ACTION_NAME",
  "code": "CODE_CONTENT"
}
<<<END_ACTION>>>

Available Actions:
- "replaceAll": Replace the entire file content. Use this to write a new file or completely rewrite the current code.
- "insert": Insert code at cursor position. Use this to insert a helper function or snippet.
- "replaceSelection": Replace selected code.

Example:
<<<EDITOR_ACTION>>>
{
  "action": "insert",
  "code": "console.log('Hello');"
}
<<<END_ACTION>>>

CRITICAL RULES:
- DO NOT just print the code in a markdown block. The user wants the code IN THE EDITOR.
- Use the JSON block format for ALL code modifications.
`;

export function getSystemPromptForMode(
  mode: AgentExecutionMode,
  disableTools: boolean
): string {
  if (disableTools) return LEGACY_SYSTEM_PROMPT;
  if (mode === 'plan') return PLAN_SYSTEM_PROMPT;
  if (mode === 'verifier') return VERIFIER_SYSTEM_PROMPT;
  return AGENT_SYSTEM_PROMPT;
}

export function resolveAgentRuntime(
  optionsOrDisable?: boolean | AgentRuntimeOptions
): ResolvedAgentRuntime {
  if (typeof optionsOrDisable === 'boolean') {
    const mode: AgentExecutionMode = 'agent';
    const disableTools = optionsOrDisable;
    const profile = getDefaultProfileForMode(mode);
    return {
      mode,
      disableTools,
      profile,
      systemPrompt: getSystemPromptForMode(mode, disableTools),
      maxSteps: 5,
      toolPolicyLayers: [],
    };
  }

  const mode = optionsOrDisable?.mode || 'agent';
  const disableTools = optionsOrDisable?.disableTools || false;
  const profile = optionsOrDisable?.profile || getDefaultProfileForMode(mode);
  const toolPolicyLayers = optionsOrDisable?.toolPolicyLayers || [];

  return {
    mode,
    disableTools,
    profile,
    systemPrompt: getSystemPromptForMode(mode, disableTools),
    maxSteps: mode === 'plan' ? 3 : 5,
    toolPolicyLayers,
  };
}
