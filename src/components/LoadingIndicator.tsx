import { m } from 'framer-motion';

interface LoadingIndicatorProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingIndicator({
  message,
  size = 'md',
}: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <m.div
        className={`border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full ${sizeClasses[size]}`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {message && (
        <m.p
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </m.p>
      )}
    </div>
  );
}
