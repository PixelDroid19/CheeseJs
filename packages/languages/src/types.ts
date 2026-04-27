import type { LspLanguageConfig } from '@cheesejs/core';
import type { Language } from '@cheesejs/core/contracts/workerTypes';

export type LanguageId = string;
export type PackageEcosystemId = 'npm' | 'pypi';
export type RuntimeProviderId = 'node-vm' | 'pyodide' | 'wasi-clang';
export type ExecutionLanguageId = Language;

export interface LanguageDescriptor {
  id: LanguageId;
  monacoId: string;
  displayName: string;
  extensions: string[];
  executable: boolean;
  executionLanguage?: ExecutionLanguageId;
  runtimeProvider?: RuntimeProviderId;
  packageEcosystem?: PackageEcosystemId;
  lsp?: LspLanguageConfig;
}

export interface DetectionResult {
  monacoId: string;
  confidence: number;
  isExecutable: boolean;
  source: 'ml' | 'parser' | 'sticky';
}

export interface DetectionContext {
  currentLanguage?: string;
}

export interface ParserDetectionCandidate {
  monacoId: string;
  confidence: number;
  score: number;
  errors: number;
  executable: boolean;
  tsSpecificSyntax?: boolean;
}
