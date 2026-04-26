import { m } from 'framer-motion';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { Toggle } from '../ui/Toggle';
import { Tooltip } from '../ui/Tooltip';

export interface CompilationTabProps {
  loopProtection: boolean;
  magicComments: boolean;
  onLoopProtectionChange: (value: boolean) => void;
  onMagicCommentsChange: (value: boolean) => void;
  onShowTopLevelResultsChange: (value: boolean) => void;
  showTopLevelResults: boolean;
}

export function CompilationTab({
  loopProtection,
  magicComments,
  onLoopProtectionChange,
  onMagicCommentsChange,
  onShowTopLevelResultsChange,
  showTopLevelResults,
}: CompilationTabProps) {
  const { t } = useTranslation();

  return (
    <m.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      <div>
        <h4 className="text-sm font-semibold mb-6 text-muted-foreground">
          {t('settings.compilation.transforms')}
        </h4>

        <div className="space-y-6">
          <Row
            label={t('settings.advanced.loopProtection')}
            helpContent={t('settings.advanced.loopProtectionTooltip')}
          >
            <Toggle
              checked={loopProtection}
              onChange={onLoopProtectionChange}
            />
          </Row>

          <Row
            label={t('settings.advanced.magicComments')}
            helpContent={t('settings.advanced.magicCommentsTooltip')}
          >
            <Toggle checked={magicComments} onChange={onMagicCommentsChange} />
          </Row>

          <Row
            label={t('settings.advanced.showTopLevelResults')}
            helpContent={t('settings.advanced.showTopLevelResultsTooltip')}
          >
            <Toggle
              checked={showTopLevelResults}
              onChange={onShowTopLevelResultsChange}
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
