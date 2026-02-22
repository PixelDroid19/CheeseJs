import type { ToolRegistry } from './toolRegistry';

export type ToolPolicyGroup =
  | 'runtime'
  | 'fs'
  | 'read'
  | 'write'
  | 'analysis'
  | 'workspace';

export type ToolPolicyPreset = 'standard' | 'safe' | 'readonly' | 'custom';

export interface ToolAccessPolicy {
  allow?: string[];
  deny?: string[];
  denyGroups?: ToolPolicyGroup[];
  allowGroups?: ToolPolicyGroup[];
}

export interface NormalizedToolAccessPolicy {
  allow: string[];
  deny: string[];
  denyGroups: ToolPolicyGroup[];
  allowGroups: ToolPolicyGroup[];
}

const TOOL_GROUPS: Record<ToolPolicyGroup, ReadonlySet<string>> = {
  runtime: new Set([]),
  fs: new Set([
    'readFile',
    'listFiles',
    'searchInFiles',
    'writeFile',
    'deleteFile',
  ]),
  read: new Set([
    'searchDocumentation',
    'readFile',
    'listFiles',
    'searchInFiles',
    'getWorkspacePath',
  ]),
  write: new Set([
    'replaceAll',
    'insert',
    'replaceSelection',
    'writeFile',
    'deleteFile',
  ]),
  analysis: new Set(['searchDocumentation', 'searchInFiles', 'readFile']),
  workspace: new Set(['getWorkspacePath', 'listFiles', 'readFile', 'searchInFiles']),
};

export const TOOL_POLICY_PRESETS: Record<
  Exclude<ToolPolicyPreset, 'custom'>,
  ToolAccessPolicy
> = {
  standard: {},
  safe: {
    denyGroups: ['write', 'runtime'],
  },
  readonly: {
    allowGroups: ['analysis', 'workspace'],
    denyGroups: ['write', 'runtime'],
  },
};

export function normalizeToolAccessPolicy(
  policy?: ToolAccessPolicy
): NormalizedToolAccessPolicy {
  return {
    allow: policy?.allow ?? [],
    deny: policy?.deny ?? [],
    allowGroups: policy?.allowGroups ?? [],
    denyGroups: policy?.denyGroups ?? [],
  };
}

export function getToolPolicyPreset(
  preset: Exclude<ToolPolicyPreset, 'custom'>
): NormalizedToolAccessPolicy {
  return normalizeToolAccessPolicy(TOOL_POLICY_PRESETS[preset]);
}

export function isToolPolicyPreset(value: string): value is ToolPolicyPreset {
  return (
    value === 'standard' ||
    value === 'safe' ||
    value === 'readonly' ||
    value === 'custom'
  );
}

function expandToolSelectors(
  policy: ToolAccessPolicy,
  key: 'allow' | 'deny',
  groupKey: 'allowGroups' | 'denyGroups'
): Set<string> {
  const direct = policy[key] ?? [];
  const groups = policy[groupKey] ?? [];
  const expanded = new Set<string>(direct);

  for (const group of groups) {
    const mapped = TOOL_GROUPS[group];
    if (!mapped) continue;
    for (const toolName of mapped) {
      expanded.add(toolName);
    }
  }

  return expanded;
}

/**
 * Applies cumulative restrictive policies.
 * - Each layer can only further restrict current access.
 * - `allow` / `allowGroups` intersects current tool set.
 * - `deny` / `denyGroups` removes from current tool set.
 */
export function applyToolPolicyLayers(
  registry: ToolRegistry,
  policyLayers: ToolAccessPolicy[]
): ToolRegistry {
  if (!policyLayers.length) return registry;

  let current = new Set<string>(Object.keys(registry));

  for (const layer of policyLayers) {
    const hasAllow =
      (layer.allow && layer.allow.length > 0) ||
      (layer.allowGroups && layer.allowGroups.length > 0);

    if (hasAllow) {
      const allowed = expandToolSelectors(layer, 'allow', 'allowGroups');
      current = new Set(Array.from(current).filter((toolName) => allowed.has(toolName)));
    }

    const denied = expandToolSelectors(layer, 'deny', 'denyGroups');
    if (denied.size > 0) {
      for (const toolName of denied) {
        current.delete(toolName);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(registry).filter(([toolName]) => current.has(toolName))
  );
}
