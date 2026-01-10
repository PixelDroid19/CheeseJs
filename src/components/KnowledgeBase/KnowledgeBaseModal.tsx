import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Globe,
  Trash2,
  Plus,
  Upload,
  Link as LinkIcon,
  AlertCircle,
  Search,
  Database as DatabaseIcon,
  Layers,
  Code,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';
import { useRagStore } from '../../store/useRagStore';

export function KnowledgeBaseModal() {
  const {
    isModalOpen,
    setModalOpen,
    documents,
    loadDocuments,
    addFile,
    addUrl,
    removeDocument,
    toggleDocumentSelection,
    activeDocumentIds,
    selectAllDocuments,
    deselectAllDocuments,
    processingStatus,
    error,
    config,
    updateConfig,
    loadConfig,
  } = useRagStore();

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'settings'>(
    'list'
  );
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isModalOpen) {
      loadDocuments();
      loadConfig();
    }
  }, [isModalOpen, loadDocuments, loadConfig]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Handle multiple files? Currently addFile is single.
      // Let's loop.
      Array.from(files).forEach((file) => {
        // We need the path. In Electron, input[type=file] gives the path in 'path' property if webSecurity is false or using specific electron handling.
        // Actually, standard file input in Electron exposes 'path' on the File object.
        const filePath = (file as { path?: string }).path;
        if (filePath) {
          addFile(filePath);
        }
      });
      // Switch to list view to show progress
      setActiveTab('list');
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput) {
      await addUrl(urlInput);
      setUrlInput('');
      setActiveTab('list');
    }
  };

  const handleScanCodebase = async () => {
    if (window.rag) {
      try {
        // Switch to list immediately to show the new "Project Codebase" item (optimistic or wait for progress)
        setActiveTab('list');
        await window.rag.indexCodebase();
        loadDocuments();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DatabaseIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Knowledge Base
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage documents for AI context
                </p>
              </div>
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {error && (
            <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-muted/30">
            <button
              onClick={() => setActiveTab('list')}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
                activeTab === 'list'
                  ? 'bg-background shadow-sm text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Layers className="w-4 h-4" />
              My Documents
              <span className="ml-1 bg-muted px-1.5 py-0.5 rounded-full text-xs">
                {documents.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
                activeTab === 'add'
                  ? 'bg-background shadow-sm text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Plus className="w-4 h-4" />
              Add New
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
                activeTab === 'settings'
                  ? 'bg-background shadow-sm text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-background">
            {activeTab === 'list' && (
              <div className="h-full flex flex-col">
                {/* Toolbar */}
                <div className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllDocuments}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllDocuments}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  {filteredDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                      <p>No documents found.</p>
                      {searchQuery && (
                        <p className="text-xs mt-1">
                          Try a different search term.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredDocuments.map((doc) => {
                        const status = processingStatus[doc.id] || {
                          status: doc.status,
                          message: '',
                        };
                        const isActive = activeDocumentIds.includes(doc.id);
                        const isProcessing =
                          status.status === 'processing' ||
                          status.status === 'pending';

                        return (
                          <div
                            key={doc.id}
                            className={clsx(
                              'flex items-center gap-4 p-3 rounded-lg border transition-all',
                              isActive
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border hover:bg-muted/50'
                            )}
                          >
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={() => toggleDocumentSelection(doc.id)}
                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                            </div>

                            <div className="p-2 rounded-lg bg-background border border-border">
                              {doc.type === 'url' ? (
                                <Globe className="w-5 h-5 text-blue-500" />
                              ) : (
                                <FileText className="w-5 h-5 text-orange-500" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4
                                  className="text-sm font-medium text-foreground truncate"
                                  title={doc.title}
                                >
                                  {doc.title}
                                </h4>
                                {status.status === 'error' && (
                                  <AlertCircle className="w-3 h-3 text-destructive" />
                                )}
                              </div>
                              <p
                                className="text-xs text-muted-foreground truncate"
                                title={doc.pathOrUrl}
                              >
                                {doc.pathOrUrl}
                              </p>
                              {isProcessing && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary animate-pulse w-full origin-left" />
                                  </div>
                                  <span className="text-[10px] text-primary">
                                    {status.message || 'Processing...'}
                                  </span>
                                </div>
                              )}
                              {status.status === 'error' && (
                                <p className="text-[10px] text-destructive mt-0.5">
                                  {doc.error || status.message}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{doc.chunkCount} chunks</span>
                              <div
                                className={clsx(
                                  'px-2 py-0.5 rounded-full text-[10px] font-medium uppercase',
                                  status.status === 'indexed'
                                    ? 'bg-green-500/10 text-green-500'
                                    : status.status === 'error'
                                      ? 'bg-red-500/10 text-red-500'
                                      : 'bg-yellow-500/10 text-yellow-500'
                                )}
                              >
                                {status.status}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    window.confirm(
                                      'Are you sure you want to remove this document?'
                                    )
                                  ) {
                                    removeDocument(doc.id);
                                  }
                                }}
                                className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                                title="Delete document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'add' && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 h-full overflow-y-auto">
                {/* Scan Codebase */}
                <div
                  onClick={handleScanCodebase}
                  className="flex flex-col items-center justify-center p-8 border border-border rounded-xl bg-card hover:border-primary hover:bg-primary/5 cursor-pointer transition-all group"
                >
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Code className="w-8 h-8 text-purple-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Scan Codebase
                  </h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Index current project files for code context.
                  </p>
                </div>

                {/* Add File */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 cursor-pointer transition-all group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    multiple
                    accept=".pdf,.docx,.txt,.md,.json,.js,.ts,.tsx,.py"
                  />
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Upload Files
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-[200px]">
                    Support for PDF, DOCX, TXT, MD, Code files
                  </p>
                </div>

                {/* Add URL */}
                <div className="flex flex-col p-8 border border-border rounded-xl bg-card">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                    <LinkIcon className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Import from URL
                  </h3>
                  <form onSubmit={handleUrlSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Web Page URL
                      </label>
                      <input
                        type="url"
                        required
                        placeholder="https://example.com/docs"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!urlInput}
                      className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Import Page
                    </button>
                  </form>
                  <p className="text-xs text-muted-foreground mt-4">
                    Web scraping will extract text content from the URL. Best
                    for documentation pages.
                  </p>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="h-full overflow-auto p-6">
                <div className="max-w-lg mx-auto space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-4">
                      Search Settings
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure how the AI retrieves and uses documents from
                      your knowledge base.
                    </p>
                  </div>

                  {/* Retrieval Limit */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-foreground">
                        Retrieval Limit
                      </label>
                      <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {config.retrievalLimit} chunks
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={config.retrievalLimit}
                      onChange={(e) =>
                        updateConfig({
                          retrievalLimit: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of relevant chunks to retrieve per search.
                    </p>
                  </div>

                  {/* Relevance Threshold */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-foreground">
                        Relevance Threshold
                      </label>
                      <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {(config.retrievalThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={config.retrievalThreshold * 100}
                      onChange={(e) =>
                        updateConfig({
                          retrievalThreshold: parseInt(e.target.value) / 100,
                        })
                      }
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum similarity score for results. Higher = stricter
                      matching.
                    </p>
                  </div>

                  {/* Max Context Tokens */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-foreground">
                        Max Context Tokens
                      </label>
                      <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {config.maxContextTokens.toLocaleString()} tokens
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="16000"
                      step="500"
                      value={config.maxContextTokens}
                      onChange={(e) =>
                        updateConfig({
                          maxContextTokens: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum tokens for context injection. Larger = more
                      context but slower.
                    </p>
                  </div>

                  {/* Injection Strategy */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Injection Strategy
                    </label>
                    <select
                      value={config.injectionStrategy}
                      onChange={(e) =>
                        updateConfig({
                          injectionStrategy: e.target.value as
                            | 'auto'
                            | 'always-retrieve'
                            | 'always-inject',
                        })
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="auto">Auto (Recommended)</option>
                      <option value="always-retrieve">
                        Always Use Retrieval
                      </option>
                      <option value="always-inject">
                        Always Inject Full Content
                      </option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Auto: injects full content for small docs, uses retrieval
                      for large ones.
                    </p>
                  </div>

                  {/* Strategy Info */}
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                    <h4 className="text-sm font-medium text-foreground mb-2">
                      About Strategies
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>
                        <strong>Auto:</strong> Chooses the best method based on
                        document size
                      </li>
                      <li>
                        <strong>Retrieval:</strong> Searches for relevant chunks
                        (faster, less context)
                      </li>
                      <li>
                        <strong>Full Inject:</strong> Includes entire documents
                        (slower, more context)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
