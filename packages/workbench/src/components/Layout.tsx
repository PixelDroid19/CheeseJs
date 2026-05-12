import {
  useRef,
  useState,
  ReactNode,
  PointerEvent,
  KeyboardEvent,
} from 'react';

interface LayoutProps {
  children: ReactNode[];
  className?: string;
}

type SplitDirection = 'horizontal' | 'vertical';
type SplitSizes = [number, number];

const DEFAULT_SIZES: SplitSizes = [50, 50];
const MIN_PANEL_SIZE = 20;
const MAX_PANEL_SIZE = 80;
const KEYBOARD_STEP = 5;

export function Layout({ children, className }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [direction] = useState<SplitDirection>(() => {
    const storedDirection = window.localStorage.getItem('split-direction');
    if (storedDirection === 'horizontal' || storedDirection === 'vertical') {
      return storedDirection;
    }
    return 'horizontal';
  });

  const [sizes, setSizes] = useState<SplitSizes>(readStoredSizes);
  const isHorizontal = direction === 'horizontal';

  function applyPrimarySize(primarySize: number) {
    const nextPrimary = clamp(primarySize, MIN_PANEL_SIZE, MAX_PANEL_SIZE);
    const nextSizes: SplitSizes = [nextPrimary, 100 - nextPrimary];
    setSizes(nextSizes);
    window.localStorage.setItem('split-sizes', JSON.stringify(nextSizes));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const updateFromPointer = (moveEvent: globalThis.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const position = isHorizontal
        ? moveEvent.clientX - rect.left
        : moveEvent.clientY - rect.top;
      const total = isHorizontal ? rect.width : rect.height;
      if (total <= 0) return;

      applyPrimarySize((position / total) * 100);
    };

    const stopDragging = () => {
      window.removeEventListener('pointermove', updateFromPointer);
      window.removeEventListener('pointerup', stopDragging);
    };

    window.addEventListener('pointermove', updateFromPointer);
    window.addEventListener('pointerup', stopDragging, { once: true });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const decrease = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
    const increase = isHorizontal ? 'ArrowRight' : 'ArrowDown';

    if (event.key === decrease) {
      event.preventDefault();
      applyPrimarySize(sizes[0] - KEYBOARD_STEP);
    }

    if (event.key === increase) {
      event.preventDefault();
      applyPrimarySize(sizes[0] + KEYBOARD_STEP);
    }
  }

  return (
    <div
      ref={containerRef}
      className={[
        'flex h-full min-h-0 min-w-0 overflow-hidden',
        isHorizontal ? 'flex-row' : 'flex-col',
        className || '',
      ].join(' ')}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={panelStyle(sizes[0])}
      >
        {children[0]}
      </div>
      <div
        aria-label="Resize editor and output panels"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        className={[
          'gutter shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isHorizontal ? 'gutter-horizontal w-2' : 'gutter-vertical h-2',
        ].join(' ')}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        role="separator"
        tabIndex={0}
      />
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={panelStyle(sizes[1])}
      >
        {children[1]}
      </div>
    </div>
  );
}

function readStoredSizes(): SplitSizes {
  const storedSizes = window.localStorage.getItem('split-sizes');
  if (!storedSizes) return DEFAULT_SIZES;

  try {
    const parsed = JSON.parse(storedSizes);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      parsed.every((value: unknown) => typeof value === 'number')
    ) {
      const primary = clamp(parsed[0], MIN_PANEL_SIZE, MAX_PANEL_SIZE);
      return [primary, 100 - primary];
    }
  } catch {
    return DEFAULT_SIZES;
  }

  return DEFAULT_SIZES;
}

function panelStyle(size: number) {
  return {
    flex: `0 0 ${size}%`,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
