import React, { useState } from 'react'
import { PackageManager } from '../PackageManager'
import {
  X,
  Sliders,
  Cpu,
  AlignLeft,
  Palette,
  Bot,
  Package,
  Wrench
} from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore'
import clsx from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { GeneralTab } from './tabs/GeneralTab'
import { AppearanceTab } from './tabs/AppearanceTab'
import { AdvancedTab } from './tabs/AdvancedTab'

type Tab =
  | 'general'
  | 'compilation'
  | 'formatting'
  | 'appearance'
  | 'ai'
  | 'npm'
  | 'advanced';

export default function Settings () {
  const { t } = useTranslation()
  const { isSettingsOpen, setIsSettingsOpen } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<Tab>('advanced')

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
                {activeTab === 'general' && <GeneralTab />}
                {activeTab === 'appearance' && <AppearanceTab />}
                {activeTab === 'advanced' && <AdvancedTab />}

                {/* Placeholder for other tabs */}
                {['compilation', 'formatting', 'ai'].includes(activeTab) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-full text-gray-500"
                  >
                    Coming soon...
                  </motion.div>
                )}

                {/* NPM Package Manager */}
                {activeTab === 'npm' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full"
                  >
                    <PackageManager />
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
