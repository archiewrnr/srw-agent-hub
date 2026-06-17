let opportunities = [];
let categories = [];
let currentCategory = localStorage.getItem('category') || 'earth_essence';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function scoreClass(score) {
  if (score >= 65) return 'score-great';
  if (score >= 40) return 'score-ok';
  return 'score-poor';
}

const MEDALS = ['gold', 'silver', 'bronze'];
const MEDAL_ICONS = { gold: '🥇', silver: '🥈', bronze: '🥉' };

function bestBought(o) {
  return (o.accessible_listings || [])
    .filter((a) => a.bought_past_month != null)
    .reduce((max, a) => Math.max(max, a.bought_past_month), 0);
}

function renderPriorityCard(o, i) {
  const best = bestBought(o);
  return `
    <div class="priority-card" data-id="${o.id}">
      <div class="priority-rank">${MEDAL_ICONS[MEDALS[i]]}</div>
      <div class="priority-main">
        <h3>${escapeHtml(o.niche_keyword)}</h3>
        <p class="priority-rationale">${escapeHtml(truncate(o.rationale || '', 110))}</p>
        <div class="priority-bars">
          <div class="bar"><span>Demand</span><div class="bar-track"><div class="bar-fill demand" style="width:${o.demand_score}%"></div></div><span>${o.demand_score}</span></div>
          <div class="bar"><span>Competition</span><div class="bar-track"><div class="bar-fill competition" style="width:${o.competition_score}%"></div></div><span>${o.competition_score}</span></div>
        </div>
      </div>
      <div class="priority-side">
        <div class="score-badge ${scoreClass(o.opportunity_score)}">
          <span class="score-value">${o.opportunity_score}</span>
          <span class="score-label">Opportunity</span>
        </div>
        <div class="priority-stat">
          <span class="stat-value ${best > 0 ? '' : 'muted'}">${best > 0 ? `${best}+/mo` : 'No badge'}</span>
          <span class="stat-label">Best bought/month</span>
        </div>
      </div>
    </div>
  `;
}

function sortOpportunities(list, key) {
  const copy = [...list];
  if (key === 'competition_score') {
    copy.sort((a, b) => a.competition_score - b.competition_score);
  } else {
    copy.sort((a, b) => b[key] - a[key]);
  }
  return copy;
}

async function loadCategories() {
  const res = await fetch('/api/categories');
  categories = await res.json();
  renderCategoryToggle();
  applyCategoryTheme();
}

function renderCategoryToggle() {
  const el = document.getElementById('categoryToggle');
  el.innerHTML = categories.map((c) => `
    <button data-key="${c.key}" class="${c.key === currentCategory ? 'active' : ''}">${c.icon} ${escapeHtml(c.label)}</button>
  `).join('');
  el.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => switchCategory(btn.dataset.key));
  });
}

function applyCategoryTheme() {
  const cat = categories.find((c) => c.key === currentCategory);
  if (!cat) return;
  document.body.classList.toggle('theme-pink', cat.theme === 'pink');
  document.getElementById('brandTitle').textContent = `${cat.icon} ${cat.label}`;
  document.getElementById('brandTagline').textContent = cat.tagline;
  document.title = `${cat.label} — ${cat.tagline}`;
}

function switchCategory(key) {
  if (key === currentCategory) return;
  currentCategory = key;
  localStorage.setItem('category', key);
  renderCategoryToggle();
  applyCategoryTheme();
  loadOpportunities();
  loadMyProducts();
  loadStatus();
  loadUpdates();
}

async function loadOpportunities() {
  const res = await fetch(`/api/opportunities?limit=200&category=${currentCategory}`);
  opportunities = await res.json();
  render();
}

async function loadUpdates() {
  const el = document.getElementById('newWorkList');
  if (!el) return;
  try {
    const res = await fetch('/updates.json', { cache: 'no-store' });
    const allUpdates = await res.json();
    const updates = allUpdates.filter((entry) => (entry.category || 'earth_essence') === currentCategory);
    if (!updates.length) {
      el.innerHTML = '<p class="empty-state">No updates yet.</p>';
      return;
    }
    el.innerHTML = updates.slice(0, 5).map((entry) => `
      <div class="new-work-entry">
        <div class="new-work-date">${new Date(entry.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        ${entry.images && entry.images.length ? `
        <div class="new-work-images">
          ${entry.images.map((img) => `
            <a href="${img.link}" class="new-work-image-card" title="${img.label}">
              <img src="${img.src}" alt="${img.label}" loading="lazy" />
              <span>${img.label}</span>
            </a>
          `).join('')}
        </div>` : ''}
        <ul>${entry.items.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = '<p class="empty-state">No updates yet.</p>';
  }
}

async function loadMyProducts() {
  const res = await fetch(`/api/my-products?category=${currentCategory}`);
  const products = await res.json();
  const el = document.getElementById('myProductsList');

  el.innerHTML = products.map((p) => `
    <a class="my-product-card" href="${p.url}" target="_blank" rel="noopener">
      ${p.image_url ? `<img src="${p.image_url}" alt="${escapeHtml(p.title || p.label)}" />` : '<div class="my-product-img-placeholder"></div>'}
      <div class="my-product-info">
        <div class="my-product-label">${escapeHtml(p.label)}</div>
        <div class="my-product-title">${escapeHtml(truncate(p.title || '', 70))}</div>
        <div class="my-product-meta">
          ${p.current_price != null ? `£${p.current_price}` : ''}
          ${p.current_rating != null ? ` · ${p.current_rating}★` : ''}
          ${p.current_review_count != null ? ` · ${p.current_review_count} reviews` : ''}
        </div>
      </div>
    </a>
  `).join('');
}

function render() {
  const priorityList = document.getElementById('priorityList');
  const topPicks = [...opportunities]
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 3);
  priorityList.innerHTML = topPicks.length
    ? topPicks.map((o, i) => renderPriorityCard(o, i)).join('')
    : '<p class="empty-state">No opportunities yet.</p>';

  const sortKey = document.getElementById('sortSelect').value;
  const filterText = document.getElementById('filterInput').value.trim().toLowerCase();

  let filtered = opportunities;
  if (filterText) {
    filtered = filtered.filter((o) => o.niche_keyword.toLowerCase().includes(filterText));
  }

  const sorted = sortOpportunities(filtered, sortKey);
  const list = document.getElementById('opportunityList');
  const totalLabel = filterText ? `${sorted.length} of ${opportunities.length} opportunities` : `${sorted.length} opportunities tracked`;
  document.getElementById('resultCount').textContent = totalLabel;

  if (sorted.length === 0) {
    list.innerHTML = '<p class="empty-state">No opportunities yet. Click "Run Scan Now" to start sourcing.</p>';
    return;
  }

  list.innerHTML = sorted.map((o, i) => {
    const medal = !filterText ? MEDALS[i] : undefined;
    const accessible = o.accessible_listings || [];
    const best = bestBought(o);

    return `
    <div class="opp-card ${medal ? `medal-${medal}` : ''}" data-id="${o.id}">
      <div class="opp-top">
        <div class="rank">${medal ? `<span class="medal">${MEDAL_ICONS[medal]}</span>` : `#${i + 1}`}</div>
        <div class="opp-main">
          <h3>${escapeHtml(o.niche_keyword)}</h3>
          <p class="rationale">${escapeHtml(o.rationale || '')}</p>
          <div class="meta">
            <span>Tracked products: ${o.product_count}</span>
            <span>Updated: ${new Date(o.updated_at).toLocaleString()}</span>
          </div>
        </div>
        <div class="scores">
          <div class="score-badge ${scoreClass(o.opportunity_score)}">
            <span class="score-value">${o.opportunity_score}</span>
            <span class="score-label">Opportunity</span>
          </div>
          <div class="sub-scores">
            <div class="bar"><span>Demand</span><div class="bar-track"><div class="bar-fill demand" style="width:${o.demand_score}%"></div></div><span>${o.demand_score}</span></div>
            <div class="bar"><span>Competition</span><div class="bar-track"><div class="bar-fill competition" style="width:${o.competition_score}%"></div></div><span>${o.competition_score}</span></div>
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-chip">
          <span class="stat-value">${o.total_results != null ? o.total_results.toLocaleString() : '—'}</span>
          <span class="stat-label">Similar listings</span>
        </div>
        <div class="stat-chip">
          <span class="stat-value">${accessible.length}</span>
          <span class="stat-label">Catchable &amp; verified selling</span>
        </div>
        <div class="stat-chip">
          <span class="stat-value ${best > 0 ? '' : 'muted'}">${best > 0 ? `${best}+/mo` : 'No badge'}</span>
          <span class="stat-label">Best bought/month</span>
        </div>
      </div>

      ${accessible.length > 0 ? `
      <details>
        <summary>ASINs to study (${accessible.length}) — low reviews + verified 50+ bought/month</summary>
        <table class="asin-table">
          <thead><tr><th>Listing</th><th>Reviews</th><th>Rating</th><th>Bought/mo</th></tr></thead>
          <tbody>
            ${accessible.map((a) => `
              <tr>
                <td><a href="${a.url}" target="_blank" rel="noopener">${escapeHtml(truncate(a.title, 55))} ↗</a></td>
                <td>${a.review_count ?? '—'}</td>
                <td>${a.rating ?? '—'}</td>
                <td>${a.bought_past_month != null ? a.bought_past_month + '+' : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>` : ''}

      ${o.why_explanation ? `
      <details>
        <summary>Why this scored ${o.opportunity_score}/100</summary>
        <p class="why-text">${escapeHtml(o.why_explanation)}</p>
      </details>` : ''}
    </div>
  `;
  }).join('');
}

async function loadStatus() {
  const res = await fetch(`/api/scan/status?category=${currentCategory}`);
  const status = await res.json();
  const statusText = document.getElementById('statusText');
  const runBtn = document.getElementById('runScanBtn');

  let text;
  if (status.running) {
    text = '🔄 Scan running…';
    runBtn.disabled = true;
  } else {
    runBtn.disabled = false;
    const last = status.lastRun ? new Date(status.lastRun).toLocaleString() : 'never';
    const next = status.nextRun ? new Date(status.nextRun).toLocaleString() : '—';
    text = `Last scan: ${last} · Next scan: ${next} · Every ${status.intervalHours}h`;
  }
  if (!status.keepaConfigured) {
    text += ' · ⚠ Keepa API key not set (scraper fallback)';
  }
  if (status.lastError) {
    text += ` · ⚠ ${status.lastError}`;
  }
  statusText.textContent = text;
  return status;
}

function pollWhileRunning() {
  const interval = setInterval(async () => {
    const status = await loadStatus();
    await loadOpportunities();
    if (!status.running) {
      clearInterval(interval);
    }
  }, 15000);
}

document.getElementById('runScanBtn').addEventListener('click', async () => {
  await fetch(`/api/scan/run?category=${currentCategory}`, { method: 'POST' });
  loadStatus();
  pollWhileRunning();
});

document.getElementById('sortSelect').addEventListener('change', render);
document.getElementById('filterInput').addEventListener('input', render);

loadUpdates();

loadCategories().then(() => {
  loadOpportunities();
  loadMyProducts();
  loadStatus().then((status) => {
    if (status.running) pollWhileRunning();
  });
});
setInterval(loadStatus, 30000);
