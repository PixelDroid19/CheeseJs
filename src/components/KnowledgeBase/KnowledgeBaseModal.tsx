import React, { useEffect, useRef, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
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
  ChevronRight,
  Info
} from 'lucide-react';
import clsx from 'clsx';
import { useRagStore } from '../../store/storeHooks';

function StatusBadge({ status, error }: { status: string; error?: string }) {
  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold uppercase tracking-wider border border-destructive/20" title={error}>
        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
        Error
      </div>
    );
  }

  if (status === 'indexed') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold uppercase tracking-wider border border-emerald-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Indexed
      </div>
    );
  }

  // pending, processing, embedding
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-semibold uppercase tracking-wider border border-amber-500/20">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-[pulse_1s_ease-in-out_infinite]" />
      {status}
    </div>
  );
}

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

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'settings'>('list');
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
      Array.from(files).forEach((file) => {
        const filePath = (file as { path?: string }).path;
        if (filePath) addFile(filePath);
      });
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
        setActiveTab('list');
        await window.rag.indexCodebase();
        loadDocuments();
      } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : 'Unknown scan error', e);
      }
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        />

        <m.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-background/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Side Nav */}
          <aside className="w-64 border-r border-border/50 bg-muted/20 flex flex-col">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/20 shadow-inner">
                  <DatabaseIcon className="w-5 h-5 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Base de Datos</h2>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Motor RAG Local</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-4 py-2 space-y-1">
              <button
                onClick={() => setActiveTab('list')}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium',
                  activeTab === 'list'
                    ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Layers className="w-4 h-4" />
                <span className="flex-1 text-left">Mis Documentos</span>
                <span className={clsx(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors",
                  activeTab === 'list' ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/15 text-muted-foreground'
                )}>
                  {documents.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('add')}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium',
                  activeTab === 'add'
                    ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Plus className="w-4 h-4" />
                <span className="flex-1 text-left">Añadir Fuente</span>
              </button>

              <div className="my-4 border-t border-border/50 mx-2" />

              <button
                onClick={() => setActiveTab('settings')}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium',
                  activeTab === 'settings'
                    ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Settings className="w-4 h-4" />
                <span className="flex-1 text-left">Ajustes Vectoriales</span>
              </button>
            </nav>

            <div className="p-4 mt-auto">
              <button
                onClick={() => setModalOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all border border-transparent hover:border-border"
              >
                <X className="w-4 h-4" />
                Cerrar Panel
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col bg-background/50 relative">
            {error && (
              <div className="absolute top-0 inset-x-0 z-10 px-6 py-3 bg-destructive/10 border-b border-destructive/20 flex items-start gap-3 text-destructive shadow-sm backdrop-blur-md">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error && typeof error === 'object' && 'message' in error ? (error as { message: string }).message : typeof error === 'string' ? error : JSON.stringify(error)}</p>
              </div>
            )}

            {activeTab === 'list' && (
              <div className="flex-1 flex flex-col h-full">
                <header className="px-8 pt-8 pb-4">
                  <h3 className="text-2xl font-bold text-foreground tracking-tight mb-4">Mis Documentos</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre o ruta..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/80 rounded-xl text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                    <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50 shrink-0">
                      <button
                        onClick={selectAllDocuments}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-background hover:shadow-sm transition-all text-muted-foreground hover:text-foreground"
                      >
                        Seleccionar Todos
                      </button>
                      <button
                        onClick={deselectAllDocuments}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-background hover:shadow-sm transition-all text-muted-foreground hover:text-foreground"
                      >
                        Ninguno
                      </button>
                    </div>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 pb-8">
                  {filteredDocuments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 ring-1 ring-border">
                        <Search className="w-6 h-6 opacity-50" />
                      </div>
                      <h4 className="text-base font-semibold text-foreground">No hay documentos</h4>
                      <p className="text-sm mt-1 max-w-[250px]">
                        {searchQuery ? 'Intenta con otro término de búsqueda.' : 'Sube archivos, enlaces web o escanea tu proyecto para dotar a la IA de conocimiento local.'}
                      </p>
                      {!searchQuery && (
                        <button
                          onClick={() => setActiveTab('add')}
                          className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                        >
                          Añadir primera fuente
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {filteredDocuments.map((doc) => {
                          const status = processingStatus[doc.id] || { status: doc.status, message: '' };
                          const isActive = activeDocumentIds.includes(doc.id);
                          const isProcessing = status.status === 'processing' || status.status === 'pending';

                          return (
                            <m.div
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              key={doc.id}
                              className={clsx(
                                'group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden',
                                isActive
                                  ? 'border-primary/40 bg-primary/[0.03] shadow-[0_4px_20px_-10px_rgba(var(--primary),0.2)]'
                                  : 'border-border/60 bg-card hover:border-border hover:shadow-md hover:bg-accent/5'
                              )}
                            >
                              <div className="flex items-center shrink-0">
                                <label className="relative flex items-center justify-center cursor-pointer p-2">
                                  <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={() => toggleDocumentSelection(doc.id)}
                                    className="peer sr-only"
                                  />
                                  <div className="w-5 h-5 rounded border-[1.5px] border-muted-foreground/40 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                                    <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5 opacity-0 peer-checked:opacity-100 transition-opacity">
                                      <path d="M3 8L6 11L11 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                </label>
                              </div>

                              <div className={clsx(
                                "flex items-center justify-center w-10 h-10 rounded-xl shrink-0 border border-black/5 shadow-sm",
                                doc.type === 'url' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-600'
                              )}>
                                {doc.type === 'url' ? <Globe className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                              </div>

                              <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <h4 className="text-sm font-semibold text-foreground truncate" title={doc.title}>
                                    {doc.title}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs text-muted-foreground truncate max-w-[300px]" title={doc.pathOrUrl}>
                                    {doc.pathOrUrl}
                                  </p>
                                  <span className="text-[10px] text-muted-foreground/60 px-1.5 py-0.5 rounded-md bg-muted/40 border border-border/50">
                                    {doc.chunkCount} {doc.chunkCount === 1 ? 'fragmento' : 'fragmentos'}
                                  </span>
                                </div>

                                {isProcessing && (
                                  <div className="mt-2.5 max-w-sm">
                                    <div className="flex items-center justify-between text-[10px] mb-1.5">
                                      <span className="text-primary font-medium">{status.message || 'Extrayendo vectores...'}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                                      <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite] w-1/3" />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-end gap-3 shrink-0">
                                <StatusBadge status={status.status} error={doc.error || status.message} />

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('¿Seguro que deseas eliminar este documento del repositorio RAG?')) removeDocument(doc.id);
                                  }}
                                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all"
                                  title="Eliminar del índice"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </m.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'add' && (
              <div className="flex-1 flex flex-col h-full overflow-y-auto">
                <header className="px-8 pt-8 pb-2">
                  <h3 className="text-2xl font-bold text-foreground tracking-tight mb-2">Añadir nueva fuente</h3>
                  <p className="text-sm text-muted-foreground max-w-xl">
                    Importa documentos o escanea código para que el Agente IA pueda recuperar esta información a través la Base Vectorial.
                  </p>
                </header>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Scan Codebase */}
                  <div
                    onClick={handleScanCodebase}
                    className="group relative flex flex-col p-6 rounded-2xl bg-card border border-border/80 hover:border-purple-500/50 hover:bg-purple-500/[0.02] hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                      <ChevronRight className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-5 border border-purple-500/20 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all">
                      <Code className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Proyecto Local</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Escanea e indexa automáticamente los archivos de código del proyecto actual para resolver bugs interactuando con ellos en el chat.
                    </p>
                  </div>

                  {/* Add File */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex flex-col p-6 rounded-2xl bg-card border border-border/80 border-dashed hover:border-primary/50 hover:bg-primary/[0.02] hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      multiple
                      accept=".pdf,.docx,.txt,.md,.json,.js,.ts,.tsx,.py"
                    />
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity -translate-y-2 group-hover:translate-y-0">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 border border-primary/20 group-hover:scale-110 group-hover:bg-primary/20 transition-all">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Subir Archivos</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Carga PDF, DOCX, TXT o Markdown para que la IA extraiga el conocimiento.
                    </p>
                  </div>

                  {/* Add URL */}
                  <div className="col-span-1 md:col-span-2 lg:col-span-1 flex flex-col p-6 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5 border border-blue-500/20">
                      <LinkIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-3">Extraer sitio Web</h3>
                    <form onSubmit={handleUrlSubmit} className="space-y-4 flex-1 flex flex-col">
                      <div className="flex-1">
                        <input
                          type="url"
                          required
                          placeholder="https://ejemplo.com/docs"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-muted/30 border border-border/80 rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!urlInput}
                        className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        Procesar URL
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="flex-1 overflow-auto h-full px-8 py-8">
                <div className="max-w-2xl">
                  <header className="mb-8">
                    <h3 className="text-2xl font-bold text-foreground tracking-tight mb-2">Ajustes Vectoriales (LibSQL)</h3>
                    <p className="text-sm text-muted-foreground">
                      Afina cómo el motor de IA consulta la base de datos local y extrae contexto (chunks) para responderte.
                    </p>
                  </header>

                  <div className="space-y-8">
                    <div className="p-6 rounded-2xl border border-border/80 bg-card space-y-6 shadow-sm">

                      {/* Retrieval Limit */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-semibold text-foreground">
                            Límite de fragmentos (Chunks)
                          </label>
                          <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                            {config.retrievalLimit} docs
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="15"
                          step="1"
                          value={config.retrievalLimit}
                          onChange={(e) => updateConfig({ retrievalLimit: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-muted rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary cursor-pointer"
                        />
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          Determina cuántos pedazos de código o texto se extraen del motor por cada mensaje en el chat para formar el contexto prompt.
                        </p>
                      </div>

                      <div className="h-px bg-border/50" />

                      {/* Relevance Threshold */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-semibold text-foreground">
                            Precisión mínima (Threshold)
                          </label>
                          <span className="text-xs font-mono font-bold text-purple-600 bg-purple-500/10 px-2 py-1 rounded-md">
                            {(config.retrievalThreshold * 100).toFixed(0)}% de match
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={config.retrievalThreshold * 100}
                          onChange={(e) => updateConfig({ retrievalThreshold: parseInt(e.target.value) / 100 })}
                          className="w-full h-1.5 bg-muted rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 cursor-pointer"
                        />
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          La similitud matemática (Coseno) con tu prompt. Un valor bajo ingresará resultados vagos pero variados. Un valor alto es estricto.
                        </p>
                      </div>

                      <div className="h-px bg-border/50" />

                      {/* Max Context Tokens */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-semibold text-foreground">
                            Límite en Ventana Contextual
                          </label>
                          <span className="text-xs font-mono font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md">
                            {config.maxContextTokens.toLocaleString()} tokens
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1000"
                          max="32000"
                          step="1000"
                          value={config.maxContextTokens}
                          onChange={(e) => updateConfig({ maxContextTokens: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-muted rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 cursor-pointer"
                        />
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          Garantiza que el contexto no explote la ventana de tu LLM, cortando la inyección de fragmentos si alcanzas este volumen.
                        </p>
                      </div>

                      <div className="h-px bg-border/50" />

                      {/* Injection Strategy */}
                      <div className="space-y-4">
                        <label className="text-sm font-semibold text-foreground block">
                          Estrategia de inyección
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { value: 'auto', label: 'Automática', desc: 'Optimizada' },
                            { value: 'always-retrieve', label: 'Siempre Buscar', desc: 'Fragmentado' },
                            { value: 'always-inject', label: 'Inyección Total', desc: 'Gasta Contexto' }
                          ].map((opt) => (
                            <label
                              key={opt.value}
                              className={clsx(
                                "flex flex-col items-center justify-center p-3 text-center border rounded-xl cursor-pointer transition-all",
                                config.injectionStrategy === opt.value
                                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                                  : "border-border hover:border-border/80 hover:bg-muted/30"
                              )}
                            >
                              <input
                                type="radio"
                                className="sr-only"
                                checked={config.injectionStrategy === opt.value}
                                onChange={() => updateConfig({ injectionStrategy: opt.value as 'auto' | 'always-retrieve' | 'always-inject' })}
                              />
                              <span className={clsx("text-sm font-bold mb-1", config.injectionStrategy === opt.value ? "text-primary" : "text-foreground")}>{opt.label}</span>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{opt.desc}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex gap-4">
                      <div className="shrink-0 mt-0.5">
                        <Info className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-400 mb-1.5">Información sobre Turso / LibSQL</h4>
                        <p className="text-[13px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                          La base de datos nativa que compila tus fragmentos soporta extensiones vectoriales L2. Los documentos cacheados se ubican en %AppData% de tu máquina y no se transmiten a la nube.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </m.div>
      </div>
    </AnimatePresence>
  );
}
