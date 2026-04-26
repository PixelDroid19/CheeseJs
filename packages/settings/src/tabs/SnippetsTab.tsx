import { useState, type MouseEvent, type SyntheticEvent } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Snippet } from '@cheesejs/core';
import { SectionHeader } from '@cheesejs/ui';

export interface SnippetsTabProps {
  addSnippet: (snippet: Omit<Snippet, 'id'>) => void;
  currentCode: string;
  onAppendSnippet: (snippet: Snippet) => void;
  onLoadSnippet: (snippet: Snippet) => void;
  removeSnippet: (id: string) => void;
  snippets: Snippet[];
  updateSnippet: (id: string, updates: Partial<Omit<Snippet, 'id'>>) => void;
}

export function SnippetsTab({
  addSnippet,
  currentCode,
  onAppendSnippet,
  onLoadSnippet,
  removeSnippet,
  snippets,
  updateSnippet,
}: SnippetsTabProps) {
  const { t } = useTranslation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editedCode, setEditedCode] = useState('');
  const [isEditingCode, setIsEditingCode] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [newSnippetName, setNewSnippetName] = useState('');
  const [newSnippetCode, setNewSnippetCode] = useState('');

  const handleSaveNew = () => {
    if (newSnippetName.trim() && newSnippetCode.trim()) {
      addSnippet({
        name: newSnippetName.trim(),
        code: newSnippetCode,
      });
      setIsCreating(false);
      setNewSnippetName('');
      setNewSnippetCode('');
    }
  };

  const handleLoad = (snippet: Snippet) => {
    if (
      confirm(
        t('settings.snippets.confirmLoad', 'Replace current code with snippet?')
      )
    ) {
      onLoadSnippet(snippet);
    }
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const startEditingName = (snippet: Snippet, event: MouseEvent) => {
    event.stopPropagation();
    setEditingId(snippet.id);
    setEditName(snippet.name);
  };

  const saveEditingName = (event?: MouseEvent) => {
    event?.stopPropagation();
    if (editingId && editName.trim()) {
      updateSnippet(editingId, { name: editName.trim() });
      setEditingId(null);
    }
  };

  const cancelEditingName = (event: SyntheticEvent) => {
    event.stopPropagation();
    setEditingId(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setIsEditingCode(false);
    } else {
      setExpandedId(id);
      setIsEditingCode(false);
      const snippet = snippets.find((entry) => entry.id === id);
      if (snippet) {
        setEditedCode(snippet.code);
      }
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

      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            setIsCreating(true);
            setNewSnippetName('');
            setNewSnippetCode('');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-secondary/80 hover:bg-secondary text-secondary-foreground rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 text-sm font-medium border border-border/50"
        >
          <Plus size={16} />
          {t('settings.snippets.createNew', 'Create New')}
        </button>
        <button
          onClick={() => {
            setIsCreating(true);
            setNewSnippetName(`Snippet ${new Date().toLocaleString()}`);
            setNewSnippetCode(currentCode || '');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 text-sm font-medium"
        >
          <Save size={16} />
          {t('settings.snippets.saveCurrent', 'Save Current Code')}
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md space-y-5 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <h3 className="text-sm font-semibold relative flex items-center gap-2">
                <Plus size={16} className="text-primary" />
                Create New Snippet
              </h3>
              <div className="relative">
                <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                  Name
                </label>
                <input
                  value={newSnippetName}
                  onChange={(event) => setNewSnippetName(event.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border bg-black/20 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 border-border/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
                  placeholder="My Awesome Snippet"
                  autoFocus
                />
              </div>
              <div className="flex-1 flex flex-col relative">
                <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                  Code
                </label>
                <textarea
                  value={newSnippetCode}
                  onChange={(event) => setNewSnippetCode(event.target.value)}
                  className="w-full h-32 p-4 text-[13px] leading-relaxed font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y bg-black/20 text-foreground border-border/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
                  placeholder="Paste or type code here..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 relative">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNew}
                  disabled={!newSnippetName.trim() || !newSnippetCode.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl transition-all shadow-md shadow-primary/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  <Save size={14} /> Save Snippet
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

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
                'rounded-xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md',
                expandedId === snippet.id
                  ? 'border-primary/30 ring-1 ring-primary/10'
                  : 'border-border/60 hover:border-border',
                'bg-card'
              )}
            >
              <div
                className={clsx(
                  'flex items-center justify-between p-3.5 cursor-pointer select-none transition-colors',
                  expandedId === snippet.id
                    ? 'bg-primary/5'
                    : 'hover:bg-muted/30'
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
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className={clsx(
                          'flex-1 px-2 py-1 text-sm rounded border focus:outline-none focus:ring-1 focus:ring-ring',
                          'bg-background',
                          'text-foreground',
                          'border-border'
                        )}
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveEditingName();
                          if (event.key === 'Escape') cancelEditingName(event);
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
                        onClick={(event) => startEditingName(snippet, event)}
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

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onAppendSnippet(snippet);
                    }}
                    className={clsx(
                      'p-2 rounded-lg transition-all',
                      'text-muted-foreground',
                      'hover:bg-success/10 hover:text-success hover:scale-105'
                    )}
                    title={t('settings.snippets.append', 'Append to Editor')}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleLoad(snippet);
                    }}
                    className={clsx(
                      'p-2 rounded-lg transition-all',
                      'text-foreground',
                      'hover:bg-info/10 hover:text-info hover:scale-105'
                    )}
                    title={t(
                      'settings.snippets.load',
                      'Replace Editor Content'
                    )}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      removeSnippet(snippet.id);
                    }}
                    className={clsx(
                      'p-2 rounded-lg transition-all',
                      'text-muted-foreground',
                      'hover:bg-destructive/10 hover:text-destructive hover:scale-105'
                    )}
                    title={t('settings.snippets.delete', 'Delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === snippet.id && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className={clsx(
                        'p-4 border-t',
                        'border-border/40 bg-zinc-950'
                      )}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span
                          className={clsx(
                            'text-[11px] font-mono tracking-wider uppercase',
                            'text-zinc-500'
                          )}
                        >
                          {snippet.code.length} chars
                        </span>
                        <div className="flex gap-2">
                          {isEditingCode ? (
                            <>
                              <button
                                onClick={() => saveCode(snippet.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-black bg-blue-400 hover:bg-blue-300 rounded-lg transition-colors"
                              >
                                <Save size={12} /> Save
                              </button>
                              <button
                                onClick={() => {
                                  setIsEditingCode(false);
                                  setEditedCode(snippet.code);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
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
                                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10'
                                )}
                              >
                                <Edit2 size={12} /> Edit Code
                              </button>
                              <button
                                onClick={() => handleCopy(snippet.code)}
                                className={clsx(
                                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10'
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
                          onChange={(event) =>
                            setEditedCode(event.target.value)
                          }
                          className={clsx(
                            'w-full h-48 p-4 text-[13px] leading-relaxed font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y transition-all shadow-inner',
                            'bg-zinc-900',
                            'text-zinc-100',
                            'border-zinc-800'
                          )}
                          spellCheck={false}
                        />
                      ) : (
                        <pre
                          className={clsx(
                            'w-full p-4 text-[13px] leading-relaxed font-mono rounded-xl border overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto selection:bg-blue-500/30',
                            'bg-zinc-900 shadow-inner',
                            'border-zinc-800',
                            'text-zinc-300'
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
