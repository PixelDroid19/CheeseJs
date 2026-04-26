import clsx from 'clsx';

interface SliderProps {
  className?: string;
  description?: string;
  formatValue?: (value: number) => string;
  label?: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}

export function Slider({
  className,
  description,
  formatValue,
  label,
  max = 100,
  min = 0,
  onChange,
  step = 1,
  value,
}: SliderProps) {
  return (
    <div className={clsx('space-y-3', className)}>
      {(label || formatValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm font-medium text-foreground">
              {label}
            </label>
          )}
          <span className="text-sm text-muted-foreground">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={clsx(
          'w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary',
          'bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
        )}
      />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
