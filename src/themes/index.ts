import onedark from './onedark.json'
import light from './light.json'

export const themes: Record<string, any> = {
  onedark,
  light
}

export const themeOptions = [
  { value: 'onedark', label: 'One Dark' },
  { value: 'light', label: 'Light' }
]
