/**
 * Data Scrubber Utility
 * Removes sensitive information before sending code to cloud providers
 */

// Patterns for common sensitive data
const SENSITIVE_PATTERNS = [
  // API Keys and Secrets
  {
    pattern:
      /(['"`])(?:sk|api|secret|token|key|auth|password|pwd|bearer)[-_]?[a-zA-Z0-9]{20,}(['"`])/gi,
    replacement: '$1[REDACTED_KEY]$2',
  },

  // Environment variable values (e.g., process.env.SECRET = "value")
  {
    pattern: /(process\.env\.[A-Z_]+\s*=\s*)(['"`])[^'"]+\2/gi,
    replacement: '$1$2[REDACTED]$2',
  },

  // Common secret patterns
  {
    pattern: /(['"`])(ghp_[a-zA-Z0-9]{36})(['"`])/g,
    replacement: '$1[REDACTED_GITHUB_TOKEN]$3',
  }, // GitHub PAT
  {
    pattern: /(['"`])(xox[baprs]-[a-zA-Z0-9-]+)(['"`])/g,
    replacement: '$1[REDACTED_SLACK_TOKEN]$3',
  }, // Slack tokens
  {
    pattern: /(['"`])(AKIA[0-9A-Z]{16})(['"`])/g,
    replacement: '$1[REDACTED_AWS_KEY]$3',
  }, // AWS Access Key

  // Connection strings
  { pattern: /(mongodb(?:\+srv)?:\/\/)[^@]+@/gi, replacement: '$1[REDACTED]@' },
  { pattern: /(postgres(?:ql)?:\/\/)[^@]+@/gi, replacement: '$1[REDACTED]@' },
  { pattern: /(mysql:\/\/)[^@]+@/gi, replacement: '$1[REDACTED]@' },
  { pattern: /(redis:\/\/)[^@]+@/gi, replacement: '$1[REDACTED]@' },

  // JWT tokens
  {
    pattern:
      /(['"`])(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)(['"`])/g,
    replacement: '$1[REDACTED_JWT]$3',
  },
];

/**
 * Scrubs sensitive data from code before sending to cloud
 */
export function scrubSensitiveData(code: string): string {
  let scrubbedCode = code;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    scrubbedCode = scrubbedCode.replace(pattern, replacement);
  }

  return scrubbedCode;
}

/**
 * Checks if code contains potentially sensitive data
 */
export function containsSensitiveData(code: string): boolean {
  for (const { pattern } of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(code)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a summary of what sensitive items were found
 */
export function getSensitiveDataSummary(code: string): string[] {
  const found: string[] = [];

  const checks = [
    { pattern: /sk[-_]?[a-zA-Z0-9]{20,}/gi, label: 'API Key' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/g, label: 'GitHub Token' },
    { pattern: /xox[baprs]-[a-zA-Z0-9-]+/g, label: 'Slack Token' },
    { pattern: /AKIA[0-9A-Z]{16}/g, label: 'AWS Access Key' },
    {
      pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
      label: 'JWT Token',
    },
    {
      pattern: /mongodb(?:\+srv)?:\/\/[^@]+@/gi,
      label: 'MongoDB Connection String',
    },
    {
      pattern: /postgres(?:ql)?:\/\/[^@]+@/gi,
      label: 'PostgreSQL Connection String',
    },
  ];

  for (const { pattern, label } of checks) {
    pattern.lastIndex = 0;
    if (pattern.test(code)) {
      found.push(label);
    }
  }

  return [...new Set(found)]; // Remove duplicates
}
