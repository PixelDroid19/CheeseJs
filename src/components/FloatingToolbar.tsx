import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Settings, Brush, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCodeRunner } from '../hooks/useCodeRunner';
import { useSettingsStore } from '../store/useSettingsStore';
import { useRuntimeStatus } from '../hooks/useRuntimeStatus';
import { useLanguageStore } from '../store/useLanguageStore';
import { SnippetsMenu } from './SnippetsMenu';
import clsx from 'clsx';

export default function FloatingToolbar() {
  const { t } = useTranslation();
  const { runCode } = useCodeRunner();
  const toggleSettings = useSettingsStore((state) => state.toggleSettings);
  const currentLanguage = useLanguageStore((state) => state.currentLanguage);
  const { isLoading, message } = useRuntimeStatus(
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
              <span className="whitespace-nowrap text-amber-500/80">
                {message || 'Loading Python...'}
              </span>
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
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.1 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
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
    </motion.button>
  );
}
