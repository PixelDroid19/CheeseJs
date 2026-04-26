import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

import { SectionHeader } from '../ui/SectionHeader';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';

export interface ThemeOption {
  label: string;
  value: string;
}

export interface AppearanceTabProps {
  fontLigatures: boolean;
  fontSize: number;
  onFontLigaturesChange: (enabled: boolean) => void;
  onFontSizeChange: (size: number) => void;
  onThemeNameChange: (themeName: string) => void;
  onUiFontSizeChange: (size: number) => void;
  themeName: string;
  themeOptions: ThemeOption[];
  uiFontSize: number;
}

export function AppearanceTab({
  fontLigatures,
  fontSize,
  onFontLigaturesChange,
  onFontSizeChange,
  onThemeNameChange,
  onUiFontSizeChange,
  themeName,
  themeOptions,
  uiFontSize,
}: AppearanceTabProps) {
  const { t } = useTranslation();

  return (
    <m.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div>
        <SectionHeader title={t('settings.categories.appearance')} />

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <label className={clsx('text-sm font-medium', 'text-foreground')}>
              {t('settings.theme')}
            </label>
            <Select
              value={themeName}
              onChange={(event) => onThemeNameChange(event.target.value)}
              className="w-40"
            >
              {themeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-3">
            <Slider
              label={`${t('settings.fontSize')} (Editor)`}
              min={12}
              max={32}
              value={fontSize}
              onChange={onFontSizeChange}
              formatValue={(value) => `${value}px`}
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            <Slider
              label={t('settings.uiFontSize', 'Font Size (UI)')}
              min={10}
              max={24}
              value={uiFontSize}
              onChange={onUiFontSizeChange}
              formatValue={(value) => `${value}px`}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <Toggle
              label={t('settings.fontLigatures', 'Font Ligatures')}
              description={t(
                'settings.fontLigaturesDesc',
                'Enable typographical ligatures in the editor'
              )}
              checked={fontLigatures}
              onChange={onFontLigaturesChange}
            />
          </div>
        </div>
      </div>
    </m.div>
  );
}
