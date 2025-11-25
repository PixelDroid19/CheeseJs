import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../../store/useSettingsStore'

export function GeneralTab () {
  const { t, i18n } = useTranslation()
  const { language, setLanguage } = useSettingsStore()

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300">
          {t('settings.language')}
        </label>
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="w-full max-w-xs bg-[#2c313a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
    </motion.div>
  )
}
