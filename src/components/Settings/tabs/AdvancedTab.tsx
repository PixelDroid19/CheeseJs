import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { HelpCircle } from 'lucide-react'
import { useSettingsStore } from '../../../store/useSettingsStore'

export function AdvancedTab () {
  const { t } = useTranslation()
  const {
    showTopLevelResults,
    setShowTopLevelResults,
    alignResults,
    setAlignResults,
    showUndefined,
    setShowUndefined,
    loopProtection,
    setLoopProtection
  } = useSettingsStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-[250px_1fr] gap-8 items-start group">
        <div className="text-right text-gray-300 text-sm font-medium pt-1 group-hover:text-white transition-colors">
          {t('settings.advanced.expressionResults')}
        </div>
        <div>
          <label className="flex items-center space-x-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={showTopLevelResults}
                onChange={(e) => setShowTopLevelResults(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              {t('settings.advanced.showTopLevel')}
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-[250px_1fr] gap-8 items-start group">
        <div className="text-right text-gray-300 text-sm font-medium pt-1 group-hover:text-white transition-colors">
          {t('settings.advanced.align')}
        </div>
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={alignResults}
                onChange={(e) => setAlignResults(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              {t('settings.advanced.alignWithSource')}
            </span>
          </label>
          <div className="group/tooltip relative flex items-center">
            <HelpCircle
              size={16}
              className="text-gray-500 hover:text-blue-400 transition-colors cursor-help"
            />
            <div className="absolute left-full ml-3 w-64 p-3 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 whitespace-pre-wrap backdrop-blur-sm">
              {t('settings.advanced.alignTooltip')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[250px_1fr] gap-8 items-start group">
        <div className="text-right text-gray-300 text-sm font-medium pt-1 group-hover:text-white transition-colors">
          {t('settings.advanced.showUndefined')}
        </div>
        <div>
          <label className="flex items-center space-x-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={showUndefined}
                onChange={(e) => setShowUndefined(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              {t('settings.advanced.showUndefinedValues')}
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-[250px_1fr] gap-8 items-start group">
        <div className="text-right text-gray-300 text-sm font-medium pt-1 group-hover:text-white transition-colors">
          {t('settings.advanced.loopProtection')}
        </div>
        <div>
          <label className="flex items-center space-x-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={loopProtection}
                onChange={(e) => setLoopProtection(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              {t('settings.advanced.protectLongRunning')}
            </span>
          </label>
        </div>
      </div>
    </motion.div>
  )
}
