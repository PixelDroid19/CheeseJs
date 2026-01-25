import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Settings,
  Loader2,
  FlaskConical,
  Brush,
  Columns,
  Rows,
  Terminal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCodeRunner } from '../hooks/useCodeRunner';
import { useSettingsStore } from '../store/useSettingsStore';
import { useRuntimeStatus } from '../hooks/useRuntimeStatus';
import { useLanguageStore } from '../store/useLanguageStore';
import { SnippetsMenu } from './SnippetsMenu';
import { CaptureControls } from './CaptureControls';
import clsx from 'clsx';

export default function FloatingToolbar() {
  const { t } = useTranslation();
  const { runCode } = useCodeRunner();
  const toggleSettings = useSettingsStore((state) => state.toggleSettings);
  const toggleTestPanel = useSettingsStore((state) => state.toggleTestPanel);
  const showTestPanel = useSettingsStore((state) => state.showTestPanel);
  const toggleConsole = useSettingsStore((state) => state.toggleConsole);
  const showConsole = useSettingsStore((state) => state.showConsole);
  const splitDirection = useSettingsStore((state) => state.splitDirection);
  const toggleSplitDirection = useSettingsStore(
    (state) => state.toggleSplitDirection
  );
  const currentLanguage = useLanguageStore((state) => state.currentLanguage);
  const { isLoading, message, status } = useRuntimeStatus(
    currentLanguage === 'python' ? 'python' : 'javascript'
  );

  const handleLint = () => {
    window.dispatchEvent(new CustomEvent('trigger-format'));
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex items-center gap-1 px-2 py-2 bg-card rounded-full shadow-2xl border border-border"
        role="toolbar"
        aria-label={t('toolbar.label', 'Main toolbar')}
      >
        {/* Loading indicator for Python */}
        <AnimatePresence>
          {isLoading && currentLanguage === 'python' && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-2 px-3 text-xs text-muted-foreground"
            >
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <div className="flex flex-col gap-1">
                <span className="whitespace-nowrap text-amber-500/80">
                  {message || 'Loading Python...'}
                </span>
                {status.progress > 0 && status.progress < 100 && (
                  <div className="w-24 bg-amber-500/20 rounded-full h-1">
                    <motion.div
                      className="bg-amber-500 h-1 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${status.progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ToolbarButton
          icon={<Play className="w-5 h-5" />}
          onClick={() => runCode()}
          label={t('toolbar.run')}
          disabled={isLoading && currentLanguage === 'python'}
        />
        <SnippetsMenu />

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        <CaptureControls />

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<FlaskConical className="w-5 h-5" />}
          onClick={toggleTestPanel}
          label={t('toolbar.tests', 'Tests')}
          isActive={showTestPanel}
          className={showTestPanel ? 'active' : ''}
        />

        <ToolbarButton
          icon={<Terminal className="w-5 h-5" />}
          onClick={toggleConsole}
          label={t('toolbar.console', 'Toggle Console')}
          isActive={showConsole}
          className={showConsole ? 'active' : ''}
        />

        <ToolbarButton
          icon={
            splitDirection === 'horizontal' ? (
              <Rows className="w-5 h-5" />
            ) : (
              <Columns className="w-5 h-5" />
            )
          }
          onClick={toggleSplitDirection}
          label={t('toolbar.toggleLayout', 'Toggle Layout')}
        />

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          icon={<Brush className="w-5 h-5" />}
          onClick={handleLint}
          label={t('toolbar.format')}
        />
        <ToolbarButton
          icon={<Settings className="w-5 h-5" />}
          onClick={toggleSettings}
          label={t('toolbar.settings')}
        />
      </motion.div>
    </div>
  );
}

function ToolbarButton({
  icon,
  onClick,
  label,
  isActive = false,
  disabled = false,
  className,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.1 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'p-3 rounded-full transition-colors relative group',
        className,
        disabled
          ? 'text-muted-foreground/50 cursor-not-allowed'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
    >
      {icon}
    </motion.button>
  );
}
