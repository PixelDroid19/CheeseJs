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
import { useThemeColors } from '../../hooks/useThemeColors'
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
  const colors = useThemeColors()

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={clsx(
              "max-w-4xl w-full mx-4 h-[600px] max-h-[90vh] flex rounded-xl shadow-2xl overflow-hidden border",
              colors.bg,
              colors.text,
              colors.border
            )}
          >
            {/* Sidebar */}
            <div className={clsx(
              "w-72 flex flex-col py-6 border-r",
              colors.sidebarBg,
              colors.border
            )}>
              <h2 className={clsx("px-6 mb-8 text-xl font-bold", colors.text)}>
                {t('settings.title')}
              </h2>
              
              <div className="space-y-1 px-3">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'w-full px-4 py-3 text-sm font-medium rounded-md transition-all flex items-center gap-3',
                        isActive
                          ? clsx(colors.isDark ? "bg-[#2B2D31] text-blue-400" : "bg-gray-100 text-blue-600")
                          : clsx(colors.textSecondary, "hover:bg-opacity-50", colors.hover)
                      )}
                    >
                      <Icon size={20} className={isActive ? "text-blue-400" : "opacity-70"} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className={clsx(
                "flex items-center justify-between px-8 py-6 border-b",
                colors.border,
                colors.bg
              )}>
                <h3 className={clsx("text-lg font-semibold", colors.text)}>
                  {tabs.find(t => t.id === activeTab)?.label}
                </h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className={clsx(
                    "p-1 rounded-md transition-colors",
                    colors.hover,
                    colors.textSecondary
                  )}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className={clsx("flex-1 overflow-y-auto p-8 custom-scrollbar", colors.bg)}>
                {activeTab === 'general' && <GeneralTab />}
                {activeTab === 'appearance' && <AppearanceTab />}
                {activeTab === 'advanced' && <AdvancedTab />}

                {/* Placeholder for other tabs */}
                {['compilation', 'formatting', 'ai'].includes(activeTab) && (
                  <div className={clsx("flex flex-col items-center justify-center h-64 opacity-50", colors.textSecondary)}>
                    <Package size={48} className="mb-4 opacity-20" />
                    <p>Coming soon...</p>
                  </div>
                )}

                {/* NPM Package Manager */}
                {activeTab === 'npm' && (
                  <div className="h-full">
                    <PackageManager />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

