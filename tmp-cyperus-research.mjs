import * as scraper from './src/scraper.js';
import { filterByFormat, accessibleListingsWithSales } from './src/scoring.js';

const SEARCHES = [
  'cyperus rotundus oil',
  'nagarmotha oil',
  'cyperus rotundus essential oil',
];

for (const keyword of SEARCHES) {
  try {
    const { tiles: rawTiles, totalResults } = await scraper.scrapeSearch(keyword);
    const tiles = filterByFormat(rawTiles, keyword);
    console.log(`\n=== "${keyword}" === totalResults=${totalResults} tiles=${tiles.length}`);
    tiles.slice(0, 10).forEach((t) => {
      console.log(`  - ${t.asin} "${t.title?.slice(0, 80)}" price=${t.price} reviews=${t.review_count} rating=${t.rating} bought=${t.bought_past_month}`);
    });
    const accessible = accessibleListingsWithSales(tiles);
    console.log(`  accessible (low review + 50+/mo badge): ${accessible.length}`);

    await new Promise((r) => setTimeout(r, 4000 + Math.random() * 4000));
  } catch (err) {
    console.log(`\n=== "${keyword}" === ERROR: ${err.message}`);
  }
}

await scraper.closeBrowser();
