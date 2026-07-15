'use strict';

/**
 * ===========================================================
 * CATEGORY CODE DECODER
 * ===========================================================
 * Real Maharashtra CAP cutoff data encodes compound category
 * codes like "GOPENH" (General seat, OPEN category, Home
 * University) or "PWDOPENH" (PWD reservation, OPEN base,
 * Home University). This decodes them into:
 *   - resolvedCode: which existing `categories` table code this
 *     row should be matched against (e.g. 'OPEN', 'PWD', 'VJ')
 *   - genderType: 'G' or 'L' (Ladies-only seat), or null
 *
 * The base-category alias table below (NTA->VJ, NTB->NT1,
 * NTC->NT2, NTD->NT3, SEBC->SBC) follows standard Maharashtra
 * DTE convention. Flagged for verification against the user's
 * source document — if it needs correction, this table is the
 * one place to fix it.
 * ===========================================================
 */

// Codes that appear directly, unprefixed/unsuffixed, matching
// an existing categories table code exactly.
const DIRECT_CODES = new Set([
  'EWS', 'TFWS', 'MI', 'DEFENCE', 'PWD', 'ORPHAN',
  'OPEN', 'OBC', 'SC', 'ST', 'VJ', 'NT1', 'NT2', 'NT3', 'SBC',
]);

// Special-reservation prefixes — when a code starts with one of
// these, the WHOLE code resolves to that special category,
// regardless of which base category follows (e.g. "PWDOPENH"
// and a hypothetical "PWDOBCH" both resolve to PWD). See the
// Phase 10 conversation notes: this is a known simplification —
// real data may have PWD reserved separately per base category,
// which this does not distinguish.
const SPECIAL_PREFIXES = [
  ['DEFENCE', 'DEFENCE'],
  ['DEF', 'DEFENCE'],
  ['PWD', 'PWD'],
  ['ORPHAN', 'ORPHAN'],
];

// Base-category token (after stripping gender prefix and
// optional university suffix) -> categories table code.
const BASE_CATEGORY_ALIASES = {
  OPEN: 'OPEN',
  OBC: 'OBC',
  SC: 'SC',
  ST: 'ST',
  NTA: 'VJ',
  NTB: 'NT1',
  NTC: 'NT2',
  NTD: 'NT3',
  SEBC: 'SBC',
  VJ: 'VJ',
  NT1: 'NT1',
  NT2: 'NT2',
  NT3: 'NT3',
  SBC: 'SBC',
};

/**
 * Decodes one category code string. Returns
 * { resolvedCode: string|null, genderType: 'G'|'L'|null }.
 * resolvedCode is null if the code doesn't match any known
 * pattern — the caller (validateRow) turns that into a clear
 * per-row validation error rather than guessing.
 */
function decodeCategoryCode(rawCode) {
  const code = String(rawCode).trim().toUpperCase();

  if (DIRECT_CODES.has(code)) {
    return { resolvedCode: code, genderType: null };
  }

  for (const [prefix, resolvedCode] of SPECIAL_PREFIXES) {
    if (code.startsWith(prefix) && code.length > prefix.length) {
      return { resolvedCode, genderType: null };
    }
  }

  const genderMatch = /^([GL])(.+)$/.exec(code);
  if (genderMatch) {
    const genderType = genderMatch[1];
    const remainder = genderMatch[2];

    if (BASE_CATEGORY_ALIASES[remainder]) {
      return { resolvedCode: BASE_CATEGORY_ALIASES[remainder], genderType };
    }

    // Try stripping a trailing university-seat suffix (H/O/S)
    // and matching what's left as the base category. The code's
    // own suffix is NOT used as the authoritative source for
    // seat-pool eligibility (that comes from `section` instead,
    // via classifySeatPool) — real data shows the suffix isn't
    // always reliable for that (e.g. a "...H" code appearing
    // under an "Other Than Home" section).
    const suffixMatch = /^(.+)([HOS])$/.exec(remainder);
    if (suffixMatch && BASE_CATEGORY_ALIASES[suffixMatch[1]]) {
      return { resolvedCode: BASE_CATEGORY_ALIASES[suffixMatch[1]], genderType };
    }
  }

  return { resolvedCode: null, genderType: null };
}

/**
 * Classifies the `section` free-text field into a normalized
 * seat-pool enum, via keyword matching (not exact string match,
 * since exact wording may vary slightly across source files).
 * Order matters — more specific checks first.
 */
function classifySeatPool(sectionText) {
  if (!sectionText) return null;
  const s = String(sectionText).toLowerCase();

  if (s.includes('state level')) return 'STATE_LEVEL';
  if (s.includes('minority')) return 'MINORITY';
  // Check the longer, more specific pattern first — "Other Than
  // Home University Seats Allotted to Other Than Home University
  // Candidates" contains "home university seats allotted to
  // other" as a substring (right after "Other Than "), so
  // checking HOME_TO_OTHER first would misclassify it.
  if (s.includes('other than home university seats allotted to other')) return 'OTHER_TO_OTHER';
  if (s.includes('other than home university seats allotted to home')) return 'OTHER_TO_HOME';
  if (s.includes('home university seats allotted to home university')) return 'HOME_TO_HOME';
  if (s.includes('home university seats allotted to other')) return 'HOME_TO_OTHER';

  return 'UNKNOWN';
}

module.exports = { decodeCategoryCode, classifySeatPool, DIRECT_CODES, BASE_CATEGORY_ALIASES };
