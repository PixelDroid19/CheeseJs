import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useAppStore } from './index';

export {
  clearDetectionCache,
  createLanguageSlice,
  partializeLanguage,
  selectCurrentLanguage,
  selectIsDetecting,
} from '@cheesejs/editor/state/useLanguageStore';
export type {
  DetectionResult,
  LanguageInfo,
  LanguageState,
} from '@cheesejs/editor/state/useLanguageStore';
export { useLanguageStore } from './storeHooks';

export function detectLanguageSync(content: string) {
  return useAppStore.getState().language.detectLanguage(content);
}

export async function detectLanguageAsync(content: string) {
  return useAppStore.getState().language.detectLanguageAsync(content);
}

export function isLanguageExecutable(languageId: string): boolean {
  return useAppStore.getState().language.isExecutable(languageId);
}

export function initializeLanguageDetection(): Promise<void> {
  return useAppStore.getState().language.initializeModel();
}

export function getLanguageDisplayName(languageId: string): string {
  return useAppStore.getState().language.getDisplayName(languageId);
}

export function setMonacoInstance(monaco: typeof Monaco): void {
  useAppStore.getState().language.setMonacoInstance(monaco);
}
