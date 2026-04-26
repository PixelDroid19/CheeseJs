import { Monaco } from '@monaco-editor/react';
import { setupTypeAcquisition as setupTypeAcquisitionBase } from '@cheesejs/editor/services/typeAcquisition';
import { usePackagesStore } from '../store/storeHooks';

export function setupTypeAcquisition(monaco: Monaco) {
  return setupTypeAcquisitionBase(monaco, usePackagesStore);
}
