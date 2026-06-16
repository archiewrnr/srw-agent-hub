import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'sourcing.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS sellers (
    seller_id TEXT PRIMARY KEY,
    label TEXT,
    last_scanned_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS products (
    asin TEXT PRIMARY KEY,
    title TEXT,
    brand TEXT,
    category TEXT,
    image_url TEXT,
    url TEXT,
    source_seller_id TEXT,
    first_seen_at INTEGER,
    last_seen_at INTEGER,
    current_price REAL,
    current_rating REAL,
    current_review_count INTEGER,
    current_bsr INTEGER
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asin TEXT,
    captured_at INTEGER,
    price REAL,
    rating REAL,
    review_count INTEGER,
    bsr INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_snapshots_asin ON snapshots(asin);

  CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    niche_keyword TEXT UNIQUE,
    demand_score REAL,
    competition_score REAL,
    opportunity_score REAL,
    rationale TEXT,
    representative_asins TEXT,
    product_count INTEGER,
    avg_competitor_reviews REAL,
    avg_competitor_rating REAL,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS scan_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER,
    finished_at INTEGER,
    status TEXT,
    sellers_scanned INTEGER,
    products_found INTEGER,
    new_opportunities INTEGER,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS my_products (
    asin TEXT PRIMARY KEY,
    label TEXT,
    url TEXT,
    title TEXT,
    image_url TEXT,
    current_price REAL,
    current_rating REAL,
    current_review_count INTEGER,
    last_scraped_at INTEGER
  );
`);

// Migrations: add columns if upgrading from an earlier schema version.
for (const ddl of [
  `ALTER TABLE opportunities ADD COLUMN why_explanation TEXT`,
  `ALTER TABLE opportunities ADD COLUMN total_results INTEGER`,
  `ALTER TABLE opportunities ADD COLUMN accessible_listings TEXT`,
  // Multi-brand support: every row is tagged with the category/brand it
  // belongs to. Existing rows default to 'earth_essence' (the original brand).
  `ALTER TABLE opportunities ADD COLUMN category_key TEXT NOT NULL DEFAULT 'earth_essence'`,
  `ALTER TABLE sellers ADD COLUMN category_key TEXT NOT NULL DEFAULT 'earth_essence'`,
  `ALTER TABLE products ADD COLUMN category_key TEXT NOT NULL DEFAULT 'earth_essence'`,
  `ALTER TABLE my_products ADD COLUMN category_key TEXT NOT NULL DEFAULT 'earth_essence'`,
  `ALTER TABLE scan_runs ADD COLUMN category_key TEXT NOT NULL DEFAULT 'earth_essence'`,
]) {
  try {
    db.exec(ddl);
  } catch {
    // column already exists
  }
}

// ---------- sellers ----------
export function upsertSeller(sellerId, label, categoryKey = 'earth_essence') {
  db.prepare(`
    INSERT INTO sellers (seller_id, label, last_scanned_at, category_key)
    VALUES (?, ?, NULL, ?)
    ON CONFLICT(seller_id) DO UPDATE SET label = excluded.label, category_key = excluded.category_key
  `).run(sellerId, label ?? null, categoryKey);
}

export function touchSeller(sellerId, timestamp = Date.now()) {
  db.prepare(`UPDATE sellers SET last_scanned_at = ? WHERE seller_id = ?`).run(timestamp, sellerId);
}

export function getSellers(categoryKey) {
  if (categoryKey) {
    return db.prepare(`SELECT * FROM sellers WHERE category_key = ? ORDER BY seller_id`).all(categoryKey);
  }
  return db.prepare(`SELECT * FROM sellers ORDER BY seller_id`).all();
}

export function removeSeller(sellerId) {
  db.prepare(`DELETE FROM sellers WHERE seller_id = ?`).run(sellerId);
}

// ---------- products ----------
export function upsertProduct(p) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO products (
      asin, title, brand, category, image_url, url, source_seller_id,
      first_seen_at, last_seen_at, current_price, current_rating, current_review_count, current_bsr, category_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asin) DO UPDATE SET
      title = excluded.title,
      brand = excluded.brand,
      category = excluded.category,
      image_url = excluded.image_url,
      url = excluded.url,
      source_seller_id = COALESCE(excluded.source_seller_id, products.source_seller_id),
      last_seen_at = excluded.last_seen_at,
      current_price = excluded.current_price,
      current_rating = excluded.current_rating,
      current_review_count = excluded.current_review_count,
      current_bsr = excluded.current_bsr,
      category_key = excluded.category_key
  `).run(
    p.asin, p.title ?? null, p.brand ?? null, p.category ?? null, p.image_url ?? null, p.url ?? null,
    p.source_seller_id ?? null, now, now,
    p.current_price ?? null, p.current_rating ?? null, p.current_review_count ?? null, p.current_bsr ?? null,
    p.category_key ?? 'earth_essence'
  );
}

export function getProduct(asin) {
  return db.prepare(`SELECT * FROM products WHERE asin = ?`).get(asin);
}

export function getAllProducts() {
  return db.prepare(`SELECT * FROM products`).all();
}

export function searchProductsByKeyword(keyword, categoryKey) {
  const like = `%${keyword.toLowerCase()}%`;
  if (categoryKey) {
    return db.prepare(`SELECT * FROM products WHERE lower(title) LIKE ? AND category_key = ?`).all(like, categoryKey);
  }
  return db.prepare(`SELECT * FROM products WHERE lower(title) LIKE ?`).all(like);
}

// ---------- snapshots ----------
export function addSnapshot(asin, { price, rating, review_count, bsr }, capturedAt = Date.now()) {
  db.prepare(`
    INSERT INTO snapshots (asin, captured_at, price, rating, review_count, bsr)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(asin, capturedAt, price ?? null, rating ?? null, review_count ?? null, bsr ?? null);
}

export function getSnapshots(asin, limit = 90) {
  return db.prepare(`
    SELECT * FROM snapshots WHERE asin = ? ORDER BY captured_at DESC LIMIT ?
  `).all(asin, limit);
}

// ---------- opportunities ----------
export function upsertOpportunity(o) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO opportunities (
      niche_keyword, demand_score, competition_score, opportunity_score, rationale, why_explanation,
      representative_asins, product_count, avg_competitor_reviews, avg_competitor_rating,
      total_results, accessible_listings, category_key,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(niche_keyword) DO UPDATE SET
      demand_score = excluded.demand_score,
      competition_score = excluded.competition_score,
      opportunity_score = excluded.opportunity_score,
      rationale = excluded.rationale,
      why_explanation = excluded.why_explanation,
      representative_asins = excluded.representative_asins,
      product_count = excluded.product_count,
      avg_competitor_reviews = excluded.avg_competitor_reviews,
      avg_competitor_rating = excluded.avg_competitor_rating,
      total_results = excluded.total_results,
      accessible_listings = excluded.accessible_listings,
      category_key = excluded.category_key,
      updated_at = excluded.updated_at
  `).run(
    o.niche_keyword, o.demand_score, o.competition_score, o.opportunity_score, o.rationale, o.why_explanation ?? null,
    JSON.stringify(o.representative_asins ?? []), o.product_count ?? 0,
    o.avg_competitor_reviews ?? null, o.avg_competitor_rating ?? null,
    o.total_results ?? null, JSON.stringify(o.accessible_listings ?? []), o.category_key ?? 'earth_essence',
    now, now
  );
}

export function getOpportunities({ sort = 'opportunity_score', limit = 100, categoryKey } = {}) {
  const allowedSort = new Set(['opportunity_score', 'demand_score', 'competition_score', 'updated_at']);
  const sortCol = allowedSort.has(sort) ? sort : 'opportunity_score';
  const rows = categoryKey
    ? db.prepare(`SELECT * FROM opportunities WHERE category_key = ? ORDER BY ${sortCol} DESC LIMIT ?`).all(categoryKey, limit)
    : db.prepare(`SELECT * FROM opportunities ORDER BY ${sortCol} DESC LIMIT ?`).all(limit);
  return rows.map(deserializeOpportunity);
}

export function getOpportunityById(id) {
  const row = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(id);
  return row ? deserializeOpportunity(row) : null;
}

/** Niche keywords already scored, oldest-updated first (i.e. most stale first). */
export function getOpportunityKeywords(categoryKey) {
  if (categoryKey) {
    return db.prepare(`SELECT niche_keyword FROM opportunities WHERE category_key = ? ORDER BY updated_at ASC`).all(categoryKey).map((r) => r.niche_keyword);
  }
  return db.prepare(`SELECT niche_keyword FROM opportunities ORDER BY updated_at ASC`).all().map((r) => r.niche_keyword);
}

/** Recomputes demand/opportunity scores in place without touching updated_at. */
export function updateOpportunityScores(id, demandScore, opportunityScore) {
  db.prepare(`UPDATE opportunities SET demand_score = ?, opportunity_score = ? WHERE id = ?`).run(demandScore, opportunityScore, id);
}

/** Overwrites the stored accessible_listings list in place without touching updated_at. */
export function updateAccessibleListings(id, accessibleListings) {
  db.prepare(`UPDATE opportunities SET accessible_listings = ? WHERE id = ?`).run(JSON.stringify(accessibleListings ?? []), id);
}

function deserializeOpportunity(row) {
  return {
    ...row,
    representative_asins: JSON.parse(row.representative_asins || '[]'),
    accessible_listings: JSON.parse(row.accessible_listings || '[]'),
  };
}

// ---------- my products (already launched) ----------
export function upsertMyProduct(p) {
  db.prepare(`
    INSERT INTO my_products (asin, label, url, title, image_url, current_price, current_rating, current_review_count, last_scraped_at, category_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asin) DO UPDATE SET
      label = excluded.label,
      url = excluded.url,
      title = excluded.title,
      image_url = excluded.image_url,
      current_price = excluded.current_price,
      current_rating = excluded.current_rating,
      current_review_count = excluded.current_review_count,
      last_scraped_at = excluded.last_scraped_at,
      category_key = excluded.category_key
  `).run(
    p.asin, p.label ?? null, p.url ?? null, p.title ?? null, p.image_url ?? null,
    p.current_price ?? null, p.current_rating ?? null, p.current_review_count ?? null,
    p.last_scraped_at ?? Date.now(), p.category_key ?? 'earth_essence'
  );
}

export function getMyProducts(categoryKey) {
  if (categoryKey) {
    return db.prepare(`SELECT * FROM my_products WHERE category_key = ?`).all(categoryKey);
  }
  return db.prepare(`SELECT * FROM my_products`).all();
}

// ---------- scan runs ----------
export function createScanRun(categoryKey = 'earth_essence') {
  const result = db.prepare(`
    INSERT INTO scan_runs (started_at, status, sellers_scanned, products_found, new_opportunities, notes, category_key)
    VALUES (?, 'running', 0, 0, 0, NULL, ?)
  `).run(Date.now(), categoryKey);
  return Number(result.lastInsertRowid);
}

export function finishScanRun(id, { status, sellers_scanned, products_found, new_opportunities, notes }) {
  db.prepare(`
    UPDATE scan_runs SET finished_at = ?, status = ?, sellers_scanned = ?, products_found = ?, new_opportunities = ?, notes = ?
    WHERE id = ?
  `).run(Date.now(), status, sellers_scanned ?? 0, products_found ?? 0, new_opportunities ?? 0, notes ?? null, id);
}

/** Marks any scan_runs rows still 'running' as 'failed' (orphaned by a process crash/restart). */
export function markStaleRunsAsFailed(note = 'Interrupted by server restart') {
  db.prepare(`UPDATE scan_runs SET finished_at = ?, status = 'failed', notes = ? WHERE status = 'running'`)
    .run(Date.now(), note);
}

export function getLatestScanRun(categoryKey) {
  if (categoryKey) {
    return db.prepare(`SELECT * FROM scan_runs WHERE category_key = ? ORDER BY id DESC LIMIT 1`).get(categoryKey);
  }
  return db.prepare(`SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1`).get();
}

export function getScanRuns(limit = 20, categoryKey) {
  if (categoryKey) {
    return db.prepare(`SELECT * FROM scan_runs WHERE category_key = ? ORDER BY id DESC LIMIT ?`).all(categoryKey, limit);
  }
  return db.prepare(`SELECT * FROM scan_runs ORDER BY id DESC LIMIT ?`).all(limit);
}

// ---------- settings ----------
export function getSetting(key, fallback = null) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

export default db;
