import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Theme {
  name: string;
  type: 'vs-dark' | 'vs-light' | 'hc-black';
  colors: Record<string, string>;
  rules: Array<{ token: string; foreground?: string; background?: string; fontStyle?: string }>;
}

interface SettingsState {
  language: string;
  themeName: string;
  fontSize: number;
  isSettingsOpen: boolean;
  showTopLevelResults: boolean;
  alignResults: boolean;
  showUndefined: boolean;
  loopProtection: boolean;
  setLanguage: (lang: string) => void;
  setThemeName: (theme: string) => void;
  setFontSize: (size: number) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  toggleSettings: () => void;
  setShowTopLevelResults: (show: boolean) => void;
  setAlignResults: (align: boolean) => void;
  setShowUndefined: (show: boolean) => void;
  setLoopProtection: (protect: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      themeName: 'onedark',
      fontSize: 19,
      isSettingsOpen: false,
      showTopLevelResults: true,
      alignResults: true,
      showUndefined: false,
      loopProtection: true,
      setLanguage: (language) => set({ language }),
      setThemeName: (themeName) => set({ themeName }),
      setFontSize: (fontSize) => set({ fontSize }),
      setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      setShowTopLevelResults: (showTopLevelResults) => set({ showTopLevelResults }),
      setAlignResults: (alignResults) => set({ alignResults }),
      setShowUndefined: (showUndefined) => set({ showUndefined }),
      setLoopProtection: (loopProtection) => set({ loopProtection })
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        language: state.language,
        themeName: state.themeName,
        fontSize: state.fontSize,
        showTopLevelResults: state.showTopLevelResults,
        alignResults: state.alignResults,
        showUndefined: state.showUndefined,
        loopProtection: state.loopProtection
      })
    }
  )
)
