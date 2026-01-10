import clsx from 'clsx';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer group',
        label && 'gap-3',
        description ? 'items-start' : 'items-center'
      )}
    >
      <div className={clsx('relative', description && 'mt-0.5')}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={clsx(
            'w-11 h-6 rounded-full peer transition-colors',
            'bg-muted peer-focus:ring-ring peer-focus:outline-none peer-focus:ring-4',
            checked ? 'bg-primary' : ''
          )}
        ></div>
        <div
          className={clsx(
            'absolute top-[2px] left-[2px] bg-background rounded-full h-5 w-5 transition-transform shadow-sm',
            checked ? 'translate-x-full' : 'translate-x-0'
          )}
        ></div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span
              className={clsx(
                'text-sm transition-colors',
                description
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground group-hover:text-foreground'
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      )}
    </label>
  );
}
