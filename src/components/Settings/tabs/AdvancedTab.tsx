import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { HelpCircle } from 'lucide-react'
import { useSettingsStore } from '../../../store/useSettingsStore'
import { useThemeColors } from '../../../hooks/useThemeColors'
import clsx from 'clsx'
import { Toggle } from '../ui/Toggle'
import { Tooltip } from '../ui/Tooltip'
import { Select } from '../ui/Select'

const HelpIcon = ({ content }: { content: string }) => {
  const colors = useThemeColors()
  return (
    <Tooltip content={content}>
      <HelpCircle size={15} className={clsx("transition-colors", colors.textSecondary, "hover:text-gray-300")} />
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
  const colors = useThemeColors()
  return (
    <div className={clsx("flex items-center justify-between min-h-[40px]", className)}>
      <div className="flex items-center gap-2">
        {label && (
          <span className={clsx("text-sm", colors.isDark ? "text-gray-200" : "text-gray-700")}>
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
  const colors = useThemeColors()
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
    executionEnvironment,
    setExecutionEnvironment
  } = useSettingsStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      {/* Sección: Entorno de ejecución */}
      <div>
        <h4 className={clsx("text-sm font-semibold mb-6", colors.textSecondary)}>
          {t('settings.advanced.environment')}
        </h4>

        <div className="space-y-6">
          <AdvancedRow
            label={t('settings.advanced.executionEnvironment')}
            helpContent={t('settings.advanced.executionEnvironmentTooltip')}
          >
            <Select
              value={executionEnvironment}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(e) => setExecutionEnvironment(e.target.value as any)}
              className="w-48"
            >
              <option value="node">Node.js (WebContainer)</option>
              <option value="browser">Browser (DOM)</option>
            </Select>
          </AdvancedRow>
        </div>
      </div>

      {/* Sección: Configuración de logs */}
      <div>
        <h4 className={clsx("text-sm font-semibold mb-6", colors.textSecondary)}>
          {t('settings.advanced.logsConfig')}
        </h4>

        <div className="space-y-6">
          {/* Nivel de detalle */}
          <AdvancedRow 
            label={t('settings.advanced.logLevel')} 
            helpContent={t('settings.advanced.logLevelTooltip')}
          >
            <Select
              value={internalLogLevel}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(e) => setInternalLogLevel(e.target.value as any)}
              className="w-48"
            >
              <option value="none">Oculto (Default)</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </Select>
          </AdvancedRow>

          {/* Evaluación de expresiones */}
          <AdvancedRow 
            label={t('settings.advanced.expressionEvaluation')}
            helpContent={t('settings.advanced.showTopLevelTooltip')}
          >
            <Toggle 
              checked={showTopLevelResults} 
              onChange={setShowTopLevelResults} 
            />
          </AdvancedRow>

          {/* Formato de salida */}
          <div>
            <div className={clsx("text-sm mb-4", colors.isDark ? "text-gray-200" : "text-gray-700")}>
              {t('settings.advanced.outputFormat')}
            </div>
            <div className="space-y-4">
              <AdvancedRow 
                label={t('settings.advanced.alignWithSource') || "Alinear resultado con fuente"}
                helpContent={t('settings.advanced.alignTooltip')}
              >
                <Toggle 
                  checked={alignResults} 
                  onChange={setAlignResults} 
                />
              </AdvancedRow>
              <AdvancedRow 
                label={t('settings.advanced.showUndefined') || "Mostrar valores undefined"}
                helpContent={t('settings.advanced.showUndefinedTooltip')}
              >
                <Toggle 
                  checked={showUndefined} 
                  onChange={setShowUndefined} 
                />
              </AdvancedRow>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className={clsx("border-t my-6", colors.isDark ? "border-[#2B2D31]" : "border-gray-200")} />

      {/* Sección: Ejecución */}
      <div>
        <h4 className={clsx("text-sm font-semibold mb-6", colors.textSecondary)}>
          {t('settings.advanced.execution')}
        </h4>
        
        <AdvancedRow 
          label={t('settings.advanced.loopProtection') || "Límite de ejecución para bucles"}
          helpContent={t('settings.advanced.loopProtectionTooltip')}
        >
          <Toggle 
            checked={loopProtection} 
            onChange={setLoopProtection} 
          />
        </AdvancedRow>

        <AdvancedRow 
          label={t('settings.advanced.magicComments') || "Comentarios mágicos"}
          helpContent={t('settings.advanced.magicCommentsTooltip') || "Habilita comentarios especiales como //? para depuración"}
        >
          <Toggle 
            checked={magicComments} 
            onChange={setMagicComments} 
          />
        </AdvancedRow>
      </div>
    </motion.div>
  )
}
