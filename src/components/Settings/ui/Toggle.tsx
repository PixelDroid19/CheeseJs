import clsx from 'clsx'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className={clsx("flex items-center cursor-pointer group", label && "space-x-3")}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className={clsx(
          "w-11 h-6 rounded-full peer transition-colors",
          "bg-muted peer-focus:ring-ring peer-focus:outline-none peer-focus:ring-4",
          checked ? "bg-primary" : ""
        )}></div>
        <div className={clsx(
          "absolute top-[2px] left-[2px] bg-background rounded-full h-5 w-5 transition-transform shadow-sm",
          checked ? "translate-x-full" : "translate-x-0"
        )}></div>
      </div>
      {label && (
        <span className={clsx("text-sm transition-colors text-muted-foreground group-hover:text-foreground")}>
          {label}
        </span>
      )}
    </label>
  )
}
