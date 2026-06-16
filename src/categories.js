// Registry of the brands/categories this dashboard tracks. Each category has
// its own seed sellers, seed keywords, "already launched" products, and a
// dashboard color theme - but shares the same scanning/scoring engine and
// underlying tables (rows are tagged with category_key).

export const CATEGORIES = {
  earth_essence: {
    key: 'earth_essence',
    label: 'Earth & Essence',
    icon: '🌿',
    tagline: 'Private Label Opportunity Finder',
    theme: 'green',
  },
  pure_pleasure: {
    key: 'pure_pleasure',
    label: 'Pure Pleasure',
    icon: '💗',
    tagline: 'Private Label Opportunity Finder',
    theme: 'pink',
  },
};

export const DEFAULT_CATEGORY = 'earth_essence';

export function isValidCategory(key) {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, key);
}

/** Resolves a query/body value to a known category key, falling back to the default. */
export function resolveCategory(key) {
  return isValidCategory(key) ? key : DEFAULT_CATEGORY;
}
