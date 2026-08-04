const STORAGE_KEY = 'pelta_api_base';
const LOCAL_URL = 'http://localhost:3000';

const localCard = document.getElementById('local-card');
const prodCard = document.getElementById('prod-card');
const localCheck = document.getElementById('local-check');
const prodCheck = document.getElementById('prod-check');
const prodUrlDisplay = document.getElementById('prod-url-display');
const prodUrlInput = document.getElementById('prod-url-input');
const saveBtn = document.getElementById('save-btn');
const statusEl = document.getElementById('status');

function render(activeBase, prodUrl) {
  const isLocal = activeBase === LOCAL_URL;
  localCard.className = isLocal ? 'card active' : 'card';
  prodCard.className = !isLocal ? 'card active' : 'card';
  localCheck.textContent = isLocal ? 'Active ✓' : '';
  prodCheck.textContent = !isLocal ? 'Active ✓' : '';
  prodUrlDisplay.textContent = prodUrl || '(not set)';
  prodUrlInput.value = prodUrl || '';
}

async function load() {
  const stored = await chrome.storage.sync.get([STORAGE_KEY, 'pelta_prod_url']);
  const activeBase = stored[STORAGE_KEY] || LOCAL_URL;
  const prodUrl = stored['pelta_prod_url'] || '';
  render(activeBase, prodUrl);
}

localCard.onclick = async () => {
  await chrome.storage.sync.set({ [STORAGE_KEY]: LOCAL_URL });
  const prodUrl = (await chrome.storage.sync.get('pelta_prod_url'))['pelta_prod_url'] || '';
  render(LOCAL_URL, prodUrl);
  statusEl.textContent = 'Switched to localhost ✓';
};

prodCard.onclick = async () => {
  const stored = await chrome.storage.sync.get('pelta_prod_url');
  const prodUrl = stored['pelta_prod_url'];
  if (!prodUrl) {
    statusEl.textContent = 'Set a production URL first.';
    return;
  }
  await chrome.storage.sync.set({ [STORAGE_KEY]: prodUrl });
  render(prodUrl, prodUrl);
  statusEl.textContent = 'Switched to production ✓';
};

saveBtn.onclick = async () => {
  const url = prodUrlInput.value.trim();
  if (!url) { statusEl.textContent = 'Enter a URL.'; return; }
  try { new URL(url); } catch { statusEl.textContent = 'Invalid URL.'; return; }

  await chrome.storage.sync.set({ pelta_prod_url: url });

  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const currentlyActive = stored[STORAGE_KEY];
  // If production is currently active, update it live
  if (currentlyActive && currentlyActive !== LOCAL_URL) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: url });
  }
  render(currentlyActive === LOCAL_URL ? LOCAL_URL : url, url);
  statusEl.textContent = 'Production URL saved ✓';
};

load();
