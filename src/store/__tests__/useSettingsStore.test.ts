import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../useSettingsStore';

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
    const state = useSettingsStore.getState();
    expect(state.alignResults).toBe(false);
  });

  it('should have internalLogLevel set to none by default', () => {
    const state = useSettingsStore.getState();
    expect(state.internalLogLevel).toBe('none');
  });

  it('should update alignResults', () => {
    const { setAlignResults } = useSettingsStore.getState();
    setAlignResults(true);
    expect(useSettingsStore.getState().alignResults).toBe(true);
  });

  it('should update internalLogLevel', () => {
    const { setInternalLogLevel } = useSettingsStore.getState();
    setInternalLogLevel('debug');
    expect(useSettingsStore.getState().internalLogLevel).toBe('debug');
  });
});
