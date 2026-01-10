/**
 * Variable Inspector Component
 *
 * Floating panel that displays live variable values during code execution.
 * Shows value changes with smooth animations.
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff } from 'lucide-react';
import {
  useExecutionVisualizerStore,
  useVariablesArray,
  useIsVisualizationActive,
} from '../store/useExecutionVisualizerStore';
import '../styles/execution-visualizer.css';

interface VariableRowProps {
  name: string;
  value: string;
  type: string;
  changed: boolean;
}

const VariableRow = memo(function VariableRow({
  name,
  value,
  type,
  changed,
}: VariableRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: changed ? [1, 1.02, 1] : 1,
      }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={`variable-row ${changed ? 'variable-changed' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="variable-name">{name}</span>
        <span className="variable-type">{type}</span>
      </div>
      <span className="variable-value" title={value}>
        {value}
      </span>
    </motion.div>
  );
});

export function VariableInspector() {
  const isActive = useIsVisualizationActive();
  const variables = useVariablesArray();
  const showVariables = useExecutionVisualizerStore((s) => s.showVariables);
  const setShowVariables = useExecutionVisualizerStore(
    (s) => s.setShowVariables
  );

  // Don't render if visualization is off or no variables
  if (!isActive) return null;

  return (
    <AnimatePresence>
      {showVariables && variables.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="variable-inspector"
        >
          <div className="variable-inspector-header">
            <span className="variable-inspector-title">Variables</span>
            <button
              onClick={() => setShowVariables(false)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Hide Variables"
            >
              <X className="w-3 h-3 text-white/50" />
            </button>
          </div>

          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {variables.map((variable) => (
                <VariableRow
                  key={variable.name}
                  name={variable.name}
                  value={variable.value}
                  type={variable.type}
                  changed={variable.changed}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Toggle button to show/hide variable inspector
 */
export function VariableInspectorToggle() {
  const showVariables = useExecutionVisualizerStore((s) => s.showVariables);
  const setShowVariables = useExecutionVisualizerStore(
    (s) => s.setShowVariables
  );
  const isActive = useIsVisualizationActive();

  if (!isActive) return null;

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setShowVariables(!showVariables)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
      title={showVariables ? 'Hide Variables' : 'Show Variables'}
    >
      {showVariables ? (
        <EyeOff className="w-4 h-4 text-white/60" />
      ) : (
        <Eye className="w-4 h-4 text-white/60" />
      )}
      <span className="text-xs text-white/60">Variables</span>
    </motion.button>
  );
}

export default VariableInspector;
