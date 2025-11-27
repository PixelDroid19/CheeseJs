import { Minus, Maximize, X } from 'lucide-react'

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
      <nav className="flex items-center justify-between w-full bg-[#282a36] text-white border-b border-[#414457] h-[40px]">
        <div className="flex items-center pl-4 text-zinc-400">
          {/* Menu button removed as requested */}
        </div>
        <div className="flex items-center h-full text-zinc-400">
           <button 
             onClick={handleMinimize} 
             className="hover:bg-zinc-500/50 w-[46px] h-full flex items-center justify-center transition-colors cursor-default"
             title="Minimize"
           >
             <Minus size={18} />
           </button>
           <button 
             onClick={handleMaximize} 
             className="hover:bg-zinc-500/50 w-[46px] h-full flex items-center justify-center transition-colors cursor-default"
             title="Maximize"
           >
             <Maximize size={18} />
           </button>
           <button 
             onClick={handleClose} 
             className="hover:bg-red-500 w-[46px] h-full flex items-center justify-center hover:text-white transition-colors cursor-default"
             title="Close"
           >
             <X size={18} />
           </button>
        </div>
      </nav>
    </header>
  )
}
