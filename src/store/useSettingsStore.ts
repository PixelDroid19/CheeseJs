

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

export interface SettingsState {
  consoleFilters: {
    log: boolean;
    info: boolean;
    warn: boolean;
    error: boolean;
  };
  showTestPanel: boolean;
  showConsole: boolean;
  splitDirection: 'horizontal' | 'vertical';
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
  fontLigatures: boolean;
  workingDirectory: string;
  setLanguage: (lang: string) => void;
  setThemeName: (theme: string) => void;
  setFontSize: (size: number) => void;
  setUiFontSize: (size: number) => void;
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
  setFontLigatures: (enabled: boolean) => void;
  setWorkingDirectory: (dir: string) => void;
  setAutoRunAfterInstall: (autoRun: boolean) => void;
  setAutoInstallPackages: (autoInstall: boolean) => void;
  setConsoleFilters: (
    filters: Partial<{
      log: boolean;
      info: boolean;
      warn: boolean;
      error: boolean;
    }>
  ) => void;
  toggleTestPanel: () => void;
  toggleConsole: () => void;
  toggleSplitDirection: () => void;
}

export const createSettingsSlice: import('zustand').StateCreator<SettingsState> = (set) => ({
  consoleFilters: {
    log: true,
    info: true,
    warn: true,
    error: true,
  },
  showTestPanel: false,
  showConsole: false,
  splitDirection: 'horizontal',
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
  fontLigatures: true,
  workingDirectory: '',
  setLanguage: (language) => set({ language }),
  setThemeName: (themeName) => set({ themeName }),
  setFontSize: (fontSize) => set({ fontSize }),
  setUiFontSize: (uiFontSize) => set({ uiFontSize }),
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
  setFontLigatures: (fontLigatures: boolean) => set({ fontLigatures }),
  setWorkingDirectory: (workingDirectory: string) => set({ workingDirectory }),
  setAutoRunAfterInstall: (autoRunAfterInstall) =>
    set({ autoRunAfterInstall }),
  setAutoInstallPackages: (autoInstallPackages) =>
    set({ autoInstallPackages }),
  setConsoleFilters: (filters) =>
    set((state) => ({
      consoleFilters: { ...state.consoleFilters, ...filters },
    })),
  toggleTestPanel: () =>
    set((state) => ({ showTestPanel: !state.showTestPanel })),
  toggleConsole: () =>
    set((state) => ({ showConsole: !state.showConsole })),
  toggleSplitDirection: () =>
    set((state) => ({
      splitDirection:
        state.splitDirection === 'horizontal' ? 'vertical' : 'horizontal',
    })),
});

export const partializeSettings = (state: SettingsState) => ({
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
  fontLigatures: state.fontLigatures,
  workingDirectory: state.workingDirectory,
  executionEnvironment: state.executionEnvironment,
  autoRunAfterInstall: state.autoRunAfterInstall,
  autoInstallPackages: state.autoInstallPackages,
  consoleFilters: state.consoleFilters,
  showTestPanel: state.showTestPanel,
  showConsole: state.showConsole,
  splitDirection: state.splitDirection,
});

