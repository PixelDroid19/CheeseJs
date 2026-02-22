import { useAppStore } from '../index';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAISettingsStore } from '../storeHooks';

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
    useAppStore.getState().aiSettings.setExecutionMode('plan');

    const state = useAppStore.getState().aiSettings;
    expect(state.executionMode).toBe('plan');
    expect(state.agentProfile).toBe('plan');
  });

  it('setExecutionMode(agent) should sync profile to build', () => {
    useAppStore.getState().aiSettings.setExecutionMode('agent');

    const state = useAppStore.getState().aiSettings;
    expect(state.executionMode).toBe('agent');
    expect(state.agentProfile).toBe('build');
  });

  it('setAgentProfile(plan) should sync mode to plan', () => {
    useAppStore.getState().aiSettings.setAgentProfile('plan');

    const state = useAppStore.getState().aiSettings;
    expect(state.agentProfile).toBe('plan');
    expect(state.executionMode).toBe('plan');
  });

  it('setAgentProfile(build) should sync mode to agent', () => {
    useAppStore.getState().aiSettings.setAgentProfile('build');

    const state = useAppStore.getState().aiSettings;
    expect(state.agentProfile).toBe('build');
    expect(state.executionMode).toBe('agent');
  });

  it('setToolPolicyPreset(readonly) should set restrictive group policy', () => {
    useAppStore.getState().aiSettings.setToolPolicyPreset('readonly');

    const state = useAppStore.getState().aiSettings;
    expect(state.toolPolicyPreset).toBe('readonly');
    expect(state.toolPolicy.allowGroups).toEqual(['analysis', 'workspace']);
    expect(state.toolPolicy.denyGroups).toEqual(['write', 'runtime']);
  });

  it('setToolPolicy should mark preset as custom', () => {
    useAppStore.getState().aiSettings.setToolPolicy({ denyGroups: ['write'] });

    const state = useAppStore.getState().aiSettings;
    expect(state.toolPolicyPreset).toBe('custom');
    expect(state.toolPolicy.denyGroups).toEqual(['write']);
  });
});
