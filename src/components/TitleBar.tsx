import { Minus, Maximize, X, Zap } from 'lucide-react'

export function TitleBar() {
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
      <nav className="flex items-center justify-between w-full bg-muted text-foreground border-b border-border h-10">
        <div className="flex items-center pl-4 text-muted-foreground gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-green-500">
              <Zap size={14} />
              <span>VM Ready</span>
            </div>
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
