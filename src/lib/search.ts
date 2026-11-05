/**
 * Unicode-aware search helpers.
 *
 * Hindi (Devanagari) text frequently arrives in different but visually
 * identical Unicode forms. The same word can be encoded with precomposed
 * characters or with a base letter plus combining marks (e.g. the nukta form
 * "क़" can be a single code point U+0958 or "क" + U+093C). Plain
 * `String.includes` treats these as different strings, so a user's typed query
 * silently fails to match stored data.
 *
 * `normalizeForSearch` collapses these differences by:
 *   1. NFC normalization — canonically composes combining marks so both forms
 *      become the same sequence.
 *   2. `toLocaleLowerCase` — case-folds mixed Latin text (no-op for Devanagari).
 *   3. Whitespace trimming + internal whitespace collapsing.
 *
 * Use `matchesQuery` / `matchesAnyField` for all client-side text filtering so
 * Hindi, English, and mixed Hindi-English queries all match consistently.
 */

export function normalizeForSearch(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `query` is empty or appears within `haystack` after normalization.
 * An empty/whitespace query matches everything (so it can gate a filter).
 */
export function matchesQuery(haystack: unknown, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return normalizeForSearch(haystack).includes(q);
}

/**
 * True when the query matches any of the provided fields. Empty query matches.
 */
export function matchesAnyField(fields: unknown[], query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return fields.some((f) => normalizeForSearch(f).includes(q));
}
