import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '../__test__/test-utils';
import ResultDisplay from './Result';

// ── Mocks ──────────────────────────────────────────────────────────────

// Monaco Editor mock
vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({
    value,
    beforeMount,
  }: {
    value?: string;
    beforeMount?: (monaco: unknown) => void;
    [key: string]: unknown;
  }) => {
    // Call beforeMount if provided to test the theme registration path
    if (beforeMount) {
      beforeMount({
        editor: { defineTheme: vi.fn() },
        languages: {
          typescript: {
            javascriptDefaults: { setEagerModelSync: vi.fn() },
          },
        },
      });
    }
    return <pre data-testid="monaco-editor">{value}</pre>;
  },
}));

// Framer motion mock
vi.mock('framer-motion', () => {
  const component = (props: any) => <div {...props}>{props.children}</div>;
  return {
    m: {
      div: component,
      button: (props: any) => <button {...props}>{props.children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// ConsoleInput mock
vi.mock('./ConsoleInput', () => ({
  ConsoleInput: () => <div data-testid="console-input">ConsoleInput</div>,
}));

// Theme mock
vi.mock('../themes', () => ({
  themes: {
    'test-theme': {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {},
    },
  },
}));

// Store mocks
const mockCodeStoreState = {
  result: [] as Array<{
    type?: string;
    lineNumber?: number;
    action?: { payload?: string };
    element?: { content?: string; consoleType?: string };
  }>,
  code: '',
};

const mockSettingsState = {
  themeName: 'test-theme',
  fontSize: 14,
  alignResults: false,
  consoleFilters: {
    log: true,
    info: true,
    warn: true,
    error: true,
  },
  toggleConsoleFilter: vi.fn(),
};

// Create a reactive mock hook reference
let currentSettings = mockSettingsState;
const useSettingsStoreMock = vi.fn((selector) =>
  selector ? selector(currentSettings) : currentSettings
);



const mockAddPackage = vi.fn();
const mockSetPackageInstalling = vi.fn();
const mockSetPackageInstalled = vi.fn();
const mockSetPackageError = vi.fn();

const mockPackagesState = {
  packages: [] as Array<{
    name: string;
    isInstalled?: boolean;
    installing?: boolean;
    error?: string;
    version?: string;
  }>,
  addPackage: mockAddPackage,
  setPackageInstalling: mockSetPackageInstalling,
  setPackageInstalled: mockSetPackageInstalled,
  setPackageError: mockSetPackageError,
  detectedMissingPackages: [] as string[],
};

const mockAddPythonPackage = vi.fn();
const mockSetPythonPackageInstalling = vi.fn();
const mockSetPythonPackageInstalled = vi.fn();
const mockSetPythonPackageError = vi.fn();

const mockPythonPackagesState = {
  packages: [] as Array<{
    name: string;
    isInstalled?: boolean;
    installing?: boolean;
    error?: string;
    version?: string;
  }>,
  addPackage: mockAddPythonPackage,
  setPackageInstalling: mockSetPythonPackageInstalling,
  setPackageInstalled: mockSetPythonPackageInstalled,
  setPackageError: mockSetPythonPackageError,
  detectedMissingPackages: [] as string[],
};

vi.mock('../store/storeHooks', () => ({
  useCodeStore: (selector: (s: any) => any) => selector(mockCodeStoreState),
  useSettingsStore: (selector: (s: any) => any) => useSettingsStoreMock(selector),
  usePackagesStore: (selector: (s: any) => any) =>
    selector ? selector(mockPackagesState) : mockPackagesState,
  usePythonPackagesStore: (selector: (s: any) => any) =>
    selector ? selector(mockPythonPackagesState) : mockPythonPackagesState,
  useLanguageStore: (selector: (s: any) => any) =>
    selector({ currentLanguage: 'javascript' }),
  useAppStore: {
    getState: () => ({
      language: {
        isLanguageExecutable: (lang: string) =>
          ['javascript', 'typescript', 'python'].includes(lang),
      },
    }),
  },
}));

// Package metadata hooks
const mockPackageMetadataState = {
  packageMetadata: {} as Record<
    string,
    {
      loading?: boolean;
      error?: boolean;
      name?: string;
      version?: string;
      description?: string;
    }
  >,
  dismissedPackages: [] as string[],
  setDismissedPackages: vi.fn(),
};

vi.mock('../hooks/usePackageMetadata', () => ({
  usePackageMetadata: () => mockPackageMetadataState,
}));

const mockPythonPackageMetadataState = {
  packageMetadata: {} as Record<
    string,
    {
      loading?: boolean;
      error?: boolean;
      name?: string;
      version?: string;
      description?: string;
    }
  >,
  dismissedPackages: [] as string[],
  setDismissedPackages: vi.fn(),
};

vi.mock('../hooks/usePythonPackageMetadata', () => ({
  usePythonPackageMetadata: () => mockPythonPackageMetadataState,
}));

// ── Tests ──────────────────────────────────────────────────────────────

describe('ResultDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable state
    mockCodeStoreState.result = [];
    mockCodeStoreState.code = '';
    mockSettingsState.alignResults = false;
    currentSettings = mockSettingsState;
    useSettingsStoreMock.mockImplementation((selector) =>
      selector ? selector(currentSettings) : currentSettings
    );
    mockPackagesState.packages = [];
    mockPackagesState.detectedMissingPackages = [];
    mockPythonPackagesState.packages = [];
    mockPythonPackagesState.detectedMissingPackages = [];
    mockPackageMetadataState.packageMetadata = {};
    mockPackageMetadataState.dismissedPackages = [];
    mockPythonPackageMetadataState.packageMetadata = {};
    mockPythonPackageMetadataState.dismissedPackages = [];
  });

  it('should render the result panel', () => {
    render(<ResultDisplay />);
    expect(screen.getByTestId('result-panel')).toBeInTheDocument();
  });

  it('should render Monaco editor with waiting message when no results', () => {
    render(<ResultDisplay />);
    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeInTheDocument();
    expect(editor.textContent).toBe('// Waiting for output...');
  });

  it('should render console filter buttons', () => {
    render(<ResultDisplay />);
    expect(screen.getByText('Log')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Warn')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('should render ConsoleInput', () => {
    render(<ResultDisplay />);
    expect(screen.getByTestId('console-input')).toBeInTheDocument();
  });

  it('should display output from result elements', () => {
    mockCodeStoreState.result = [
      {
        type: 'result',
        lineNumber: 1,
        element: { content: 'Hello World', consoleType: 'log' },
      },
    ];

    render(<ResultDisplay />);
    const editor = screen.getByTestId('monaco-editor');
    expect(editor.textContent).toBe('Hello World');
  });

  it('should join multiple result elements with newlines', () => {
    mockCodeStoreState.result = [
      {
        type: 'result',
        lineNumber: 1,
        element: { content: 'Line 1', consoleType: 'log' },
      },
      {
        type: 'result',
        lineNumber: 2,
        element: { content: 'Line 2', consoleType: 'log' },
      },
    ];

    render(<ResultDisplay />);
    const editor = screen.getByTestId('monaco-editor');
    expect(editor.textContent).toBe('Line 1\nLine 2');
  });

  it('should filter out log messages when log filter is toggled off', () => {
    mockCodeStoreState.result = [
      {
        type: 'result',
        lineNumber: 1,
        element: { content: 'Log msg', consoleType: 'log' },
      },
      {
        type: 'result',
        lineNumber: 2,
        element: { content: 'Error msg', consoleType: 'error' },
      },
    ];

    const { rerender } = render(<ResultDisplay />);
    // Toggle off Log filter
    act(() => {
      currentSettings = {
        ...currentSettings,
        consoleFilters: { ...currentSettings.consoleFilters, log: false },
      };
    });
    rerender(<ResultDisplay />);

    const editor = screen.getByTestId('monaco-editor');
    expect(editor.textContent).not.toContain('Log msg');
    expect(editor.textContent).toContain('Error msg');
  });

  it('should filter out error messages when error filter is toggled off', () => {
    mockCodeStoreState.result = [
      {
        type: 'result',
        lineNumber: 1,
        element: { content: 'Log msg', consoleType: 'log' },
      },
      {
        type: 'error',
        lineNumber: 2,
        element: { content: 'Error msg', consoleType: 'error' },
      },
    ];

    const { rerender } = render(<ResultDisplay />);
    act(() => {
      currentSettings = {
        ...currentSettings,
        consoleFilters: { ...currentSettings.consoleFilters, error: false },
      };
    });
    rerender(<ResultDisplay />);

    const editor = screen.getByTestId('monaco-editor');
    expect(editor.textContent).toContain('Log msg');
    expect(editor.textContent).not.toContain('Error msg');
  });

  it('should show Auto-Fix button when there is an execution error', () => {
    mockCodeStoreState.result = [
      {
        type: 'error',
        lineNumber: 1,
        element: {
          content: 'ReferenceError: x is not defined',
          consoleType: 'error',
        },
      },
    ];

    render(<ResultDisplay />);
    expect(screen.getByText('Auto-Fix')).toBeInTheDocument();
  });

  it('should not show Auto-Fix button when there are no errors', () => {
    mockCodeStoreState.result = [
      {
        type: 'result',
        lineNumber: 1,
        element: { content: 'Hello', consoleType: 'log' },
      },
    ];

    render(<ResultDisplay />);
    expect(screen.queryByText('Auto-Fix')).not.toBeInTheDocument();
  });

  it('should call triggerAIAutoCorrection when Auto-Fix is clicked', () => {
    const mockAutoCorrect = vi.fn();
    (
      window as Window & { triggerAIAutoCorrection?: (c: string) => void }
    ).triggerAIAutoCorrection = mockAutoCorrect;

    mockCodeStoreState.result = [
      {
        type: 'error',
        lineNumber: 1,
        element: { content: 'SyntaxError: unexpected', consoleType: 'error' },
      },
    ];

    render(<ResultDisplay />);
    fireEvent.click(screen.getByText('Auto-Fix'));
    expect(mockAutoCorrect).toHaveBeenCalledWith('SyntaxError: unexpected');

    delete (
      window as Window & { triggerAIAutoCorrection?: (c: string) => void }
    ).triggerAIAutoCorrection;
  });

  it('should align results with source code when alignResults is enabled', () => {
    mockSettingsState.alignResults = true;
    mockCodeStoreState.code = 'line1\nline2\nline3';
    mockCodeStoreState.result = [
      {
        type: 'result',
        lineNumber: 3,
        element: { content: 'result on line 3', consoleType: 'log' },
      },
    ];

    render(<ResultDisplay />);
    const editor = screen.getByTestId('monaco-editor');
    // Lines 1 and 2 should be empty, line 3 has the result
    const lines = editor.textContent!.split('\n');
    expect(lines[0]).toBe('');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('result on line 3');
  });

  it('should filter out action elements from display', () => {
    mockCodeStoreState.result = [
      {
        type: 'result',
        lineNumber: 1,
        element: { content: 'visible', consoleType: 'log' },
      },
      {
        action: { payload: 'lodash' },
        element: { content: 'install lodash' },
      },
    ];

    render(<ResultDisplay />);
    const editor = screen.getByTestId('monaco-editor');
    expect(editor.textContent).toContain('visible');
    expect(editor.textContent).not.toContain('install lodash');
  });

  describe('package toasts', () => {
    it('should show a package toast for detected missing npm packages', () => {
      mockPackagesState.detectedMissingPackages = ['lodash'];
      mockPackageMetadataState.packageMetadata = {
        lodash: {
          name: 'lodash',
          version: '4.17.21',
          description: 'Utility library',
        },
      };

      render(<ResultDisplay />);
      expect(screen.getByText('lodash')).toBeInTheDocument();
      expect(screen.getByText('v4.17.21')).toBeInTheDocument();
      expect(screen.getByText('Utility library')).toBeInTheDocument();
    });

    it('should show install button for available package', () => {
      mockPackagesState.detectedMissingPackages = ['axios'];
      mockPackageMetadataState.packageMetadata = {
        axios: {
          name: 'axios',
          version: '1.6.0',
          description: 'HTTP client',
        },
      };

      render(<ResultDisplay />);
      expect(screen.getByText('packages.install')).toBeInTheDocument();
    });

    it('should show installing state', () => {
      mockPackagesState.packages = [{ name: 'axios', installing: true }];

      render(<ResultDisplay />);
      expect(screen.getByText('packages.installing')).toBeInTheDocument();
    });

    it('should show error state with retry button', () => {
      mockPackagesState.packages = [{ name: 'axios', error: 'Network error' }];

      render(<ResultDisplay />);
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('packages.retry')).toBeInTheDocument();
    });

    it('should show "not found" for non-existent package', () => {
      mockPackagesState.detectedMissingPackages = ['nonexistent-pkg'];
      mockPackageMetadataState.packageMetadata = {
        'nonexistent-pkg': { error: true },
      };

      render(<ResultDisplay />);
      expect(screen.getByText('packages.notFound')).toBeInTheDocument();
    });

    it('should show loading state for unknown package', () => {
      mockPackagesState.detectedMissingPackages = ['loading-pkg'];
      // loading: true with a name set so it doesn't hit the doesNotExist branch
      // (doesNotExist = metadata && !metadata.version && !metadata.name)
      mockPackageMetadataState.packageMetadata = {
        'loading-pkg': { loading: true, name: 'loading-pkg' },
      };

      render(<ResultDisplay />);
      expect(screen.getByText('packages.checking')).toBeInTheDocument();
    });

    it('should install npm package when install button is clicked', async () => {
      const mockInstall = vi
        .fn()
        .mockResolvedValue({ success: true, version: '1.0.0' });
      Object.defineProperty(window, 'packageManager', {
        value: { install: mockInstall },
        writable: true,
        configurable: true,
      });

      mockPackagesState.detectedMissingPackages = ['axios'];
      mockPackageMetadataState.packageMetadata = {
        axios: { name: 'axios', version: '1.6.0' },
      };

      render(<ResultDisplay />);
      fireEvent.click(screen.getByText('packages.install'));

      expect(mockAddPackage).toHaveBeenCalledWith('axios');
      expect(mockSetPackageInstalling).toHaveBeenCalledWith('axios', true);

      // Wait for async install to complete
      await vi.waitFor(() => {
        expect(mockInstall).toHaveBeenCalledWith('axios');
        expect(mockSetPackageInstalled).toHaveBeenCalledWith('axios', '1.0.0');
      });

      delete (window as unknown as Record<string, unknown>).packageManager;
    });

    it('should handle npm package install failure', async () => {
      const mockInstall = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed to install',
      });
      Object.defineProperty(window, 'packageManager', {
        value: { install: mockInstall },
        writable: true,
        configurable: true,
      });

      mockPackagesState.detectedMissingPackages = ['bad-pkg'];
      mockPackageMetadataState.packageMetadata = {
        'bad-pkg': { name: 'bad-pkg', version: '1.0.0' },
      };

      render(<ResultDisplay />);
      fireEvent.click(screen.getByText('packages.install'));

      await vi.waitFor(() => {
        expect(mockSetPackageError).toHaveBeenCalledWith(
          'bad-pkg',
          'Failed to install'
        );
      });

      delete (window as unknown as Record<string, unknown>).packageManager;
    });

    it('should show python package install button with micropip label', () => {
      mockPythonPackagesState.detectedMissingPackages = ['numpy'];
      mockPythonPackageMetadataState.packageMetadata = {
        numpy: { name: 'numpy', version: '1.24.0' },
      };

      render(<ResultDisplay />);
      expect(screen.getByText('packages.installPython')).toBeInTheDocument();
    });

    it('should dismiss package toast when X is clicked', () => {
      mockPackagesState.detectedMissingPackages = ['lodash'];
      mockPackageMetadataState.packageMetadata = {
        lodash: { name: 'lodash', version: '4.17.21' },
      };

      render(<ResultDisplay />);
      // Find the dismiss button (X icon button)
      const dismissButtons = screen.getAllByRole('button');
      // The dismiss button is inside each toast, has an X icon
      const dismissBtn = dismissButtons.find(
        (btn) =>
          btn.querySelector('svg') &&
          btn.classList.contains('text-muted-foreground')
      );
      expect(dismissBtn).toBeDefined();
      fireEvent.click(dismissBtn!);

      expect(mockPackageMetadataState.setDismissedPackages).toHaveBeenCalled();
    });
  });

  describe('FilterToggle counts', () => {
    it('should show count badges for each console type', () => {
      mockCodeStoreState.result = [
        { element: { content: 'log1', consoleType: 'log' } },
        { element: { content: 'log2', consoleType: 'log' } },
        { element: { content: 'warn1', consoleType: 'warn' } },
        { element: { content: 'info1', consoleType: 'info' } },
        {
          type: 'error',
          element: { content: 'err1', consoleType: 'error' },
        },
      ];

      render(<ResultDisplay />);

      // Find the filter buttons and check counts
      const logButton = screen.getByText('Log').closest('button')!;
      const warnButton = screen.getByText('Warn').closest('button')!;
      const infoButton = screen.getByText('Info').closest('button')!;
      const errorButton = screen.getByText('Error').closest('button')!;

      expect(logButton.textContent).toContain('2');
      expect(warnButton.textContent).toContain('1');
      expect(infoButton.textContent).toContain('1');
      expect(errorButton.textContent).toContain('1');
    });
  });
});
