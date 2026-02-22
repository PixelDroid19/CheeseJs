/**
 * Query Rewriting Module
 *
 * Transforms user queries before they hit the search pipeline to improve
 * retrieval quality. Strategies:
 *
 * 1. Synonym expansion — maps common programming term variants
 * 2. Typo correction — fixes frequent technical misspellings
 * 3. Query decomposition — splits compound queries into sub-queries
 * 4. Term normalization — normalizes casing, whitespace, common prefixes
 */

// ---------------------------------------------------------------------------
// Synonym expansion
// ---------------------------------------------------------------------------

/**
 * Bidirectional synonym groups for programming terms.
 * When a term from any group is found, all other terms in the group are appended.
 */
const SYNONYM_GROUPS: string[][] = [
  ['function', 'func', 'fn', 'method', 'def'],
  ['class', 'struct', 'type', 'interface'],
  ['error', 'exception', 'throw', 'catch', 'try'],
  ['async', 'await', 'promise', 'asynchronous'],
  ['import', 'require', 'module', 'export'],
  ['array', 'list', 'collection', 'slice'],
  ['object', 'map', 'dict', 'dictionary', 'hash', 'record'],
  ['string', 'str', 'text'],
  ['number', 'int', 'integer', 'float', 'double', 'num'],
  ['boolean', 'bool', 'flag'],
  ['null', 'nil', 'none', 'undefined', 'void'],
  ['loop', 'for', 'while', 'iterate', 'foreach'],
  ['variable', 'var', 'let', 'const', 'val'],
  ['component', 'widget', 'element'],
  ['callback', 'handler', 'listener', 'hook'],
  ['database', 'db', 'store', 'storage', 'repository', 'repo'],
  ['test', 'spec', 'unit test', 'testing'],
  ['config', 'configuration', 'settings', 'options', 'preferences'],
  ['api', 'endpoint', 'route', 'handler'],
  ['authentication', 'auth', 'login', 'signin', 'sign in'],
  ['render', 'display', 'show', 'view'],
];

/** Build a lookup from any term to its synonym group */
const synonymLookup: Map<string, string[]> = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    synonymLookup.set(term.toLowerCase(), group);
  }
}

/**
 * Expand a query by appending synonyms for any matched terms.
 * Only adds terms not already in the query.
 */
function expandSynonyms(query: string): string {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);
  const additions: string[] = [];

  for (const word of words) {
    const group = synonymLookup.get(word);
    if (group) {
      for (const synonym of group) {
        if (!lowerQuery.includes(synonym) && !additions.includes(synonym)) {
          additions.push(synonym);
        }
      }
    }
  }

  if (additions.length === 0) return query;
  return `${query} ${additions.join(' ')}`;
}

// ---------------------------------------------------------------------------
// Typo correction
// ---------------------------------------------------------------------------

/** Common misspellings of technical terms */
const TYPO_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  javasript: 'javascript',
  javscript: 'javascript',
  javascirpt: 'javascript',
  typescipt: 'typescript',
  typscript: 'typescript',
  typescrip: 'typescript',
  // React
  recat: 'react',
  raect: 'react',
  // Common terms
  fucntion: 'function',
  funciton: 'function',
  funcion: 'function',
  functoin: 'function',
  retrun: 'return',
  reutrn: 'return',
  consle: 'console',
  cosole: 'console',
  asncy: 'async',
  aysnc: 'async',
  awiat: 'await',
  improt: 'import',
  ipmort: 'import',
  exoprt: 'export',
  eport: 'export',
  compnent: 'component',
  componet: 'component',
  tempalte: 'template',
  templete: 'template',
  interace: 'interface',
  inteface: 'interface',
  varaible: 'variable',
  varialbe: 'variable',
  paramter: 'parameter',
  paramater: 'parameter',
  arguement: 'argument',
  agument: 'argument',
  promies: 'promise',
  promse: 'promise',
  resposne: 'response',
  reqeust: 'request',
  requets: 'request',
  middlware: 'middleware',
  midleware: 'middleware',
  datbase: 'database',
  databse: 'database',
  configuraton: 'configuration',
  configuation: 'configuration',
  authetication: 'authentication',
  authentcation: 'authentication',
  initalize: 'initialize',
  initilize: 'initialize',
};

/**
 * Fix common typos in the query.
 */
function fixTypos(query: string): string {
  const words = query.split(/\s+/);
  const corrected = words.map((word) => {
    const lower = word.toLowerCase();
    const fix = TYPO_MAP[lower];
    if (fix) {
      // Preserve original casing pattern if possible
      if (word[0] === word[0].toUpperCase()) {
        return fix.charAt(0).toUpperCase() + fix.slice(1);
      }
      return fix;
    }
    return word;
  });
  return corrected.join(' ');
}

// ---------------------------------------------------------------------------
// Query decomposition
// ---------------------------------------------------------------------------

/** Patterns that indicate a compound query */
const COMPOUND_PATTERNS = [
  /\band\b/i,
  /\bor\b/i,
  /\balso\b/i,
  /\bas well as\b/i,
  /,\s+(?:and\s+)?/,
];

/**
 * Split compound queries into sub-queries.
 * "How to create a function and export it" -> ["How to create a function", "export it"]
 *
 * Returns the original query plus sub-queries (if decomposition applies).
 */
function decomposeQuery(query: string): string[] {
  // Don't decompose short queries
  if (query.split(/\s+/).length <= 4) return [query];

  for (const pattern of COMPOUND_PATTERNS) {
    if (pattern.test(query)) {
      const parts = query
        .split(pattern)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);

      if (parts.length > 1) {
        // Return original + sub-parts
        return [query, ...parts];
      }
    }
  }

  return [query];
}

// ---------------------------------------------------------------------------
// Term normalization
// ---------------------------------------------------------------------------

/**
 * Normalize query terms: trim, collapse whitespace, lowercase common prefixes.
 */
function normalizeQuery(query: string): string {
  return (
    query
      .trim()
      .replace(/\s+/g, ' ')
      // Remove common question prefixes that don't help retrieval
      .replace(
        /^(?:how (?:do I|to|can I)|what (?:is|are)|where (?:is|are|do)|can (?:I|you)|please|help me)\s+/i,
        ''
      )
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RewriteResult {
  /** The primary rewritten query (typo-fixed, normalized) */
  primary: string;
  /** Synonym-expanded version of the primary query */
  expanded: string;
  /** Sub-queries from decomposition (if compound query detected) */
  subQueries: string[];
  /** Whether any rewriting was actually applied */
  wasRewritten: boolean;
}

/**
 * Rewrite a user query to improve retrieval quality.
 * Returns the rewritten variants.
 */
export function rewriteQuery(query: string): RewriteResult {
  if (!query || query.trim().length === 0) {
    return { primary: '', expanded: '', subQueries: [], wasRewritten: false };
  }

  const original = query.trim();

  // Step 1: Fix typos
  const typoFixed = fixTypos(original);

  // Step 2: Normalize
  const normalized = normalizeQuery(typoFixed);

  // Step 3: Expand synonyms
  const expanded = expandSynonyms(normalized);

  // Step 4: Decompose
  const subQueries = decomposeQuery(normalized);

  const wasRewritten =
    normalized !== original || expanded !== normalized || subQueries.length > 1;

  return {
    primary: normalized,
    expanded,
    subQueries,
    wasRewritten,
  };
}
