import { useState, ReactNode } from 'react';
import Split from 'react-split';

interface LayoutProps {
  children: ReactNode[];
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  const [direction] = useState(() => {
    const storedDirection = window.localStorage.getItem('split-direction');
    if (storedDirection) return storedDirection;
    return 'horizontal';
  });

  const [sizes, setSizes] = useState(() => {
    const storedSizes = window.localStorage.getItem('split-sizes');
    if (storedSizes) {
      try {
        const parsed = JSON.parse(storedSizes);
        if (
          Array.isArray(parsed) &&
          parsed.length === 2 &&
          parsed.every((v: unknown) => typeof v === 'number')
        ) {
          return parsed as [number, number];
        }
      } catch {
        // Corrupted localStorage value — use default
      }
    }
    return [50, 50];
  });

  function handleDragEnd(e: number[]) {
    const [left, right] = e;
    setSizes([left, right]);
    window.localStorage.setItem('split-sizes', JSON.stringify([left, right]));
  }

  return (
    <Split
      className={`flex ${direction} h-full overflow-hidden ${className || ''}`}
      sizes={sizes}
      gutterSize={4}
      cursor="col-resize"
      onDragEnd={handleDragEnd}
    >
      {children}
    </Split>
  );
}
