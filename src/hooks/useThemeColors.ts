import { useSettingsStore } from '../store/useSettingsStore'

export const useThemeColors = () => {
  const { themeName } = useSettingsStore()
  const isDark = themeName === 'onedark'

  return {
    isDark,
    bg: isDark ? 'bg-[#18181b]' : 'bg-white',
    sidebarBg: isDark ? 'bg-[#18181b]' : 'bg-gray-50/50',
    text: isDark ? 'text-gray-200' : 'text-gray-800',
    textSecondary: isDark ? 'text-gray-400' : 'text-gray-500',
    border: isDark ? 'border-white/10' : 'border-gray-200',
    inputBg: isDark ? 'bg-[#27272a]' : 'bg-white',
    inputBorder: isDark ? 'border-gray-700' : 'border-gray-300',
    hover: isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100',
    active: isDark ? 'bg-white/10' : 'bg-gray-100',
    accent: isDark ? 'text-blue-400' : 'text-blue-600',
    accentBg: isDark ? 'bg-blue-500' : 'bg-blue-600',
    divider: isDark ? 'border-gray-800' : 'border-gray-100'
  }
}
