export type AgentProfile = 'build' | 'plan';

export const PROFILE_ALLOWED_TOOLS: Record<
  AgentProfile,
  ReadonlySet<string>
> = {
  build: new Set([
    'searchDocumentation',
    'readFile',
    'listFiles',
    'searchInFiles',
    'getWorkspacePath',
    'replaceAll',
    'insert',
    'replaceSelection',
    'writeFile',
    'deleteFile',
  ]),
  plan: new Set([
    'searchDocumentation',
    'readFile',
    'listFiles',
    'searchInFiles',
    'getWorkspacePath',
  ]),
};

export function getDefaultProfileForMode(
  mode: 'agent' | 'plan' | 'verifier'
): AgentProfile {
  if (mode === 'plan' || mode === 'verifier') {
    return 'plan';
  }
  return 'build';
}

export function isToolAllowedForProfile(
  profile: AgentProfile,
  toolName: string
): boolean {
  return PROFILE_ALLOWED_TOOLS[profile].has(toolName);
}
