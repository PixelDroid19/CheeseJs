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

export function CompilationTab() {
  const { t } = useTranslation();
  const {
    loopProtection,
    setLoopProtection,
    magicComments,
    setMagicComments,
    showTopLevelResults,
    setShowTopLevelResults,
  } = useSettingsStore();

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
            <Toggle checked={loopProtection} onChange={setLoopProtection} />
          </Row>

          <Row
            label={t('settings.advanced.magicComments')}
            helpContent={t('settings.advanced.magicCommentsTooltip')}
          >
            <Toggle checked={magicComments} onChange={setMagicComments} />
          </Row>

          <Row
            label={t('settings.advanced.showTopLevelResults')}
            helpContent={t('settings.advanced.showTopLevelResultsTooltip')}
          >
            <Toggle
              checked={showTopLevelResults}
              onChange={setShowTopLevelResults}
            />
          </Row>
        </div>
      </div>
    </m.div>
  );
}
