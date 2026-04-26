import { m } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Toggle, Tooltip } from '@cheesejs/ui';

export interface FormattingTabProps {
  alignResults: boolean;
  consoleFilters: {
    error: boolean;
    info: boolean;
    log: boolean;
    warn: boolean;
  };
  onAlignResultsChange: (value: boolean) => void;
  onConsoleFiltersChange: (
    filters: Partial<{
      error: boolean;
      info: boolean;
      log: boolean;
      warn: boolean;
    }>
  ) => void;
  onShowUndefinedChange: (value: boolean) => void;
  showUndefined: boolean;
}

export function FormattingTab({
  alignResults,
  consoleFilters,
  onAlignResultsChange,
  onConsoleFiltersChange,
  onShowUndefinedChange,
  showUndefined,
}: FormattingTabProps) {
  const { t } = useTranslation();

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
            <Toggle checked={alignResults} onChange={onAlignResultsChange} />
          </Row>

          <Row
            label={t('settings.advanced.showUndefined')}
            helpContent={t('settings.advanced.showUndefinedTooltip')}
          >
            <Toggle checked={showUndefined} onChange={onShowUndefinedChange} />
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
              onChange={(checked) => onConsoleFiltersChange({ log: checked })}
            />
          </Row>

          <Row label={t('settings.formatting.filterInfo')}>
            <Toggle
              checked={consoleFilters.info}
              onChange={(checked) => onConsoleFiltersChange({ info: checked })}
            />
          </Row>

          <Row label={t('settings.formatting.filterWarn')}>
            <Toggle
              checked={consoleFilters.warn}
              onChange={(checked) => onConsoleFiltersChange({ warn: checked })}
            />
          </Row>

          <Row label={t('settings.formatting.filterError')}>
            <Toggle
              checked={consoleFilters.error}
              onChange={(checked) => onConsoleFiltersChange({ error: checked })}
            />
          </Row>
        </div>
      </div>
    </m.div>
  );
}

function HelpIcon({ content }: { content: string }) {
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
}

function Row({
  label,
  helpContent,
  children,
}: {
  children: ReactNode;
  helpContent?: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between min-h-10">
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">{label}</span>
        {helpContent && <HelpIcon content={helpContent} />}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
