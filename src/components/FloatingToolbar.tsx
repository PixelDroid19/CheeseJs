import React from 'react'
import { motion } from 'framer-motion'
import { Play, Settings, Brush, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { useSettingsStore } from '../store/useSettingsStore'
import { useCodeStore } from '../store/useCodeStore'
import { SnippetsMenu } from './SnippetsMenu'
import clsx from 'clsx'

export default function FloatingToolbar() {
  const { t } = useTranslation()
  const { runCode } = useCodeRunner()
  const toggleSettings = useSettingsStore((state) => state.toggleSettings)
  const isExecuting = useCodeStore((state) => state.isExecuting)

  const handleLint = () => {
    window.dispatchEvent(new CustomEvent('trigger-format'))
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex items-center gap-1 px-2 py-2 bg-white dark:bg-[#2c313a] rounded-full shadow-2xl border border-gray-200 dark:border-gray-700"
      >
        <ToolbarButton
          icon={isExecuting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          onClick={() => runCode()}
          label={t('toolbar.run')}
          isActive={isExecuting}
          disabled={isExecuting}
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
  isActive = false,
  disabled = false
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
      onClick={disabled ? undefined : onClick}
      className={clsx(
        'p-3 rounded-full transition-colors relative group',
        disabled && 'cursor-not-allowed opacity-70',
        !disabled && 'hover:bg-gray-100 dark:hover:bg-gray-600',
        isActive ? 'text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' : 'text-gray-600 dark:text-gray-300'
      )}
      title={label}
      disabled={disabled}
    >
      {icon}
    </motion.button>
  )
}
