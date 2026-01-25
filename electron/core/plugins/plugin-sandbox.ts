/**
 * Plugin Sandbox
 *
 * Security sandbox for plugin execution.
 * Restricts access to dangerous APIs based on plugin permissions.
 */

import vm from 'vm';
import { createMainLogger } from '../logger.js';

const log = createMainLogger('PluginSandbox');

// ============================================================================
// TYPES
// ============================================================================

export type PluginPermission =
  | 'filesystem' // Read/write filesystem access
  | 'network' // HTTP/HTTPS requests
  | 'shell' // Execute shell commands
  | 'clipboard' // Clipboard access
  | 'notifications' // System notifications
  | 'storage' // Plugin storage (always granted)
  | 'editor' // Editor manipulation
  | 'terminal' // Terminal access
  | 'debug'; // Debug capabilities;

import { createRequire } from 'module';

export interface SandboxOptions {
  pluginId: string;
  permissions: PluginPermission[];
  timeout?: number;
}

export interface SandboxedAPI {
  console: Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'debug'>;
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
  Promise: typeof Promise;
  Buffer: typeof Buffer;
  URL: typeof URL;
  URLSearchParams: typeof URLSearchParams;
  TextEncoder: typeof TextEncoder;
  TextDecoder: typeof TextDecoder;
  JSON: typeof JSON;
  Math: typeof Math;
  Date: typeof Date;
  Array: typeof Array;
  Object: typeof Object;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  Map: typeof Map;
  Set: typeof Set;
  WeakMap: typeof WeakMap;
  WeakSet: typeof WeakSet;
  Symbol: typeof Symbol;
  Error: typeof Error;
  RegExp: typeof RegExp;
  require?: NodeRequire;
  fetch?: typeof fetch;
  process?: Partial<typeof process>;
}

// ============================================================================
// PLUGIN SANDBOX CLASS
// ============================================================================

export class PluginSandbox {
  private context: vm.Context | null = null;
  private options: SandboxOptions;
  private timers: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();

  constructor(options: SandboxOptions) {
    this.options = {
      timeout: 30000, // Default 30 second timeout
      ...options,
    };
  }

  /**
   * Check if plugin has a specific permission
   */
  hasPermission(permission: PluginPermission): boolean {
    return this.options.permissions.includes(permission);
  }

  /**
   * Create sandbox context with restricted APIs
   */
  createContext(): vm.Context {
    const sandbox: SandboxedAPI = this.buildSandboxedAPI();

    // Add permission-based APIs
    if (this.hasPermission('filesystem')) {
      sandbox.require = this.createSafeRequire(['fs', 'path']);
    }

    if (this.hasPermission('network')) {
      sandbox.fetch = this.createSafeFetch();
    }

    if (this.hasPermission('debug')) {
      sandbox.process = this.createSafeProcess();
    }

    this.context = vm.createContext(sandbox, {
      name: `plugin-${this.options.pluginId}`,
      codeGeneration: {
        strings: false, // Disable eval()
        wasm: false, // Disable WebAssembly
      },
    });

    return this.context;
  }

  /**
   * Run code in sandbox
   */
  async run<T>(code: string, filename?: string): Promise<T> {
    if (!this.context) {
      this.createContext();
    }

    const script = new vm.Script(code, {
      filename: filename || `${this.options.pluginId}.js`,
    });

    try {
      const result = script.runInContext(this.context!, {
        timeout: this.options.timeout,
        breakOnSigint: true,
      });

      // Handle promises
      if (result instanceof Promise) {
        return await result;
      }

      return result;
    } catch (error) {
      log.error(
        `[PluginSandbox] Execution error in ${this.options.pluginId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Cleanup sandbox resources
   */
  dispose(): void {
    // Clear all timers
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

    this.context = null;
    log.debug(`[PluginSandbox] Disposed sandbox for ${this.options.pluginId}`);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Build base sandboxed API (always available)
   */
  private buildSandboxedAPI(): SandboxedAPI {
    return {
      // Console (safe)
      console: {
        log: (...args: unknown[]) =>
          log.info(`[${this.options.pluginId}]`, ...args),
        info: (...args: unknown[]) =>
          log.info(`[${this.options.pluginId}]`, ...args),
        warn: (...args: unknown[]) =>
          log.warn(`[${this.options.pluginId}]`, ...args),
        error: (...args: unknown[]) =>
          log.error(`[${this.options.pluginId}]`, ...args),
        debug: (...args: unknown[]) =>
          log.debug(`[${this.options.pluginId}]`, ...args),
      },

      // Timers (tracked for cleanup) - use type assertion to avoid Node/Browser type conflicts
      setTimeout: ((callback: () => void, ms?: number) => {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          callback();
        }, ms);
        this.timers.add(timer);
        return timer;
      }) as typeof setTimeout,
      setInterval: ((callback: () => void, ms?: number) => {
        const interval = setInterval(callback, ms);
        this.intervals.add(interval);
        return interval;
      }) as typeof setInterval,
      clearTimeout: ((timer: NodeJS.Timeout) => {
        this.timers.delete(timer);
        clearTimeout(timer);
      }) as typeof clearTimeout,
      clearInterval: ((interval: NodeJS.Timeout) => {
        this.intervals.delete(interval);
        clearInterval(interval);
      }) as typeof clearInterval,

      // Safe globals
      Promise,
      Buffer,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      Error,
      RegExp,
    };
  }

  /**
   * Create safe require function with allowlist
   */
  private createSafeRequire(allowedModules: string[]): NodeRequire {
    const originalRequire = createRequire(import.meta.url);

    const safeRequire = (id: string) => {
      // Check if module is in allowlist
      if (!allowedModules.includes(id) && !id.startsWith('.')) {
        throw new Error(
          `[PluginSandbox] Module '${id}' is not allowed. ` +
            `Allowed modules: ${allowedModules.join(', ')}`
        );
      }

      return originalRequire(id);
    };

    // Copy require properties
    safeRequire.resolve = originalRequire.resolve;
    safeRequire.cache = {};
    safeRequire.extensions = {};
    safeRequire.main = undefined;

    // Cast to NodeRequire
    return safeRequire as unknown as NodeRequire;
  }

  /**
   * Create safe fetch with restrictions
   */
  private createSafeFetch(): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      // Block localhost and internal IPs
      const blockedPatterns = [
        /^https?:\/\/localhost/i,
        /^https?:\/\/127\./,
        /^https?:\/\/0\./,
        /^https?:\/\/10\./,
        /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^https?:\/\/192\.168\./,
        /^file:/i,
      ];

      for (const pattern of blockedPatterns) {
        if (pattern.test(url)) {
          throw new Error(`[PluginSandbox] Access to ${url} is blocked`);
        }
      }

      log.debug(`[PluginSandbox] ${this.options.pluginId} fetching: ${url}`);
      return fetch(input, init);
    };
  }

  /**
   * Create safe process object (limited)
   */
  private createSafeProcess(): Partial<typeof process> {
    return {
      env: {} as NodeJS.ProcessEnv, // Empty env with proper type
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      versions: { ...process.versions },
      cwd: () => '/sandbox', // Fake cwd
      hrtime: process.hrtime,
      nextTick: process.nextTick,
    };
  }
}

// ============================================================================
// CAPABILITY CHECKER
// ============================================================================

export class CapabilityChecker {
  private requiredPermissions: Map<string, PluginPermission[]> = new Map([
    ['fs', ['filesystem']],
    ['fs/promises', ['filesystem']],
    ['path', ['filesystem']],
    ['http', ['network']],
    ['https', ['network']],
    ['net', ['network']],
    ['dgram', ['network']],
    ['child_process', ['shell']],
    ['electron', ['shell', 'clipboard', 'notifications']],
  ]);

  /**
   * Check if module access is allowed
   */
  isModuleAllowed(
    moduleName: string,
    permissions: PluginPermission[]
  ): boolean {
    const required = this.requiredPermissions.get(moduleName);
    if (!required) {
      return true; // Unknown modules are allowed by default
    }

    return required.every((p) => permissions.includes(p));
  }

  /**
   * Get required permissions for a module
   */
  getRequiredPermissions(moduleName: string): PluginPermission[] {
    return this.requiredPermissions.get(moduleName) || [];
  }

  /**
   * Analyze code for required permissions
   */
  analyzeCodePermissions(code: string): PluginPermission[] {
    const permissions: Set<PluginPermission> = new Set();

    // Check for require/import statements
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = requirePattern.exec(code)) !== null) {
      const required = this.requiredPermissions.get(match[1]);
      if (required) {
        required.forEach((p) => permissions.add(p));
      }
    }

    while ((match = importPattern.exec(code)) !== null) {
      const required = this.requiredPermissions.get(match[1]);
      if (required) {
        required.forEach((p) => permissions.add(p));
      }
    }

    // Check for fetch/XMLHttpRequest
    if (/fetch\s*\(|XMLHttpRequest/g.test(code)) {
      permissions.add('network');
    }

    // Check for exec/spawn
    if (/exec\s*\(|spawn\s*\(|execSync\s*\(|spawnSync\s*\(/g.test(code)) {
      permissions.add('shell');
    }

    return Array.from(permissions);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const capabilityChecker = new CapabilityChecker();

/**
 * Create a new sandbox for a plugin
 */
export function createPluginSandbox(options: SandboxOptions): PluginSandbox {
  return new PluginSandbox(options);
}
