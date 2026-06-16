// Each brand's own already-launched products. These are excluded from the
// opportunity tracker (no point recommending a launch for something already
// on sale) and shown in their own "Already Launched" dashboard section.

export const MY_PRODUCTS_BY_CATEGORY = {
  earth_essence: [
    {
      asin: 'B0FHRXTM2N',
      label: 'Soursop Liquid Extract',
      url: 'https://www.amazon.co.uk/dp/B0FHRXTM2N',
      excludeTerms: ['soursop'],
    },
    {
      asin: 'B0GS2JYBJ7',
      label: 'Lymphatic Drainage Support Drops',
      url: 'https://www.amazon.co.uk/dp/B0GS2JYBJ7',
      // "lymph..." covers competitor brand names too (e.g. "Lymphoria Wellness
      // Drops"), but only when the format matches ours (drops/liquid). A
      // capsule/tablet/softgel version of a lymph product is a different
      // format and still a valid opportunity.
      excludeTerms: ['lymph'],
      excludeExceptIf: ['capsule', 'tablet', 'softgel', 'pill', 'gummi'],
    },
    {
      asin: 'B0H1XPBS3X',
      label: 'Moonbites Sleep Gummies',
      url: 'https://www.amazon.co.uk/dp/B0H1XPBS3X',
      excludeTerms: ['moonbites', 'sleep gummies', 'sleep gummy'],
    },
  ],
  pure_pleasure: [
    {
      asin: 'B0FS4FK4KP',
      label: 'PurePleasure Wand Vibrator',
      url: 'https://www.amazon.co.uk/dp/B0FS4FK4KP',
      excludeTerms: ['wand vibrator', 'wand massager', 'handheld massager'],
    },
    {
      asin: 'B0FM4LVJ5W',
      label: 'PurePleasure Thrusting Rabbit Vibrator',
      url: 'https://www.amazon.co.uk/dp/B0FM4LVJ5W',
      excludeTerms: ['rabbit vibrator', 'thrusting vibrator', 'thrusting dildo'],
    },
  ],
};

/** True if a niche keyword overlaps with one of this category's own already-launched products. */
export function isOwnProductNiche(keyword, categoryKey) {
  const lower = keyword.toLowerCase();
  const products = MY_PRODUCTS_BY_CATEGORY[categoryKey] || [];
  return products.some((p) => {
    const matches = p.excludeTerms.some((term) => lower.includes(term));
    if (!matches) return false;
    if (p.excludeExceptIf && p.excludeExceptIf.some((term) => lower.includes(term))) {
      return false;
    }
    return true;
  });
}
