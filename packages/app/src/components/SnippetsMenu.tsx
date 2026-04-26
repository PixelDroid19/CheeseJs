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
import { useEditorTabsStore } from '../store/storeHooks';
import clsx from 'clsx';

export function SnippetsMenu() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'list' | 'add'>('list');
  const [newSnippetName, setNewSnippetName] = useState('');
  const [newSnippetCode, setNewSnippetCode] = useState('');
  const { snippets, addSnippet, removeSnippet } = useSnippetsStore();
  const { tabs, activeTabId, updateTabCode } = useEditorTabsStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

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
      setNewSnippetCode('');
    }
    setIsOpen(!isOpen);
  };

  const handleSave = () => {
    if (newSnippetName.trim() && newSnippetCode.trim()) {
      addSnippet({ name: newSnippetName.trim(), code: newSnippetCode });
      setView('list');
      setNewSnippetName('');
      setNewSnippetCode('');
    }
  };

  const handleLoad = (snippet: Snippet) => {
    // Removed confirm dialog to prevent focus stealing issues
    if (activeTabId) updateTabCode(activeTabId, snippet.code);
    setIsOpen(false);
  };

  const handleAppend = (snippet: Snippet) => {
    if (activeTabId && activeTab) {
      updateTabCode(activeTabId, activeTab.code + '\n' + snippet.code);
    }
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
                className="bg-popover/95 backdrop-blur-xl rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-border/50 flex flex-col overflow-hidden ring-1 ring-white/5"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              >
                {/* Header */}
                <div className="p-4 border-b border-border/40 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent">
                  {view === 'add' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setView('list')}
                        className="p-1 -ml-1 rounded-md hover:bg-white/10 hover:text-foreground transition-colors"
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
                        onClick={() => {
                          setView('add');
                          setNewSnippetCode(activeTab?.code || '');
                        }}
                        className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors"
                        title={t('settings.snippets.add', 'Add Snippet')}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
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
                          className="w-full px-4 py-2.5 rounded-xl border border-border/50 bg-black/20 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-inner"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') setView('list');
                          }}
                        />
                      </div>

                      <div className="flex-1 flex flex-col min-h-[140px]">
                        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                          {t('common.code', 'Snippet Code')}
                        </label>
                        <textarea
                          value={newSnippetCode}
                          onChange={(e) => setNewSnippetCode(e.target.value)}
                          placeholder="Paste or type code here..."
                          className="flex-1 w-full p-4 font-mono text-[11px] leading-relaxed rounded-xl border border-border/50 bg-black/20 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-y shadow-inner"
                        />
                      </div>

                      <div className="pt-3 flex gap-2">
                        <button
                          onClick={handleSave}
                          disabled={
                            !newSnippetName.trim() || !newSnippetCode.trim()
                          }
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl font-medium transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
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
                            onClick={() => {
                              setView('add');
                              setNewSnippetCode(activeTab?.code || '');
                            }}
                            className="mt-4 px-4 py-2 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                          >
                            Create your first snippet
                          </button>
                        </div>
                      ) : (
                        snippets.map((snippet) => (
                          <div
                            key={snippet.id}
                            className="group p-3 mb-1 rounded-xl border border-transparent hover:border-border/60 hover:bg-white/5 hover:-translate-y-0.5 transition-all shadow-sm hover:shadow-md"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm text-foreground truncate drop-shadow-sm">
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

                            <div className="relative group/code rounded-lg overflow-hidden border border-border/40 shadow-inner">
                              <pre className="text-[11px] leading-relaxed font-mono text-muted-foreground bg-black/40 p-3 line-clamp-3">
                                {snippet.code}
                              </pre>
                              {/* Overlay actions */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/code:opacity-100 transition-opacity duration-300 flex items-end justify-end p-2 gap-2 backdrop-blur-[1px]">
                                <button
                                  onClick={() => handleAppend(snippet)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg shadow-sm border border-white/10 backdrop-blur-md transition-all hover:scale-105"
                                >
                                  <Plus size={12} />
                                  {t('settings.snippets.append', 'Append')}
                                </button>
                                <button
                                  onClick={() => handleLoad(snippet)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary/80 hover:bg-primary rounded-lg shadow-sm border border-primary/20 backdrop-blur-md transition-all hover:scale-105"
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
