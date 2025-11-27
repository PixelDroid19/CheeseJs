declare module 'json-cycle'
declare module 'stringify-object'

interface Window {
  electronAPI: {
    closeApp: () => void
    maximizeApp: () => void
    unmaximizeApp: () => void
    minimizeApp: () => void
    showContextMenu: () => void
    onToggleMagicComments: (callback: () => void) => void
  }
}
