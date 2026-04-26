import { GeneralTab as SettingsGeneralTab } from '@cheesejs/settings';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/storeHooks';

export function GeneralTab() {
  const { i18n } = useTranslation();
  const { language, setLanguage, workingDirectory, setWorkingDirectory } =
    useSettingsStore();

  return (
    <SettingsGeneralTab
      language={language}
      onLanguageChange={(lang) => {
        setLanguage(lang);
        void i18n.changeLanguage(lang);
      }}
      workingDirectory={workingDirectory}
      onWorkingDirectoryChange={setWorkingDirectory}
    />
  );
}
