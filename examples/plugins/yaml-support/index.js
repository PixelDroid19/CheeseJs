/**
 * YAML Language Support Plugin
 *
 * Example plugin demonstrating language extension point.
 * Adds YAML syntax highlighting to CheeseJS.
 */

module.exports = {
  /**
   * Activate plugin
   * @param {Object} context - Plugin context
   */
  activate(context) {
    context.logger.info('YAML Support plugin activated');

    // Language contribution is automatically registered from manifest
    // This is just a placeholder for any additional activation logic

    // Example: Could add custom YAML validation, parsing, etc.
    // For now, Monaco language config from manifest is sufficient
  },

  /**
   * Deactivate plugin
   */
  deactivate() {
    console.log('[YAML Support] Plugin deactivated');
  },
};
