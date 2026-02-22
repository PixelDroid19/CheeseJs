import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '../__test__/test-utils';
import { Layout } from './Layout';

// Mock react-split
vi.mock('react-split', () => ({
  default: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className: string;
  }) => (
    <div data-testid="split-pane" className={className}>
      {children}
    </div>
  ),
}));

describe('Layout', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should render children inside split pane', () => {
    render(
      <Layout>
        <div>Panel 1</div>
        <div>Panel 2</div>
      </Layout>
    );
    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();
    expect(screen.getByTestId('split-pane')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <Layout className="custom-class">
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    const splitPane = screen.getByTestId('split-pane');
    expect(splitPane.className).toContain('custom-class');
  });

  it('should use default direction horizontal', () => {
    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    const splitPane = screen.getByTestId('split-pane');
    expect(splitPane.className).toContain('horizontal');
  });

  it('should read direction from localStorage', () => {
    window.localStorage.setItem('split-direction', 'vertical');
    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    const splitPane = screen.getByTestId('split-pane');
    expect(splitPane.className).toContain('vertical');
  });

  it('should handle corrupted localStorage sizes gracefully', () => {
    window.localStorage.setItem('split-sizes', 'not-json');
    // Should not throw
    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should reject invalid sizes from localStorage', () => {
    // Not an array of 2 numbers
    window.localStorage.setItem('split-sizes', JSON.stringify([50]));
    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should accept valid sizes from localStorage', () => {
    window.localStorage.setItem('split-sizes', JSON.stringify([60, 40]));
    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
