import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../__test__/test-utils';
import FloatingToolbar from './FloatingToolbar';

// Mock hooks and stores
const mockRunCode = vi.fn();
const mockToggleSettings = vi.fn();
const mockSetModalOpen = vi.fn();

vi.mock('../hooks/useCodeRunner', () => ({
  useCodeRunner: () => ({ runCode: mockRunCode }),
}));

vi.mock('../store/storeHooks', () => ({
  useSettingsStore: vi.fn((selector) => selector ? selector({ toggleSettings: mockToggleSettings }) : { toggleSettings: mockToggleSettings }),
  useLanguageStore: vi.fn((selector) => selector ? selector({ currentLanguage: 'javascript' }) : { currentLanguage: 'javascript' }),
  useRagStore: vi.fn((selector) => selector ? selector({ setModalOpen: mockSetModalOpen }) : { setModalOpen: mockSetModalOpen }),
  useCodeStore: vi.fn((selector) => selector ? selector({ isExecuting: false, isPendingRun: false }) : { isExecuting: false, isPendingRun: false }),
  usePackagesStore: vi.fn((selector) => selector ? selector({ isInstalling: false, packages: [] }) : { isInstalling: false, packages: [] }),
  usePythonPackagesStore: vi.fn((selector) => selector ? selector({ isInstalling: false, packages: [] }) : { isInstalling: false, packages: [] }),
}));

vi.mock('../hooks/useRuntimeStatus', () => ({
  useRuntimeStatus: () => ({ isLoading: false, message: null }),
}));

vi.mock('./SnippetsMenu', () => ({
  SnippetsMenu: () => <div data-testid="snippets-menu">Snippets</div>,
}));

// Mock framer-motion
vi.mock('framer-motion', () => {
  const component = (props: React.ComponentPropsWithoutRef<'div'>) => <div {...props}>{props.children}</div>;
  return {
    m: {
      div: component,
      button: (props: React.ComponentPropsWithoutRef<'button'>) => <button {...props}>{props.children}</button>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('FloatingToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render toolbar', () => {
    render(<FloatingToolbar />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should render run button', () => {
    render(<FloatingToolbar />);
    expect(screen.getByTestId('run-button')).toBeInTheDocument();
  });

  it('should call runCode', () => {
    render(<FloatingToolbar />);
    fireEvent.click(screen.getByTestId('run-button'));
    expect(mockRunCode).toHaveBeenCalled();
  });
});
