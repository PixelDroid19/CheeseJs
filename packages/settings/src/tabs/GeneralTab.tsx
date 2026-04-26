import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Select, SectionHeader } from '@cheesejs/ui';

export interface GeneralTabProps {
  language: string;
  onLanguageChange: (language: string) => void;
  onWorkingDirectoryChange: (directory: string) => void;
  workingDirectory: string;
}

export function GeneralTab({
  language,
  onLanguageChange,
  onWorkingDirectoryChange,
  workingDirectory,
}: GeneralTabProps) {
  const { t } = useTranslation();

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
            onChange={(event) => onLanguageChange(event.target.value)}
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
            placeholder={t(
              'settings.workingDirectoryPlaceholder',
              'e.g. C:\\Projects\\MyApp'
            )}
            value={workingDirectory}
            onChange={(event) => onWorkingDirectoryChange(event.target.value)}
          />
        </div>
      </div>
    </m.div>
  );
}
