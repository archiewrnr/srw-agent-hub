import 'dotenv/config';
import { KEEPA_DOMAIN_ID } from './seeds.js';

const KEEPA_BASE = 'https://api.keepa.com';
const KEEPA_EPOCH_OFFSET_MIN = 21564000; // minutes between Unix epoch and 2011-01-01T00:00:00Z

let lastTokenStatus = { tokensLeft: null, refillIn: null, refillRate: null };

export function hasKeepaKey() {
  return Boolean(process.env.KEEPA_API_KEY);
}

export function getTokenStatus() {
  return { ...lastTokenStatus };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function dateToKeepaMinutes(date) {
  return Math.floor(date.getTime() / 60000) - KEEPA_EPOCH_OFFSET_MIN;
}

function numOrNull(v) {
  return v === undefined || v === null || v === -1 ? null : v;
}

function priceOrNull(v) {
  const n = numOrNull(v);
  return n === null ? null : n / 100;
}

// Find the last value in a Keepa [time, value, time, value, ...] series
// at or before the given keepa-time (minutes), skipping -1 "no data" entries.
function valueAtOrBefore(csv, targetKeepaMinutes) {
  if (!Array.isArray(csv) || csv.length === 0) return null;
  let result = null;
  for (let i = 0; i < csv.length; i += 2) {
    const t = csv[i];
    const v = csv[i + 1];
    if (t <= targetKeepaMinutes && v !== -1) result = v;
    if (t > targetKeepaMinutes) break;
  }
  return result;
}

async function keepaFetch(path, params) {
  const key = process.env.KEEPA_API_KEY;
  if (!key) return null;
  const url = new URL(`${KEEPA_BASE}${path}`);
  url.searchParams.set('key', key);
  url.searchParams.set('domain', String(KEEPA_DOMAIN_ID));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Keepa ${path} failed: HTTP ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (typeof json.tokensLeft === 'number') {
    lastTokenStatus = { tokensLeft: json.tokensLeft, refillIn: json.refillIn, refillRate: json.refillRate };
  }
  return json;
}

// Throttle if we're close to running out of tokens.
async function throttleIfLow() {
  if (lastTokenStatus.tokensLeft !== null && lastTokenStatus.tokensLeft < 5 && lastTokenStatus.refillIn) {
    const wait = Math.min(lastTokenStatus.refillIn, 60000);
    console.log(`[keepa] low on tokens (${lastTokenStatus.tokensLeft}), waiting ${wait}ms`);
    await sleep(wait);
  }
}

/**
 * Returns the list of ASINs a seller has listed on their Amazon storefront.
 * Returns [] if no Keepa key is configured or the request fails.
 */
export async function getSellerASINs(sellerId) {
  if (!hasKeepaKey()) return [];
  try {
    const json = await keepaFetch('/seller', { seller: sellerId, storefront: 1 });
    const seller = json?.sellers?.[sellerId];
    await throttleIfLow();
    return seller?.asinList ?? [];
  } catch (err) {
    console.error(`[keepa] seller ${sellerId} lookup failed: ${err.message}`);
    return [];
  }
}

/**
 * Fetches product data (price, rating, review count, sales rank + 90-day
 * history) for a batch of ASINs. Returns [] if no Keepa key configured.
 */
export async function getProducts(asins) {
  if (!hasKeepaKey() || asins.length === 0) return [];
  const results = [];
  for (const batch of chunk(asins, 100)) {
    try {
      const json = await keepaFetch('/product', { asin: batch.join(','), stats: 90 });
      for (const p of json?.products ?? []) {
        results.push(parseKeepaProduct(p));
      }
    } catch (err) {
      console.error(`[keepa] product batch failed: ${err.message}`);
    }
    await throttleIfLow();
  }
  return results;
}

function parseKeepaProduct(p) {
  const csv = p.csv || [];
  const current = (p.stats && p.stats.current) || [];
  const reviewCsv = csv[17];

  const currentReviewCount = numOrNull(current[17]);
  const reviewCount30dAgo = valueAtOrBefore(reviewCsv, dateToKeepaMinutes(new Date(Date.now() - 30 * 86400000)));
  const reviewVelocity30d = (currentReviewCount != null && reviewCount30dAgo != null)
    ? Math.max(0, currentReviewCount - reviewCount30dAgo)
    : null;

  const firstImage = (p.imagesCSV || '').split(',')[0];
  const category = (Array.isArray(p.categoryTree) && p.categoryTree.length)
    ? p.categoryTree[p.categoryTree.length - 1].name
    : null;

  return {
    asin: p.asin,
    title: p.title || null,
    brand: p.brand || null,
    category,
    image_url: firstImage ? `https://m.media-amazon.com/images/I/${firstImage}` : null,
    url: `https://www.amazon.co.uk/dp/${p.asin}`,
    current_price: priceOrNull(current[1] ?? current[0]),
    current_rating: numOrNull(current[16]) != null ? current[16] / 10 : null,
    current_review_count: currentReviewCount,
    current_bsr: numOrNull(current[3]),
    review_velocity_30d: reviewVelocity30d,
  };
}

export const KEEPA_DOMAIN = KEEPA_DOMAIN_ID;
