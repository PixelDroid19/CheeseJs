/**
 * Python Module
 * 
 * Exports all Python-related functionality for CheeseJS
 */

export {
  registerPythonLanguage,
  isPythonRegistered
} from './pythonLanguage'

export {
  isPythonCode,
  detectLanguage,
  initializePythonSupport,
  updateEditorLanguage
} from './pythonService'

export type { PythonExecutionResult } from './pythonService'
