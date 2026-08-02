/* ── pelta.ai Popup — Activity Feed ─────────────────────── */

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function verdictIcon(verdict) {
  if (verdict === 'block') return '🔴';
  if (verdict === 'flag')  return '🟡';
  return '🟢';
}

function verdictClass(verdict) {
  if (verdict === 'block') return 'verdict-block';
  if (verdict === 'flag')  return 'verdict-flag';
  return 'verdict-allow';
}

function renderFeed(events) {
  const feed = document.getElementById('event-feed');

  if (!events || events.length === 0) {
    feed.innerHTML = '<div class="empty">No activity yet — start a conversation to begin scanning</div>';
    return;
  }

  feed.innerHTML = events.map((ev) => `
    <div class="event">
      <div class="event-icon">${verdictIcon(ev.verdict)}</div>
      <div class="event-body">
        <div class="event-top">
          <span class="verdict-badge ${verdictClass(ev.verdict)}">${ev.verdict}</span>
          <span class="event-tool">${ev.tool || 'Unknown'}</span>
          ${ev.source === 'image-upload' ? '<span class="event-source-badge">🖼 image</span>' : ''}
          <span class="event-time">${timeAgo(ev.timestamp)}</span>
        </div>
        <div class="event-reason">${ev.reason || '—'}</div>
      </div>
    </div>
  `).join('');
}

function renderStats(events) {
  const blocks = events.filter(e => e.verdict === 'block').length;
  const flags  = events.filter(e => e.verdict === 'flag').length;
  document.getElementById('count-block').textContent = blocks;
  document.getElementById('count-flag').textContent  = flags;
  document.getElementById('count-total').textContent = events.length;
}

// Load and render on open
chrome.storage.local.get({ pelta_events: [] }, ({ pelta_events }) => {
  renderStats(pelta_events);
  renderFeed(pelta_events);
});

// Clear history
document.getElementById('clear-history').addEventListener('click', () => {
  chrome.storage.local.set({ pelta_events: [] }, () => {
    renderStats([]);
    renderFeed([]);
  });
});

// Open dashboard in new tab
document.getElementById('open-dashboard').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:3000' });
});
