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

vi.mock('../store/useSettingsStore', () => ({
  useSettingsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ toggleSettings: mockToggleSettings }),
}));

vi.mock('../store/useLanguageStore', () => ({
  useLanguageStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ currentLanguage: 'javascript' }),
}));

vi.mock('../store/useRagStore', () => ({
  useRagStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setModalOpen: mockSetModalOpen }),
}));

vi.mock('../hooks/useRuntimeStatus', () => ({
  useRuntimeStatus: () => ({ isLoading: false, message: null }),
}));

vi.mock('./SnippetsMenu', () => ({
  SnippetsMenu: () => <div data-testid="snippets-menu">Snippets</div>,
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...filterMotionProps(props)}>{children}</div>
    ),
    button: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...filterMotionProps(props)}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Filter out framer-motion-specific props
function filterMotionProps(props: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (
      ![
        'initial',
        'animate',
        'exit',
        'transition',
        'whileHover',
        'whileTap',
        'layout',
      ].includes(key)
    ) {
      filtered[key] = value;
    }
  }
  return filtered;
}

describe('FloatingToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render toolbar with role attribute', () => {
    render(<FloatingToolbar />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should render run button', () => {
    render(<FloatingToolbar />);
    const runButton = screen.getByTestId('run-button');
    expect(runButton).toBeInTheDocument();
  });

  it('should call runCode when run button is clicked', () => {
    render(<FloatingToolbar />);
    fireEvent.click(screen.getByTestId('run-button'));
    expect(mockRunCode).toHaveBeenCalled();
  });

  it('should render settings button', () => {
    render(<FloatingToolbar />);
    const settingsButton = screen.getByTestId('settings-button');
    expect(settingsButton).toBeInTheDocument();
  });

  it('should call toggleSettings when settings button is clicked', () => {
    render(<FloatingToolbar />);
    fireEvent.click(screen.getByTestId('settings-button'));
    expect(mockToggleSettings).toHaveBeenCalled();
  });

  it('should render snippets menu', () => {
    render(<FloatingToolbar />);
    expect(screen.getByTestId('snippets-menu')).toBeInTheDocument();
  });

  it('should render knowledge base button', () => {
    render(<FloatingToolbar />);
    // KB button has label "Knowledge Base"
    const kbButton = screen.getByTitle('Knowledge Base');
    expect(kbButton).toBeInTheDocument();
  });

  it('should call setModalOpen when knowledge base button clicked', () => {
    render(<FloatingToolbar />);
    fireEvent.click(screen.getByTitle('Knowledge Base'));
    expect(mockSetModalOpen).toHaveBeenCalledWith(true);
  });
});
