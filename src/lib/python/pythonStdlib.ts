/**
 * Python Standard Library Modules
 * 
 * This list contains modules that are part of Python's standard library
 * and should not be detected as missing packages requiring installation.
 * 
 * Based on Python 3.11+ standard library.
 * Also includes Pyodide built-in packages.
 */

export const PYTHON_STDLIB_MODULES = new Set([
  // Text Processing
  'string', 'difflib', 're', 'textwrap', 'unicodedata', 'stringprep', 'readline', 'rlcompleter',

  // Binary Data
  'struct', 'codecs',

  // Data Types
  'datetime', 'zoneinfo', 'calendar', 'collections', 'heapq', 'bisect', 'array', 'weakref',
  'types', 'copy', 'pprint', 'reprlib', 'enum', 'graphlib',

  // Numeric and Math
  'numbers', 'math', 'cmath', 'decimal', 'fractions', 'random', 'statistics',

  // Functional Programming
  'itertools', 'functools', 'operator',

  // File and Directory Access
  'pathlib', 'fileinput', 'stat', 'filecmp', 'tempfile', 'glob', 'fnmatch', 'linecache', 'shutil',

  // Data Persistence
  'pickle', 'copyreg', 'shelve', 'marshal', 'dbm', 'sqlite3',

  // Data Compression
  'zlib', 'gzip', 'bz2', 'lzma', 'zipfile', 'tarfile',

  // File Formats
  'csv', 'configparser', 'tomllib', 'netrc', 'plistlib',

  // Cryptographic
  'hashlib', 'hmac', 'secrets',

  // OS Services
  'os', 'io', 'time', 'argparse', 'getopt', 'logging', 'getpass', 'curses', 'platform', 'errno', 'ctypes',

  // Concurrent Execution
  'threading', 'multiprocessing', 'concurrent', 'subprocess', 'sched', 'queue', 'contextvars',

  // Networking
  'asyncio', 'socket', 'ssl', 'select', 'selectors', 'signal',

  // Internet Data Handling
  'email', 'json', 'mailbox', 'mimetypes', 'base64', 'binascii', 'quopri',

  // HTML/XML
  'html', 'xml',

  // Internet Protocols
  'webbrowser', 'wsgiref', 'urllib', 'http', 'ftplib', 'poplib', 'imaplib', 'smtplib', 
  'uuid', 'socketserver', 'xmlrpc', 'ipaddress',

  // Multimedia
  'wave', 'colorsys',

  // Internationalization
  'gettext', 'locale',

  // Program Frameworks
  'turtle', 'cmd', 'shlex',

  // GUI
  'tkinter', 'idlelib',

  // Development Tools
  'typing', 'pydoc', 'doctest', 'unittest', 'test', '2to3', 'lib2to3',

  // Debugging and Profiling
  'bdb', 'faulthandler', 'pdb', 'profile', 'timeit', 'trace', 'tracemalloc',

  // Software Packaging
  'distutils', 'ensurepip', 'venv', 'zipapp',

  // Python Runtime
  'sys', 'sysconfig', 'builtins', 'warnings', 'dataclasses', 'contextlib', 'abc', 
  'atexit', 'traceback', 'gc', 'inspect', 'site',

  // Custom Interpreters
  'code', 'codeop',

  // Import System
  'zipimport', 'pkgutil', 'modulefinder', 'runpy', 'importlib',

  // Python Language Services
  'ast', 'symtable', 'token', 'keyword', 'tokenize', 'tabnanny', 'pyclbr', 'py_compile',
  'compileall', 'dis', 'pickletools',

  // MS Windows Specific
  'msvcrt', 'winreg', 'winsound',

  // Unix Specific
  'posix', 'pwd', 'grp', 'fcntl', 'pipes', 'resource', 'termios', 'tty', 'pty', 'crypt', 'spwd',

  // Pyodide Built-in Packages (available without micropip install)
  'micropip', 'pyodide', 'js', 'pyodide_js',

  // Common submodules that should be recognized
  'collections.abc', 'concurrent.futures', 'email.mime', 'html.parser', 'http.client',
  'http.server', 'importlib.metadata', 'importlib.resources', 'logging.handlers',
  'multiprocessing.pool', 'os.path', 'typing.extensions', 'unittest.mock', 'urllib.parse',
  'urllib.request', 'xml.etree', 'xml.etree.ElementTree', 'xml.dom', 'xml.sax',

  // Internal/private modules (start with _)
  '__future__', '__main__', '_thread',

  // Additional commonly available in Pyodide
  'setuptools', 'pkg_resources', 'distlib', 'packaging', 'pyparsing',
])

/**
 * Check if a module name is part of Python's standard library
 */
export function isPythonStdlibModule(moduleName: string): boolean {
  // Check exact match
  if (PYTHON_STDLIB_MODULES.has(moduleName)) {
    return true
  }
  
  // Check if it's a submodule of a stdlib package (e.g., 'os.path', 'collections.abc')
  const topLevel = moduleName.split('.')[0]
  if (PYTHON_STDLIB_MODULES.has(topLevel)) {
    return true
  }
  
  // Check private modules
  if (moduleName.startsWith('_')) {
    return true
  }
  
  return false
}

/**
 * Extract the base package name from an import
 * e.g., 'numpy.random' -> 'numpy'
 */
export function extractPythonPackageName(importPath: string): string {
  return importPath.split('.')[0]
}
