import * as db from './src/db.js';
import { weakIncumbentBonus } from './src/scoring.js';

function clamp(min, max, v) {
  if (v == null || Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

const opportunities = db.getOpportunities({ limit: 10000 });
let changed = 0;

for (const o of opportunities) {
  const accessible = o.accessible_listings || [];

  let demandScore;
  if (accessible.length === 0) {
    demandScore = 0;
  } else {
    const maxBought = Math.max(...accessible.map((a) => a.bought_past_month || 0));
    const salesScore = clamp(0, 100, (Math.log10(maxBought + 1) / Math.log10(10001)) * 100);
    const countBonus = clamp(0, 5, accessible.length - 1);
    demandScore = Math.round(clamp(0, 100, salesScore + countBonus) * 10) / 10;
  }

  const bonus = weakIncumbentBonus(o.avg_competitor_rating, o.avg_competitor_reviews);
  const opportunityScore = Math.round(clamp(0, 100, demandScore * 0.8 + (100 - o.competition_score) * 0.15 + bonus * 0.3) * 10) / 10;

  if (demandScore !== o.demand_score || opportunityScore !== o.opportunity_score) {
    db.updateOpportunityScores(o.id, demandScore, opportunityScore);
    changed++;
  }
}

console.log(`Recomputed ${opportunities.length} opportunities, ${changed} changed.`);
