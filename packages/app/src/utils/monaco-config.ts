import type { Monaco } from '@monaco-editor/react';
import { themes } from '@cheesejs/themes';
import {
  configureMonaco as configureMonacoBase,
  setupMonacoEnvironment,
} from '@cheesejs/editor/utils/monaco-config';

export { setupMonacoEnvironment };

export function configureMonaco(monaco: Monaco) {
  configureMonacoBase(monaco, themes);
}
