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
      const instance = await WebContainer.boot()
      await instance.fs.writeFile('package.json', JSON.stringify({
        name: 'jsrunner-sandbox',
        type: 'module'
      }))
      set({ webContainer: instance, isLoading: false })
    } catch (err) {
      console.error('Failed to boot WebContainer:', err)
      set({ error: err as Error, isLoading: false })
    }
  }
}))
