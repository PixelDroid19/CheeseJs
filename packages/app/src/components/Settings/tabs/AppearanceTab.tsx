import { AppearanceTab as SettingsAppearanceTab } from '@cheesejs/settings';
import { useSettingsStore } from '../../../store/storeHooks';
import { themeOptions } from '../../../themes';

export function AppearanceTab() {
  const {
    themeName,
    setThemeName,
    fontSize,
    setFontSize,
    uiFontSize,
    setUiFontSize,
    fontLigatures,
    setFontLigatures,
  } = useSettingsStore();

  return (
    <SettingsAppearanceTab
      themeName={themeName}
      onThemeNameChange={setThemeName}
      fontSize={fontSize}
      onFontSizeChange={setFontSize}
      uiFontSize={uiFontSize}
      onUiFontSizeChange={setUiFontSize}
      fontLigatures={fontLigatures}
      onFontLigaturesChange={setFontLigatures}
      themeOptions={themeOptions}
    />
  );
}
