import clsx from 'clsx'
import { useThemeColors } from '../../../hooks/useThemeColors'

export function SectionHeader({ title }: { title: string }) {
  const colors = useThemeColors()
  return (
    <h3 className={clsx("text-sm font-semibold pb-2 mb-4 border-b", colors.text, colors.divider)}>
      {title}
    </h3>
  )
}
