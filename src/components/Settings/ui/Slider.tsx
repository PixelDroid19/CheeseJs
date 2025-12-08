import clsx from 'clsx';

type SliderProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Slider({ className, ...props }: SliderProps) {
  return (
    <input
      type="range"
      className={clsx(
        'w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary',
        'bg-muted',
        className
      )}
      {...props}
    />
  );
}
