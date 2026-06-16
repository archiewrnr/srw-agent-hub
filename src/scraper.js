import { chromium } from 'playwright';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);
    if (existing && existing.isConnected()) {
      return existing;
    }
    browserPromise = null;
  }
  browserPromise = chromium.launch({ headless: true });
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser && browser.isConnected()) {
      await browser.close().catch(() => {});
    }
    browserPromise = null;
  }
}

/** Random delay between page navigations to stay conservative on rate. */
export function randomDelay(min = 8000, max = 20000) {
  const ms = Math.floor(Math.random() * (max - min)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parsePrice(text) {
  if (!text) return null;
  const match = String(text).replace(/,/g, '').match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

async function newPage() {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
    locale: 'en-GB',
  });
  return context.newPage();
}

/**
 * Scrapes an Amazon UK storefront page for a seller's listed products.
 * Returns [] on failure (CAPTCHA, layout change, network error) so the
 * scan loop can continue with other sources.
 */
export async function scrapeStorefront(sellerId) {
  const page = await newPage();
  try {
    const url = `https://www.amazon.co.uk/s?me=${sellerId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page
      .waitForSelector('[data-component-type="s-search-result"]', { timeout: 15000 })
      .catch(() => {});
    return await extractResultTiles(page);
  } catch (err) {
    console.error(`[scraper] storefront ${sellerId} failed: ${err.message}`);
    return [];
  } finally {
    await page.context().close();
  }
}

/**
 * Scrapes an Amazon UK search results page for a keyword. Returns the
 * top result tiles plus an estimated total-result count (competition size).
 */
export async function scrapeSearch(keyword) {
  const page = await newPage();
  try {
    const url = `https://www.amazon.co.uk/s?k=${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page
      .waitForSelector('[data-component-type="s-search-result"]', { timeout: 15000 })
      .catch(() => {});
    const tiles = await extractResultTiles(page);
    const totalResults = await extractTotalResults(page);
    return { tiles, totalResults };
  } catch (err) {
    console.error(`[scraper] search "${keyword}" failed: ${err.message}`);
    return { tiles: [], totalResults: null };
  } finally {
    await page.context().close();
  }
}

async function extractResultTiles(page) {
  return page.$$eval('[data-component-type="s-search-result"]', (nodes) =>
    nodes
      .slice(0, 24)
      .map((el) => {
        const asin = el.getAttribute('data-asin') || null;
        // Scope to the tile's own title block - some tiles embed a
        // "customers also bought" carousel with its own h2/span elements,
        // which a bare "h2 span" selector can match instead (wrong title
        // for this ASIN).
        const titleEl = el.querySelector('[data-cy="title-recipe"] h2 a span, [data-cy="title-recipe"] h2 span, h2 a span, h2 span');
        const title = titleEl ? titleEl.textContent.trim() : null;
        const priceEl = el.querySelector('.a-price .a-offscreen');
        const price = priceEl ? priceEl.textContent.trim() : null;
        const ratingEl = el.querySelector('span.a-icon-alt');
        const ratingText = ratingEl ? ratingEl.textContent.trim() : null;
        const ratingMatch = ratingText ? ratingText.match(/([\d.]+) out of/) : null;
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
        // Prefer the precise "X,XXX ratings" aria-label over the visible
        // badge text, which Amazon often abbreviates ("(3.2K)") - a naive
        // /(\d+)/ match on "(3.2K)" would wrongly read review_count as 3.
        const reviewLabelEl = el.querySelector(
          'a[aria-label$="ratings"], a[aria-label$="rating"], span[aria-label$="ratings"], span[aria-label$="rating"]'
        );
        let reviewCount = null;
        if (reviewLabelEl) {
          const m = reviewLabelEl.getAttribute('aria-label').replace(/,/g, '').match(/(\d+)/);
          reviewCount = m ? parseInt(m[1], 10) : null;
        } else {
          const reviewEl = el.querySelector('a[href*="#customerReviews"] span');
          const reviewText = reviewEl ? reviewEl.textContent.trim() : '';
          const m = reviewText.replace(/,/g, '').match(/([\d.]+)\s*(K|M)?/i);
          if (m) {
            const num = parseFloat(m[1]);
            const mult = m[2] ? (m[2].toUpperCase() === 'M' ? 1e6 : 1e3) : 1;
            reviewCount = Math.round(num * mult);
          }
        }
        const imgEl = el.querySelector('img.s-image');
        const image_url = imgEl ? imgEl.getAttribute('src') : null;
        const linkEl = el.querySelector('h2 a');
        const href = linkEl ? linkEl.getAttribute('href') : null;
        const url = href
          ? new URL(href, 'https://www.amazon.co.uk').toString()
          : asin
          ? `https://www.amazon.co.uk/dp/${asin}`
          : null;

        // "100+ bought in past month" / "1K+ bought in past month" badge -
        // Amazon's own sales-velocity signal, when shown.
        const boughtEl = [...el.querySelectorAll('span')].find((s) =>
          /bought in past month/i.test(s.textContent || '')
        );
        const boughtText = boughtEl ? boughtEl.textContent.trim() : null;
        const boughtMatch = boughtText ? boughtText.match(/([\d.]+)(K)?\+?\s*bought/i) : null;
        const bought_past_month = boughtMatch
          ? Math.round(parseFloat(boughtMatch[1]) * (boughtMatch[2] ? 1000 : 1))
          : null;

        return { asin, title, price, rating, review_count: reviewCount, image_url, url, bought_past_month };
      })
      .filter((p) => p.asin && p.title)
      // Amazon pads sparse result pages by repeating the same listings -
      // without this, a tiny market (e.g. 6 total results) can look like
      // several independent "accessible" listings when it's really 1-2.
      .filter((p, i, arr) => arr.findIndex((q) => q.asin === p.asin) === i)
  );
}

/**
 * Scrapes a single Amazon UK product page for title/image/price/rating/reviews.
 * Returns null on failure so callers can keep previously cached data.
 */
export async function scrapeProduct(asin) {
  const page = await newPage();
  try {
    const url = `https://www.amazon.co.uk/dp/${asin}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#productTitle', { timeout: 15000 }).catch(() => {});
    return await page.evaluate(() => {
      const title = document.querySelector('#productTitle')?.textContent.trim() || null;
      const image_url = document.querySelector('#landingImage, #imgBlkFront')?.getAttribute('src') || null;
      const priceEl = document.querySelector('.a-price .a-offscreen, #corePrice_feature_div .a-offscreen');
      const price = priceEl ? priceEl.textContent.trim() : null;
      const ratingText = document.querySelector('#acrPopover .a-icon-alt, span.a-icon-alt')?.textContent.trim() || '';
      const ratingMatch = ratingText.match(/([\d.]+) out of/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
      const reviewText = document.querySelector('#acrCustomerReviewText')?.textContent.trim() || '';
      const reviewMatch = reviewText.replace(/,/g, '').match(/(\d+)/);
      const review_count = reviewMatch ? parseInt(reviewMatch[1], 10) : null;
      return { title, image_url, price, rating, review_count };
    });
  } catch (err) {
    console.error(`[scraper] product ${asin} failed: ${err.message}`);
    return null;
  } finally {
    await page.context().close();
  }
}

async function extractTotalResults(page) {
  try {
    const text = await page.evaluate(() => document.body.innerText);
    const match = text.match(/of (?:over )?([\d,]+) results/i) || text.match(/([\d,]+) results for/i);
    return match ? parseInt(match[1].replace(/,/g, ''), 10) : null;
  } catch {
    return null;
  }
}
