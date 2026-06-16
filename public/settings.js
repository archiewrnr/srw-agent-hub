let categories = [];
let currentCategory = localStorage.getItem('category') || 'earth_essence';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
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
  document.title = `Settings — ${cat.label} Opportunity Finder`;
}

function switchCategory(key) {
  if (key === currentCategory) return;
  currentCategory = key;
  localStorage.setItem('category', key);
  renderCategoryToggle();
  applyCategoryTheme();
  loadSellers();
}

async function loadSettings() {
  const res = await fetch('/api/settings');
  const settings = await res.json();
  document.getElementById('intervalInput').value = settings.scan_interval_hours;
  document.getElementById('keepaStatus').textContent = settings.keepa_configured
    ? '✅ Keepa API key detected.'
    : '⚠ No Keepa API key configured — running on Playwright scraper fallback only.';
}

async function loadSellers() {
  const res = await fetch(`/api/sellers?category=${currentCategory}`);
  const sellers = await res.json();
  const list = document.getElementById('sellerList');
  list.innerHTML = sellers.length ? sellers.map((s) => `
    <li>
      <span><strong>${escapeHtml(s.seller_id)}</strong>${s.label ? ' — ' + escapeHtml(s.label) : ''}
        ${s.last_scanned_at ? `<br><small>Last scanned: ${new Date(s.last_scanned_at).toLocaleString()}</small>` : ''}
      </span>
      <button data-id="${escapeHtml(s.seller_id)}" class="remove-seller">Remove</button>
    </li>
  `).join('') : '<li class="hint">No tracked storefronts for this category yet.</li>';

  list.querySelectorAll('.remove-seller').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/sellers/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
      loadSellers();
    });
  });
}

document.getElementById('saveIntervalBtn').addEventListener('click', async () => {
  const value = Number(document.getElementById('intervalInput').value);
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scan_interval_hours: value }),
  });
  document.getElementById('intervalSaved').textContent = 'Saved.';
  setTimeout(() => (document.getElementById('intervalSaved').textContent = ''), 2000);
});

document.getElementById('addSellerBtn').addEventListener('click', async () => {
  const seller_id = document.getElementById('newSellerId').value.trim();
  const label = document.getElementById('newSellerLabel').value.trim();
  if (!seller_id) return;
  await fetch('/api/sellers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seller_id, label, category: currentCategory }),
  });
  document.getElementById('newSellerId').value = '';
  document.getElementById('newSellerLabel').value = '';
  loadSellers();
});

loadSettings();
loadCategories().then(() => loadSellers());
