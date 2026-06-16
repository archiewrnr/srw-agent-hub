import * as db from './src/db.js';
import { filterByFormat, accessibleListingsWithSales, weakIncumbentBonus } from './src/scoring.js';

function clamp(min, max, v) {
  if (v == null || Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function demandFromAccessible(accessible) {
  if (!accessible || accessible.length === 0) return 0;
  const withSales = accessible.filter((a) => a.bought_past_month != null && a.bought_past_month >= 50);
  if (withSales.length === 0) return 0;
  const maxBought = Math.max(...withSales.map((a) => a.bought_past_month));
  const salesScore = clamp(0, 100, (Math.log10(maxBought + 1) / Math.log10(10001)) * 100);
  const countBonus = clamp(0, 5, withSales.length - 1);
  return Math.round(clamp(0, 100, salesScore + countBonus) * 10) / 10;
}

const opportunities = db.getOpportunities({ limit: 10000, categoryKey: 'earth_essence' });

let affected = 0;
const report = [];

for (const o of opportunities) {
  const accessible = o.accessible_listings || [];
  if (accessible.length === 0) continue;

  const filtered = filterByFormat(accessible, o.niche_keyword);
  if (filtered.length === accessible.length) continue; // nothing mismatched

  affected++;
  const dropped = accessible.filter((a) => !filtered.includes(a));

  const newDemand = demandFromAccessible(filtered);
  const bonus = weakIncumbentBonus(o.avg_competitor_rating, o.avg_competitor_reviews);
  const newOpportunity = Math.round(clamp(0, 100, newDemand * 0.8 + (100 - o.competition_score) * 0.15 + bonus * 0.3) * 10) / 10;

  report.push({
    id: o.id,
    keyword: o.niche_keyword,
    old_opportunity: o.opportunity_score,
    new_opportunity: newOpportunity,
    old_demand: o.demand_score,
    new_demand: newDemand,
    dropped: dropped.map((d) => `${d.title.slice(0, 50)} (${d.bought_past_month}+/mo)`),
    kept: filtered.map((d) => `${d.title.slice(0, 50)} (${d.bought_past_month}+/mo)`),
  });
}

report.sort((a, b) => b.old_opportunity - a.old_opportunity);

console.log(`Total earth_essence opportunities: ${opportunities.length}`);
console.log(`Affected by format mismatch in accessible_listings: ${affected}`);
console.log('');
console.log('Top 20 affected by previous rank:');
for (const r of report.slice(0, 20)) {
  console.log(`#${r.id} "${r.keyword}": opportunity ${r.old_opportunity} -> ${r.new_opportunity}, demand ${r.old_demand} -> ${r.new_demand}`);
  console.log(`   dropped: ${JSON.stringify(r.dropped)}`);
  console.log(`   kept: ${JSON.stringify(r.kept)}`);
}

const APPLY = process.argv.includes('--apply');
if (APPLY) {
  let updated = 0;
  for (const o of opportunities) {
    const accessible = o.accessible_listings || [];
    if (accessible.length === 0) continue;
    const filtered = filterByFormat(accessible, o.niche_keyword);
    if (filtered.length === accessible.length) continue;

    const newDemand = demandFromAccessible(filtered);
    const bonus = weakIncumbentBonus(o.avg_competitor_rating, o.avg_competitor_reviews);
    const newOpportunity = Math.round(clamp(0, 100, newDemand * 0.8 + (100 - o.competition_score) * 0.15 + bonus * 0.3) * 10) / 10;

    db.updateOpportunityScores(o.id, newDemand, newOpportunity);
    db.updateAccessibleListings(o.id, filtered);
    updated++;
  }
  console.log(`\nApplied fixes to ${updated} opportunities.`);
}
