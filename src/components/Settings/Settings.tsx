import React, { useState } from 'react';
import { PackageManager } from '../PackageManager';
import { PythonPackageManager } from '../PythonPackageManager';
import {
  X,
  Sliders,
  Cpu,
  AlignLeft,
  Palette,
  Bot,
  Package,
  Wrench,
  FileCode,
  Bug,
  Puzzle,
  Store,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GeneralTab } from './tabs/GeneralTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { AdvancedTab } from './tabs/AdvancedTab';
import { SnippetsTab } from './tabs/SnippetsTab';
import { PluginTab } from './tabs/PluginTab';
import { MarketplaceTab } from './tabs/MarketplaceTab';

type Tab =
  | 'general'
  | 'compilation'
  | 'formatting'
  | 'appearance'
  | 'ai'
  | 'npm'
  | 'pypi'
  | 'snippets'
  | 'plugins'
  | 'marketplace'
  | 'advanced';

export default function Settings() {
  const { t } = useTranslation();
  const { isSettingsOpen, setIsSettingsOpen } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<Tab>('advanced');

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: t('settings.categories.general'), icon: Sliders },
    {
      id: 'compilation',
      label: t('settings.categories.compilation'),
      icon: Cpu,
    },
    {
      id: 'formatting',
      label: t('settings.categories.formatting'),
      icon: AlignLeft,
    },
    {
      id: 'appearance',
      label: t('settings.categories.appearance'),
      icon: Palette,
    },
    {
      id: 'snippets',
      label: t('settings.categories.snippets', 'Snippets'),
      icon: FileCode,
    },
    { id: 'ai', label: t('settings.categories.ai'), icon: Bot },
    { id: 'npm', label: t('settings.categories.npm'), icon: Package },
    {
      id: 'pypi',
      label: t('settings.categories.pypi', 'PyPI (Python)'),
      icon: Bug,
    },
    {
      id: 'plugins',
      label: t('settings.categories.plugins', 'Plugins'),
      icon: Puzzle,
    },
    {
      id: 'marketplace',
      label: t('settings.categories.marketplace', 'Marketplace'),
      icon: Store,
    },
    { id: 'advanced', label: t('settings.categories.advanced'), icon: Wrench },
  ];

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={clsx(
              'settings-modal max-w-4xl w-full mx-4 h-[600px] max-h-[90vh] flex rounded-xl shadow-2xl overflow-hidden border',
              'bg-background text-foreground border-border'
            )}
          >
            {/* Sidebar */}
            <div
              className={clsx(
                'w-72 flex flex-col py-6 border-r',
                'bg-muted/30 border-border'
              )}
            >
              <h2
                className={clsx('px-6 mb-8 text-xl font-bold text-foreground')}
              >
                {t('settings.title')}
              </h2>

              <div className="space-y-1 px-3">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'settings-sidebar-item w-full px-4 py-3 text-sm font-medium rounded-md transition-all flex items-center gap-3',
                        isActive
                          ? 'bg-accent text-accent-foreground active'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                      )}
                    >
                      <Icon
                        className={clsx(
                          'w-5 h-5',
                          isActive ? 'text-primary' : 'opacity-70'
                        )}
                      />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
              <div
                className={clsx(
                  'flex items-center justify-between px-8 py-6 border-b',
                  'border-border'
                )}
              >
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {tabs.find((t) => t.id === activeTab)?.label}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(`settings.descriptions.${activeTab}`)}
                  </p>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className={clsx(
                    'p-2 rounded-full transition-colors',
                    'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl space-y-8">
                  {activeTab === 'general' && <GeneralTab />}
                  {activeTab === 'appearance' && <AppearanceTab />}
                  {activeTab === 'npm' && <PackageManager />}
                  {activeTab === 'pypi' && <PythonPackageManager />}
                  {activeTab === 'advanced' && <AdvancedTab />}
                  {activeTab === 'snippets' && <SnippetsTab />}
                  {activeTab === 'plugins' && <PluginTab />}
                  {activeTab === 'marketplace' && <MarketplaceTab />}

                  {/* Placeholders for other tabs */}
                  {['compilation', 'formatting', 'ai'].includes(activeTab) && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Wrench className="w-12 h-12 mb-4 opacity-20" />
                      <p>{t('common.comingSoon')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
