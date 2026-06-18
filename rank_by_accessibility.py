"""
Ranks tracked opportunities by genuine launch accessibility: lowest review count
combined with highest verified "bought in past month" sales badge, using the
per-listing accessible_listings data rather than the misleading top-10 AVERAGE
review count (which one entrenched competitor can drag up by hundreds).

Usage: python rank_by_accessibility.py [earth_essence|pure_pleasure]
"""
import json
import sys
import urllib.request

category = sys.argv[1] if len(sys.argv) > 1 else "earth_essence"
url = f"http://localhost:3000/api/opportunities?limit=600&category={category}"

with urllib.request.urlopen(url, timeout=20) as resp:
    data = json.loads(resp.read().decode("utf-8"))

rows = []
for o in data:
    listings = o.get("accessible_listings", [])
    best = None
    best_ratio = -1
    for l in listings:
        bpm = l.get("bought_past_month")
        rc = l.get("review_count")
        if bpm is None or rc is None:
            continue
        ratio = bpm / max(rc, 1)
        if ratio > best_ratio:
            best_ratio = ratio
            best = l
    if best:
        rows.append({
            "niche": o["niche_keyword"],
            "opp_score": o["opportunity_score"],
            "comp_score": o["competition_score"],
            "review_count": best["review_count"],
            "bought_past_month": best["bought_past_month"],
            "ratio": round(best_ratio, 1),
            "comp_title": best["title"][:70],
            "comp_asin": best["asin"],
        })

rows.sort(key=lambda r: -r["ratio"])

with open(f"accessibility_rank_{category}.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, indent=2, ensure_ascii=False)

print(f"{len(rows)} niches with at least one accessible+selling listing, category={category}")
print(f"{'niche':<32} {'opp':>5} {'comp':>5} {'rev':>4} {'bought':>7} {'ratio':>7}")
for r in rows[:30]:
    print(f"{r['niche']:<32} {r['opp_score']:>5} {r['comp_score']:>5} {r['review_count']:>4} {r['bought_past_month']:>7} {r['ratio']:>7}")
