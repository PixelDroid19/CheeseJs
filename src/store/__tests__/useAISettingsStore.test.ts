import { beforeEach, describe, expect, it } from 'vitest';
import { useAISettingsStore } from '../useAISettingsStore';

describe('useAISettingsStore', () => {
  beforeEach(() => {
    useAISettingsStore.setState({
      executionMode: 'agent',
      agentProfile: 'build',
      toolPolicyPreset: 'standard',
      toolPolicy: {
        allow: [],
        deny: [],
        allowGroups: [],
        denyGroups: [],
      },
      provider: 'local',
      apiKeys: {
        openai: '',
        anthropic: '',
        google: '',
        local: '',
      },
    });
    localStorage.clear();
  });

  it('setExecutionMode(plan) should sync profile to plan', () => {
    useAISettingsStore.getState().setExecutionMode('plan');

    const state = useAISettingsStore.getState();
    expect(state.executionMode).toBe('plan');
    expect(state.agentProfile).toBe('plan');
  });

  it('setExecutionMode(agent) should sync profile to build', () => {
    useAISettingsStore.getState().setExecutionMode('agent');

    const state = useAISettingsStore.getState();
    expect(state.executionMode).toBe('agent');
    expect(state.agentProfile).toBe('build');
  });

  it('setAgentProfile(plan) should sync mode to plan', () => {
    useAISettingsStore.getState().setAgentProfile('plan');

    const state = useAISettingsStore.getState();
    expect(state.agentProfile).toBe('plan');
    expect(state.executionMode).toBe('plan');
  });

  it('setAgentProfile(build) should sync mode to agent', () => {
    useAISettingsStore.getState().setAgentProfile('build');

    const state = useAISettingsStore.getState();
    expect(state.agentProfile).toBe('build');
    expect(state.executionMode).toBe('agent');
  });

  it('setToolPolicyPreset(readonly) should set restrictive group policy', () => {
    useAISettingsStore.getState().setToolPolicyPreset('readonly');

    const state = useAISettingsStore.getState();
    expect(state.toolPolicyPreset).toBe('readonly');
    expect(state.toolPolicy.allowGroups).toEqual(['analysis', 'workspace']);
    expect(state.toolPolicy.denyGroups).toEqual(['write', 'runtime']);
  });

  it('setToolPolicy should mark preset as custom', () => {
    useAISettingsStore.getState().setToolPolicy({ denyGroups: ['write'] });

    const state = useAISettingsStore.getState();
    expect(state.toolPolicyPreset).toBe('custom');
    expect(state.toolPolicy.denyGroups).toEqual(['write']);
  });
});
