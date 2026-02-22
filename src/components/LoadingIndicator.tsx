import { m } from 'framer-motion';

interface LoadingIndicatorProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function LoadingIndicator({
  message,
  size = 'md',
}: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="cube-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
            </filter>
          </defs>

          <m.g
            animate={{ rotate: 360, scale: [1, 1.05, 1] }}
            transition={{
              rotate: { duration: 8, ease: "linear", repeat: Infinity },
              scale: { duration: 2, ease: "easeInOut", repeat: Infinity }
            }}
            style={{ transformOrigin: '50% 50%' }}
          >
            {/* Top face */}
            <m.path
              d="M50 15 L85 35 L50 55 L15 35 Z"
              fill="currentColor" fillOpacity="0.7"
              filter="url(#cube-shadow)"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Right face */}
            <m.path
              d="M85 35 L85 75 L50 95 L50 55 Z"
              fill="currentColor" fillOpacity="1"
              filter="url(#cube-shadow)"
              animate={{ x: [0, 5, 0], y: [0, 3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Left face */}
            <m.path
              d="M15 35 L50 55 L50 95 L15 75 Z"
              fill="currentColor" fillOpacity="0.4"
              filter="url(#cube-shadow)"
              animate={{ x: [0, -5, 0], y: [0, 3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </m.g>
        </svg>
      </div>

      {message && (
        <m.div className="flex items-center gap-1.5 mt-2">
          <m.p
            className="text-sm font-medium tracking-wide text-foreground/80"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {message}
          </m.p>
          <m.span
            className="text-sm font-medium text-foreground/60 tracking-widest"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            ...
          </m.span>
        </m.div>
      )}
    </div>
  );
}
