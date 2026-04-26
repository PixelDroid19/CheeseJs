import { useState, type ElementType } from 'react';
import { SettingsDialog } from '@cheesejs/frontend';
import { PackageManager } from '../PackageManager';
import { PythonPackageManager } from '../PythonPackageManager';
import {
  Sliders,
  Cpu,
  AlignLeft,
  Palette,
  Package,
  Wrench,
  FileCode,
  Bug,
  Code2,
} from 'lucide-react';
import { useSettingsStore } from '../../store/storeHooks';
import { useTranslation } from 'react-i18next';
import { GeneralTab } from './tabs/GeneralTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { AdvancedTab } from './tabs/AdvancedTab';
import { SnippetsTab } from './tabs/SnippetsTab';
import { CompilationTab } from './tabs/CompilationTab';
import { FormattingTab } from './tabs/FormattingTab';
import { LspTab } from './tabs/LspTab';

type Tab =
  | 'general'
  | 'compilation'
  | 'formatting'
  | 'appearance'
  | 'npm'
  | 'pypi'
  | 'snippets'
  | 'lsp'
  | 'advanced';

export default function Settings() {
  const { t } = useTranslation();
  const { isSettingsOpen, setIsSettingsOpen } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const tabs: { id: Tab; label: string; icon: ElementType }[] = [
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
    { id: 'npm', label: t('settings.categories.npm'), icon: Package },
    {
      id: 'pypi',
      label: t('settings.categories.pypi', 'PyPI (Python)'),
      icon: Bug,
    },
    {
      id: 'lsp',
      label: t('settings.categories.lsp', 'Inteligencia de código'),
      icon: Code2,
    },
    { id: 'advanced', label: t('settings.categories.advanced'), icon: Wrench },
  ];

  return (
    <SettingsDialog
      isOpen={isSettingsOpen}
      title={t('settings.title')}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={() => setIsSettingsOpen(false)}
      description={t(`settings.descriptions.${activeTab}`)}
    >
      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'compilation' && <CompilationTab />}
      {activeTab === 'formatting' && <FormattingTab />}
      {activeTab === 'appearance' && <AppearanceTab />}
      {activeTab === 'npm' && <PackageManager />}
      {activeTab === 'pypi' && <PythonPackageManager />}
      {activeTab === 'advanced' && <AdvancedTab />}
      {activeTab === 'snippets' && <SnippetsTab />}
      {activeTab === 'lsp' && <LspTab />}
    </SettingsDialog>
  );
}
