/**
 * Plugin Marketplace
 *
 * Service for discovering, searching, and installing plugins
 * from remote registries.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface MarketplacePlugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string | { name: string; email?: string; url?: string };
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];
  categories?: MarketplaceCategory[];
  icon?: string;
  screenshots?: string[];
  downloads: number;
  rating: number;
  ratingCount: number;
  publishedAt: string;
  updatedAt: string;
  engines?: { cheesejs?: string };
  contributes?: {
    languages?: number;
    transpilers?: number;
    panels?: number;
    themes?: number;
    commands?: number;
    snippets?: number;
  };
}

export type MarketplaceCategory =
  | 'Languages'
  | 'Themes'
  | 'Snippets'
  | 'Formatters'
  | 'Debuggers'
  | 'Testing'
  | 'Linters'
  | 'Other';

export interface MarketplaceVersion {
  version: string;
  publishedAt: string;
  downloadUrl: string;
  checksum: string;
  engines: { cheesejs: string };
  changelog?: string;
}

export interface SearchOptions {
  query?: string;
  category?: MarketplaceCategory;
  sortBy?: 'downloads' | 'rating' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  plugins: MarketplacePlugin[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface InstallResult {
  success: boolean;
  pluginId: string;
  version: string;
  path?: string;
  error?: string;
}

// ============================================================================
// MARKETPLACE SERVICE
// ============================================================================

export class PluginMarketplace {
  private registryUrl: string;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(registryUrl: string = 'https://registry.cheesejs.dev') {
    this.registryUrl = registryUrl;
  }

  /**
   * Search for plugins
   */
  async search(options: SearchOptions = {}): Promise<SearchResult> {
    const params = new URLSearchParams();

    if (options.query) params.set('q', options.query);
    if (options.category) params.set('category', options.category);
    if (options.sortBy) params.set('sortBy', options.sortBy);
    if (options.sortOrder) params.set('sortOrder', options.sortOrder);
    if (options.page) params.set('page', options.page.toString());
    if (options.pageSize) params.set('pageSize', options.pageSize.toString());

    const cacheKey = `search:${params.toString()}`;
    const cached = this.getFromCache<SearchResult>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${this.registryUrl}/api/plugins?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const result = await response.json();
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Marketplace] Search error:', error);
      // Return mock data for development/offline
      return this.getMockSearchResult(options);
    }
  }

  /**
   * Get featured plugins
   */
  async getFeatured(): Promise<MarketplacePlugin[]> {
    const cacheKey = 'featured';
    const cached = this.getFromCache<MarketplacePlugin[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.registryUrl}/api/plugins/featured`);

      if (!response.ok) {
        throw new Error(`Failed to get featured: ${response.statusText}`);
      }

      const result = await response.json();
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Marketplace] Featured error:', error);
      return this.getMockFeatured();
    }
  }

  /**
   * Get plugin details
   */
  async getPlugin(pluginId: string): Promise<MarketplacePlugin | null> {
    const cacheKey = `plugin:${pluginId}`;
    const cached = this.getFromCache<MarketplacePlugin>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${this.registryUrl}/api/plugins/${encodeURIComponent(pluginId)}`
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get plugin: ${response.statusText}`);
      }

      const result = await response.json();
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Marketplace] Get plugin error:', error);
      // Fallback to mock data
      const mock = this.getMockSearchResult({}).plugins.find(
        (p) => p.id === pluginId
      );
      return mock || null;
    }
  }

  /**
   * Get plugin versions
   */
  async getVersions(pluginId: string): Promise<MarketplaceVersion[]> {
    const cacheKey = `versions:${pluginId}`;
    const cached = this.getFromCache<MarketplaceVersion[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${this.registryUrl}/api/plugins/${encodeURIComponent(pluginId)}/versions`
      );

      if (!response.ok) {
        throw new Error(`Failed to get versions: ${response.statusText}`);
      }

      const result = await response.json();
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Marketplace] Get versions error:', error);
      // Fallback to mock versions
      const plugin = await this.getPlugin(pluginId);
      if (!plugin) return [];

      return [
        {
          version: plugin.version,
          publishedAt: plugin.updatedAt,
          downloadUrl: `mock:install/${pluginId}`,
          checksum: 'mock-checksum',
          engines: { cheesejs: '^1.0.0' },
        },
      ];
    }
  }

  /**
   * Get categories with counts
   */
  async getCategories(): Promise<
    { category: MarketplaceCategory; count: number }[]
  > {
    const cacheKey = 'categories';
    const cached =
      this.getFromCache<{ category: MarketplaceCategory; count: number }[]>(
        cacheKey
      );
    if (cached) return cached;

    try {
      const response = await fetch(`${this.registryUrl}/api/categories`);

      if (!response.ok) {
        throw new Error(`Failed to get categories: ${response.statusText}`);
      }

      const result = await response.json();
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Marketplace] Get categories error:', error);
      return this.getMockCategories();
    }
  }

  /**
   * Download plugin package
   */
  async download(
    pluginId: string,
    version?: string
  ): Promise<{ buffer: ArrayBuffer; checksum: string }> {
    const versions = await this.getVersions(pluginId);
    const targetVersion = version
      ? versions.find((v) => v.version === version)
      : versions[0]; // Latest

    if (!targetVersion) {
      throw new Error(
        `Version ${version || 'latest'} not found for ${pluginId}`
      );
    }

    const response = await fetch(targetVersion.downloadUrl);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    return {
      buffer,
      checksum: targetVersion.checksum,
    };
  }

  /**
   * Install plugin from marketplace (via IPC to main process)
   */
  async install(pluginId: string, version?: string): Promise<InstallResult> {
    if (!window.pluginAPI?.installFromUrl) {
      throw new Error('Plugin installation API not available');
    }

    const plugin = await this.getPlugin(pluginId);
    if (!plugin) {
      return {
        success: false,
        pluginId,
        version: version || 'latest',
        error: 'Plugin not found',
      };
    }

    const versions = await this.getVersions(pluginId);
    const targetVersion = version
      ? versions.find((v) => v.version === version)
      : versions[0];

    if (!targetVersion) {
      return {
        success: false,
        pluginId,
        version: version || 'latest',
        error: 'Version not found',
      };
    }

    try {
      const result = await window.pluginAPI.installFromUrl(
        targetVersion.downloadUrl,
        pluginId
      );

      return {
        success: result.success,
        pluginId,
        version: targetVersion.version,
        path: result.path,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        pluginId,
        version: targetVersion.version,
        error: String(error),
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Mock data for development/offline mode
  private getMockSearchResult(options: SearchOptions): SearchResult {
    const mockPlugins: MarketplacePlugin[] = [
      {
        id: 'rust-support',
        name: 'rust-support',
        displayName: 'Rust Language Support',
        description:
          'Adds Rust language support with syntax highlighting and code execution via WASM',
        version: '1.0.0',
        author: 'CheeseJS Community',
        license: 'MIT',
        keywords: ['rust', 'wasm', 'language'],
        categories: ['Languages'],
        downloads: 1250,
        rating: 4.5,
        ratingCount: 23,
        publishedAt: '2025-06-15T10:00:00Z',
        updatedAt: '2025-12-01T15:30:00Z',
        contributes: { languages: 1, transpilers: 1 },
      },
      {
        id: 'go-support',
        name: 'go-support',
        displayName: 'Go Language Support',
        description: 'Go/Golang language support with syntax highlighting',
        version: '0.9.0',
        author: 'CheeseJS Community',
        license: 'MIT',
        keywords: ['go', 'golang', 'language'],
        categories: ['Languages'],
        downloads: 890,
        rating: 4.2,
        ratingCount: 15,
        publishedAt: '2025-08-20T08:00:00Z',
        updatedAt: '2025-11-15T12:00:00Z',
        contributes: { languages: 1 },
      },
      {
        id: 'dracula-theme',
        name: 'dracula-theme',
        displayName: 'Dracula Theme',
        description:
          'A dark theme for CheeseJS based on the popular Dracula color scheme',
        version: '2.1.0',
        author: 'Theme Authors',
        license: 'MIT',
        keywords: ['theme', 'dark', 'dracula'],
        categories: ['Themes'],
        downloads: 3420,
        rating: 4.8,
        ratingCount: 67,
        publishedAt: '2025-03-10T14:00:00Z',
        updatedAt: '2025-10-05T09:00:00Z',
        contributes: { themes: 1 },
      },
      {
        id: 'react-snippets',
        name: 'react-snippets',
        displayName: 'React Snippets',
        description: 'Essential React code snippets for faster development',
        version: '1.2.0',
        author: 'React Devs',
        license: 'MIT',
        keywords: ['react', 'snippets', 'jsx'],
        categories: ['Snippets'],
        downloads: 2150,
        rating: 4.6,
        ratingCount: 42,
        publishedAt: '2025-05-01T16:00:00Z',
        updatedAt: '2025-09-20T11:00:00Z',
        contributes: { snippets: 50 },
      },
    ];

    // Filter by query
    let filtered = mockPlugins;
    if (options.query) {
      const q = options.query.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (options.category) {
      filtered = filtered.filter((p) =>
        p.categories?.includes(options.category!)
      );
    }

    // Sort
    const sortBy = options.sortBy || 'downloads';
    const sortOrder = options.sortOrder || 'desc';
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'downloads':
          cmp = a.downloads - b.downloads;
          break;
        case 'rating':
          cmp = a.rating - b.rating;
          break;
        case 'updated':
          cmp =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    // Paginate
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      plugins: filtered.slice(start, end),
      total: filtered.length,
      page,
      pageSize,
      hasMore: end < filtered.length,
    };
  }

  private getMockFeatured(): MarketplacePlugin[] {
    return this.getMockSearchResult({ sortBy: 'downloads', pageSize: 4 })
      .plugins;
  }

  private getMockCategories(): {
    category: MarketplaceCategory;
    count: number;
  }[] {
    return [
      { category: 'Languages', count: 12 },
      { category: 'Themes', count: 25 },
      { category: 'Snippets', count: 18 },
      { category: 'Formatters', count: 8 },
      { category: 'Linters', count: 6 },
      { category: 'Testing', count: 4 },
      { category: 'Debuggers', count: 3 },
      { category: 'Other', count: 15 },
    ];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const pluginMarketplace = new PluginMarketplace();
