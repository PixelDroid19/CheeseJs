/**
 * Plugin Tab
 *
 * Settings tab for managing plugins: view installed plugins,
 * enable/disable, install from folder, and uninstall.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Puzzle,
  Power,
  PowerOff,
  Trash2,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import { usePluginStore } from '../../../store/usePluginStore';
import type { PluginInfo } from '../../../lib/plugins/plugin-api';

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status: PluginInfo['status'] }) {
  const config = {
    installed: { color: 'bg-gray-500', label: 'Installed' },
    active: { color: 'bg-green-500', label: 'Active' },
    disabled: { color: 'bg-yellow-500', label: 'Disabled' },
    error: { color: 'bg-red-500', label: 'Error' },
  };

  const { color, label } = config[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        color,
        'text-white'
      )}
    >
      {status === 'active' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'error' && <AlertCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

// ============================================================================
// PLUGIN CARD
// ============================================================================

interface PluginCardProps {
  plugin: PluginInfo;
  onActivate: () => void;
  onDeactivate: () => void;
  onUninstall: () => void;
  isLoading: boolean;
}

function PluginCard({
  plugin,
  onActivate,
  onDeactivate,
  onUninstall,
  isLoading,
}: PluginCardProps) {
  const { manifest, status, error } = plugin;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={clsx(
        'p-4 rounded-xl border transition-all',
        'bg-[#1e2025] border-white/10',
        status === 'error' && 'border-red-500/30 bg-red-500/5'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Plugin Icon */}
          <div
            className={clsx(
              'p-2.5 rounded-lg shrink-0',
              status === 'active'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-white/5 text-white/40'
            )}
          >
            <Puzzle className="w-5 h-5" />
          </div>

          {/* Plugin Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-white truncate">
                {manifest.name}
              </h4>
              <span className="text-xs text-white/40">v{manifest.version}</span>
              <StatusBadge status={status} />
            </div>

            {manifest.description && (
              <p className="text-sm text-white/50 mt-1 line-clamp-2">
                {manifest.description}
              </p>
            )}

            {error && (
              <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {status === 'active' ? (
            <button
              onClick={onDeactivate}
              disabled={isLoading}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
                'disabled:opacity-50'
              )}
              title="Deactivate"
            >
              <PowerOff className="w-4 h-4" />
            </button>
          ) : status !== 'error' ? (
            <button
              onClick={onActivate}
              disabled={isLoading}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                'bg-green-500/20 text-green-400 hover:bg-green-500/30',
                'disabled:opacity-50'
              )}
              title="Activate"
            >
              <Power className="w-4 h-4" />
            </button>
          ) : null}

          <button
            onClick={onUninstall}
            disabled={isLoading}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              'bg-red-500/10 text-red-400 hover:bg-red-500/20',
              'disabled:opacity-50'
            )}
            title="Uninstall"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ onOpenFolder }: { onOpenFolder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-white/5 mb-4">
        <Puzzle className="w-10 h-10 text-white/30" />
      </div>
      <h3 className="text-lg font-medium text-white/70 mb-2">
        No Plugins Installed
      </h3>
      <p className="text-sm text-white/40 mb-6 max-w-sm">
        Extend CheeseJS with custom languages, formatters, and UI panels.
      </p>
      <button
        onClick={onOpenFolder}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-lg',
          'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors'
        )}
      >
        <FolderOpen className="w-4 h-4" />
        Open Plugins Folder
      </button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PluginTab() {
  const {
    plugins,
    isLoading,
    error,
    pluginsPath,
    loadPlugins,
    activatePlugin,
    deactivatePlugin,
    uninstallPlugin,
    getPluginsPath,
  } = usePluginStore();

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
    getPluginsPath();
  }, [loadPlugins, getPluginsPath]);

  // Listen for plugin state changes
  useEffect(() => {
    if (window.pluginAPI?.onStateChanged) {
      const unsubscribe = window.pluginAPI.onStateChanged(() => {
        loadPlugins();
      });
      return unsubscribe;
    }
  }, [loadPlugins]);

  const handleActivate = async (id: string) => {
    setActionLoading(id);
    try {
      await activatePlugin(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (id: string) => {
    setActionLoading(id);
    try {
      await deactivatePlugin(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (id: string) => {
    if (!confirm(`Are you sure you want to uninstall this plugin?`)) return;
    setActionLoading(id);
    try {
      await uninstallPlugin(id);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenFolder = async () => {
    const path = await getPluginsPath();
    if (path && window.electronAPI?.showItemInFolder) {
      window.electronAPI.showItemInFolder(path);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Plugins</h3>
          <p className="text-sm text-white/50">
            Manage installed plugins and extensions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPlugins()}
            disabled={isLoading}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white',
              'disabled:opacity-50'
            )}
            title="Refresh"
          >
            <RefreshCw
              className={clsx('w-4 h-4', isLoading && 'animate-spin')}
            />
          </button>

          <button
            onClick={handleOpenFolder}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg',
              'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors'
            )}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm">Open Folder</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Plugin List */}
      {plugins.length === 0 ? (
        <EmptyState onOpenFolder={handleOpenFolder} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {plugins.map((plugin) => (
              <PluginCard
                key={plugin.manifest.id}
                plugin={plugin}
                onActivate={() => handleActivate(plugin.manifest.id)}
                onDeactivate={() => handleDeactivate(plugin.manifest.id)}
                onUninstall={() => handleUninstall(plugin.manifest.id)}
                isLoading={actionLoading === plugin.manifest.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Plugins Path Info */}
      {pluginsPath && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-white/30">
            Plugins directory:{' '}
            <code className="text-white/50">{pluginsPath}</code>
          </p>
        </div>
      )}
    </div>
  );
}

export default PluginTab;
