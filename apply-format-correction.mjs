import rawDb, { getOpportunities } from './src/db.js';
import { filterByFormat, weakIncumbentBonus } from './src/scoring.js';

function clamp(min, max, v) {
  if (v == null || Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}
function round1(v) {
  return Math.round(v * 10) / 10;
}

const opportunities = getOpportunities({ limit: 10000 });
let changed = 0;

const update = rawDb.prepare(`
  UPDATE opportunities SET demand_score = ?, opportunity_score = ?, accessible_listings = ? WHERE id = ?
`);

for (const o of opportunities) {
  const accessible = o.accessible_listings || [];
  const filtered = filterByFormat(accessible, o.niche_keyword);

  let demandScore;
  if (filtered.length === 0) {
    demandScore = 0;
  } else {
    const maxBought = Math.max(...filtered.map((a) => a.bought_past_month || 0));
    const salesScore = clamp(0, 100, (Math.log10(maxBought + 1) / Math.log10(10001)) * 100);
    const countBonus = clamp(0, 5, filtered.length - 1);
    demandScore = round1(clamp(0, 100, salesScore + countBonus));
  }

  const bonus = weakIncumbentBonus(o.avg_competitor_rating, o.avg_competitor_reviews);
  const opportunityScore = round1(clamp(0, 100, demandScore * 0.8 + (100 - o.competition_score) * 0.15 + bonus * 0.3));

  if (filtered.length !== accessible.length || demandScore !== o.demand_score || opportunityScore !== o.opportunity_score) {
    update.run(demandScore, opportunityScore, JSON.stringify(filtered), o.id);
    changed++;
    if (Math.abs(opportunityScore - o.opportunity_score) >= 5) {
      console.log(`${o.niche_keyword}: opp ${o.opportunity_score} -> ${opportunityScore} (demand ${o.demand_score} -> ${demandScore})`);
    }
  }
}

console.log(`Recomputed ${opportunities.length} opportunities, ${changed} changed.`);
