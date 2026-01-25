/**
 * Plugin Marketplace Tab
 *
 * UI for browsing and installing plugins from the marketplace.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Download,
  Star,
  TrendingUp,
  Package,
  Loader2,
  ExternalLink,
  Check,
  X,
  Filter,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import {
  pluginMarketplace,
  type MarketplacePlugin,
  type MarketplaceCategory,
  type SearchOptions,
} from '../../../lib/plugins/marketplace';
import { usePluginStore } from '../../../store/usePluginStore';

// ============================================================================
// PLUGIN CARD
// ============================================================================

interface MarketplaceCardProps {
  plugin: MarketplacePlugin;
  isInstalled: boolean;
  onInstall: () => void;
  isInstalling: boolean;
}

function MarketplaceCard({
  plugin,
  isInstalled,
  onInstall,
  isInstalling,
}: MarketplaceCardProps) {
  const authorName =
    typeof plugin.author === 'string' ? plugin.author : plugin.author.name;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          {plugin.icon ? (
            <img
              src={plugin.icon}
              alt={plugin.displayName}
              className="w-8 h-8 rounded"
            />
          ) : (
            <Package className="w-6 h-6 text-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">
              {plugin.displayName}
            </h4>
            <span className="text-xs text-muted-foreground">
              v{plugin.version}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {plugin.description}
          </p>

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" />
              {plugin.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {formatDownloads(plugin.downloads)}
            </span>
            <span>{authorName}</span>
          </div>

          {/* Categories */}
          {plugin.categories && plugin.categories.length > 0 && (
            <div className="flex gap-1 mt-2">
              {plugin.categories.map((cat) => (
                <span
                  key={cat}
                  className="px-2 py-0.5 text-xs bg-secondary/30 rounded-full"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-green-500 bg-green-500/10 rounded-md">
              <Check className="w-4 h-4" />
              Installed
            </span>
          ) : (
            <button
              onClick={onInstall}
              disabled={isInstalling}
              className={clsx(
                'inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                isInstalling
                  ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {isInstalling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// CATEGORY FILTER
// ============================================================================

interface CategoryFilterProps {
  categories: { category: MarketplaceCategory; count: number }[];
  selected: MarketplaceCategory | null;
  onSelect: (category: MarketplaceCategory | null) => void;
}

function CategoryFilter({
  categories,
  selected,
  onSelect,
}: CategoryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-secondary/30 rounded-md hover:bg-secondary/70 transition-colors"
      >
        <Filter className="w-4 h-4" />
        {selected || 'All Categories'}
        <ChevronDown
          className={clsx(
            'w-4 h-4 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-1 w-48 bg-popover border border-border rounded-md shadow-lg z-10"
          >
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={clsx(
                'w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                !selected && 'bg-accent'
              )}
            >
              All Categories
            </button>
            {categories.map(({ category, count }) => (
              <button
                key={category}
                onClick={() => {
                  onSelect(category);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex justify-between',
                  selected === category && 'bg-accent'
                )}
              >
                <span>{category}</span>
                <span className="text-muted-foreground">{count}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// SORT SELECTOR
// ============================================================================

interface SortSelectorProps {
  value: SearchOptions['sortBy'];
  onChange: (value: SearchOptions['sortBy']) => void;
}

function SortSelector({ value, onChange }: SortSelectorProps) {
  const options: { value: SearchOptions['sortBy']; label: string }[] = [
    { value: 'downloads', label: 'Most Downloads' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'updated', label: 'Recently Updated' },
    { value: 'name', label: 'Name' },
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SearchOptions['sortBy'])}
      className="px-3 py-2 text-sm bg-secondary/30 rounded-md border-none focus:ring-2 focus:ring-primary"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MarketplaceTab() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory | null>(null);
  const [sortBy, setSortBy] = useState<SearchOptions['sortBy']>('downloads');
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [categories, setCategories] = useState<
    { category: MarketplaceCategory; count: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const installedPlugins = usePluginStore((state) => state.plugins);
  const loadPlugins = usePluginStore((state) => state.loadPlugins);

  // Load categories on mount
  useEffect(() => {
    pluginMarketplace.getCategories().then(setCategories);
  }, []);

  // Search plugins
  const searchPlugins = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await pluginMarketplace.search({
        query: query || undefined,
        category: category || undefined,
        sortBy,
        pageSize: 20,
      });
      setPlugins(result.plugins);
    } catch (err) {
      setError('Failed to load plugins. Please try again.');
      console.error('[Marketplace] Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [query, category, sortBy]);

  useEffect(() => {
    const debounce = setTimeout(searchPlugins, 300);
    return () => clearTimeout(debounce);
  }, [searchPlugins]);

  // Install handler
  const handleInstall = async (plugin: MarketplacePlugin) => {
    setInstallingIds((prev) => new Set(prev).add(plugin.id));

    try {
      const result = await pluginMarketplace.install(plugin.id);

      if (result.success) {
        await loadPlugins();
      } else {
        setError(`Failed to install ${plugin.displayName}: ${result.error}`);
      }
    } catch (err) {
      setError(`Failed to install ${plugin.displayName}`);
      console.error('[Marketplace] Install error:', err);
    } finally {
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(plugin.id);
        return next;
      });
    }
  };

  // Check if plugin is installed
  const isInstalled = (pluginId: string) => {
    return installedPlugins.some((p) => p.manifest.id === pluginId);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Plugin Marketplace
        </h3>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-secondary/30 rounded-md border-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2">
          <CategoryFilter
            categories={categories}
            selected={category}
            onSelect={setCategory}
          />
          <SortSelector value={sortBy} onChange={setSortBy} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
          <X className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-destructive/20 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Results */}
      {!isLoading && (
        <div className="space-y-3">
          {plugins.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No plugins found</p>
              {query && (
                <p className="text-sm mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {plugins.map((plugin) => (
                <MarketplaceCard
                  key={plugin.id}
                  plugin={plugin}
                  isInstalled={isInstalled(plugin.id)}
                  onInstall={() => handleInstall(plugin)}
                  isInstalling={installingIds.has(plugin.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
        <p className="flex items-center justify-center gap-1">
          Plugins are provided by the community.
          <a
            href="https://cheesejs.dev/plugins"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Learn more <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDownloads(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export default MarketplaceTab;
