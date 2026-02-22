import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import clsx from 'clsx';
import { useSettingsStore } from '../../../store/storeHooks';
import { Toggle } from '../ui/Toggle';
import { Tooltip } from '../ui/Tooltip';

const HelpIcon = ({ content }: { content: string }) => {
  return (
    <Tooltip content={content}>
      <HelpCircle
        size={15}
        className={clsx(
          'transition-colors text-muted-foreground hover:text-foreground'
        )}
      />
    </Tooltip>
  );
};

const Row = ({
  label,
  helpContent,
  children,
}: {
  label: string;
  helpContent?: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex items-center justify-between min-h-10">
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">{label}</span>
        {helpContent && <HelpIcon content={helpContent} />}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
};

export function FormattingTab() {
  const { t } = useTranslation();
  const {
    alignResults,
    setAlignResults,
    showUndefined,
    setShowUndefined,
    consoleFilters,
    setConsoleFilters,
  } = useSettingsStore();

  return (
    <m.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div>
        <h4 className="text-sm font-semibold mb-6 text-muted-foreground">
          {t('settings.formatting.display')}
        </h4>

        <div className="space-y-6">
          <Row
            label={t('settings.advanced.alignResults')}
            helpContent={t('settings.advanced.alignResultsTooltip')}
          >
            <Toggle checked={alignResults} onChange={setAlignResults} />
          </Row>

          <Row
            label={t('settings.advanced.showUndefined')}
            helpContent={t('settings.advanced.showUndefinedTooltip')}
          >
            <Toggle checked={showUndefined} onChange={setShowUndefined} />
          </Row>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-6 text-muted-foreground">
          {t('settings.formatting.filters')}
        </h4>

        <div className="space-y-6">
          <Row label={t('settings.formatting.filterLog')}>
            <Toggle
              checked={consoleFilters.log}
              onChange={(checked) => setConsoleFilters({ log: checked })}
            />
          </Row>

          <Row label={t('settings.formatting.filterInfo')}>
            <Toggle
              checked={consoleFilters.info}
              onChange={(checked) => setConsoleFilters({ info: checked })}
            />
          </Row>

          <Row label={t('settings.formatting.filterWarn')}>
            <Toggle
              checked={consoleFilters.warn}
              onChange={(checked) => setConsoleFilters({ warn: checked })}
            />
          </Row>

          <Row label={t('settings.formatting.filterError')}>
            <Toggle
              checked={consoleFilters.error}
              onChange={(checked) => setConsoleFilters({ error: checked })}
            />
          </Row>
        </div>
      </div>
    </m.div>
  );
}
