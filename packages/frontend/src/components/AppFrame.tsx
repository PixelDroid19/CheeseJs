import { useEffect, type ReactNode } from 'react';
import { LazyMotion, domAnimation } from 'framer-motion';

export interface AppFrameProps {
  children: ReactNode;
  titleBar?: ReactNode;
  themeName: string;
  darkMode: boolean;
  uiFontSize: number;
}

/**
 * Shared renderer frame that applies theme chrome and global UI sizing.
 */
export function AppFrame({
  children,
  titleBar,
  themeName,
  darkMode,
  uiFontSize,
}: AppFrameProps) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.setAttribute('data-theme', themeName);
  }, [darkMode, themeName]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${uiFontSize}px`;
  }, [uiFontSize]);

  return (
    <LazyMotion features={domAnimation}>
      <div className="flex flex-col h-screen bg-background">
        {titleBar}
        <div className="flex-1 overflow-hidden relative">{children}</div>
      </div>
    </LazyMotion>
  );
}
