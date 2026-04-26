import { LspTab as SettingsLspTab } from '@cheesejs/settings';
import { useLspStore } from '../../../store/storeHooks';

export function LspTab() {
  const {
    languages,
    lspStatus,
    isLoadingLsp,
    loadLspConfig,
    toggleLspLanguage,
    addLspLanguage,
    removeLspLanguage,
  } = useLspStore();

  return (
    <SettingsLspTab
      languages={languages}
      lspStatus={lspStatus}
      isLoadingLsp={isLoadingLsp}
      loadLspConfig={loadLspConfig}
      toggleLspLanguage={toggleLspLanguage}
      addLspLanguage={addLspLanguage}
      removeLspLanguage={removeLspLanguage}
    />
  );
}
