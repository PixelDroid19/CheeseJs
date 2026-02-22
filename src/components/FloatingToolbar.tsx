import { m, AnimatePresence } from 'framer-motion';
import {
  Play,
  Settings,
  Brush,
  Loader2,
  Database as DatabaseIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCodeRunner } from '../hooks/useCodeRunner';
import { useSettingsStore } from '../store/useSettingsStore';
import { useRuntimeStatus } from '../hooks/useRuntimeStatus';
import { useLanguageStore } from '../store/useLanguageStore';
import { useRagStore } from '../store/useRagStore';
import { useCodeStore } from '../store/useCodeStore';
import { usePackagesStore } from '../store/usePackagesStore';
import { usePythonPackagesStore } from '../store/usePythonPackagesStore';
import { SnippetsMenu } from './SnippetsMenu';
import clsx from 'clsx';

export default function FloatingToolbar() {
  const { t } = useTranslation();
  const { runCode } = useCodeRunner();
  const toggleSettings = useSettingsStore((state) => state.toggleSettings);
  const currentLanguage = useLanguageStore((state) => state.currentLanguage);
  const setModalOpen = useRagStore((state) => state.setModalOpen);
  const { isLoading: isRuntimeLoading, message: runtimeMessage } = useRuntimeStatus(
    currentLanguage === 'python' ? 'python' : 'javascript'
  );

  const isExecuting = useCodeStore((state) => state.isExecuting);
  const isPendingRun = useCodeStore((state) => state.isPendingRun);

  const packages = usePackagesStore((state) => state.packages);
  const pythonPackages = usePythonPackagesStore((state) => state.packages);
  const isInstallingPackage =
    packages.some((p) => p.installing) || pythonPackages.some((p) => p.installing);

  const isBusy =
    (isRuntimeLoading && currentLanguage === 'python') ||
    isExecuting ||
    isPendingRun ||
    isInstallingPackage;

  let busyMessage = '';
  if (isInstallingPackage) {
    busyMessage = 'Installing packages...';
  } else if (isRuntimeLoading && currentLanguage === 'python') {
    busyMessage = runtimeMessage || 'Loading Python...';
  } else if (isExecuting || isPendingRun) {
    busyMessage = 'Running code...';
  }

  const handleLint = () => {
    window.dispatchEvent(new CustomEvent('trigger-format'));
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <m.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex items-center gap-1 px-2 py-2 bg-card rounded-full shadow-2xl border border-border"
        role="toolbar"
        aria-label={t('toolbar.label', 'Main toolbar')}
      >
        {/* Loading indicator */}
        <AnimatePresence>
          {isBusy && (
            <m.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2 px-3 text-xs text-muted-foreground"
            >
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span className="whitespace-nowrap text-amber-500/80">
                {busyMessage}
              </span>
            </m.div>
          )}
        </AnimatePresence>

        <ToolbarButton
          icon={<Play className="w-5 h-5" />}
          onClick={() => runCode()}
          label={t('toolbar.run')}
          disabled={isBusy}
          testId="run-button"
        />
        <SnippetsMenu />
        <ToolbarButton
          icon={<Brush className="w-5 h-5" />}
          onClick={handleLint}
          label={t('toolbar.format')}
        />
        <ToolbarButton
          icon={<Settings className="w-5 h-5" />}
          onClick={toggleSettings}
          label={t('toolbar.settings')}
          testId="settings-button"
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ToolbarButton
          icon={<DatabaseIcon className="w-5 h-5" />}
          onClick={() => setModalOpen(true)}
          label="Knowledge Base"
        />
      </m.div>
    </div>
  );
}

function ToolbarButton({
  icon,
  onClick,
  label,
  isActive = false,
  disabled = false,
  testId,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <m.button
      whileHover={disabled ? {} : { scale: 1.1 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={clsx(
        'p-3 rounded-full transition-colors relative group',
        disabled
          ? 'text-muted-foreground/50 cursor-not-allowed'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
    >
      {icon}
    </m.button>
  );
}
