import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  magicComments: boolean;
  executionEnvironment: 'node' | 'browser';
  autoRunAfterInstall: boolean;
  autoInstallPackages: boolean;
  uiFontSize: number;
  captureTheme: string;
  captureIncludeOutput: boolean;
  showTestPanel: boolean;
  showConsole: boolean;
  consoleFilters: {
    log: boolean;
    warn: boolean;
    error: boolean;
    info: boolean;
  };
  splitDirection: 'horizontal' | 'vertical';
  setLanguage: (lang: string) => void;
  setThemeName: (theme: string) => void;
  setFontSize: (size: number) => void;

  setUiFontSize: (size: number) => void;
  setCaptureTheme: (theme: string) => void;
  setCaptureIncludeOutput: (include: boolean) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  toggleSettings: () => void;
  setShowTopLevelResults: (show: boolean) => void;
  setAlignResults: (align: boolean) => void;
  setShowUndefined: (show: boolean) => void;
  setLoopProtection: (protect: boolean) => void;
  setInternalLogLevel: (
    level: 'none' | 'error' | 'warn' | 'info' | 'debug'
  ) => void;
  setNpmRcContent: (content: string) => void;
  setMagicComments: (enabled: boolean) => void;
  setExecutionEnvironment: (env: 'node' | 'browser') => void;
  setAutoRunAfterInstall: (autoRun: boolean) => void;
  setAutoInstallPackages: (autoInstall: boolean) => void;
  setShowTestPanel: (show: boolean) => void;
  toggleTestPanel: () => void;
  setShowConsole: (show: boolean) => void;
  toggleConsole: () => void;
  setConsoleFilters: (
    filters: Partial<SettingsState['consoleFilters']>
  ) => void;
  setSplitDirection: (direction: 'horizontal' | 'vertical') => void;
  toggleSplitDirection: () => void;
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
      magicComments: true,
      executionEnvironment: 'node',
      autoRunAfterInstall: true,
      autoInstallPackages: true, // Default to auto-install
      uiFontSize: 14,
      captureTheme: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      captureIncludeOutput: true,
      showTestPanel: false,
      showConsole: false,
      consoleFilters: {
        log: true,
        warn: true,
        error: true,
        info: true,
      },
      splitDirection: 'horizontal',
      setLanguage: (language) => set({ language }),
      setThemeName: (themeName) => set({ themeName }),
      setFontSize: (fontSize) => set({ fontSize }),
      setUiFontSize: (uiFontSize) => set({ uiFontSize }),
      setCaptureTheme: (captureTheme) => set({ captureTheme }),
      setCaptureIncludeOutput: (captureIncludeOutput) =>
        set({ captureIncludeOutput }),
      setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      toggleSettings: () =>
        set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      setShowTopLevelResults: (showTopLevelResults) =>
        set({ showTopLevelResults }),
      setAlignResults: (alignResults) => set({ alignResults }),
      setShowUndefined: (showUndefined) => set({ showUndefined }),
      setLoopProtection: (loopProtection) => set({ loopProtection }),
      setInternalLogLevel: (internalLogLevel) => set({ internalLogLevel }),
      setNpmRcContent: (npmRcContent) => set({ npmRcContent }),
      setMagicComments: (magicComments) => set({ magicComments }),
      setExecutionEnvironment: (executionEnvironment) =>
        set({ executionEnvironment }),
      setAutoRunAfterInstall: (autoRunAfterInstall) =>
        set({ autoRunAfterInstall }),
      setAutoInstallPackages: (autoInstallPackages) =>
        set({ autoInstallPackages }),
      setShowTestPanel: (showTestPanel) => set({ showTestPanel }),
      toggleTestPanel: () =>
        set((state) => ({ showTestPanel: !state.showTestPanel })),
      setShowConsole: (showConsole) => set({ showConsole }),
      toggleConsole: () =>
        set((state) => ({ showConsole: !state.showConsole })),
      setConsoleFilters: (filters) =>
        set((state) => ({
          consoleFilters: { ...state.consoleFilters, ...filters },
        })),
      setSplitDirection: (splitDirection) => set({ splitDirection }),
      toggleSplitDirection: () =>
        set((state) => ({
          splitDirection:
            state.splitDirection === 'horizontal' ? 'vertical' : 'horizontal',
        })),
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
        npmRcContent: state.npmRcContent,
        magicComments: state.magicComments,
        uiFontSize: state.uiFontSize,
        executionEnvironment: state.executionEnvironment,
        autoRunAfterInstall: state.autoRunAfterInstall,
        autoInstallPackages: state.autoInstallPackages,
        captureTheme: state.captureTheme,
        captureIncludeOutput: state.captureIncludeOutput,
        showConsole: state.showConsole,
        consoleFilters: state.consoleFilters,
        splitDirection: state.splitDirection,
      }),
    }
  )
);
