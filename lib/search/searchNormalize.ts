/**
 * Search Normalization & Tokenization
 * 
 * Ported from web's docs/src/lib/search/searchNormalize.ts
 * Normalizes text, expands aliases, and tokenizes for search indexing
 */

// ===== GLOBAL ALIAS TABLE =====

const GLOBAL_ALIASES: Record<string, string[]> = {
  // English street abbreviations
  street: ['st', 'str'],
  avenue: ['ave', 'av'],
  boulevard: ['blvd', 'bd', 'boul'],
  road: ['rd'],
  drive: ['dr'],
  lane: ['ln'],
  court: ['ct'],
  place: ['pl'],
  circle: ['cir'],
  highway: ['hwy'],
  route: ['rte', 'rt'],

  // French street terms (common in Francophone Africa)
  rue: ['r'],
  quartier: ['qtr', 'q'],
  carrefour: ['crf'],
  rond_point: ['rp', 'rond-point'],

  // Common terms
  building: ['bldg', 'bld'],
  apartment: ['apt', 'appt'],
  number: ['no', 'num', '#'],
  floor: ['fl', 'etage'],
  block: ['blk', 'bloc'],
};

// ===== PER-COUNTRY ALIAS OVERLAYS =====

const COUNTRY_ALIASES: Record<string, Record<string, string[]>> = {
  CM: {
    // Cameroon-specific
    carrefour: ['crf', 'crfr'],
    quartier: ['qtr', 'qt'],
    avenue: ['ave', 'av'],
  },
  GH: {
    // Ghana-specific
    street: ['st', 'str'],
    road: ['rd'],
  },
  NG: {
    // Nigeria-specific
    street: ['st', 'str'],
    road: ['rd'],
    close: ['cls'],
    crescent: ['cres'],
  },
  SN: {
    // Senegal-specific (French)
    rue: ['r'],
    avenue: ['ave', 'av'],
  },
};

// Pre-computed reverse lookup: abbreviation -> canonical form
let globalReverseLookup: Map<string, string> | null = null;
const countryReverseLookups = new Map<string, Map<string, string>>();

function buildGlobalReverseLookup(): Map<string, string> {
  if (globalReverseLookup) return globalReverseLookup;

  globalReverseLookup = new Map();
  for (const [canonical, aliases] of Object.entries(GLOBAL_ALIASES)) {
    for (const alias of aliases) {
      globalReverseLookup.set(alias, canonical);
    }
  }
  return globalReverseLookup;
}

function buildCountryReverseLookup(countryCode: string): Map<string, string> {
  const cached = countryReverseLookups.get(countryCode);
  if (cached) return cached;

  const lookup = new Map<string, string>();
  const countryAliases = COUNTRY_ALIASES[countryCode];
  if (countryAliases) {
    for (const [canonical, aliases] of Object.entries(countryAliases)) {
      for (const alias of aliases) {
        lookup.set(alias, canonical);
      }
    }
  }
  countryReverseLookups.set(countryCode, lookup);
  return lookup;
}

// ===== DIACRITICS REMOVAL =====

const DIACRITICS_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ė': 'e', 'ę': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'į': 'i',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ō': 'o', 'ø': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ů': 'u',
  'ç': 'c', 'ć': 'c', 'č': 'c',
  'ñ': 'n', 'ń': 'n', 'ň': 'n',
  'ÿ': 'y', 'ý': 'y',
  'ß': 'ss',
  'ž': 'z', 'ź': 'z', 'ż': 'z',
  'ś': 's', 'š': 's',
  'ł': 'l', 'ľ': 'l',
  'ř': 'r',
  'ť': 't',
  'đ': 'd', 'ď': 'd',
};

function removeDiacritics(text: string): string {
  let result = '';
  for (const char of text) {
    result += DIACRITICS_MAP[char] || char;
  }
  return result;
}

// ===== NORMALIZATION =====

/**
 * Normalize text for search indexing/querying
 * - lowercase
 * - trim & collapse whitespace
 * - remove diacritics
 * - strip punctuation (keep alphanumeric and spaces)
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  return removeDiacritics(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
}

// ===== ALIAS EXPANSION =====

/**
 * Expand aliases in text (both directions)
 * Returns array of text variants including original
 */
export function expandAliases(text: string, countryCode?: string): string[] {
  const normalized = normalizeText(text);
  const variants = new Set<string>([normalized]);

  const words = normalized.split(/\s+/);
  const globalLookup = buildGlobalReverseLookup();
  const countryLookup = countryCode ? buildCountryReverseLookup(countryCode) : null;

  // Expand each word
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const expanded = new Set<string>([word]);

    // Check global aliases
    const globalCanonical = globalLookup.get(word);
    if (globalCanonical) {
      expanded.add(globalCanonical);
      // Also add all aliases for the canonical
      const aliases = GLOBAL_ALIASES[globalCanonical] || [];
      aliases.forEach(alias => expanded.add(alias));
    }

    // Check country-specific aliases
    if (countryLookup) {
      const countryCanonical = countryLookup.get(word);
      if (countryCanonical) {
        expanded.add(countryCanonical);
        const aliases = COUNTRY_ALIASES[countryCode!]?.[countryCanonical] || [];
        aliases.forEach(alias => expanded.add(alias));
      }
    }

    // Generate variants with each expansion
    expanded.forEach(expandedWord => {
      const newWords = [...words];
      newWords[i] = expandedWord;
      variants.add(newWords.join(' '));
    });
  }

  return Array.from(variants);
}

// ===== TOKENIZATION =====

/**
 * Generate all prefixes for a word (for prefix matching)
 * e.g., "street" -> ["s", "st", "str", "stre", "stree", "street"]
 */
function generatePrefixes(word: string, minLength: number = 2): string[] {
  const prefixes: string[] = [];
  for (let i = minLength; i <= word.length; i++) {
    prefixes.push(word.substring(0, i));
  }
  return prefixes;
}

/**
 * Tokenize text to prefixes for search indexing
 */
export function tokenizeToPrefixes(text: string, minPrefixLength: number = 2): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const words = normalized.split(/\s+/).filter(w => w.length >= minPrefixLength);
  const prefixes = new Set<string>();

  for (const word of words) {
    const wordPrefixes = generatePrefixes(word, minPrefixLength);
    wordPrefixes.forEach(p => prefixes.add(p));
  }

  return Array.from(prefixes).sort();
}

/**
 * Tokenize text with alias expansion
 */
export function tokenizeWithAliases(text: string, countryCode?: string): string[] {
  const variants = expandAliases(text, countryCode);
  const allPrefixes = new Set<string>();

  for (const variant of variants) {
    const prefixes = tokenizeToPrefixes(variant);
    prefixes.forEach(p => allPrefixes.add(p));
  }

  return Array.from(allPrefixes).sort();
}

/**
 * Get query tokens from search query
 */
export function getQueryTokens(query: string): string[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];

  const words = normalized.split(/\s+/).filter(w => w.length >= 2);
  return words;
}

/**
 * Check if query starts with a number (for house number searches)
 */
export function isNumericLeading(query: string): boolean {
  const trimmed = query.trim();
  return /^\d/.test(trimmed);
}
