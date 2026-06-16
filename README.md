# Earth & Essence — Private Label Opportunity Finder

A local web dashboard that continuously sources new Amazon UK product
opportunities for the Earth & Essence brand (currently selling liquid
herbal drops / lymphatic & detox wellness products).

It scans a set of competitor storefronts plus a growing list of
"wellness drops" niche keywords, scores each niche on **demand vs.
competition**, and ranks them so the top of the list is the best
candidate for your next product launch.

## How it works

1. **Storefront scan** — for each tracked seller ID, pulls their full
   product catalogue (via the Keepa API if configured, otherwise a
   local Playwright scrape of `amazon.co.uk/s?me=<sellerId>`).
2. **Keyword discovery** — extracts "ingredient + form" phrases (e.g.
   "ashwagandha drops") from product titles and merges them with a
   curated seed list in [src/seeds.js](src/seeds.js).
3. **Competition snapshot** — for each niche keyword, runs a live
   Amazon search (`amazon.co.uk/s?k=...`) to count results and measure
   the average reviews/rating of the top 10 listings.
4. **Scoring** — combines sales-rank/review-velocity data (demand) with
   the competition snapshot (competition) into an Opportunity Score
   (0–100). See [src/scoring.js](src/scoring.js) for the exact formula.
5. **Loop** — repeats on a schedule (default every 6 hours), or on
   demand via the "Run Scan Now" button. Results, history, and run logs
   are stored in `data/sourcing.db` (SQLite).

## Setup

```bash
npm install
npx playwright install chromium
```

Copy `.env.example` to `.env` (already done) and add your Keepa API key:

```
KEEPA_API_KEY=your_key_here
```

Get a key from [keepa.com](https://keepa.com) → Settings (gear icon) →
**API** tab → subscribe to an API access plan if you haven't already →
copy the **Access Key**.

Without a Keepa key the app still works, falling back to the Playwright
scraper for both storefront and competition data — just with weaker
demand signals (no sales-rank/review history).

## Running

```bash
npm start
```

Open **http://localhost:3000**. The first scan won't run automatically —
click **Run Scan Now** to populate the dashboard (a full cycle takes
roughly 10–15 minutes due to the deliberate delays between page loads,
see below).

To leave it running continuously ("24/7"), leave this terminal open, or
set it up to run at login (e.g. a Windows Scheduled Task running
`npm start` in this folder, or a tool like `pm2`).

## Managing sources

Visit **Settings** (top right) to:
- Add/remove tracked Amazon UK seller storefronts
- Change the scan interval (1–24 hours)
- Check whether Keepa is configured

## Rate limiting & ToS note

Amazon storefront/search pages return `503` to cloud/datacenter
requests, so this tool runs the scraper **locally** using your own
connection. Even so, it deliberately:

- Waits 8–20 seconds (randomized) between page loads
- Runs a full cycle only on the configured interval (default 6h), not
  continuously
- Prefers the Keepa API (licensed Amazon data) over scraping wherever
  possible

This tool is intended for personal market research only.

## Project structure

```
server.js            Express app entry + scheduler bootstrap
src/db.js             SQLite schema & queries (node:sqlite)
src/keepa.js          Keepa API client (storefront ASINs, product data)
src/scraper.js        Playwright fallback scraper
src/scoring.js        Demand vs. competition → opportunity score
src/seeds.js          Tracked seller IDs + niche keyword seed list
src/scanner.js        One full scan cycle
src/scheduler.js      Cron loop + manual trigger + status
routes/api.js         REST API for the dashboard
public/               Dashboard frontend (vanilla HTML/JS)
data/sourcing.db      SQLite database (created on first run)
```
