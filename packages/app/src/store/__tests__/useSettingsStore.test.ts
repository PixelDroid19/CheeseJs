import { useAppStore } from '../index';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../storeHooks';

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset store to default values for testing
    useSettingsStore.setState({
      alignResults: false,
      internalLogLevel: 'none',
      showUndefined: false,
      loopProtection: true,
      showTopLevelResults: true,
    });

    // Clear localStorage to simulate fresh start
    localStorage.clear();
  });

  it('should have alignResults disabled by default', () => {
    const state = useAppStore.getState().settings;
    expect(state.alignResults).toBe(false);
  });

  it('should have internalLogLevel set to none by default', () => {
    const state = useAppStore.getState().settings;
    expect(state.internalLogLevel).toBe('none');
  });

  it('should update alignResults', () => {
    const { setAlignResults } = useAppStore.getState().settings;
    setAlignResults(true);
    expect(useAppStore.getState().settings.alignResults).toBe(true);
  });

  it('should update internalLogLevel', () => {
    const { setInternalLogLevel } = useAppStore.getState().settings;
    setInternalLogLevel('debug');
    expect(useAppStore.getState().settings.internalLogLevel).toBe('debug');
  });
});
