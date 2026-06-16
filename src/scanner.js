import * as db from './db.js';
import * as keepa from './keepa.js';
import * as scraper from './scraper.js';
import { scoreOpportunity, buildRationale, explainOpportunity, accessibleListingsWithSales, filterByFormat } from './scoring.js';
import { SELLERS_BY_CATEGORY, SEED_KEYWORDS_BY_CATEGORY } from './seeds.js';
import { isOwnProductNiche } from './myProducts.js';
import { resolveCategory } from './categories.js';

const SUFFIXES = [
  'liquid extract',
  'liquid drops',
  'extract drops',
  'drops',
  'extract',
  'tincture',
  'capsules',
  'tablets',
  'gummies',
  'oil',
  'powder',
];

const GENERIC_WORDS = new Set([
  'drops', 'extract', 'liquid', 'tincture', 'capsules', 'tablets', 'gummies',
  'oil', 'powder', 'root', 'leaf', 'high', 'strength', 'mg', 'supplement', 'support',
]);

// Connector/filler words that never belong in an ingredient phrase. If any of
// these appear, or the whole ingredient is made up of GENERIC_WORDS (e.g.
// "support liquid"), the candidate is just title noise, not a real niche.
const STOPWORDS = new Set([
  'with', 'and', 'for', 'the', 'of', 'in', 'a', 'an', 'to', 'your', 'our', 'by', 'from', 'no',
]);

function isLowQualityIngredient(ingredient) {
  const words = ingredient.split(' ');
  if (words.some((w) => STOPWORDS.has(w) || /^\d/.test(w))) return true;
  return words.every((w) => GENERIC_WORDS.has(w));
}

/** Extracts "<ingredient> <form>" style candidate niche keywords from a product title. */
function extractCandidateKeywords(title) {
  if (!title) return [];
  const words = title.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
  const candidates = new Set();
  for (let i = 0; i < words.length; i++) {
    for (const suffix of SUFFIXES) {
      const suffixWords = suffix.split(' ');
      if (i + suffixWords.length > words.length) continue;
      const slice = words.slice(i, i + suffixWords.length).join(' ');
      if (slice === suffix && i > 0) {
        const ingredient = words.slice(Math.max(0, i - 2), i).join(' ');
        if (ingredient.length > 2 && !isLowQualityIngredient(ingredient)) {
          candidates.add(`${ingredient} ${suffix}`);
        }
      }
    }
  }
  return [...candidates];
}

/** Strips generic form words to get the core "ingredient" term for DB matching. */
function primaryTerm(keyword) {
  const words = keyword.split(' ').filter((w) => !GENERIC_WORDS.has(w));
  return (words.join(' ') || keyword.split(' ')[0]).trim();
}

function average(nums) {
  const valid = nums.filter((n) => n != null && !Number.isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

async function scanSellers(categoryKey) {
  let sellersScanned = 0;
  let productsFound = 0;
  const discoveredKeywords = new Map(); // keyword -> frequency
  const sellers = SELLERS_BY_CATEGORY[categoryKey] || [];

  for (const seller of sellers) {
    db.upsertSeller(seller.seller_id, seller.label, categoryKey);

    let products = [];
    if (keepa.hasKeepaKey()) {
      const asins = await keepa.getSellerASINs(seller.seller_id);
      if (asins.length > 0) {
        const enriched = await keepa.getProducts(asins);
        products = enriched.map((p) => ({ ...p, source_seller_id: seller.seller_id }));
      }
    }

    if (products.length === 0) {
      const tiles = await scraper.scrapeStorefront(seller.seller_id);
      products = tiles.map((t) => ({
        asin: t.asin,
        title: t.title,
        brand: null,
        category: null,
        image_url: t.image_url,
        url: t.url,
        source_seller_id: seller.seller_id,
        current_price: scraper.parsePrice(t.price),
        current_rating: t.rating,
        current_review_count: t.review_count,
        current_bsr: null,
        review_velocity_30d: null,
      }));
      await scraper.randomDelay();
    }

    for (const p of products) {
      if (!p.asin || !p.title) continue;
      db.upsertProduct({ ...p, category_key: categoryKey });
      db.addSnapshot(p.asin, {
        price: p.current_price,
        rating: p.current_rating,
        review_count: p.current_review_count,
        bsr: p.current_bsr,
      });
      productsFound++;

      for (const kw of extractCandidateKeywords(p.title)) {
        discoveredKeywords.set(kw, (discoveredKeywords.get(kw) || 0) + 1);
      }
    }

    db.touchSeller(seller.seller_id);
    sellersScanned++;
  }

  return { sellersScanned, productsFound, discoveredKeywords };
}

function buildKeywordList(discoveredKeywords, categoryKey, maxTotal = 500) {
  const seedKeywords = SEED_KEYWORDS_BY_CATEGORY[categoryKey] || [];
  const seedSet = new Set(seedKeywords);
  const discoveredSorted = [...discoveredKeywords.entries()]
    .filter(([kw]) => !seedSet.has(kw))
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw);

  const combined = [...seedKeywords, ...discoveredSorted].filter((kw) => !isOwnProductNiche(kw, categoryKey));

  // Re-score already-tracked niches first (stalest-updated first) so existing
  // opportunities reflect the latest scoring fixes ASAP, before spending time
  // scoring brand-new candidates that have never been scored.
  const combinedSet = new Set(combined);
  const staleOrdered = db.getOpportunityKeywords(categoryKey).filter((kw) => combinedSet.has(kw));
  const staleSet = new Set(staleOrdered);
  const fresh = combined.filter((kw) => !staleSet.has(kw));

  return [...staleOrdered, ...fresh].slice(0, maxTotal);
}

export async function scoreKeywords(keywords, categoryKey) {
  let opportunitiesUpdated = 0;

  for (const keyword of keywords) {
    const term = primaryTerm(keyword);
    const matchedProducts = term ? db.searchProductsByKeyword(term, categoryKey) : [];

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

    // Low-review listings from the top 10 - candidates worth a closer look,
    // each carrying its own asin/title/url so the dashboard doesn't need to
    // cross-reference the tracked-products table (which can go stale/mismatched).
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
      category_key: categoryKey,
    });

    opportunitiesUpdated++;
    await scraper.randomDelay();
  }

  return opportunitiesUpdated;
}

/**
 * Runs one full scan cycle: pulls storefront catalogues, extracts candidate
 * niche keywords, scores each on demand vs. competition, and persists
 * results. Designed to never throw past this boundary so the scheduler
 * loop survives bad pages / API errors.
 */
export async function runScanCycle(categoryKey) {
  categoryKey = resolveCategory(categoryKey);
  const runId = db.createScanRun(categoryKey);
  console.log(`[scanner] [${categoryKey}] scan run #${runId} started`);

  try {
    const { sellersScanned, productsFound, discoveredKeywords } = await scanSellers(categoryKey);
    const keywords = buildKeywordList(discoveredKeywords, categoryKey);
    const opportunitiesUpdated = await scoreKeywords(keywords, categoryKey);

    db.finishScanRun(runId, {
      status: 'completed',
      sellers_scanned: sellersScanned,
      products_found: productsFound,
      new_opportunities: opportunitiesUpdated,
      notes: `Scored ${keywords.length} niche keywords (${discoveredKeywords.size} discovered dynamically).`,
    });

    console.log(`[scanner] [${categoryKey}] scan run #${runId} completed: ${sellersScanned} sellers, ${productsFound} products, ${opportunitiesUpdated} opportunities`);
    return { runId, sellersScanned, productsFound, opportunitiesUpdated };
  } catch (err) {
    console.error(`[scanner] scan run #${runId} failed:`, err);
    db.finishScanRun(runId, {
      status: 'failed',
      sellers_scanned: 0,
      products_found: 0,
      new_opportunities: 0,
      notes: String(err?.message || err),
    });
    throw err;
  } finally {
    await scraper.closeBrowser();
  }
}
