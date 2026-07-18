/* ── pelta.ai Prompt Guard — Content Script ────────────────
 *   Injected into chat.openai.com and chatgpt.com.
 *   Intercepts the send action, checks via local API, overlays result.
 * ─────────────────────────────────────────────────────────── */

/* ── Selectors (update if ChatGPT's DOM changes) ──────────── */
const SELECTORS = {
  input: '#prompt-textarea',
  sendButton: '#composer-submit-button',
};

/* ── State ───────────────────────────────────────────────── */
let inputEl = null;
let sendEl = null;
let reconnectObserver = null;

/* ── Re-entrancy guard ────────────────────────────────── */
let replaying = false;

/* ── Bootstrap ─────────────────────────────────────────── */
function acquire() {
  inputEl = document.querySelector(SELECTORS.input);
  sendEl = document.querySelector(SELECTORS.sendButton);
  if (inputEl && sendEl) {
    attachListeners();
    return true;
  }
  return false;
}

function watchForMount() {
  if (reconnectObserver) reconnectObserver.disconnect();
  reconnectObserver = new MutationObserver(() => {
    if (!inputEl || !sendEl || !document.contains(inputEl) || !document.contains(sendEl)) {
      detachListeners();
      if (acquire()) console.log('[pelta] re-acquired chat elements');
    }
  });
  reconnectObserver.observe(document.body, { childList: true, subtree: true });
}

/* ── Listeners ──────────────────────────────────────────── */
let keydownHandler = null;
let clickHandler = null;

function attachListeners() {
  if (keydownHandler || clickHandler) return; // already attached

  keydownHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !replaying) {
      const text = getPromptText();
      if (!text || !text.trim()) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      startCheck(text, 'keydown');
    }
  };

  clickHandler = (e) => {
    if (replaying) return;
    const text = getPromptText();
    if (!text || !text.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    startCheck(text, 'click');
  };

  inputEl.addEventListener('keydown', keydownHandler, true);
  sendEl.addEventListener('click', clickHandler, true);
}

function detachListeners() {
  if (keydownHandler && inputEl) {
    inputEl.removeEventListener('keydown', keydownHandler, true);
  }
  if (clickHandler && sendEl) {
    sendEl.removeEventListener('click', clickHandler, true);
  }
  keydownHandler = null;
  clickHandler = null;
  inputEl = null;
  sendEl = null;
}

/* ── Read prompt from ProseMirror contenteditable ───────── */
function getPromptText() {
  if (!inputEl) return '';
  return inputEl.textContent || '';
}

/* ── Clear ProseMirror content ──────────────────────────── */
function clearPrompt() {
  if (!inputEl) return;
  // Set minimal empty paragraph — ProseMirror needs at least <p><br></p>
  inputEl.innerHTML = '<p><br></p>';
  // Dispatch an InputEvent so React/ProseMirror syncs its state
  inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
}

/* ── Re-dispatch the send action ────────────────────────── */
function replaySend() {
  replaying = true;
  // Small delay to allow overlay removal paint before re-trigger
  requestAnimationFrame(() => {
    if (sendEl) sendEl.click();
    replaying = false;
  });
}

/* ── Overlay DOM helpers ────────────────────────────────── */
function createOverlay() {
  let el = document.getElementById('pelta-overlay');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'pelta-overlay';
  document.body.appendChild(el);
  return el;
}

function removeOverlay() {
  const el = document.getElementById('pelta-overlay');
  if (el) el.remove();
}

/* ── Verification flow ──────────────────────────────────── */
function startCheck(text, trigger) {
  showChecking(text);
  chrome.runtime.sendMessage({ type: 'CHECK_PROMPT', text }, (response) => {
    if (!response) {
      showError('No response from extension background — check console.');
      return;
    }
    if (response.error) {
      showError(response.reason || 'Governance check failed.');
      return;
    }
    switch (response.verdict) {
      case 'allow':
        removeOverlay();
        replaySend();
        break;
      case 'flag':
        showFlag(response, text);
        break;
      case 'block':
        showBlock(response, text);
        break;
      default:
        removeOverlay();
        replaySend();
    }
  });
}

/* ── Build highlighted prompt HTML from API highlights ─── */
function buildHighlightedPrompt(text, highlights) {
  if (!highlights || highlights.length === 0) {
    return escapeHtml(text);
  }
  // Sort by start position; remove overlaps
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const cleaned = [];
  let lastEnd = -1;
  for (const h of sorted) {
    if (h.start >= lastEnd) {
      cleaned.push(h);
      lastEnd = h.end;
    }
  }
  let html = '';
  let cursor = 0;
  for (const span of cleaned) {
    if (span.start > cursor) {
      html += escapeHtml(text.slice(cursor, span.start));
    }
    const cls = span.severity === 'high' ? 'pelta-hl-high' : 'pelta-hl-medium';
    html += `<span class="pelta-hl ${cls}">${escapeHtml(text.slice(span.start, span.end))}</span>`;
    cursor = span.end;
  }
  if (cursor < text.length) {
    html += escapeHtml(text.slice(cursor));
  }
  return html;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Overlay variants ───────────────────────────────────── */
function showChecking(text) {
  const el = createOverlay();
  el.className = 'checking';
  el.innerHTML = `
    <div class="pelta-label">
      <span class="pelta-dot"></span>
      <span>pelta.ai — scanning for sensitive data...</span>
    </div>
  `;
}

function showFlag(response, promptText) {
  const el = createOverlay();
  el.className = 'flag';
  const promptHtml = buildHighlightedPrompt(promptText, response.highlights);
  el.innerHTML = `
    <div class="pelta-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
      Flagged — ${response.riskLevel} risk
    </div>
    <div class="pelta-reason">${response.reason || 'No reason provided.'}</div>
    <div class="pelta-prompt-label">Submitted Prompt (highlighted)</div>
    <div class="pelta-prompt-preview">${promptHtml}</div>
    <div class="pelta-meta">method: ${response.detectionMethod || '—'} <span>·</span> check with admin discretion</div>
    <div class="pelta-btn-group">
      <button class="pelta-btn pelta-btn-primary" id="pelta-allow">Send Anyway</button>
      <button class="pelta-btn pelta-btn-secondary" id="pelta-cancel">Cancel</button>
    </div>
  `;
  document.getElementById('pelta-allow').onclick = () => {
    removeOverlay();
    replaySend();
  };
  document.getElementById('pelta-cancel').onclick = removeOverlay;
}

function showBlock(response, promptText) {
  const el = createOverlay();
  el.className = 'block';
  const promptHtml = buildHighlightedPrompt(promptText, response.highlights);
  el.innerHTML = `
    <div class="pelta-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      Blocked by governance policy
    </div>
    <div class="pelta-reason">${response.reason || 'No reason provided.'}</div>
    <div class="pelta-prompt-label">Submitted Prompt (highlighted)</div>
    <div class="pelta-prompt-preview">${promptHtml}</div>
    <div class="pelta-meta">method: ${response.detectionMethod || '—'} <span>·</span> message not sent</div>
    <div class="pelta-btn-group">
      <button class="pelta-btn pelta-btn-secondary" id="pelta-dismiss">Dismiss</button>
    </div>
  `;
  document.getElementById('pelta-dismiss').onclick = () => {
    clearPrompt();
    removeOverlay();
  };
}

function showError(reason) {
  const el = createOverlay();
  el.className = 'error';
  el.innerHTML = `
    <div class="pelta-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Governance server unreachable
    </div>
    <div class="pelta-reason">${reason}</div>
    <div class="pelta-btn-group">
      <button class="pelta-btn pelta-btn-secondary" id="pelta-dismiss-error">Dismiss</button>
    </div>
  `;
  document.getElementById('pelta-dismiss-error').onclick = removeOverlay;
}

/* ── Init ───────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!acquire()) {
      // ChatGPT sometimes loads the composer after initial paint
      setTimeout(() => { if (!acquire()) watchForMount(); }, 800);
    } else {
      watchForMount();
    }
  });
} else {
  if (!acquire()) {
    setTimeout(() => { if (!acquire()) watchForMount(); }, 800);
  } else {
    watchForMount();
  }
}
