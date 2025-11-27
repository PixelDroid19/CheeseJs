import { create } from 'zustand'
import { WebContainer } from '@webcontainer/api'

interface WebContainerState {
  webContainer: WebContainer | null;
  isLoading: boolean;
  error: Error | null;
  bootWebContainer: () => Promise<void>;
}

export const useWebContainerStore = create<WebContainerState>((set) => ({
  webContainer: null,
  isLoading: true,
  error: null,
  bootWebContainer: async () => {
    try {
      // Add a timeout race to prevent infinite loading
      const bootPromise = WebContainer.boot()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WebContainer boot timed out')), 3000)
      )

      const instance = await Promise.race([bootPromise, timeoutPromise]) as WebContainer
      
      await instance.fs.writeFile(
        'package.json',
        JSON.stringify({
          name: 'jsrunner-sandbox',
          type: 'module'
        })
      )
      set({ webContainer: instance, isLoading: false })
    } catch (err) {
      console.error('WebContainer boot failed:', err)
      set({ error: err as Error, isLoading: false })
    }
  }
}))
