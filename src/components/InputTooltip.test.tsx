import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '../__test__/test-utils';
import { InputTooltip } from './InputTooltip';

// Mock framer-motion
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
});
