import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { themeOptions as defaultThemeOptions } from '../../../themes';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import { SectionHeader } from '../ui/SectionHeader';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { themeManager } from '../../../lib/themes/theme-manager';

export function AppearanceTab() {
  const { t } = useTranslation();
  const {
    themeName,
    setThemeName,
    fontSize,
    setFontSize,
    uiFontSize,
    setUiFontSize,
    captureTheme,
    setCaptureTheme,
    captureIncludeOutput,
    setCaptureIncludeOutput,
  } = useSettingsStore();

  const [themeOptions, setThemeOptions] = useState(defaultThemeOptions);

  useEffect(() => {
    const updateThemes = () => {
      // Get plugin themes from ThemeManager (filter out built-in themes to avoid duplicates)
      const registeredThemes = themeManager
        .getAllThemes()
        .filter((t) => t.pluginId !== 'builtin')
        .map((t) => ({
          value: t.id,
          label: t.label,
        }));
      setThemeOptions([...defaultThemeOptions, ...registeredThemes]);
    };

    updateThemes();
    // Subscribe to theme changes (returns ThemeSubscription with unsubscribe method)
    const subscription = themeManager.subscribe(() => {
      // Re-fetch themes when any theme change happens
      updateThemes();
    });
    return () => subscription.unsubscribe();
  }, []);

  const CAPTURE_THEMES = [
    {
      name: 'Purple',
      value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      name: 'Sunset',
      value: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
    },
    {
      name: 'Ocean',
      value: 'linear-gradient(to top, #0ba360 0%, #3cba92 100%)',
    },
    {
      name: 'Midnight',
      value: 'linear-gradient(to top, #0f2027 0%, #203a43 60%, #2c5364 100%)',
    },
    {
      name: 'Fire',
      value: 'linear-gradient(to top, #ff0844 0%, #ffb199 100%)',
    },
    { name: 'Clean', value: '#e2e8f0' },
    { name: 'Transparent', value: 'transparent' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div>
        <SectionHeader title={t('settings.categories.appearance')} />

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <label className={clsx('text-sm font-medium', 'text-foreground')}>
              {t('settings.theme')}
            </label>
            <Select
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              className="w-40"
            >
              {themeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <label className={clsx('text-sm font-medium', 'text-foreground')}>
              {t('settings.resetLayout', 'Restablecer Diseño')}
            </label>
            <button
              onClick={() => {
                window.localStorage.removeItem('split-sizes');
                window.location.reload();
              }}
              className="px-3 py-1.5 text-sm font-medium text-white bg-destructive rounded-md hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 transition-colors"
            >
              {t('settings.reset', 'Restablecer')}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={clsx('text-sm font-medium', 'text-foreground')}>
                {t('settings.fontSize')} (Editor)
              </label>
              <span className={clsx('text-sm', 'text-muted-foreground')}>
                {fontSize}px
              </span>
            </div>
            <Slider
              min="12"
              max="32"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={clsx('text-sm font-medium', 'text-foreground')}>
                {t('settings.uiFontSize') || 'Tamaño de fuente (UI)'}
              </label>
              <span className={clsx('text-sm', 'text-muted-foreground')}>
                {uiFontSize}px
              </span>
            </div>
            <Slider
              min="10"
              max="24"
              value={uiFontSize}
              onChange={(e) => setUiFontSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-border">
          <SectionHeader
            title={
              t('settings.categories.capture') || 'Personalización de Captura'
            }
          />

          <div className="flex items-center justify-between mb-6">
            <label className={clsx('text-sm font-medium', 'text-foreground')}>
              {t('settings.captureIncludeOutput') ||
                'Incluir salida en captura'}
            </label>
            <Toggle
              checked={captureIncludeOutput}
              onChange={setCaptureIncludeOutput}
            />
          </div>

          <div className="space-y-3">
            <label className={clsx('text-sm font-medium', 'text-foreground')}>
              {t('settings.captureBackground') || 'Fondo de Captura'}
            </label>
            <div className="grid grid-cols-7 gap-4">
              {CAPTURE_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => setCaptureTheme(theme.value)}
                  className={clsx(
                    'w-12 h-12 rounded-full border transition-all duration-200 shadow-sm relative overflow-hidden',
                    captureTheme === theme.value
                      ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 shadow-md'
                      : 'border-border hover:scale-110 hover:border-primary/50 hover:shadow-md'
                  )}
                  style={{
                    background:
                      theme.value === 'transparent'
                        ? 'conic-gradient(at center, #e2e8f0 0.25turn, #ffffff 0.25turn 0.5turn, #e2e8f0 0.5turn 0.75turn, #ffffff 0.75turn) top left / 10px 10px repeat'
                        : theme.value,
                  }}
                  title={theme.name}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
