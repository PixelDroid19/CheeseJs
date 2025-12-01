import { Minus, Maximize, X, Wifi, WifiOff } from 'lucide-react'
import { useWebContainerStore } from '../store/useWebContainerStore'

export function TitleBar() {
  const webContainer = useWebContainerStore((state) => state.webContainer)
  const isLoading = useWebContainerStore((state) => state.isLoading)
  const error = useWebContainerStore((state) => state.error)

  const handleMinimize = () => {
    window.electronAPI.minimizeApp()
  }

  const handleMaximize = () => {
    // Toggles maximize/unmaximize in the main process
    window.electronAPI.maximizeApp()
  }

  const handleClose = () => {
    window.electronAPI.closeApp()
  }

  return (
    <header className="titlebar select-none">
      <nav className="flex items-center justify-between w-full bg-muted text-foreground border-b border-border h-[40px]">
        <div className="flex items-center pl-4 text-muted-foreground gap-3">
          {/* Menu button removed as requested */}
           <div className="flex items-center gap-2 text-xs">
            {isLoading ? (
              <span className="text-yellow-500 animate-pulse">Booting...</span>
            ) : error ? (
               <div className="flex items-center gap-1 text-destructive" title={error.message}>
                 <WifiOff size={14} />
                 <span>Offline</span>
               </div>
            ) : webContainer ? (
               <div className="flex items-center gap-1 text-green-500">
                 <Wifi size={14} />
                 <span>Online</span>
               </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center h-full text-muted-foreground">
           <button 
             onClick={handleMinimize} 
             className="hover:bg-accent w-[46px] h-full flex items-center justify-center transition-colors cursor-default"
             title="Minimize"
           >
             <Minus size={18} />
           </button>
           <button 
             onClick={handleMaximize} 
             className="hover:bg-accent w-[46px] h-full flex items-center justify-center transition-colors cursor-default"
             title="Maximize"
           >
             <Maximize size={18} />
           </button>
           <button 
             onClick={handleClose} 
             className="hover:bg-destructive w-[46px] h-full flex items-center justify-center hover:text-destructive-foreground transition-colors cursor-default"
             title="Close"
           >
             <X size={18} />
           </button>
        </div>
      </nav>
    </header>
  )
}
