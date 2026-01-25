/**
 * Solarized Theme Plugin
 *
 * Provides Solarized Light and Dark themes for Monaco Editor.
 * Based on the original Solarized color scheme by Ethan Schoonover.
 */

module.exports = {
  activate(context) {
    context.logger.info('Solarized theme plugin activated');

    // Themes are registered declaratively via plugin.json
    // This activate function can be used for additional runtime configuration

    return {
      deactivate() {
        context.logger.info('Solarized theme plugin deactivated');
      },
    };
  },
};
