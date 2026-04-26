import { useState, type ElementType } from 'react';
import {
  createNpmPackageBridge,
  createPythonPackageBridge,
  NpmPackageManager,
  PythonPackageManager,
} from '@cheesejs/package-management';
import { SettingsDialog } from '@cheesejs/settings';
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
import {
  usePackagesStore,
  usePythonPackagesStore,
} from '../../store/storeHooks';
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

const npmBridge = createNpmPackageBridge(() => window.packageManager);
const pythonBridge = createPythonPackageBridge(
  () => window.pythonPackageManager
);

export default function Settings() {
  const { t } = useTranslation();
  const settingsStore = useSettingsStore();
  const { isSettingsOpen, setIsSettingsOpen } = settingsStore;
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const npmStore = usePackagesStore();
  const pythonStore = usePythonPackagesStore();

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
      {activeTab === 'npm' && (
        <NpmPackageManager
          bridge={npmBridge}
          settings={settingsStore}
          store={npmStore}
        />
      )}
      {activeTab === 'pypi' && (
        <PythonPackageManager bridge={pythonBridge} store={pythonStore} />
      )}
      {activeTab === 'advanced' && <AdvancedTab />}
      {activeTab === 'snippets' && <SnippetsTab />}
      {activeTab === 'lsp' && <LspTab />}
    </SettingsDialog>
  );
}
