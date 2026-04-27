import { AppearanceTab as SettingsAppearanceTab } from '@cheesejs/settings';
import { themeOptions } from '@cheesejs/themes';
import { useSettingsStore } from '../../../store/storeHooks';

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
