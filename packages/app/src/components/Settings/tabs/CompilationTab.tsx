import { CompilationTab as SettingsCompilationTab } from '@cheesejs/settings';
import { useSettingsStore } from '../../../store/storeHooks';

export function CompilationTab() {
  const {
    loopProtection,
    setLoopProtection,
    magicComments,
    setMagicComments,
    showTopLevelResults,
    setShowTopLevelResults,
  } = useSettingsStore();

  return (
    <SettingsCompilationTab
      loopProtection={loopProtection}
      onLoopProtectionChange={setLoopProtection}
      magicComments={magicComments}
      onMagicCommentsChange={setMagicComments}
      showTopLevelResults={showTopLevelResults}
      onShowTopLevelResultsChange={setShowTopLevelResults}
    />
  );
}
