/* ── pelta.ai Prompt Guard — Service Worker ───────────────
 *   Proxies prompt text from the content script to the local
 *   guard check API and returns the verdict.
 * ─────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'pelta_api_base';
const LOCAL_URL = 'http://localhost:3000';

async function getApiBase() {
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    const base = stored[STORAGE_KEY] || LOCAL_URL;
    console.log('[pelta] background API_BASE:', base);
    return base;
  } catch {
    return LOCAL_URL;
  }
}

/* ── Fail-closed toggle ───────────────────────────────────
 *   true  → block the send when the governance server is down
 *   false → allow the send through (with a warning overlay)
 * ─────────────────────────────────────────────────────────── */
const FAIL_CLOSED = true;

function storeEvent(msg, data) {
  const event = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    verdict: data.verdict,
    riskLevel: data.riskLevel || 'none',
    reason: data.reason || '',
    tool: msg.tool || 'Unknown',
    source: msg.trigger === 'paste-image' ? 'image-upload' : 'text',
    promptSnippet: (msg.text || '').slice(0, 90),
  };
  chrome.storage.local.get({ pelta_events: [] }, ({ pelta_events }) => {
    const updated = [event, ...pelta_events].slice(0, 50);
    chrome.storage.local.set({ pelta_events: updated });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'CHECK_PROMPT') return;

  (async () => {
    const API_BASE = await getApiBase();
    try {
      const res = await fetch(`${API_BASE}/api/guard/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: msg.text,
          source: 'extension',
          tool: msg.tool || 'ChatGPT',
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      storeEvent(msg, data);
      sendResponse(data);
    } catch (err) {
      console.warn('[pelta] API call failed:', err.message);
      const fallback = {
        error: true,
        verdict: FAIL_CLOSED ? 'block' : 'allow',
        riskLevel: FAIL_CLOSED ? 'high' : 'none',
        reason: FAIL_CLOSED
          ? 'pelta.ai governance server unreachable — message blocked by policy.'
          : 'pelta.ai governance server unreachable — message sent without check.',
        detectionMethod: 'extension',
        dataCategory: 'None',
      };
      storeEvent(msg, fallback);
      sendResponse(fallback);
    }
  })();

  return true;
});

/* ── Desktop Notification Handler ─────────────────────────
 *   Fired by content-script when an admin approves/rejects
 *   a request, even if the overlay has already been dismissed.
 * ─────────────────────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'NOTIFY_USER') return;

  const isApproved = msg.status === 'approved';
  // Minimal valid 1x1 PNG (Chrome requires a local/data URL for notifications)
  const iconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  chrome.notifications.create(`pelta-${Date.now()}`, {
    type: 'basic',
    iconUrl: iconDataUrl,
    title: isApproved ? 'pelta.ai — Request Approved ✓' : 'pelta.ai — Request Denied',
    message: isApproved
      ? 'Your prompt has been unblocked by an admin. Go back to the tab to send it.'
      : `Denied: ${msg.reason || 'No reason provided.'}`,
    priority: 2,
  }, (notifId) => {
    if (chrome.runtime.lastError) {
      console.warn('[pelta] Notification failed:', chrome.runtime.lastError.message);
    }
  });
  sendResponse({ ok: true });
});
