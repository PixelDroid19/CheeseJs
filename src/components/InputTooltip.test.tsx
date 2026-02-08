import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '../__test__/test-utils';
import { InputTooltip } from './InputTooltip';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => {
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
      return <div {...filtered}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('InputTooltip', () => {
  let mockOnInputRequest: ReturnType<typeof vi.fn>;
  let mockOnResult: ReturnType<typeof vi.fn>;
  let mockSendInputResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnInputRequest = vi.fn().mockReturnValue(vi.fn());
    mockOnResult = vi.fn().mockReturnValue(vi.fn());
    mockSendInputResponse = vi.fn();

    Object.defineProperty(window, 'codeRunner', {
      value: {
        onInputRequest: mockOnInputRequest,
        onResult: mockOnResult,
        sendInputResponse: mockSendInputResponse,
      },
      writable: true,
      configurable: true,
    });
  });

  it('should render nothing when no request', () => {
    const { container } = render(<InputTooltip />);
    expect(container.querySelector('form')).toBeNull();
  });

  it('should subscribe to input requests and results on mount', () => {
    render(<InputTooltip />);
    expect(mockOnInputRequest).toHaveBeenCalledTimes(1);
    expect(mockOnResult).toHaveBeenCalledTimes(1);
  });

  it('should show tooltip when input request arrives', () => {
    render(<InputTooltip />);
    const inputCallback = mockOnInputRequest.mock.calls[0][0];

    act(() => {
      inputCallback({
        id: 'exec-1',
        data: { prompt: 'Enter your name:', line: 5 },
      });
    });

    expect(screen.getByText('Enter your name:')).toBeInTheDocument();
    expect(screen.getByText('input()')).toBeInTheDocument();
  });

  it('should use default prompt if none provided', () => {
    render(<InputTooltip />);
    const inputCallback = mockOnInputRequest.mock.calls[0][0];

    act(() => {
      inputCallback({
        id: 'exec-1',
        data: { prompt: '', line: 1 },
      });
    });

    // With our test i18n, the key itself is returned
    expect(screen.getByText('input.defaultPrompt')).toBeInTheDocument();
  });

  it('should submit value on form submit', () => {
    render(<InputTooltip />);
    const inputCallback = mockOnInputRequest.mock.calls[0][0];

    act(() => {
      inputCallback({
        id: 'exec-1',
        data: { prompt: 'Name:', line: 1, requestId: 'req-1' },
      });
    });

    const input = screen.getByPlaceholderText('input.placeholder');
    fireEvent.change(input, { target: { value: 'John' } });
    fireEvent.submit(input.closest('form')!);

    expect(mockSendInputResponse).toHaveBeenCalledWith(
      'exec-1',
      'John',
      'req-1'
    );
  });

  it('should submit on Enter keypress', () => {
    render(<InputTooltip />);
    const inputCallback = mockOnInputRequest.mock.calls[0][0];

    act(() => {
      inputCallback({
        id: 'exec-1',
        data: { prompt: 'Value:', line: 1, requestId: 'req-2' },
      });
    });

    const input = screen.getByPlaceholderText('input.placeholder');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSendInputResponse).toHaveBeenCalledWith(
      'exec-1',
      'test',
      'req-2'
    );
  });

  it('should cancel on Escape keypress', () => {
    render(<InputTooltip />);
    const inputCallback = mockOnInputRequest.mock.calls[0][0];

    act(() => {
      inputCallback({
        id: 'exec-1',
        data: { prompt: 'Value:', line: 1, requestId: 'req-3' },
      });
    });

    const input = screen.getByPlaceholderText('input.placeholder');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(mockSendInputResponse).toHaveBeenCalledWith('exec-1', '', 'req-3');
  });

  it('should dismiss tooltip when execution completes', () => {
    render(<InputTooltip />);
    const inputCallback = mockOnInputRequest.mock.calls[0][0];
    const resultCallback = mockOnResult.mock.calls[0][0];

    act(() => {
      inputCallback({
        id: 'exec-1',
        data: { prompt: 'Value:', line: 1 },
      });
    });

    expect(screen.getByText('Value:')).toBeInTheDocument();

    act(() => {
      resultCallback({ type: 'complete' });
    });

    // Tooltip form should be removed
    expect(screen.queryByText('Value:')).not.toBeInTheDocument();
  });

  it('should clear previous request on new execution', () => {
    render(<InputTooltip />);
    const inputCallback = mockOnInputRequest.mock.calls[0][0];

    act(() => {
      inputCallback({
        id: 'exec-1',
        data: { prompt: 'First:', line: 1 },
      });
    });

    act(() => {
      inputCallback({
        id: 'exec-2',
        data: { prompt: 'Second:', line: 2 },
      });
    });

    expect(screen.getByText('Second:')).toBeInTheDocument();
  });

  it('should cancel button send empty response', () => {
    render(<InputTooltip />);
    const inputCallback = mockOnInputRequest.mock.calls[0][0];

    act(() => {
      inputCallback({
        id: 'exec-1',
        data: { prompt: 'Cancel me:', line: 1, requestId: 'req-4' },
      });
    });

    const cancelButton = screen.getByTitle('input.cancel');
    fireEvent.click(cancelButton);

    expect(mockSendInputResponse).toHaveBeenCalledWith('exec-1', '', 'req-4');
  });
});
