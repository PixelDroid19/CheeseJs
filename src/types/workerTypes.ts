/**
 * Unified Worker Communication Types
 *
 * Central type definitions for all IPC and worker thread communication.
 * Ensures type safety between main process, workers, and renderer.
 */

// ============================================================================
// LANGUAGES
// ============================================================================

export type Language = 'javascript' | 'typescript' | 'python';

export const SUPPORTED_LANGUAGES: Language[] = [
  'javascript',
  'typescript',
  'python',
];

export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language);
}

// ============================================================================
// EXECUTION
// ============================================================================

export interface ExecutionOptions {
  timeout?: number;
  showUndefined?: boolean;
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  magicComments?: boolean;
  language?: Language;
}

export interface ExecutionRequest {
  id: string;
  code: string;
  language: Language;
  options: ExecutionOptions;
}

// Result types from worker
export type ResultType =
  | 'result'
  | 'console'
  | 'debug'
  | 'error'
  | 'complete'
  | 'status';

export type ConsoleType = 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';

export interface ExecutionResult {
  type: ResultType;
  id: string;
  data?: unknown;
  line?: number;
  jsType?: string;
  consoleType?: ConsoleType;
}

export interface ExecutionError {
  name: string;
  message: string;
  stack?: string;
}

export interface ExecutionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// WORKER STATUS
// ============================================================================

export interface WorkerStatus {
  language: Language;
  ready: boolean;
  loading: boolean;
  message?: string;
  progress?: number;
}

// ============================================================================
// DETECTION
// ============================================================================

export interface DetectionResult {
  monacoId: string;
  confidence: number;
  isExecutable: boolean;
}

export interface LanguageInfo {
  id: string;
  monacoId: string;
  displayName: string;
  extensions: string[];
  isExecutable: boolean;
}

// ============================================================================
// PACKAGES
// ============================================================================

export interface PackageInfo {
  name: string;
  version: string;
  path?: string;
}

export interface PackageInstallResult {
  success: boolean;
  packageName: string;
  version?: string;
  error?: string;
}

// ============================================================================
// RESULTS FOR UI
// ============================================================================

export interface ResultElement {
  content: string;
  color?: string;
  jsType?: string;
  consoleType?: ConsoleType;
}

export interface UIResult {
  lineNumber?: number;
  element: ResultElement;
  type: 'execution' | 'error';
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_TIMEOUT = 30000;
export const MAX_RESULTS = 1000;
export const EXECUTION_DEBOUNCE_MS = 100;
