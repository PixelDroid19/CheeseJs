import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  HelpCircle,
  Sliders,
  Cpu,
  AlignLeft,
  Palette,
  Bot,
  Package,
  Wrench
} from 'lucide-react'
import { useSettingsStore } from '../store/useSettingsStore'
import { themeOptions } from '../themes'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

type Tab =
  | 'general'
  | 'compilation'
  | 'formatting'
  | 'appearance'
  | 'ai'
  | 'npm'
  | 'advanced';

export default function Settings () {
  const { t, i18n } = useTranslation()
  const {
    themeName,
    setThemeName,
    fontSize,
    setFontSize,
    language,
    setLanguage,
    isSettingsOpen,
    setIsSettingsOpen,
    showTopLevelResults,
    setShowTopLevelResults,
    alignResults,
    setAlignResults,
    showUndefined,
    setShowUndefined,
    loopProtection,
    setLoopProtection
  } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<Tab>('advanced')

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: t('settings.categories.general'), icon: Sliders },
    {
      id: 'compilation',
      label: t('settings.categories.compilation'),
      icon: Cpu
    },
    {
      id: 'formatting',
      label: t('settings.categories.formatting'),
      icon: AlignLeft
    },
    {
      id: 'appearance',
      label: t('settings.categories.appearance'),
      icon: Palette
    },
    { id: 'ai', label: t('settings.categories.ai'), icon: Bot },
    { id: 'npm', label: t('settings.categories.npm'), icon: Package },
    { id: 'advanced', label: t('settings.categories.advanced'), icon: Wrench }
  ]

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="bg-[#1e1e1e]/95 backdrop-blur-md text-white rounded-xl shadow-2xl w-[900px] h-[600px] flex flex-col border border-white/10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">
                {t('settings.title')}
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="w-64 bg-black/20 border-r border-white/10 flex flex-col py-4">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'w-full px-6 py-3 text-sm font-medium transition-all flex items-center gap-3 relative',
                        activeTab === tab.id
                          ? 'text-blue-400 bg-white/5'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                      )}
                    >
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="activeTabIndicator"
                          className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"
                        />
                      )}
                      <Icon size={18} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Content */}
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
                {activeTab === 'general' && (
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
                )}

                {activeTab === 'appearance' && (
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
                )}

                {activeTab === 'advanced' && (
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
                              onChange={(e) =>
                                setShowTopLevelResults(e.target.checked)
                              }
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
                              onChange={(e) =>
                                setAlignResults(e.target.checked)
                              }
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
                              onChange={(e) =>
                                setShowUndefined(e.target.checked)
                              }
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
                              onChange={(e) =>
                                setLoopProtection(e.target.checked)
                              }
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
                )}

                {/* Placeholder for other tabs */}
                {['compilation', 'formatting', 'ai', 'npm'].includes(
                  activeTab
                ) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-full text-gray-500"
                  >
                    Coming soon...
                  </motion.div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                {t('settings.close')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
