import clsx from 'clsx'
import { useThemeColors } from '../../../hooks/useThemeColors'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  const colors = useThemeColors()
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
          colors.isDark ? "bg-[#3F3F46] peer-focus:ring-blue-800" : "bg-gray-200 peer-focus:ring-blue-400",
          "peer-focus:outline-none peer-focus:ring-4",
          checked ? colors.accentBg : ""
        )}></div>
        <div className={clsx(
          "absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform",
          checked ? "translate-x-full" : "translate-x-0"
        )}></div>
      </div>
      {label && (
        <span className={clsx("text-sm transition-colors", colors.textSecondary, "group-hover:" + colors.text)}>
          {label}
        </span>
      )}
    </label>
  )
}
