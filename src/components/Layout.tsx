import { useState, ReactNode } from 'react';
import Split from 'react-split';
import { useSettingsStore } from '../store/useSettingsStore';

interface LayoutProps {
  children: ReactNode[];
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  const { themeName, splitDirection } = useSettingsStore();
  const isSketchy = themeName === 'sketchy';

  const [sizes, setSizes] = useState(() => {
    try {
      const storedSizes = window.localStorage.getItem('split-sizes');
      if (storedSizes) {
        const parsed = JSON.parse(storedSizes);
        // Ensure no pane is too small (e.g., < 10%)
        // This prevents the "missing UI" issue if the split was dragged too far
        if (
          !Array.isArray(parsed) ||
          parsed.length !== 2 ||
          parsed.some((size) => typeof size !== 'number' || isNaN(size)) ||
          parsed[0] < 10 ||
          parsed[1] < 10
        ) {
          return [50, 50];
        }
        return parsed;
      }
    } catch (_e) {
      // Ignore error and return default
    }
    return [50, 50];
  });

  function handleDragEnd(e: number[]) {
    const [left, right] = e;
    setSizes([left, right]);
    window.localStorage.setItem('split-sizes', JSON.stringify([left, right]));
  }

  // Determine cursor and direction class based on split direction
  const isVertical = splitDirection === 'vertical';
  const cursorStyle = isVertical ? 'row-resize' : 'col-resize';
  const directionClass = isVertical ? 'flex-col' : 'flex-row';

  return (
    <Split
      className={`flex ${directionClass} h-full overflow-hidden ${
        isSketchy ? 'p-2 gap-2 bg-transparent' : ''
      } ${className || ''}`}
      sizes={sizes}
      minSize={100}
      gutterSize={isSketchy ? 8 : 4}
      cursor={cursorStyle}
      direction={isVertical ? 'vertical' : 'horizontal'}
      onDragEnd={handleDragEnd}
      key={splitDirection}
      gutter={(_index, dir) => {
        const gutter = document.createElement('div');
        gutter.className = `gutter gutter-${dir} ${
          isSketchy ? 'bg-transparent' : ''
        }`;
        return gutter;
      }}
    >
      {children.map((child, i) => (
        <div
          key={i}
          className={`${
            isSketchy
              ? 'sketchy-box h-full overflow-hidden bg-background'
              : 'h-full overflow-hidden'
          }`}
        >
          {child}
        </div>
      ))}
    </Split>
  );
}
