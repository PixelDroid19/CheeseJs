import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'framer-motion';
import {
  Book,
  Play,
  Plus,
  X,
  Copy,
  Trash2,
  ChevronLeft,
  Save,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSnippetsStore, Snippet } from '../store/storeHooks';
import { useCodeStore } from '../store/storeHooks';
import clsx from 'clsx';

export function SnippetsMenu() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'list' | 'add'>('list');
  const [newSnippetName, setNewSnippetName] = useState('');
  const { snippets, addSnippet, removeSnippet } = useSnippetsStore();
  const { code, setCode } = useCodeStore();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  // Update position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        const rect = buttonRef.current!.getBoundingClientRect();
        setMenuStyle({
          position: 'fixed',
          bottom: window.innerHeight - rect.top + 16, // 16px offset from top of button
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
          zIndex: 9999,
          maxHeight: '30rem',
          width: '22rem',
        });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);

  const toggleOpen = () => {
    if (!isOpen) {
      setView('list');
      setNewSnippetName('');
    }
    setIsOpen(!isOpen);
  };

  const handleSave = () => {
    if (newSnippetName.trim()) {
      addSnippet({ name: newSnippetName.trim(), code });
      setView('list');
      setNewSnippetName('');
    }
  };

  const handleLoad = (snippet: Snippet) => {
    // Removed confirm dialog to prevent focus stealing issues
    setCode(snippet.code);
    setIsOpen(false);
  };

  const handleAppend = (snippet: Snippet) => {
    setCode(code + '\n' + snippet.code);
    setIsOpen(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Optional: show toast
  };

  return (
    <>
      <m.button
        ref={buttonRef}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleOpen}
        className={clsx(
          'p-3 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors relative group',
          isOpen && 'bg-accent text-primary'
        )}
        title={t('toolbar.snippets', 'Snippets')}
      >
        <Book className="w-5 h-5" />
      </m.button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => setIsOpen(false)}
              />

              {/* Menu */}
              <m.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={menuStyle}
                className="bg-popover rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              >
                {/* Header */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
                  {view === 'add' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setView('list')}
                        className="p-1 -ml-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <ChevronLeft
                          size={18}
                          className="text-muted-foreground"
                        />
                      </button>
                      <h3 className="font-semibold text-foreground">
                        {t('settings.snippets.add', 'New Snippet')}
                      </h3>
                    </div>
                  ) : (
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Book size={18} className="text-primary" />
                      {t('settings.categories.snippets', 'Snippets')}
                    </h3>
                  )}

                  <div className="flex items-center gap-1">
                    {view === 'list' && (
                      <button
                        onClick={() => setView('add')}
                        className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors"
                        title={t('settings.snippets.add', 'Add Snippet')}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px]">
                  {view === 'add' ? (
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                          {t('settings.snippets.name', 'Name')}
                        </label>
                        <input
                          type="text"
                          value={newSnippetName}
                          onChange={(e) => setNewSnippetName(e.target.value)}
                          placeholder="My Awesome Snippet"
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') setView('list');
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                          {t('common.preview', 'Code Preview')}
                        </label>
                        <div className="text-xs font-mono p-3 rounded-lg bg-muted text-muted-foreground border border-border max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {code || (
                            <span className="text-muted-foreground/50 italic">
                              No code to save
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={handleSave}
                          disabled={!newSnippetName.trim() || !code}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Save size={16} />
                          {t('common.save', 'Save Snippet')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {snippets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                          <Book className="w-12 h-12 mb-3 opacity-20" />
                          <p className="text-sm font-medium">No snippets yet</p>
                          <p className="text-xs opacity-70 mt-1">
                            Save your code to reuse it later
                          </p>
                          <button
                            onClick={() => setView('add')}
                            className="mt-4 px-4 py-2 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                          >
                            Create your first snippet
                          </button>
                        </div>
                      ) : (
                        snippets.map((snippet) => (
                          <div
                            key={snippet.id}
                            className="group p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm text-foreground truncate">
                                {snippet.name}
                              </span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleCopy(snippet.code)}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background shadow-sm"
                                  title={t('common.copy', 'Copy')}
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete snippet?'))
                                      removeSnippet(snippet.id);
                                  }}
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-background shadow-sm"
                                  title={t('common.delete', 'Delete')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="relative">
                              <pre className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded border border-border line-clamp-3 overflow-hidden">
                                {snippet.code}
                              </pre>
                              {/* Overlay actions */}
                              <div className="absolute inset-0 bg-gradient-to-t from-muted via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 gap-2">
                                <button
                                  onClick={() => handleAppend(snippet)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-secondary-foreground bg-secondary/80 hover:bg-secondary rounded shadow-sm hover:shadow hover:scale-105 transition-all"
                                >
                                  <Plus size={12} />
                                  {t('settings.snippets.append', 'Append')}
                                </button>
                                <button
                                  onClick={() => handleLoad(snippet)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-foreground bg-primary/80 hover:bg-primary rounded shadow-sm hover:shadow hover:scale-105 transition-all"
                                >
                                  <Play size={12} />
                                  {t('settings.snippets.load', 'Load')}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </m.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
