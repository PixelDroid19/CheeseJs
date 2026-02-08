import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { themeOptions } from '../../../themes';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { SectionHeader } from '../ui/SectionHeader';
import clsx from 'clsx';

export function AppearanceTab() {
  const { t } = useTranslation();
  const {
    themeName,
    setThemeName,
    fontSize,
    setFontSize,
    uiFontSize,
    setUiFontSize,
  } = useSettingsStore();

  return (
    <motion.div
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
              onChange={(e) => setThemeName(e.target.value)}
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
              onChange={setFontSize}
              formatValue={(v) => `${v}px`}
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            <Slider
              label={t('settings.uiFontSize', 'Font Size (UI)')}
              min={10}
              max={24}
              value={uiFontSize}
              onChange={setUiFontSize}
              formatValue={(v) => `${v}px`}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
