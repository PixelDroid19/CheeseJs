import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '../__test__/test-utils';
import { Layout } from '@cheesejs/workbench/components/Layout';

describe('Layout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
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
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <Layout className="custom-class">
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    const splitPane = getSplitPane('A');
    expect(splitPane.className).toContain('custom-class');
  });

  it('should use default direction horizontal', () => {
    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    const splitPane = getSplitPane('A');
    expect(splitPane.className).toContain('flex-row');
  });

  it('should read direction from localStorage', () => {
    window.localStorage.setItem('split-direction', 'vertical');
    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );
    const splitPane = getSplitPane('A');
    expect(splitPane.className).toContain('flex-col');
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
    expect(screen.getByText('A').parentElement).toHaveStyle({
      flex: '0 0 60%',
    });
  });

  it('clamps stored sizes so panels stay usable', () => {
    window.localStorage.setItem('split-sizes', JSON.stringify([5, 95]));

    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );

    expect(screen.getByText('A').parentElement).toHaveStyle({
      flex: '0 0 20%',
    });
  });

  it('supports keyboard resizing', () => {
    render(
      <Layout>
        <div>A</div>
        <div>B</div>
      </Layout>
    );

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });

    expect(window.localStorage.getItem('split-sizes')).toBe('[55,45]');
  });
});

function getSplitPane(text: string) {
  const splitPane = screen.getByText(text).parentElement?.parentElement;
  if (!splitPane) {
    throw new Error('Split pane was not rendered.');
  }
  return splitPane;
}
