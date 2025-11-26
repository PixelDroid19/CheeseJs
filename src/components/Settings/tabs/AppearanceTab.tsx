import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { themeOptions } from '../../../themes'
import { useThemeColors } from '../../../hooks/useThemeColors'
import { Select } from '../ui/Select'
import { Slider } from '../ui/Slider'
import { SectionHeader } from '../ui/SectionHeader'
import clsx from 'clsx'

export function AppearanceTab () {
  const { t } = useTranslation()
  const { themeName, setThemeName, fontSize, setFontSize } = useSettingsStore()
  const colors = useThemeColors()

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
                <label className={clsx("text-sm font-medium", colors.text)}>
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
                 <div className="flex items-center justify-between">
                    <label className={clsx("text-sm font-medium", colors.text)}>
                    {t('settings.fontSize')}
                    </label>
                    <span className={clsx("text-sm", colors.textSecondary)}>
                        {fontSize}px
                    </span>
                 </div>
                <Slider
                min="12"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full"
                />
            </div>
        </div>
      </div>
    </motion.div>
  )
}
