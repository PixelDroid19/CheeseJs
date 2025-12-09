/**
 * Dependency Detector
 * 
 * Detects missing dependencies in JavaScript/TypeScript and Python code
 * before execution to provide helpful error messages and auto-install prompts.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DetectedDependency {
  /** Package name */
  name: string;
  /** Import statement or require call */
  importStatement: string;
  /** Line number where import/require appears */
  line: number;
  /** Whether this is a built-in module */
  isBuiltin: boolean;
  /** Whether the package is already installed */
  isInstalled?: boolean;
}

export interface DependencyDetectionResult {
  /** List of detected dependencies */
  dependencies: DetectedDependency[];
  /** Dependencies that appear to be missing */
  missing: DetectedDependency[];
  /** Language of the code */
  language: 'javascript' | 'typescript' | 'python';
}

// ============================================================================
// BUILT-IN MODULES
// ============================================================================

/** Node.js built-in modules */
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https',
  'module', 'net', 'os', 'path', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'tty',
  'url', 'util', 'v8', 'vm', 'zlib', 'worker_threads', 'perf_hooks',
  'async_hooks', 'trace_events', 'inspector', 'wasi',
  // Node.js prefixed versions
  'node:assert', 'node:buffer', 'node:child_process', 'node:cluster',
  'node:console', 'node:constants', 'node:crypto', 'node:dgram',
  'node:dns', 'node:domain', 'node:events', 'node:fs', 'node:http',
  'node:https', 'node:module', 'node:net', 'node:os', 'node:path',
  'node:punycode', 'node:querystring', 'node:readline', 'node:repl',
  'node:stream', 'node:string_decoder', 'node:sys', 'node:timers',
  'node:tls', 'node:tty', 'node:url', 'node:util', 'node:v8', 'node:vm',
  'node:zlib', 'node:worker_threads', 'node:perf_hooks', 'node:async_hooks',
  'node:trace_events', 'node:inspector', 'node:wasi', 'node:test',
]);

/** Python standard library modules (common ones) */
const PYTHON_STDLIB = new Set([
  // Built-in types and functions
  'builtins', '__future__',
  // Text processing
  'string', 're', 'difflib', 'textwrap', 'unicodedata', 'stringprep',
  // Binary data
  'struct', 'codecs',
  // Data types
  'datetime', 'calendar', 'collections', 'heapq', 'bisect', 'array',
  'weakref', 'types', 'copy', 'pprint', 'reprlib', 'enum', 'graphlib',
  // Numeric and math
  'numbers', 'math', 'cmath', 'decimal', 'fractions', 'random', 'statistics',
  // Functional
  'itertools', 'functools', 'operator',
  // File and directory
  'pathlib', 'fileinput', 'stat', 'filecmp', 'tempfile', 'glob', 'fnmatch',
  'linecache', 'shutil',
  // Data persistence
  'pickle', 'copyreg', 'shelve', 'dbm', 'sqlite3',
  // Data compression
  'zlib', 'gzip', 'bz2', 'lzma', 'zipfile', 'tarfile',
  // File formats
  'csv', 'configparser', 'tomllib', 'netrc', 'plistlib',
  // Cryptographic
  'hashlib', 'hmac', 'secrets',
  // OS services
  'os', 'io', 'time', 'argparse', 'getopt', 'logging', 'getpass', 'curses',
  'platform', 'errno', 'ctypes',
  // Concurrent execution
  'threading', 'multiprocessing', 'concurrent', 'subprocess', 'sched',
  'queue', 'contextvars',
  // Networking
  'asyncio', 'socket', 'ssl', 'select', 'selectors', 'signal',
  // Internet data
  'email', 'json', 'mailbox', 'mimetypes', 'base64', 'binascii', 'quopri',
  // HTML/XML
  'html', 'xml',
  // Internet protocols
  'webbrowser', 'wsgiref', 'urllib', 'http', 'ftplib', 'poplib', 'imaplib',
  'smtplib', 'uuid', 'socketserver', 'xmlrpc', 'ipaddress',
  // Multimedia
  'wave', 'colorsys',
  // Internationalization
  'gettext', 'locale',
  // Program frameworks
  'turtle', 'cmd', 'shlex',
  // GUI
  'tkinter',
  // Development
  'typing', 'pydoc', 'doctest', 'unittest', 'test',
  // Debugging
  'bdb', 'faulthandler', 'pdb', 'timeit', 'trace', 'tracemalloc',
  // Runtime
  'sys', 'sysconfig', 'warnings', 'dataclasses', 'contextlib', 'abc', 'atexit',
  'traceback', 'gc', 'inspect', 'site',
  // Importing
  'importlib', 'zipimport', 'pkgutil', 'modulefinder', 'runpy',
  // Python language
  'ast', 'symtable', 'token', 'keyword', 'tokenize', 'tabnanny', 'pyclbr',
  'py_compile', 'compileall', 'dis', 'pickletools',
  // Other
  'formatter',
]);

/** Packages available in Pyodide by default */
const PYODIDE_BUILTINS = new Set([
  'micropip', 'pyodide', 'js', 'pyodide_js',
]);

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

/** Pattern to match ES6 import statements */
const ES6_IMPORT_PATTERN = /^\s*import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*(?:from\s+)?['"]([^'"]+)['"]/gm;

/** Pattern to match require() calls */
const REQUIRE_PATTERN = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Pattern to match dynamic import() */
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Pattern to match Python import statements */
const PYTHON_IMPORT_PATTERN = /^\s*(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Extract package name from import path
 * e.g., 'lodash/debounce' -> 'lodash'
 *       '@scope/package/file' -> '@scope/package'
 */
function extractPackageName(importPath: string): string {
  // Handle scoped packages
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  }
  
  // Regular packages
  const parts = importPath.split('/');
  return parts[0];
}

/**
 * Extract Python module name from import path
 * e.g., 'numpy.random' -> 'numpy'
 */
function extractPythonModuleName(importPath: string): string {
  const parts = importPath.split('.');
  return parts[0];
}

/**
 * Detect dependencies in JavaScript/TypeScript code
 */
export function detectJSDependencies(code: string): DetectedDependency[] {
  const dependencies: DetectedDependency[] = [];
  const seen = new Set<string>();
  
  // Split into lines to track line numbers
  const lines = code.split('\n');
  
  // Find ES6 imports
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    ES6_IMPORT_PATTERN.lastIndex = 0;
    const match = ES6_IMPORT_PATTERN.exec(line);
    
    if (match) {
      const importPath = match[1];
      const packageName = extractPackageName(importPath);
      
      // Skip relative imports
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        continue;
      }
      
      if (!seen.has(packageName)) {
        seen.add(packageName);
        dependencies.push({
          name: packageName,
          importStatement: line.trim(),
          line: i + 1,
          isBuiltin: NODE_BUILTINS.has(packageName),
        });
      }
    }
  }
  
  // Find require() calls
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    REQUIRE_PATTERN.lastIndex = 0;
    let match;
    
    while ((match = REQUIRE_PATTERN.exec(line)) !== null) {
      const importPath = match[1];
      const packageName = extractPackageName(importPath);
      
      // Skip relative imports
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        continue;
      }
      
      if (!seen.has(packageName)) {
        seen.add(packageName);
        dependencies.push({
          name: packageName,
          importStatement: match[0],
          line: i + 1,
          isBuiltin: NODE_BUILTINS.has(packageName),
        });
      }
    }
  }
  
  // Find dynamic imports
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    DYNAMIC_IMPORT_PATTERN.lastIndex = 0;
    let match;
    
    while ((match = DYNAMIC_IMPORT_PATTERN.exec(line)) !== null) {
      const importPath = match[1];
      const packageName = extractPackageName(importPath);
      
      // Skip relative imports
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        continue;
      }
      
      if (!seen.has(packageName)) {
        seen.add(packageName);
        dependencies.push({
          name: packageName,
          importStatement: match[0],
          line: i + 1,
          isBuiltin: NODE_BUILTINS.has(packageName),
        });
      }
    }
  }
  
  return dependencies;
}

/**
 * Detect dependencies in Python code
 */
export function detectPythonDependencies(code: string): DetectedDependency[] {
  const dependencies: DetectedDependency[] = [];
  const seen = new Set<string>();
  
  // Split into lines to track line numbers
  const lines = code.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    PYTHON_IMPORT_PATTERN.lastIndex = 0;
    const match = PYTHON_IMPORT_PATTERN.exec(line);
    
    if (match) {
      const importPath = match[1] || match[2];
      if (!importPath) continue;
      
      // Handle comma-separated imports: import os, sys, json
      const modules = importPath.split(',').map(m => m.trim());
      
      for (const mod of modules) {
        const moduleName = extractPythonModuleName(mod);
        
        if (!seen.has(moduleName)) {
          seen.add(moduleName);
          const isBuiltin = PYTHON_STDLIB.has(moduleName) || PYODIDE_BUILTINS.has(moduleName);
          
          dependencies.push({
            name: moduleName,
            importStatement: line.trim(),
            line: i + 1,
            isBuiltin,
          });
        }
      }
    }
  }
  
  return dependencies;
}

/**
 * Check which packages are installed (via window APIs)
 */
export async function checkInstalledPackages(
  dependencies: DetectedDependency[],
  language: 'javascript' | 'typescript' | 'python'
): Promise<DetectedDependency[]> {
  // Filter out built-ins first
  const externalDeps = dependencies.filter(d => !d.isBuiltin);
  
  if (externalDeps.length === 0) {
    return dependencies;
  }
  
  try {
    if (language === 'python') {
      // Check Python packages via Pyodide
      if (typeof window !== 'undefined' && window.pythonPackageManager) {
        const result = await window.pythonPackageManager.listInstalled();
        if (result.success) {
          const installedSet = new Set(result.packages.map(p => p.toLowerCase()));
          
          for (const dep of externalDeps) {
            dep.isInstalled = installedSet.has(dep.name.toLowerCase());
          }
        }
      }
    } else {
      // Check npm packages
      if (typeof window !== 'undefined' && window.packageManager) {
        const result = await window.packageManager.list();
        if (result.success) {
          const installedSet = new Set(result.packages.map(p => p.name.toLowerCase()));
          
          for (const dep of externalDeps) {
            dep.isInstalled = installedSet.has(dep.name.toLowerCase());
          }
        }
      }
    }
  } catch (e) {
    console.warn('[DependencyDetector] Error checking installed packages:', e);
  }
  
  return dependencies;
}

/**
 * Detect dependencies and check installation status
 */
export async function detectDependencies(
  code: string,
  language: 'javascript' | 'typescript' | 'python'
): Promise<DependencyDetectionResult> {
  let dependencies: DetectedDependency[];
  
  if (language === 'python') {
    dependencies = detectPythonDependencies(code);
  } else {
    dependencies = detectJSDependencies(code);
  }
  
  // Check which are installed
  await checkInstalledPackages(dependencies, language);
  
  // Filter missing packages (not built-in and not installed)
  const missing = dependencies.filter(
    d => !d.isBuiltin && d.isInstalled === false
  );
  
  return {
    dependencies,
    missing,
    language,
  };
}

/**
 * Get suggested packages for common typos or alternative names
 */
export function getSuggestedPackages(packageName: string, language: string): string[] {
  const suggestions: string[] = [];
  
  // Common package alternatives
  const alternatives: Record<string, string[]> = {
    // JavaScript
    'lodash': ['lodash-es', 'underscore'],
    'moment': ['dayjs', 'date-fns', 'luxon'],
    'request': ['axios', 'node-fetch', 'got'],
    'express': ['fastify', 'koa', 'hapi'],
    'mocha': ['jest', 'vitest', 'ava'],
    
    // Python
    'sklearn': ['scikit-learn'],
    'cv2': ['opencv-python'],
    'PIL': ['pillow'],
    'yaml': ['pyyaml'],
    'bs4': ['beautifulsoup4'],
  };
  
  if (alternatives[packageName]) {
    suggestions.push(...alternatives[packageName]);
  }
  
  return suggestions;
}

/**
 * Format missing dependencies as user-friendly message
 */
export function formatMissingDependencies(result: DependencyDetectionResult): string | null {
  if (result.missing.length === 0) {
    return null;
  }
  
  const packageManager = result.language === 'python' ? 'PyPI' : 'npm';
  const packageNames = result.missing.map(d => d.name).join(', ');
  
  if (result.missing.length === 1) {
    const pkg = result.missing[0];
    const suggestions = getSuggestedPackages(pkg.name, result.language);
    let message = `📦 Missing package: ${pkg.name}\n\nInstall it via Settings → ${packageManager}`;
    
    if (suggestions.length > 0) {
      message += `\n\nAlternatives: ${suggestions.join(', ')}`;
    }
    
    return message;
  }
  
  return `📦 Missing packages: ${packageNames}\n\nInstall them via Settings → ${packageManager}`;
}

