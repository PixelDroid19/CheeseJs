import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../__test__/test-utils';
import FloatingToolbar from './FloatingToolbar';

// Mock hooks and stores
const mockRunCode = vi.fn();
const mockToggleSettings = vi.fn();

vi.mock('../hooks/useCodeRunner', () => ({
  useCodeRunner: () => ({ runCode: mockRunCode }),
}));

vi.mock('../store/storeHooks', () => ({
  useSettingsStore: vi.fn((selector) =>
    selector
      ? selector({ toggleSettings: mockToggleSettings })
      : { toggleSettings: mockToggleSettings }
  ),
  useLanguageStore: vi.fn((selector) =>
    selector
      ? selector({ currentLanguage: 'javascript' })
      : { currentLanguage: 'javascript' }
  ),
  usePackagesStore: vi.fn((selector) =>
    selector
      ? selector({ isInstalling: false, packages: [] })
      : { isInstalling: false, packages: [] }
  ),
  usePythonPackagesStore: vi.fn((selector) =>
    selector
      ? selector({ isInstalling: false, packages: [] })
      : { isInstalling: false, packages: [] }
  ),
  useEditorTabsStore: vi.fn((selector) =>
    selector
      ? selector({
          tabs: [],
          activeTabId: 'test-tab',
          getActiveTab: () => ({ isExecuting: false, isPendingRun: false }),
        })
      : {
          tabs: [],
          activeTabId: 'test-tab',
          getActiveTab: () => ({ isExecuting: false, isPendingRun: false }),
        }
  ),
}));

vi.mock('@cheesejs/runtime-shell', async () => {
  const actual = await vi.importActual<
    typeof import('@cheesejs/runtime-shell')
  >('@cheesejs/runtime-shell');

  return {
    ...actual,
    useRuntimeStatus: () => ({ isLoading: false, message: null }),
  };
});

vi.mock('./SnippetsMenu', () => ({
  SnippetsMenu: () => <div data-testid="snippets-menu">Snippets</div>,
}));

// Mock framer-motion
vi.mock('framer-motion', () => {
  type MotionMockProps<T> = T & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
    transition?: unknown;
    whileHover?: unknown;
    whileTap?: unknown;
  };

  const stripMotionProps = <T extends object>({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...domProps
  }: MotionMockProps<T>) => domProps;

  const component = (props: React.ComponentPropsWithoutRef<'div'>) => {
    const domProps = stripMotionProps(props);
    return <div {...domProps}>{props.children}</div>;
  };
  return {
    m: {
      div: component,
      button: (props: React.ComponentPropsWithoutRef<'button'>) => {
        const domProps = stripMotionProps(props);
        return <button {...domProps}>{props.children}</button>;
      },
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
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
