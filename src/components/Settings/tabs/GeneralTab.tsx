import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/storeHooks';
import { Select } from '../ui/Select';
import { SectionHeader } from '../ui/SectionHeader';
import clsx from 'clsx';

export function GeneralTab() {
  const { t, i18n } = useTranslation();
  const { language, setLanguage, workingDirectory, setWorkingDirectory } = useSettingsStore();

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <m.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div>
        <SectionHeader title={t('settings.categories.general')} />
        <div className="flex items-center justify-between">
          <label className={clsx('text-sm font-medium', 'text-foreground')}>
            {t('settings.language')}
          </label>
          <Select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-40"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </Select>
        </div>

        <div className="mt-6 flex flex-col space-y-2">
          <label className={clsx('text-sm font-medium', 'text-foreground')}>
            {t('settings.workingDirectory', 'Working Directory (for .env)')}
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            placeholder={t('settings.workingDirectoryPlaceholder', 'e.g. C:\\Projects\\MyApp')}
            value={workingDirectory}
            onChange={(e) => setWorkingDirectory(e.target.value)}
          />
        </div>
      </div>
    </m.div>
  );
}
