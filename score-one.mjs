import * as db from './src/db.js';
import * as scraper from './src/scraper.js';
import { scoreOpportunity, buildRationale, explainOpportunity, accessibleListingsWithSales, filterByFormat } from './src/scoring.js';

function average(nums) {
  const valid = nums.filter((n) => n != null && !Number.isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function primaryTerm(keyword) {
  const GENERIC_WORDS = new Set([
    'drops', 'extract', 'liquid', 'tincture', 'capsules', 'tablets', 'gummies',
    'oil', 'powder', 'root', 'leaf', 'high', 'strength', 'mg', 'supplement', 'support',
  ]);
  const words = keyword.split(' ').filter((w) => !GENERIC_WORDS.has(w));
  return (words.join(' ') || keyword.split(' ')[0]).trim();
}

const keyword = process.argv[2];

const term = primaryTerm(keyword);
const matchedProducts = term ? db.searchProductsByKeyword(term) : [];

const { tiles: rawTiles, totalResults } = await scraper.scrapeSearch(keyword);
const tiles = filterByFormat(rawTiles, keyword);
const top10 = tiles.slice(0, 10);
const competition = {
  tiles,
  totalResults,
  top10AvgReviews: average(top10.map((t) => t.review_count)),
  top10AvgRating: average(top10.map((t) => t.rating)),
};

const { demandScore, competitionScore, opportunityScore, bestProduct } = scoreOpportunity({
  matchedProducts,
  competition,
});

const rationale = buildRationale({ keyword, bestProduct, matchedCount: matchedProducts.length, competition });
const whyExplanation = explainOpportunity({ keyword, demandScore, competitionScore, opportunityScore, competition, bestProduct });

const representativeAsins = [
  ...(bestProduct?.asin ? [bestProduct.asin] : []),
  ...top10.slice(0, 3).map((t) => t.asin),
].filter((v, i, arr) => v && arr.indexOf(v) === i);

const accessibleListingsData = accessibleListingsWithSales(top10).map((t) => ({
  asin: t.asin,
  title: t.title,
  url: t.url,
  review_count: t.review_count,
  rating: t.rating,
  bought_past_month: t.bought_past_month ?? null,
}));

db.upsertOpportunity({
  niche_keyword: keyword,
  demand_score: demandScore,
  competition_score: competitionScore,
  opportunity_score: opportunityScore,
  rationale,
  why_explanation: whyExplanation,
  representative_asins: representativeAsins,
  product_count: matchedProducts.length,
  avg_competitor_reviews: competition.top10AvgReviews,
  avg_competitor_rating: competition.top10AvgRating,
  total_results: totalResults,
  accessible_listings: accessibleListingsData,
});

console.log(`Upserted "${keyword}": demand=${demandScore} competition=${competitionScore} opportunity=${opportunityScore} total_results=${totalResults} accessible=${accessibleListingsData.length}`);

await scraper.closeBrowser();
