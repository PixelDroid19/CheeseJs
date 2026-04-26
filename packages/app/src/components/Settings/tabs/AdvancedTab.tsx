import { AdvancedTab as SettingsAdvancedTab } from '@cheesejs/settings';
import { useSettingsStore } from '../../../store/storeHooks';

export function AdvancedTab() {
  const { internalLogLevel, setInternalLogLevel } = useSettingsStore();

  return (
    <SettingsAdvancedTab
      internalLogLevel={internalLogLevel}
      onInternalLogLevelChange={setInternalLogLevel}
    />
  );
}
