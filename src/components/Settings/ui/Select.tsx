import clsx from 'clsx'
import { useThemeColors } from '../../../hooks/useThemeColors'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode
}

export function Select({ children, className, ...props }: SelectProps) {
  const colors = useThemeColors()
  return (
    <select
      className={clsx(
        "border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all",
        colors.inputBg,
        colors.inputBorder,
        colors.text,
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
