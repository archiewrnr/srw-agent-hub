import * as scraper from './src/scraper.js';
import * as db from './src/db.js';
import { MY_PRODUCTS_BY_CATEGORY } from './src/myProducts.js';

for (const [categoryKey, products] of Object.entries(MY_PRODUCTS_BY_CATEGORY)) {
  for (const p of products) {
    console.log(`Scraping ${p.asin} (${categoryKey})...`);
    const data = await scraper.scrapeProduct(p.asin);
    if (data) {
      db.upsertMyProduct({
        asin: p.asin,
        label: p.label,
        url: p.url,
        title: data.title,
        image_url: data.image_url,
        current_price: scraper.parsePrice(data.price),
        current_rating: data.rating,
        current_review_count: data.review_count,
        category_key: categoryKey,
      });
      console.log(`  -> ${data.title} | £${scraper.parsePrice(data.price)} | ${data.rating}★ | ${data.review_count} reviews`);
    } else {
      console.log(`  -> failed`);
    }
    await scraper.randomDelay(3000, 6000);
  }
}

await scraper.closeBrowser();
process.exit(0);
