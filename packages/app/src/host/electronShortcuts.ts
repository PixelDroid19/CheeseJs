export function subscribeToMagicCommentsShortcut(callback: () => void) {
  return window.electronAPI?.onToggleMagicComments?.(callback);
}
