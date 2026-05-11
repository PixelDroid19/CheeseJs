import { hostBridge } from './hostBridge';

export function subscribeToMagicCommentsShortcut(callback: () => void) {
  return hostBridge.windowControls.onToggleMagicComments(callback);
}
