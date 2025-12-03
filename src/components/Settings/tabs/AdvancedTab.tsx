import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { HelpCircle } from 'lucide-react'
import { useSettingsStore } from '../../../store/useSettingsStore'
import clsx from 'clsx'
import { Toggle } from '../ui/Toggle'
import { Tooltip } from '../ui/Tooltip'
import { Select } from '../ui/Select'

const HelpIcon = ({ content }: { content: string }) => {
  return (
    <Tooltip content={content}>
      <HelpCircle size={15} className={clsx("transition-colors text-muted-foreground hover:text-foreground")} />
    </Tooltip>
  )
}

const AdvancedRow = ({ 
  label, 
  helpContent,
  children, 
  className = "" 
}: { 
  label?: string, 
  helpContent?: string,
  children: React.ReactNode, 
  className?: string 
}) => {
  return (
    <div className={clsx("flex items-center justify-between min-h-10", className)}>
      <div className="flex items-center gap-2">
        {label && (
          <span className="text-sm text-foreground">
            {label}
          </span>
        )}
        {helpContent && <HelpIcon content={helpContent} />}
      </div>
      <div className="flex items-center gap-3">
        {children}
      </div>
    </div>
  )
}

export function AdvancedTab () {
  const { t } = useTranslation()
  const {
    showTopLevelResults,
    setShowTopLevelResults,
    alignResults,
    setAlignResults,
    showUndefined,
    setShowUndefined,
    loopProtection,
    setLoopProtection,
    internalLogLevel,
    setInternalLogLevel,
    magicComments,
    setMagicComments,
    autoRunAfterInstall,
    setAutoRunAfterInstall,
    autoInstallPackages,
    setAutoInstallPackages
  } = useSettingsStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      {/* Sección: Entorno de ejecución */}
      <div>
        <h4 className="text-sm font-semibold mb-6 text-muted-foreground">
          {t('settings.advanced.environment')}
        </h4>

        <div className="space-y-6">
          <AdvancedRow
            label={t('settings.advanced.loopProtection')}
            helpContent={t('settings.advanced.loopProtectionTooltip')}
          >
            <Toggle
              checked={loopProtection}
              onChange={setLoopProtection}
            />
          </AdvancedRow>

          <AdvancedRow
            label={t('settings.advanced.magicComments')}
            helpContent={t('settings.advanced.magicCommentsTooltip')}
          >
            <Toggle
              checked={magicComments}
              onChange={setMagicComments}
            />
          </AdvancedRow>
        </div>
      </div>

      {/* Sección: Resultados */}
      <div>
        <h4 className="text-sm font-semibold mb-6 text-muted-foreground">
          {t('settings.advanced.results')}
        </h4>

        <div className="space-y-6">
           <AdvancedRow
            label={t('settings.advanced.showTopLevelResults')}
            helpContent={t('settings.advanced.showTopLevelResultsTooltip')}
          >
            <Toggle
              checked={showTopLevelResults}
              onChange={setShowTopLevelResults}
            />
          </AdvancedRow>

          <AdvancedRow
            label={t('settings.advanced.alignResults')}
            helpContent={t('settings.advanced.alignResultsTooltip')}
          >
            <Toggle
              checked={alignResults}
              onChange={setAlignResults}
            />
          </AdvancedRow>

          <AdvancedRow
            label={t('settings.advanced.showUndefined')}
            helpContent={t('settings.advanced.showUndefinedTooltip')}
          >
            <Toggle
              checked={showUndefined}
              onChange={setShowUndefined}
            />
          </AdvancedRow>

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

      {/* Sección: Paquetes NPM */}
      <div>
        <h4 className="text-sm font-semibold mb-6 text-muted-foreground">
          {t('settings.categories.npm')}
        </h4>

        <div className="space-y-6">
          <AdvancedRow
            label={t('settings.advanced.autoInstallPackages')}
            helpContent={t('settings.advanced.autoInstallPackagesTooltip')}
          >
            <Toggle
              checked={autoInstallPackages}
              onChange={setAutoInstallPackages}
            />
          </AdvancedRow>

           <AdvancedRow
            label={t('settings.advanced.autoRunAfterInstall')}
            helpContent={t('settings.advanced.autoRunAfterInstallTooltip')}
          >
            <Toggle
              checked={autoRunAfterInstall}
              onChange={setAutoRunAfterInstall}
            />
          </AdvancedRow>
        </div>
      </div>
    </motion.div>
  )
}
