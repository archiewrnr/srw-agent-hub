function clamp(min, max, v) {
  if (v == null || Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// Listings with fewer reviews than this are "catchable" - a new seller can
// realistically match that review count within a few months.
const LOW_REVIEW_THRESHOLD = 100;

// Amazon's "bought in past month" badge starts at 50+. Anything below this
// (or no badge at all) is not real evidence of ongoing sales.
const MIN_SALES_BADGE = 50;

// Each product format a private-label seller would source/manufacture
// differently. Singular and plural forms both matter - titles often say
// "per Capsule" or "1 Tablet" rather than the plural seed-keyword form.
const FORMAT_GROUPS = {
  liquid: ['drops?', 'liquids?', 'tinctures?'],
  gummies: ['gumm(?:y|ies)'],
  capsules: ['capsules?', 'caps?', 'softgels?'],
  tablets: ['tablets?', 'tabs?', 'pills?'],
  powder: ['powders?'],
};

function detectFormat(text) {
  const lower = (text || '').toLowerCase();
  const matches = Object.entries(FORMAT_GROUPS).filter(([, words]) =>
    words.some((w) => new RegExp(`\\b${w}\\b`).test(lower))
  );
  // Exactly one recognised format -> use it. Zero or multiple (e.g. a title
  // mentioning both "capsules" and "tablets") is ambiguous - don't filter on it.
  return matches.length === 1 ? matches[0][0] : null;
}

// Amazon's search returns broadly-related results regardless of product
// form - e.g. a search for "milk thistle gummies" can surface "Milk Thistle
// ... per Capsule" bestsellers in the top 10. That capsule's sales say
// nothing about demand for a gummy product - different format, different
// manufacturing/sourcing, different market. Drop listings whose form clearly
// conflicts with the keyword's form before they pollute demand/competition
// stats.
export function filterByFormat(tiles, keyword) {
  const keywordFormat = detectFormat(keyword);
  if (!keywordFormat) return tiles || [];
  return (tiles || []).filter((t) => {
    const tileFormat = detectFormat(t.title);
    return !tileFormat || tileFormat === keywordFormat;
  });
}

// Lower BSR (Best Sellers Rank) = higher demand. Log scale across categories
// that can range from a handful of products to several million.
function bsrToDemandScore(bsr) {
  if (!bsr || bsr <= 0) return 0;
  return clamp(0, 100, 100 - (Math.log10(bsr) / 7) * 100);
}

// New reviews gained in the last 30 days, as a demand-velocity bonus.
function velocityBonus(velocity) {
  if (!velocity) return 0;
  return clamp(0, 20, velocity / 2);
}

// Number of competing listings returned for the niche keyword search.
// A high total-listing count overstates how "crowded" a niche really is if
// most of those listings are individually weak/catchable (<100 reviews) -
// 124 minnows are less of a barrier to a new listing than 41 listings that
// include a few entrenched bestsellers. accessibleRatio (0-1, share of the
// top 10 that are catchable) discounts the raw count accordingly.
function competitionFromResultCount(totalResults, accessibleRatio = 0) {
  if (totalResults == null) return 50; // unknown -> assume moderate
  const raw = clamp(0, 100, (Math.log10(totalResults + 1) / Math.log10(201)) * 100);
  return raw * (1 - accessibleRatio * 0.5);
}

// How entrenched the top results are, based on average review count.
function reviewCompetitionComponent(avgReviews) {
  if (avgReviews == null) return 30; // unknown -> assume moderate
  return clamp(0, 100, (Math.log10(avgReviews + 1) / Math.log10(1001)) * 100);
}

// Weak/low-quality incumbents are easier to out-compete with a better listing.
export function weakIncumbentBonus(avgRating, avgReviews) {
  let bonus = 0;
  if (avgRating != null && avgRating < 4.0) bonus += 10;
  if (avgRating != null && avgRating < 3.5) bonus += 10;
  if (avgReviews != null && avgReviews < 50) bonus += 5;
  return clamp(0, 25, bonus);
}

/** Returns the tiles that have a "catchable" (low) review count. */
export function accessibleListings(tiles, threshold = LOW_REVIEW_THRESHOLD) {
  return (tiles || []).filter((t) => t.review_count != null && t.review_count < threshold);
}

/** Counts how many of the given tiles have a "catchable" (low) review count. */
export function accessibleListingsCount(tiles, threshold = LOW_REVIEW_THRESHOLD) {
  return accessibleListings(tiles, threshold).length;
}

// The only listings worth citing as launch comps: low review count (catchable)
// AND a verified "50+ bought in past month" badge (real, ongoing sales - not a guess).
export function accessibleListingsWithSales(tiles, reviewThreshold = LOW_REVIEW_THRESHOLD, salesThreshold = MIN_SALES_BADGE) {
  return accessibleListings(tiles, reviewThreshold).filter(
    (t) => t.bought_past_month != null && t.bought_past_month >= salesThreshold
  );
}

// When no Keepa sales-rank data is available, "high demand" requires real proof:
// at least one low-review (<100), not-yet-entrenched listing showing Amazon's
// own "50+ bought in past month" badge. Without that, a niche full of
// low-review listings could just mean nobody is buying from anyone -
// "easy to rank" isn't the same as "people are buying here".
function fallbackDemandFromTiles(tiles) {
  if (!tiles || tiles.length === 0) return 0;

  const withSales = accessibleListingsWithSales(tiles);
  if (withSales.length === 0) {
    // No catchable (<100-review) listing has a verified 50+/month badge -
    // a low review count alone is not evidence anyone is buying, so it
    // doesn't count toward demand at all.
    return 0;
  }

  const maxBought = Math.max(...withSales.map((t) => t.bought_past_month));
  // Scaled to Amazon's actual badge ceiling ("10K+ bought in past month"),
  // not 1000/mo - a listing doing 1000/mo is strong but shouldn't score the
  // same as one doing 10x that. 50/mo -> ~43, 200/mo -> ~58, 1000/mo -> ~75,
  // 5000/mo -> ~92, 10000+/mo -> 100. This IS the demand score - sales volume
  // is the signal that matters most, so it isn't diluted by other factors.
  const salesScore = clamp(0, 100, (Math.log10(maxBought + 1) / Math.log10(10001)) * 100);
  // Extra qualifying listings are only a minor tiebreaker between otherwise
  // similar sales volumes, never enough to substitute for actual sales.
  const countBonus = clamp(0, 5, withSales.length - 1);
  return clamp(0, 100, salesScore + countBonus);
}

/**
 * Scores a niche/keyword opportunity.
 *
 * @param {object} input
 * @param {Array}  input.matchedProducts - products from tracked storefronts whose
 *                 title matches the niche keyword (Keepa-enriched if available)
 * @param {object} input.competition - { tiles, totalResults, top10AvgReviews, top10AvgRating }
 */
export function scoreOpportunity({ matchedProducts = [], competition = {} }) {
  const withBsr = matchedProducts.filter((p) => p.current_bsr != null && p.current_bsr > 0);
  const bestProduct = withBsr.sort((a, b) => a.current_bsr - b.current_bsr)[0] || matchedProducts[0] || null;
  const maxVelocity = Math.max(0, ...matchedProducts.map((p) => p.review_velocity_30d ?? 0), 0);

  let demandScore;
  if (bestProduct?.current_bsr != null) {
    demandScore = clamp(0, 100, bsrToDemandScore(bestProduct.current_bsr) * 0.8 + velocityBonus(maxVelocity));
  } else {
    demandScore = fallbackDemandFromTiles(competition.tiles);
  }

  const top10 = (competition.tiles || []).slice(0, 10);
  const accessibleRatio = top10.length ? accessibleListingsCount(top10) / top10.length : 0;

  const resultsComponent = competitionFromResultCount(competition.totalResults, accessibleRatio);
  const reviewComponent = reviewCompetitionComponent(competition.top10AvgReviews);
  const competitionScore = clamp(0, 100, resultsComponent * 0.5 + reviewComponent * 0.5);

  const bonus = weakIncumbentBonus(competition.top10AvgRating, competition.top10AvgReviews);

  // Demand (driven by verified sales volume) is the dominant factor - a niche
  // with much higher proven sales should outrank one with merely weaker
  // competition. Competition and incumbent-weakness are secondary nudges
  // that can't override a large gap in actual sales evidence.
  const opportunityScore = clamp(0, 100, demandScore * 0.8 + (100 - competitionScore) * 0.15 + bonus * 0.3);

  return {
    demandScore: round1(demandScore),
    competitionScore: round1(competitionScore),
    opportunityScore: round1(opportunityScore),
    bestProduct,
  };
}

/** Builds a human-readable rationale string for the dashboard. */
export function buildRationale({ keyword, bestProduct, matchedCount, competition }) {
  const parts = [];

  if (bestProduct) {
    const bsrPart = bestProduct.current_bsr ? `ranks #${bestProduct.current_bsr.toLocaleString()} in "${bestProduct.category ?? 'its category'}"` : `listed in "${bestProduct.category ?? 'its category'}"`;
    const reviewPart = bestProduct.current_review_count != null ? `${bestProduct.current_review_count} reviews` : 'review data pending';
    const ratingPart = bestProduct.current_rating != null ? `${bestProduct.current_rating}★` : 'no rating yet';
    const velocityPart = bestProduct.review_velocity_30d ? ` (+${bestProduct.review_velocity_30d} reviews/30d)` : '';
    parts.push(`Top related listing ${bsrPart} with ${reviewPart} at ${ratingPart}${velocityPart}.`);
  }

  if (matchedCount) {
    parts.push(`${matchedCount} related product(s) found across tracked storefronts.`);
  }

  if (competition?.totalResults != null) {
    const ratingInfo = competition.top10AvgRating != null
      ? `, top listings averaging ${competition.top10AvgReviews ?? '?'} reviews at ${competition.top10AvgRating.toFixed(1)}★`
      : '';
    parts.push(`Amazon UK search for "${keyword}" returns ~${competition.totalResults.toLocaleString()} results${ratingInfo}.`);
  } else {
    parts.push(`Live competition count unavailable for "${keyword}".`);
  }

  return parts.join(' ');
}

/**
 * Builds a plain-language explanation of *why* an opportunity scored the way
 * it did - the specific evidence behind the demand/competition/opportunity
 * numbers, plus a verdict on whether it's worth pursuing.
 */
export function explainOpportunity({ keyword, demandScore, competitionScore, opportunityScore, competition = {}, bestProduct }) {
  const { tiles = [], totalResults, top10AvgReviews, top10AvgRating } = competition;
  const top10 = tiles.slice(0, 10);
  const accessible = accessibleListingsCount(top10);
  const parts = [];

  if (bestProduct?.current_bsr != null) {
    parts.push(
      `A tracked competitor product ranks #${bestProduct.current_bsr.toLocaleString()} in "${bestProduct.category ?? 'its category'}" (Keepa sales-rank data) - demand score ${demandScore}/100 is based on that real sales-rank signal.`
    );
  } else if (top10.length === 0) {
    parts.push(
      `No live search results came back for "${keyword}", so the demand score (${demandScore}/100) defaults low - there's no evidence of an active market for this exact phrase.`
    );
  } else if (accessible === 0) {
    parts.push(
      `All ${top10.length} of the top listings for "${keyword}" already have ${LOW_REVIEW_THRESHOLD}+ reviews (averaging ${Math.round(top10AvgReviews ?? 0)} reviews at ${(top10AvgRating ?? 0).toFixed(1)}★). The category is dominated by entrenched listings, so demand score is low (${demandScore}/100) even though ~${(totalResults ?? top10.length).toLocaleString()} results exist - that volume reflects established sellers, not room for a newcomer.`
    );
  } else if (accessible / top10.length >= 0.5) {
    parts.push(
      `${accessible} of the top ${top10.length} listings for "${keyword}" have fewer than ${LOW_REVIEW_THRESHOLD} reviews (top-10 average: ${Math.round(top10AvgReviews ?? 0)} reviews at ${(top10AvgRating ?? 0).toFixed(1)}★), out of ~${(totalResults ?? top10.length).toLocaleString()} total listings. Most of the page is sellers without a big review moat - a sign of ongoing sales without one entrenched winner. Demand score: ${demandScore}/100.`
    );
  } else {
    const entrenched = top10.length - accessible;
    parts.push(
      `Only ${accessible} of the top ${top10.length} listings for "${keyword}" have fewer than ${LOW_REVIEW_THRESHOLD} reviews - the other ${entrenched} are entrenched (top-10 average: ${Math.round(top10AvgReviews ?? 0)} reviews at ${(top10AvgRating ?? 0).toFixed(1)}★), out of ~${(totalResults ?? top10.length).toLocaleString()} total listings. A few accessible listings exist, but the page is mostly dominated by established sellers, so demand score is modest (${demandScore}/100).`
    );
  }

  // Amazon's own "bought in past month" badge, when shown on a low-review
  // listing, is the only real evidence of ongoing sales we accept. The badge
  // starts at 50+, so anything below that (or no badge) doesn't count.
  const accessibleWithSales = accessibleListingsWithSales(top10);
  if (accessibleWithSales.length > 0) {
    const best = accessibleWithSales.reduce((a, b) => (b.bought_past_month > a.bought_past_month ? b : a));
    const others = accessibleWithSales.length - 1;
    const othersPart = others > 0 ? ` (plus ${others} more low-review listing${others > 1 ? 's' : ''} with a 50+/month badge)` : '';
    parts.push(
      `"${best.title?.slice(0, 60) ?? best.asin}" shows Amazon's "${best.bought_past_month}+ bought in past month" badge with only ${best.review_count} reviews${othersPart} - real, current evidence of an accessible slot with ongoing demand.`
    );
  } else {
    parts.push(
      `No accessible (<${LOW_REVIEW_THRESHOLD}-review) listing shows a verified "50+ bought in past month" badge, so the demand score is capped at ${demandScore}/100 regardless of how many low-review listings exist - without that badge there's no proof anyone is actually buying.`
    );
  }

  const discountNote = accessible > 0
    ? ` (${accessible}/${top10.length} top listings are low-review/catchable, which discounts how much the raw listing count counts against this niche)`
    : '';

  if (competitionScore >= 75) {
    parts.push(`Competition score is high (${competitionScore}/100)${discountNote} - a large total result count and/or high average reviews make this a crowded space.`);
  } else if (competitionScore <= 50) {
    parts.push(`Competition score is moderate-to-low (${competitionScore}/100)${discountNote} - relatively few listings and/or modest review counts.`);
  } else {
    parts.push(`Competition score is moderate (${competitionScore}/100)${discountNote}.`);
  }

  let verdict;
  if (opportunityScore >= 60) verdict = 'Strong candidate - demand signal clearly outweighs competition.';
  else if (opportunityScore >= 45) verdict = "Worth a closer manual look - the balance leans favorable but isn't decisive.";
  else verdict = 'Likely not worth pursuing on this data alone - competition outweighs the demand signal.';
  parts.push(`Net opportunity score: ${opportunityScore}/100. ${verdict}`);

  return parts.join(' ');
}
