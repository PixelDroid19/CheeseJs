import { FormattingTab as SettingsFormattingTab } from '@cheesejs/settings';
import { useSettingsStore } from '../../../store/storeHooks';

export function FormattingTab() {
  const {
    alignResults,
    setAlignResults,
    showUndefined,
    setShowUndefined,
    consoleFilters,
    setConsoleFilters,
  } = useSettingsStore();

  return (
    <SettingsFormattingTab
      alignResults={alignResults}
      onAlignResultsChange={setAlignResults}
      showUndefined={showUndefined}
      onShowUndefinedChange={setShowUndefined}
      consoleFilters={consoleFilters}
      onConsoleFiltersChange={setConsoleFilters}
    />
  );
}
