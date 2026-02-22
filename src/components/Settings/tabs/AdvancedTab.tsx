import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { useSettingsStore } from '../../../store/storeHooks';
import clsx from 'clsx';
import { Tooltip } from '../ui/Tooltip';
import { Select } from '../ui/Select';

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

const AdvancedRow = ({
  label,
  helpContent,
  children,
  className = '',
}: {
  label?: string;
  helpContent?: string;
  children: React.ReactNode;
  className?: string;
}) => {
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
};

export function AdvancedTab() {
  const { t } = useTranslation();
  const { internalLogLevel, setInternalLogLevel } = useSettingsStore();

  return (
    <m.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      {/* Section: Execution environment */}
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(e) => setInternalLogLevel(e.target.value as any)}
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
