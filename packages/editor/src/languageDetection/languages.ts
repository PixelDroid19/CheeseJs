/**
 * Language Registry
 *
 * Centralized definitions for supported programming languages.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LanguageInfo {
  id: string; // Short ID (e.g., 'py', 'ts', 'js')
  monacoId: string; // Monaco language ID (e.g., 'python', 'typescript')
  displayName: string; // Human-readable name
  extensions: string[]; // File extensions
  isExecutable: boolean; // Can be executed in CheeseJS
}

// ============================================================================
// LANGUAGE REGISTRY
// ============================================================================

export const LANGUAGES: Record<string, LanguageInfo> = {
  // Executable languages
  typescript: {
    id: 'ts',
    monacoId: 'typescript',
    displayName: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    isExecutable: true,
  },
  javascript: {
    id: 'js',
    monacoId: 'javascript',
    displayName: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs'],
    isExecutable: true,
  },
  python: {
    id: 'py',
    monacoId: 'python',
    displayName: 'Python',
    extensions: ['.py', '.pyw'],
    isExecutable: true,
  },

  // Non-executable languages
  html: {
    id: 'html',
    monacoId: 'html',
    displayName: 'HTML',
    extensions: ['.html', '.htm'],
    isExecutable: false,
  },
  css: {
    id: 'css',
    monacoId: 'css',
    displayName: 'CSS',
    extensions: ['.css'],
    isExecutable: false,
  },
  json: {
    id: 'json',
    monacoId: 'json',
    displayName: 'JSON',
    extensions: ['.json'],
    isExecutable: false,
  },
  markdown: {
    id: 'md',
    monacoId: 'markdown',
    displayName: 'Markdown',
    extensions: ['.md', '.markdown'],
    isExecutable: false,
  },
};

/**
 * Map detection IDs to Monaco IDs
 */
export const DETECTION_TO_MONACO: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  php: 'php',
  swift: 'swift',
  sh: 'shell',
  ps1: 'powershell',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'markdown',
  sql: 'sql',
  yaml: 'yaml',
  xml: 'xml',
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get language info by Monaco ID
 */
export function getLanguageInfo(languageId: string): LanguageInfo | undefined {
  return LANGUAGES[languageId];
}

/**
 * Check if a language is executable
 */
export function isExecutable(languageId: string): boolean {
  const info = LANGUAGES[languageId];
  return info?.isExecutable ?? false;
}

/**
 * Get display name for a language
 */
export function getDisplayName(languageId: string): string {
  const info = LANGUAGES[languageId];
  return info?.displayName ?? languageId;
}
