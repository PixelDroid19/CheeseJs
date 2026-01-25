# YAML Language Support Plugin

Example plugin that adds YAML syntax highlighting to CheeseJS.

## Installation

1. Copy this directory to `~/.cheesejs/plugins/yaml-support/`
2. Open CheeseJS → Settings → Plugins
3. Click "Activate" on YAML Language Support

## Features

- ✅ Syntax highlighting for .yaml and .yml files
- ✅ Auto-closing brackets and quotes
- ✅ Comment support (#)

## Usage

Once activated, simply open or create a .yaml file in the editor.

## Example

```yaml
# Sample YAML configuration
app:
  name: CheeseJS
  version: 1.0.0
  features:
    - Code execution
    - Plugins
    - Testing
```

## Technical Details

This plugin demonstrates the **Language Extension Point**:

- Manifest declares language contribution in `plugin.json`
- Monaco configuration provides syntax rules
- CheeseJS automatically registers the language on activation

## License

MIT
