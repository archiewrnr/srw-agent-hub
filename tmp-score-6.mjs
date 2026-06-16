import * as db from './src/db.js';
import * as scraper from './src/scraper.js';
import { scoreOpportunity, buildRationale, accessibleListingsWithSales, filterByFormat } from './src/scoring.js';

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

// Round 8: Metabolic Health cluster (building on Berberine Gummies find), adaptogen "Day" cluster,
// liver/hormone support, and one more format-gap test
const KEYWORDS = [
  'chromium picolinate capsules',
  'gymnema sylvestre capsules',
  'ceylon cinnamon capsules',
  'white mulberry leaf extract capsules',
  'apple cider vinegar capsules',
  'holy basil tulsi capsules',
  'schisandra berry capsules',
  'nac n-acetyl cysteine capsules',
  'dim diindolylmethane capsules',
  'sea moss gummies',
];

for (const keyword of KEYWORDS) {
  try {
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

    const accessibleListingsData = accessibleListingsWithSales(top10);
    const rationale = buildRationale({ keyword, bestProduct, matchedCount: matchedProducts.length, competition });

    console.log(`\n=== ${keyword} ===`);
    console.log(`opportunity=${opportunityScore} demand=${demandScore} competition=${competitionScore} totalResults=${totalResults} top10AvgRating=${competition.top10AvgRating} top10AvgReviews=${competition.top10AvgReviews}`);
    console.log(`accessible (low review + 50+/mo badge): ${accessibleListingsData.length}`);
    accessibleListingsData.slice(0, 3).forEach((a) => {
      console.log(`  - ${a.asin} "${a.title?.slice(0, 60)}" reviews=${a.review_count} rating=${a.rating} bought=${a.bought_past_month}`);
    });
    console.log(`rationale: ${rationale}`);

    await new Promise((r) => setTimeout(r, 4000 + Math.random() * 4000));
  } catch (err) {
    console.log(`\n=== ${keyword} === ERROR: ${err.message}`);
  }
}

await scraper.closeBrowser();
