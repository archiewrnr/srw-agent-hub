import express from 'express';
import * as db from '../src/db.js';
import * as scheduler from '../src/scheduler.js';
import * as keepa from '../src/keepa.js';
import { MY_PRODUCTS_BY_CATEGORY, isOwnProductNiche } from '../src/myProducts.js';
import { isExcludedNiche } from '../src/excludedNiches.js';
import { CATEGORIES, resolveCategory } from '../src/categories.js';

const router = express.Router();

router.get('/categories', (req, res) => {
  res.json(Object.values(CATEGORIES));
});

router.get('/opportunities', (req, res) => {
  const { sort, limit } = req.query;
  const categoryKey = resolveCategory(req.query.category);
  const opportunities = db
    .getOpportunities({
      sort,
      // over-fetch since we filter out own-product niches afterwards
      limit: limit ? Number(limit) * 2 : undefined,
      categoryKey,
    })
    .filter((o) => !isOwnProductNiche(o.niche_keyword, categoryKey))
    .filter((o) => !isExcludedNiche(o.niche_keyword, categoryKey));
  res.json(limit ? opportunities.slice(0, Number(limit)) : opportunities);
});

router.get('/my-products', (req, res) => {
  const categoryKey = resolveCategory(req.query.category);
  const myProducts = MY_PRODUCTS_BY_CATEGORY[categoryKey] || [];
  const cached = new Map(db.getMyProducts(categoryKey).map((p) => [p.asin, p]));
  res.json(myProducts.map((p) => ({ ...p, ...cached.get(p.asin) })));
});

router.get('/opportunities/:id', (req, res) => {
  const opp = db.getOpportunityById(Number(req.params.id));
  if (!opp) return res.status(404).json({ error: 'Not found' });

  const representatives = opp.representative_asins.map((asin) => ({
    asin,
    product: db.getProduct(asin) || null,
    snapshots: db.getSnapshots(asin, 60).reverse(),
  }));

  res.json({ ...opp, representatives });
});

router.get('/scan/status', (req, res) => {
  const categoryKey = resolveCategory(req.query.category);
  res.json({
    ...scheduler.getStatus(categoryKey),
    intervalHours: scheduler.getIntervalHours(),
    keepaConfigured: keepa.hasKeepaKey(),
    tokenStatus: keepa.getTokenStatus(),
    recentRuns: db.getScanRuns(10, categoryKey),
  });
});

router.post('/scan/run', async (req, res) => {
  const categoryKey = resolveCategory(req.query.category || req.body?.category);
  const result = await scheduler.triggerScan(categoryKey);
  res.json(result);
});

router.get('/sellers', (req, res) => {
  const categoryKey = resolveCategory(req.query.category);
  res.json(db.getSellers(categoryKey));
});

router.post('/sellers', (req, res) => {
  const { seller_id, label, category } = req.body || {};
  if (!seller_id) return res.status(400).json({ error: 'seller_id required' });
  db.upsertSeller(seller_id, label, resolveCategory(category));
  res.json({ ok: true });
});

router.delete('/sellers/:id', (req, res) => {
  db.removeSeller(req.params.id);
  res.json({ ok: true });
});

router.get('/settings', (req, res) => {
  res.json({
    scan_interval_hours: scheduler.getIntervalHours(),
    scan_daily_hour: scheduler.getScanDailyHour(),
    keepa_configured: keepa.hasKeepaKey(),
  });
});

router.post('/settings', (req, res) => {
  const { scan_interval_hours, scan_daily_hour } = req.body || {};
  if (scan_interval_hours != null) {
    db.setSetting('scan_interval_hours', scan_interval_hours);
  }
  if (scan_daily_hour !== undefined) {
    if (scan_daily_hour === null) {
      db.setSetting('scan_daily_hour', null);
    } else {
      const h = Number(scan_daily_hour);
      if (Number.isFinite(h) && h >= 0 && h <= 23) db.setSetting('scan_daily_hour', h);
    }
  }
  scheduler.applyIntervalChange();
  res.json({ ok: true });
});

export default router;
