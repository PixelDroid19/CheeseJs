import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { themeOptions } from '../../../themes'

export function AppearanceTab () {
  const { t } = useTranslation()
  const { themeName, setThemeName, fontSize, setFontSize } = useSettingsStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300">
          {t('settings.theme')}
        </label>
        <select
          value={themeName}
          onChange={(e) => setThemeName(e.target.value)}
          className="w-full max-w-xs bg-[#2c313a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        >
          {themeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300">
          {t('settings.fontSize')} ({fontSize}px)
        </label>
        <input
          type="range"
          min="12"
          max="32"
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full max-w-xs h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </motion.div>
  )
}
