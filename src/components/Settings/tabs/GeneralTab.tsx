import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { useThemeColors } from '../../../hooks/useThemeColors'
import { Select } from '../ui/Select'
import { SectionHeader } from '../ui/SectionHeader'
import clsx from 'clsx'

export function GeneralTab () {
  const { t, i18n } = useTranslation()
  const { language, setLanguage } = useSettingsStore()
  const colors = useThemeColors()

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div>
        <SectionHeader title={t('settings.categories.general')} />
        <div className="flex items-center justify-between">
          <label className={clsx("text-sm font-medium", colors.text)}>
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
      </div>
    </motion.div>
  )
}
