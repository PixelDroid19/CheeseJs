import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Trash2, Play, Edit2, Save, X } from 'lucide-react'
import { useSnippetsStore, Snippet } from '../../../store/useSnippetsStore'
import { useCodeStore } from '../../../store/useCodeStore'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { useThemeColors } from '../../../hooks/useThemeColors'
import { SectionHeader } from '../ui/SectionHeader'
import clsx from 'clsx'

export function SnippetsTab() {
  const { t } = useTranslation()
  const colors = useThemeColors()
  const { snippets, addSnippet, removeSnippet, updateSnippet } = useSnippetsStore()
  const { code, setCode } = useCodeStore()
  const { toggleSettings } = useSettingsStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleSaveCurrent = () => {
    addSnippet({
      name: `Snippet ${new Date().toLocaleString()}`,
      code: code
    })
  }

  const handleLoad = (snippet: Snippet) => {
    if (confirm(t('settings.snippets.confirmLoad', 'Replace current code with snippet?'))) {
      setCode(snippet.code)
      toggleSettings() // Close settings to see the code
    }
  }

  const startEditing = (snippet: Snippet) => {
    setEditingId(snippet.id)
    setEditName(snippet.name)
  }

  const saveEditing = () => {
    if (editingId && editName.trim()) {
      updateSnippet(editingId, { name: editName.trim() })
      setEditingId(null)
    }
  }

  const cancelEditing = () => {
    setEditingId(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 h-full flex flex-col"
    >
      <div>
        <SectionHeader title={t('settings.categories.snippets', 'Snippets')} />
        <p className={clsx("text-sm mt-2", colors.textSecondary)}>
          {t('settings.snippets.description', 'Save frequently used code snippets for quick access.')}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveCurrent}
          className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors text-sm font-medium"
        >
          <Save size={16} />
          {t('settings.snippets.saveCurrent', 'Save Current Code')}
        </button>
      </div>

      <div className={clsx(
        "flex-1 overflow-y-auto rounded-md border p-2 space-y-2",
        colors.inputBg,
        colors.border
      )}>
        {snippets.length === 0 ? (
          <div className={clsx("h-full flex flex-col items-center justify-center text-center p-4", colors.textSecondary)}>
            <p>{t('settings.snippets.empty', 'No snippets saved yet.')}</p>
          </div>
        ) : (
          snippets.map((snippet) => (
            <div
              key={snippet.id}
              className={clsx(
                "flex items-center justify-between p-3 rounded-md border transition-colors",
                colors.border,
                colors.isDark ? "bg-[#2c313a] hover:bg-[#353a45]" : "bg-white hover:bg-gray-50"
              )}
            >
              <div className="flex-1 min-w-0 mr-4">
                {editingId === snippet.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={clsx(
                        "flex-1 px-2 py-1 text-sm rounded border focus:outline-none focus:ring-1 focus:ring-blue-500",
                        colors.inputBg,
                        colors.text,
                        colors.border
                      )}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing()
                        if (e.key === 'Escape') cancelEditing()
                      }}
                    />
                    <button onClick={saveEditing} className="text-green-500 hover:text-green-600">
                        <Save className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEditing} className="text-red-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span className={clsx("text-sm font-medium truncate", colors.text)}>
                      {snippet.name}
                    </span>
                    <button 
                        onClick={() => startEditing(snippet)}
                        className={clsx("opacity-0 group-hover:opacity-100 transition-opacity", colors.textSecondary)}
                    >
                        <Edit2 size={12} />
                    </button>
                  </div>
                )}
                <div className={clsx("text-xs truncate mt-1 font-mono opacity-60", colors.textSecondary)}>
                    {snippet.code.slice(0, 50).replace(/\n/g, ' ')}...
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLoad(snippet)}
                  className={clsx(
                    "p-2 rounded-md transition-colors",
                    colors.text,
                    "hover:bg-blue-500/10 hover:text-blue-500"
                  )}
                  title={t('settings.snippets.load', 'Load to Editor')}
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeSnippet(snippet.id)}
                  className={clsx(
                    "p-2 rounded-md transition-colors",
                    colors.textSecondary,
                    "hover:bg-red-500/10 hover:text-red-500"
                  )}
                  title={t('settings.snippets.delete', 'Delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}
