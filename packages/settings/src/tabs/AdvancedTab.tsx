import { m } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { Select } from '../ui/Select';
import { Tooltip } from '../ui/Tooltip';

export interface AdvancedTabProps {
  internalLogLevel: 'debug' | 'error' | 'info' | 'none' | 'warn';
  onInternalLogLevelChange: (
    level: 'debug' | 'error' | 'info' | 'none' | 'warn'
  ) => void;
}

export function AdvancedTab({
  internalLogLevel,
  onInternalLogLevelChange,
}: AdvancedTabProps) {
  const { t } = useTranslation();

  return (
    <m.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div>
        <h4 className="text-sm font-semibold mb-6 text-muted-foreground">
          {t('settings.advanced.logsConfig')}
        </h4>

        <div className="space-y-6">
          <AdvancedRow
            label={t('settings.advanced.internalLogLevel')}
            helpContent={t('settings.advanced.internalLogLevelTooltip')}
          >
            <Select
              value={internalLogLevel}
              onChange={(event) =>
                onInternalLogLevelChange(
                  event.target.value as AdvancedTabProps['internalLogLevel']
                )
              }
              className="w-32"
            >
              <option value="none">None</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </Select>
          </AdvancedRow>
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

function AdvancedRow({
  label,
  helpContent,
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
  helpContent?: string;
  label?: string;
}) {
  return (
    <div
      className={clsx('flex items-center justify-between min-h-10', className)}
    >
      <div className="flex items-center gap-2">
        {label && <span className="text-sm text-foreground">{label}</span>}
        {helpContent && <HelpIcon content={helpContent} />}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
