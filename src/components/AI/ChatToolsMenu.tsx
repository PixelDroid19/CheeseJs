import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code,
  Wrench,
  Database,
  Pin,
  PinOff,
  FileText,
  Globe,
  FolderCode,
  BookOpen,
} from 'lucide-react';
import clsx from 'clsx';
import { useRagStore } from '../../store/useRagStore';

interface ChatToolsMenuProps {
  includeCode: boolean;
  setIncludeCode: (value: boolean) => void;
  useAgent: boolean;
  setUseAgent: (value: boolean) => void;
  onInsertDocs: () => void;
  inputHasDocs: boolean;
}

export function ChatToolsMenu({
  includeCode,
  setIncludeCode,
  useAgent,
  setUseAgent,
  onInsertDocs,
  inputHasDocs,
}: ChatToolsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    documents,
    pinnedDocIds,
    togglePinnedDoc,
    clearPinnedDocs,
    loadDocuments,
  } = useRagStore();

  // Load documents when menu opens
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, loadDocuments]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'file':
        return FileText;
      case 'url':
        return Globe;
      case 'codebase':
        return FolderCode;
      default:
        return FileText;
    }
  };

  // Active features count
  // const activeCount = [includeCode, useAgent, pinnedDocIds.length > 0, inputHasDocs].filter(Boolean).length;

  return (
    <div className="relative" ref={menuRef}>
      {/* Compact Toggle Buttons */}
      <div className="flex items-center gap-1">
        {/* Quick Toggle: Code Context */}
        <button
          onClick={() => setIncludeCode(!includeCode)}
          className={clsx(
            'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all',
            includeCode
              ? 'bg-blue-500/10 text-blue-500'
              : 'text-muted-foreground hover:bg-muted'
          )}
          title={includeCode ? 'Code context enabled' : 'Code context disabled'}
        >
          <Code className="w-3 h-3" />
          <span className="hidden sm:inline">
            {includeCode ? 'Code' : 'Code'}
          </span>
        </button>

        {/* Quick Toggle: Agent Tools */}
        <button
          onClick={() => setUseAgent(!useAgent)}
          className={clsx(
            'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all',
            useAgent
              ? 'bg-amber-500/10 text-amber-500'
              : 'text-muted-foreground hover:bg-muted'
          )}
          title={useAgent ? 'Agent tools enabled' : 'Agent tools disabled'}
        >
          <Wrench className="w-3 h-3" />
          <span className="hidden sm:inline">Tools</span>
        </button>

        {/* Quick Toggle: @docs */}
        <button
          onClick={onInsertDocs}
          className={clsx(
            'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all',
            inputHasDocs
              ? 'bg-green-500/10 text-green-500'
              : 'text-muted-foreground hover:bg-muted'
          )}
          title="Search documentation"
        >
          <BookOpen className="w-3 h-3" />
          <span className="hidden sm:inline">@docs</span>
        </button>

        {/* Docs Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all border',
            isOpen || pinnedDocIds.length > 0
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'text-muted-foreground hover:bg-muted border-transparent'
          )}
          title="Pin documentation to always include"
        >
          <Database className="w-3 h-3" />
          {pinnedDocIds.length > 0 && (
            <span className="bg-primary text-primary-foreground text-[8px] px-1 rounded-full min-w-[14px] text-center">
              {pinnedDocIds.length}
            </span>
          )}
        </button>
      </div>

      {/* Pinned Docs Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-3 py-2 bg-muted/30 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pin className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Pinned Docs</span>
                </div>
                {pinnedDocIds.length > 0 && (
                  <button
                    onClick={clearPinnedDocs}
                    className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-red-500/10"
                  >
                    <PinOff className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pinned docs are always included in AI context
              </p>
            </div>

            {/* Documents List */}
            <div className="max-h-48 overflow-y-auto p-2">
              {documents.length === 0 ? (
                <div className="text-center py-6">
                  <Database className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    No documents yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add docs in Knowledge Base
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {documents.map((doc) => {
                    const Icon = getDocIcon(doc.type);
                    const isPinned = pinnedDocIds.includes(doc.id);

                    return (
                      <button
                        key={doc.id}
                        onClick={() => togglePinnedDoc(doc.id)}
                        className={clsx(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left group',
                          isPinned
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-accent border border-transparent'
                        )}
                      >
                        <div
                          className={clsx(
                            'p-1.5 rounded-md',
                            isPinned ? 'bg-primary/20' : 'bg-muted'
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={clsx(
                              'text-xs font-medium truncate',
                              isPinned ? 'text-primary' : 'text-foreground'
                            )}
                          >
                            {doc.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {doc.chunkCount} chunks • {doc.type}
                          </p>
                        </div>
                        {isPinned ? (
                          <Pin className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : (
                          <Pin className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 group-hover:text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
