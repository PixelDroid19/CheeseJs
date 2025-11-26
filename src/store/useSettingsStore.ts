import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Theme {
  name: string;
  type: 'vs-dark' | 'vs-light' | 'hc-black';
  colors: Record<string, string>;
  rules: Array<{
    token: string;
    foreground?: string;
    background?: string;
    fontStyle?: string;
  }>;
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
  internalLogLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  npmRcContent: string;
  setLanguage: (lang: string) => void;
  setThemeName: (theme: string) => void;
  setFontSize: (size: number) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  toggleSettings: () => void;
  setShowTopLevelResults: (show: boolean) => void;
  setAlignResults: (align: boolean) => void;
  setShowUndefined: (show: boolean) => void;
  setLoopProtection: (protect: boolean) => void;
  setInternalLogLevel: (level: 'none' | 'error' | 'warn' | 'info' | 'debug') => void;
  setNpmRcContent: (content: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      themeName: 'onedark',
      fontSize: 19,
      isSettingsOpen: false,
      showTopLevelResults: true,
      alignResults: false,
      showUndefined: false,
      loopProtection: true,
      internalLogLevel: 'none',
      npmRcContent: 'registry=https://registry.npmjs.org/\nstrict-ssl=true',
      setLanguage: (language) => set({ language }),
      setThemeName: (themeName) => set({ themeName }),
      setFontSize: (fontSize) => set({ fontSize }),
      setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      toggleSettings: () =>
        set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      setShowTopLevelResults: (showTopLevelResults) =>
        set({ showTopLevelResults }),
      setAlignResults: (alignResults) => set({ alignResults }),
      setShowUndefined: (showUndefined) => set({ showUndefined }),
      setLoopProtection: (loopProtection) => set({ loopProtection }),
      setInternalLogLevel: (internalLogLevel) => set({ internalLogLevel }),
      setNpmRcContent: (npmRcContent) => set({ npmRcContent })
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
        loopProtection: state.loopProtection,
        internalLogLevel: state.internalLogLevel,
        npmRcContent: state.npmRcContent
      })
    }
  )
)
