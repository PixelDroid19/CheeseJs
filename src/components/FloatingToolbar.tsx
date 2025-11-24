import { motion } from 'framer-motion'
import { Play, Settings, Brush } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { useSettingsStore } from '../store/useSettingsStore'
import clsx from 'clsx'

export default function FloatingToolbar () {
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
        className="flex items-center gap-1 px-2 py-2 bg-white dark:bg-[#2c313a] rounded-full shadow-2xl border border-gray-200 dark:border-gray-700"
      >
        <ToolbarButton icon={<Play size={20} />} onClick={() => runCode()} label={t('toolbar.run')} />
        <ToolbarButton icon={<Brush size={20} />} onClick={handleLint} label={t('toolbar.format')} />
        <ToolbarButton icon={<Settings size={20} />} onClick={toggleSettings} label={t('toolbar.settings')} />
      </motion.div>
    </div>
  )
}

function ToolbarButton ({ icon, onClick, label }: { icon: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={clsx(
        'p-3 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors relative group'
      )}
      title={label}
    >
      {icon}
    </motion.button>
  )
}
