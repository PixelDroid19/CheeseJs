/**
 * Dependencies module exports
 */

export {
  detectDependencies,
  detectJSDependencies,
  detectPythonDependencies,
  checkInstalledPackages,
  getSuggestedPackages,
  formatMissingDependencies,
  type DetectedDependency,
  type DependencyDetectionResult,
} from './detector';
