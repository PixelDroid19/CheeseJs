import onedark from './onedark.json'
import light from './light.json'
import midnight from './midnight.json'

export type ThemeType = 'light' | 'dark'

export interface ThemeDefinition {
  name: string
  label: string
  type: ThemeType
  monacoTheme: unknown
}

export const themesConfig: Record<string, ThemeDefinition> = {
  onedark: {
    name: 'onedark',
    label: 'One Dark',
    type: 'dark',
    monacoTheme: onedark
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    type: 'dark',
    monacoTheme: midnight
  },
  light: {
    name: 'light',
    label: 'Light',
    type: 'light',
    monacoTheme: light
  }
}

export const themes: Record<string, unknown> = Object.fromEntries(
  Object.values(themesConfig).map((t) => [t.name, t.monacoTheme])
)

export const themeOptions = Object.values(themesConfig).map((t) => ({
  value: t.name,
  label: t.label
}))
