declare module 'json-cycle'
declare module 'stringify-object'

interface Window {
  electronAPI: {
    closeApp: () => void
    maximizeApp: () => void
    unmaximizeApp: () => void
    onToggleMagicComments: (callback: () => void) => void
  }
}
