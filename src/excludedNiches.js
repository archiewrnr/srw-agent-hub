// Whole product types a category will never sell, regardless of score.
// Unlike myProducts.js (which excludes niches that overlap an existing SKU),
// these are excluded because the format itself is out of scope for the brand.

export const EXCLUDED_TERMS_BY_CATEGORY = {
  pure_pleasure: [
    // Pure Pleasure sells toys only — no lubricants, gels, creams, serums,
    // balms, washes or massage oils. Word-boundary terms (\b) avoid false
    // positives like "gel" matching inside "kegel".
    /\blubricant\b/, /\blube\b/, /\bgel\b/, /\bcream\b/, /\bserum\b/, /\bbalm\b/,
    /\bwash\b/, /\bmoisturis/, /\bmassage oil\b/, /\byoni steam\b/, /\bwhitening\b/,
    /\bfreshness spray\b/, /\bdeodorant\b/, /\bscrub\b/,
  ],
};

/** True if a niche keyword matches one of this category's out-of-scope product types. */
export function isExcludedNiche(keyword, categoryKey) {
  const lower = keyword.toLowerCase();
  const patterns = EXCLUDED_TERMS_BY_CATEGORY[categoryKey] || [];
  return patterns.some((pattern) => pattern.test(lower));
}
