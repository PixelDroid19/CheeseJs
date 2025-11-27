import clsx from 'clsx'
import { useThemeColors } from '../../../hooks/useThemeColors'

type SliderProps = React.InputHTMLAttributes<HTMLInputElement>

export function Slider({ className, ...props }: SliderProps) {
  const colors = useThemeColors()
  return (
    <input
      type="range"
      className={clsx(
        "w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500",
        colors.isDark ? "bg-gray-700" : "bg-gray-200",
        className
      )}
      {...props}
    />
  )
}
