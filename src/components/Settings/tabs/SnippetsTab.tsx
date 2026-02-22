import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  Play,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
} from 'lucide-react';
import { useSnippetsStore, Snippet } from '../../../store/storeHooks';
import { useCodeStore } from '../../../store/storeHooks';
import { useSettingsStore } from '../../../store/storeHooks';
import { SectionHeader } from '../ui/SectionHeader';
import clsx from 'clsx';

export function SnippetsTab() {
  const { t } = useTranslation();
  const { snippets, addSnippet, removeSnippet, updateSnippet } =
    useSnippetsStore();
  const { code, setCode } = useCodeStore();
  const { toggleSettings } = useSettingsStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editedCode, setEditedCode] = useState('');
  const [isEditingCode, setIsEditingCode] = useState(false);

  const handleSaveCurrent = () => {
    addSnippet({
      name: `Snippet ${new Date().toLocaleString()}`,
      code: code,
    });
  };

  const handleLoad = (snippet: Snippet) => {
    if (
      confirm(
        t('settings.snippets.confirmLoad', 'Replace current code with snippet?')
      )
    ) {
      setCode(snippet.code);
      toggleSettings(); // Close settings to see the code
    }
  };

  const handleAppend = (snippet: Snippet) => {
    setCode(code + '\n' + snippet.code);
    toggleSettings();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const startEditingName = (snippet: Snippet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(snippet.id);
    setEditName(snippet.name);
  };

  const saveEditingName = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingId && editName.trim()) {
      updateSnippet(editingId, { name: editName.trim() });
      setEditingId(null);
    }
  };

  const cancelEditingName = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setIsEditingCode(false);
    } else {
      setExpandedId(id);
      setIsEditingCode(false);
      const snippet = snippets.find((s) => s.id === id);
      if (snippet) setEditedCode(snippet.code);
    }
  };

  const saveCode = (id: string) => {
    updateSnippet(id, { code: editedCode });
    setIsEditingCode(false);
  };

  return (
    <m.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 h-full flex flex-col"
    >
      <div>
        <SectionHeader title={t('settings.categories.snippets', 'Snippets')} />
        <p className={clsx('text-sm mt-2', 'text-muted-foreground')}>
          {t(
            'settings.snippets.description',
            'Save frequently used code snippets for quick access.'
          )}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveCurrent}
          className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors text-sm font-medium"
        >
          <Save size={16} />
          {t('settings.snippets.saveCurrent', 'Save Current Code')}
        </button>
      </div>

      <div
        className={clsx(
          'flex-1 overflow-y-auto rounded-md border p-2 space-y-2',
          'bg-background',
          'border-border'
        )}
      >
        {snippets.length === 0 ? (
          <div
            className={clsx(
              'h-full flex flex-col items-center justify-center text-center p-4',
              'text-muted-foreground'
            )}
          >
            <p>{t('settings.snippets.empty', 'No snippets saved yet.')}</p>
          </div>
        ) : (
          snippets.map((snippet) => (
            <div
              key={snippet.id}
              className={clsx(
                'rounded-md border transition-all duration-200 overflow-hidden',
                'border-border',
                'bg-card'
              )}
            >
              {/* Header */}
              <div
                className={clsx(
                  'flex items-center justify-between p-3 cursor-pointer select-none',
                  'hover:bg-muted/50'
                )}
                onClick={() => toggleExpand(snippet.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {expandedId === snippet.id ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}

                  {editingId === snippet.id ? (
                    <div
                      className="flex items-center gap-2 flex-1 mr-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={clsx(
                          'flex-1 px-2 py-1 text-sm rounded border focus:outline-none focus:ring-1 focus:ring-ring',
                          'bg-background',
                          'text-foreground',
                          'border-border'
                        )}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditingName();
                          if (e.key === 'Escape') cancelEditingName(e);
                        }}
                      />
                      <button
                        onClick={saveEditingName}
                        className="text-success hover:text-success/90"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEditingName}
                        className="text-destructive hover:text-destructive/90"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group flex-1">
                      <span
                        className={clsx(
                          'text-sm font-medium truncate',
                          'text-foreground'
                        )}
                      >
                        {snippet.name}
                      </span>
                      <button
                        onClick={(e) => startEditingName(snippet, e)}
                        className={clsx(
                          'opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded',
                          'text-muted-foreground'
                        )}
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAppend(snippet);
                    }}
                    className={clsx(
                      'p-2 rounded-md transition-colors',
                      'text-muted-foreground',
                      'hover:bg-success/10 hover:text-success'
                    )}
                    title={t('settings.snippets.append', 'Append to Editor')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoad(snippet);
                    }}
                    className={clsx(
                      'p-2 rounded-md transition-colors',
                      'text-foreground',
                      'hover:bg-info/10 hover:text-info'
                    )}
                    title={t(
                      'settings.snippets.load',
                      'Replace Editor Content'
                    )}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSnippet(snippet.id);
                    }}
                    className={clsx(
                      'p-2 rounded-md transition-colors',
                      'text-muted-foreground',
                      'hover:bg-destructive/10 hover:text-destructive'
                    )}
                    title={t('settings.snippets.delete', 'Delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              <AnimatePresence>
                {expandedId === snippet.id && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={clsx('p-3 border-t', 'border-border')}>
                      <div className="flex justify-between items-center mb-2">
                        <span
                          className={clsx(
                            'text-xs font-mono opacity-70',
                            'text-muted-foreground'
                          )}
                        >
                          {snippet.code.length} chars
                        </span>
                        <div className="flex gap-2">
                          {isEditingCode ? (
                            <>
                              <button
                                onClick={() => saveCode(snippet.id)}
                                className="flex items-center gap-1 text-xs text-green-500 hover:text-green-600"
                              >
                                <Save size={12} /> Save
                              </button>
                              <button
                                onClick={() => {
                                  setIsEditingCode(false);
                                  setEditedCode(snippet.code);
                                }}
                                className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/90"
                              >
                                <X size={12} /> Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setIsEditingCode(true);
                                  setEditedCode(snippet.code);
                                }}
                                className={clsx(
                                  'flex items-center gap-1 text-xs hover:text-blue-500',
                                  'text-muted-foreground'
                                )}
                              >
                                <Edit2 size={12} /> Edit Code
                              </button>
                              <button
                                onClick={() => handleCopy(snippet.code)}
                                className={clsx(
                                  'flex items-center gap-1 text-xs hover:text-blue-500',
                                  'text-muted-foreground'
                                )}
                              >
                                <Copy size={12} /> Copy
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditingCode ? (
                        <textarea
                          value={editedCode}
                          onChange={(e) => setEditedCode(e.target.value)}
                          className={clsx(
                            'w-full h-32 p-2 text-xs font-mono rounded border focus:outline-none focus:ring-1 focus:ring-ring resize-y',
                            'bg-background',
                            'text-foreground',
                            'border-border'
                          )}
                        />
                      ) : (
                        <pre
                          className={clsx(
                            'w-full p-2 text-xs font-mono rounded border overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto',
                            'bg-muted',
                            'border-border',
                            'text-foreground'
                          )}
                        >
                          {snippet.code}
                        </pre>
                      )}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </m.div>
  );
}
