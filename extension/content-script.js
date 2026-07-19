/* ── pelta.ai Prompt Guard — Content Script ────────────────
 *   Injected into chat.openai.com and chatgpt.com.
 *   Intercepts the send action, checks via local API, overlays result.
 * ─────────────────────────────────────────────────────────── */

function getToolName() {
  const host = window.location.hostname;
  if (host.includes('gemini')) return 'Gemini';
  if (host.includes('claude')) return 'Claude';
  if (host.includes('deepseek')) return 'DeepSeek';
  if (host.includes('copilot')) return 'Copilot';
  return 'ChatGPT';
}

/* ── Selectors (supports ChatGPT, Gemini, Claude, DeepSeek, Copilot) ──────── */
const SELECTORS = {
  input: '#prompt-textarea, div.ql-editor[contenteditable="true"], div[contenteditable="true"].ProseMirror, div[contenteditable="true"][role="textbox"], textarea#chat-input, textarea[placeholder*="Ask"], textarea[placeholder*="DeepSeek"], textarea[aria-label*="Ask"], textarea',
  sendButton: '#composer-submit-button, button.send-button, [data-testid="send-button"], [aria-label*="Send message"], [aria-label*="Send prompt"], [aria-label*="Send"], [aria-label*="submit"], button[class*="send"]',
};

/* ── State ───────────────────────────────────────────────── */
let inputEl = null;
let sendEl = null;
let reconnectObserver = null;

/* ── Re-entrancy guard ────────────────────────────────── */
let replaying = false;

/* ── Visual Active Badge ─────────────────────────────────── */
function showActiveBadge() {
  let badge = document.getElementById('pelta-active-badge');
  if (badge) return;
  badge = document.createElement('div');
  badge.id = 'pelta-active-badge';
  badge.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="width:6px;height:6px;background-color:#22c55e;border-radius:50%;display:inline-block;box-shadow:0 0 8px #22c55e;animation:pelta-pulse 2s infinite;"></span>
      <span>pelta.ai active</span>
    </div>
  `;
  badge.style.cssText = `
    position: fixed;
    bottom: 12px;
    right: 12px;
    z-index: 99999;
    background: #18181b;
    border: 1px solid #27272a;
    color: #e4e4e7;
    font-size: 10px;
    font-family: monospace;
    padding: 6px 10px;
    border-radius: 6px;
    opacity: 0.8;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  `;
  
  let style = document.getElementById('pelta-badge-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pelta-badge-style';
    style.innerHTML = `
      @keyframes pelta-pulse {
        0% { opacity: 0.4; }
        50% { opacity: 1; }
        100% { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }
  document.body.appendChild(badge);
}

function removeActiveBadge() {
  const badge = document.getElementById('pelta-active-badge');
  if (badge) badge.remove();
  const style = document.getElementById('pelta-badge-style');
  if (style) style.remove();
}

/* ── Bootstrap ─────────────────────────────────────────── */
function acquire() {
  inputEl = document.querySelector(SELECTORS.input);
  if (inputEl) {
    attachListeners();
    showActiveBadge();
    return true;
  }
  return false;
}

function watchForMount() {
  if (reconnectObserver) reconnectObserver.disconnect();
  reconnectObserver = new MutationObserver(() => {
    if (!inputEl || !document.contains(inputEl)) {
      detachListeners();
      if (acquire()) console.log('[pelta] re-acquired chat elements');
    }
  });
  reconnectObserver.observe(document.body, { childList: true, subtree: true });
}

/* ── Listeners ──────────────────────────────────────────── */
let keydownHandler = null;
let keyupHandler = null;
let clickHandler = null;

function attachListeners() {
  if (keydownHandler || clickHandler) return; // already attached

  keydownHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !replaying) {
      if (!inputEl || !inputEl.contains(e.target) && e.target !== inputEl) return;
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
    const btn = e.target.closest(SELECTORS.sendButton);
    if (!btn) return;

    const text = getPromptText();
    if (!text || !text.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    startCheck(text, 'click');
  };

  keyupHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !replaying) {
      if (!inputEl || (!inputEl.contains(e.target) && e.target !== inputEl)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  window.addEventListener('keydown', keydownHandler, true);
  window.addEventListener('keyup', keyupHandler, true);
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('mousedown', clickHandler, true);
  document.addEventListener('pointerdown', clickHandler, true);
}

function detachListeners() {
  if (keydownHandler) {
    window.removeEventListener('keydown', keydownHandler, true);
  }
  if (keyupHandler) {
    window.removeEventListener('keyup', keyupHandler, true);
  }
  if (clickHandler) {
    document.removeEventListener('click', clickHandler, true);
  }
  keydownHandler = null;
  keyupHandler = null;
  clickHandler = null;
  inputEl = null;
  sendEl = null;
  removeActiveBadge();
}

/* ── Read prompt from ProseMirror/Quill/Textarea ────────── */
function getPromptText() {
  if (!inputEl) return '';
  if (inputEl.tagName === 'TEXTAREA') {
    return inputEl.value || '';
  }
  return inputEl.textContent || '';
}

/* ── Clear ProseMirror/Quill/Textarea content ───────────── */
function clearPrompt() {
  if (!inputEl) return;
  if (inputEl.tagName === 'TEXTAREA') {
    inputEl.value = '';
  } else {
    const tool = getToolName();
    if (tool === 'Gemini') {
      inputEl.innerHTML = '';
    } else {
      inputEl.innerHTML = '<p><br></p>';
    }
  }
  // Dispatch events so React/ProseMirror/Quill/Textarea sync state
  inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}

/* ── Re-dispatch the send action ────────────────────────── */
function replaySend() {
  replaying = true;
  requestAnimationFrame(() => {
    const btn = document.querySelector(SELECTORS.sendButton);
    if (btn) btn.click();
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
  chrome.runtime.sendMessage({ type: 'CHECK_PROMPT', text, tool: getToolName() }, (response) => {
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
