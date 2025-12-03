import React from 'react'
import { motion } from 'framer-motion'
import { Play, Settings, Brush } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { useSettingsStore } from '../store/useSettingsStore'
import { SnippetsMenu } from './SnippetsMenu'
import clsx from 'clsx'

export default function FloatingToolbar() {
  const { t } = useTranslation()
  const { runCode } = useCodeRunner()
  const toggleSettings = useSettingsStore((state) => state.toggleSettings)

  const handleLint = () => {
    window.dispatchEvent(new CustomEvent('trigger-format'))
  }

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
        <ToolbarButton
          icon={<Play className="w-5 h-5" />}
          onClick={() => runCode()}
          label={t('toolbar.run')}
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
  )
}

function ToolbarButton({
  icon,
  onClick,
  label,
  isActive = false
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  isActive?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={clsx(
        'p-3 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors relative group'
      )}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
    >
      {icon}
    </motion.button>
  )
}
