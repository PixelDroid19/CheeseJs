import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Info, Plus, Save, Search, Terminal, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { LspLanguageConfig } from '@cheesejs/core';
import { SectionHeader, Toggle } from '@cheesejs/ui';

export type LspConnectionStatus = 'error' | 'running' | 'starting' | 'stopped';

export interface LspTabProps {
  addLspLanguage: (id: string, config: LspLanguageConfig) => void;
  isLoadingLsp: boolean;
  languages: Record<string, LspLanguageConfig>;
  loadLspConfig: () => Promise<void>;
  lspStatus: Record<string, LspConnectionStatus>;
  removeLspLanguage: (id: string) => void;
  toggleLspLanguage: (id: string) => void;
}

const STATUS_COLORS: Record<LspConnectionStatus, string> = {
  stopped: 'bg-zinc-500',
  starting: 'bg-amber-400 animate-pulse',
  running: 'bg-emerald-400',
  error: 'bg-red-500',
};

const STATUS_LABELS: Record<LspConnectionStatus, string> = {
  stopped: 'Detenido',
  starting: 'Iniciando...',
  running: 'Activo',
  error: 'Error',
};

export function LspTab({
  addLspLanguage,
  isLoadingLsp,
  languages,
  loadLspConfig,
  lspStatus,
  removeLspLanguage,
  toggleLspLanguage,
}: LspTabProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [newExtensions, setNewExtensions] = useState('');

  useEffect(() => {
    void loadLspConfig();
  }, [loadLspConfig]);

  const languageEntries = Object.entries(languages);
  const enabledCount = languageEntries.filter(
    ([, config]) => config.enabled
  ).length;

  const filteredLanguages = languageEntries.filter(([, config]) => {
    if (filter === 'enabled' && !config.enabled) return false;
    if (filter === 'disabled' && config.enabled) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        config.name.toLowerCase().includes(query) ||
        config.fileExtensions.some((ext) => ext.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const resetForm = () => {
    setNewId('');
    setNewName('');
    setNewCommand('');
    setNewArgs('');
    setNewExtensions('');
    setIsAdding(false);
  };

  const handleAddLsp = () => {
    const id = newId.trim().toLowerCase().replace(/\s+/g, '-');
    if (!id || !newName.trim() || !newCommand.trim()) return;
    if (languages[id]) return;

    const config: LspLanguageConfig = {
      name: newName.trim(),
      command: newCommand.trim(),
      args: newArgs
        .split(',')
        .map((arg) => arg.trim())
        .filter(Boolean),
      fileExtensions: newExtensions
        .split(',')
        .map((extension) => {
          const ext = extension.trim();
          return ext.startsWith('.') ? ext : `.${ext}`;
        })
        .filter(Boolean),
      enabled: true,
    };

    addLspLanguage(id, config);
    resetForm();
  };

  const handleRemoveLsp = (id: string, name: string) => {
    if (confirm(`¿Eliminar el servidor de lenguaje "${name}"?`)) {
      removeLspLanguage(id);
    }
  };

  return (
    <m.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div>
        <SectionHeader
          title={t('settings.categories.lsp', 'Inteligencia de código')}
        />
        <p className="text-sm text-muted-foreground mb-6">
          {t(
            'settings.lsp.description',
            'La inteligencia de código proporciona funciones de IDE como ir a definición, información al pasar el cursor y diagnósticos a través del protocolo de servidor de lenguaje (LSP).'
          )}
        </p>

        <h3 className="text-sm font-semibold text-foreground mb-1">
          {t('settings.lsp.servers', 'Servidores de lenguaje')}
        </h3>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-4">
          {t(
            'settings.lsp.serversInfo',
            '{{total}} servidores de lenguaje recomendados • {{enabled}} habilitados',
            { total: languageEntries.length, enabled: enabledCount }
          )}
          <Info className="w-3 h-3" />
        </p>

        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {(['all', 'enabled', 'disabled'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                  filter === value
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
              >
                {value === 'all'
                  ? t('settings.lsp.filterAll', 'Todos')
                  : value === 'enabled'
                    ? t('settings.lsp.filterEnabled', 'Habilitado')
                    : t('settings.lsp.filterDisabled', 'Deshabilitado')}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('settings.search', 'Buscar...')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-border/50 bg-black/20 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
              />
            </div>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className={clsx(
                'p-2 rounded-xl border transition-all hover:-translate-y-0.5',
                isAdding
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                  : 'border-border/50 bg-black/20 hover:bg-white/5 text-muted-foreground hover:text-foreground'
              )}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isAdding && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="p-5 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md space-y-4 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent pointer-events-none" />

                <h3 className="text-sm font-semibold relative flex items-center gap-2">
                  <Terminal size={16} className="text-primary" />
                  {t(
                    'settings.lsp.addNew',
                    'Agregar nuevo servidor de lenguaje'
                  )}
                </h3>

                <div className="grid grid-cols-2 gap-4 relative">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                      ID (único)
                    </label>
                    <input
                      value={newId}
                      onChange={(event) => setNewId(event.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border bg-black/20 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 border-border/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
                      placeholder="css, html, rust..."
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                      {t('settings.lsp.name', 'Nombre')}
                    </label>
                    <input
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border bg-black/20 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 border-border/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
                      placeholder="CSS Language Server"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 relative">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                      {t('settings.lsp.command', 'Comando')}
                    </label>
                    <input
                      value={newCommand}
                      onChange={(event) => setNewCommand(event.target.value)}
                      className="w-full px-4 py-2.5 text-sm font-mono rounded-xl border bg-black/20 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 border-border/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
                      placeholder="npx, node, rust-analyzer..."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                      {t('settings.lsp.args', 'Argumentos (coma)')}
                    </label>
                    <input
                      value={newArgs}
                      onChange={(event) => setNewArgs(event.target.value)}
                      className="w-full px-4 py-2.5 text-sm font-mono rounded-xl border bg-black/20 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 border-border/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
                      placeholder="css-languageserver, --stdio"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                    {t(
                      'settings.lsp.extensions',
                      'Extensiones de archivo (coma)'
                    )}
                  </label>
                  <input
                    value={newExtensions}
                    onChange={(event) => setNewExtensions(event.target.value)}
                    className="w-full px-4 py-2.5 text-sm font-mono rounded-xl border bg-black/20 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 border-border/50 transition-all shadow-inner placeholder:text-muted-foreground/50"
                    placeholder=".css, .scss, .less"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2 relative">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground rounded-xl transition-colors"
                  >
                    {t('common.cancel', 'Cancelar')}
                  </button>
                  <button
                    onClick={handleAddLsp}
                    disabled={
                      !newId.trim() || !newName.trim() || !newCommand.trim()
                    }
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl transition-all shadow-md shadow-primary/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <Save size={14} />
                    {t('settings.lsp.addServer', 'Agregar Servidor')}
                  </button>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {isLoadingLsp ? (
          <div className="py-8 text-center text-sm text-muted-foreground tracking-wide animate-pulse">
            {t('settings.lsp.loading', 'Cargando configuraciones LSP...')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredLanguages.map(([id, config]) => {
              const status: LspConnectionStatus = lspStatus[id] || 'stopped';
              return (
                <div
                  key={id}
                  className={clsx(
                    'p-4 rounded-xl border transition-all duration-300 group hover:shadow-md',
                    config.enabled
                      ? 'border-border/60 hover:border-primary/30 bg-card'
                      : 'border-border/30 bg-card/50 opacity-70 hover:opacity-100'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div
                          className={clsx(
                            'w-2.5 h-2.5 rounded-full transition-colors',
                            STATUS_COLORS[status]
                          )}
                        />
                        {status === 'running' && (
                          <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-card-foreground">
                          {config.name}
                        </h4>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          {STATUS_LABELS[status]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemoveLsp(id, config.name)}
                        className="p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                        title={t('common.delete', 'Eliminar')}
                      >
                        <Trash2 size={14} />
                      </button>
                      <Toggle
                        checked={config.enabled ?? true}
                        onChange={() => toggleLspLanguage(id)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <code className="text-[10px] text-muted-foreground bg-black/20 px-2 py-0.5 rounded font-mono truncate">
                      {config.command} {config.args.join(' ')}
                    </code>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
                    <span className="font-medium">Ext:</span>
                    {config.fileExtensions.map((ext) => (
                      <span
                        key={ext}
                        className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-mono"
                      >
                        {ext}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredLanguages.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-xl">
                {t(
                  'settings.lsp.noResults',
                  'No se encontraron servidores de lenguaje.'
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 p-4 bg-muted/30 border border-border/30 backdrop-blur rounded-xl flex gap-3 text-sm">
          <Info className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <span className="font-semibold text-foreground">
              {t('settings.lsp.troubleTitle', '¿Problemas con LSP?')}
            </span>
            <span className="text-muted-foreground ml-2">
              {t(
                'settings.lsp.troubleText',
                'Ver registros LSP para entender qué está fallando, o deja que el asistente los analice y ayude a solucionar el problema.'
              )}
            </span>
          </div>
        </div>
      </div>
    </m.div>
  );
}
