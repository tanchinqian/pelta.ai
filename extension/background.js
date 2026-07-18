/* ── pelta.ai Prompt Guard — Service Worker ───────────────
 *   Proxies prompt text from the content script to the local
 *   guard check API and returns the verdict.
 * ─────────────────────────────────────────────────────────── */

const API_BASE = 'http://localhost:3000';

/* ── Fail-closed toggle ───────────────────────────────────
 *   true  → block the send when the governance server is down
 *   false → allow the send through (with a warning overlay)
 * ─────────────────────────────────────────────────────────── */
const FAIL_CLOSED = true;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'CHECK_PROMPT') return;

  fetch(`${API_BASE}/api/guard/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: msg.text,
      source: 'extension',
      tool: 'ChatGPT',
    }),
  })
    .then((r) => {
      if (!r.ok) {
        return r.json().then((body) => {
          throw new Error(body.error || `HTTP ${r.status}`);
        });
      }
      return r.json();
    })
    .then((data) => sendResponse(data))
    .catch((err) => {
      console.warn('[pelta] API call failed:', err.message);
      sendResponse({
        error: true,
        verdict: FAIL_CLOSED ? 'block' : 'allow',
        riskLevel: FAIL_CLOSED ? 'high' : 'none',
        reason: FAIL_CLOSED
          ? 'pelta.ai governance server unreachable — message blocked by policy.'
          : 'pelta.ai governance server unreachable — message sent without check.',
        detectionMethod: 'extension',
        dataCategory: 'None',
      });
    });

  return true; // keep message channel open for async response
});
