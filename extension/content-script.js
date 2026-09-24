/**
 * Detects which AI tool the user is currently on by reading the hostname.
 * This label is sent alongside the prompt to the backend so the admin
 * dashboard can show "User sent to Gemini" vs "User sent to Claude", etc.
 */
function getToolName() {
  const host = window.location.hostname;
  if (host.includes('gemini')) return 'Gemini';
  if (host.includes('claude')) return 'Claude';
  if (host.includes('deepseek')) return 'DeepSeek';
  if (host.includes('copilot')) return 'Copilot';
  return 'ChatGPT';
}

/* ── API Base resolver ─────────────────────────────────────────────────────
 *  The extension popup lets admins configure which Pelta.ai backend to use
 *  (e.g. localhost for dev, or a production URL for deployment).
 *  We read that setting from chrome.storage.sync at startup so every API
 *  call in this script always hits the right backend.
 * ───────────────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'pelta_api_base';
const LOCAL_URL = 'http://localhost:3000';

// Default to localhost; overwritten by resolveApiBase() on init
let API_BASE = LOCAL_URL;

/**
 * Reads the user-configured backend URL from Chrome's synced storage.
 * Falls back to localhost:3000 if nothing is stored.
 * Called once at script init (non-blocking, async).
 */
async function resolveApiBase() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const stored = await new Promise((resolve) => {
        chrome.storage.sync.get(STORAGE_KEY, resolve);
      });
      API_BASE = stored[STORAGE_KEY] || LOCAL_URL;
    }
  } catch { }
}

/* ── DOM Selectors ────────────────────────────────────────────────────────────
 *  Each AI tool uses a completely different DOM structure for its chat input
 *  and send button. ChatGPT uses a <textarea>, Gemini uses a Quill editor
 *  (div.ql-editor), Claude uses ProseMirror (div.ProseMirror), etc.
 *
 *  These broad selector lists ensure we can locate the correct element on
 *  all supported platforms without needing separate codepaths per site.
 * ───────────────────────────────────────────────────────────────────────── */
const SELECTORS = {
  // Matches the text input area across ChatGPT, Gemini, Claude, DeepSeek, Copilot
  input: '#prompt-textarea, div.ql-editor[contenteditable="true"], div[contenteditable="true"].ProseMirror, div[contenteditable="true"][role="textbox"], textarea#chat-input, textarea[placeholder*="Ask"], textarea[placeholder*="DeepSeek"], textarea[aria-label*="Ask"], textarea, div[role="textbox"][contenteditable="true"]',
  // Matches the send/submit button across all supported tools
  sendButton: 'button[type="submit"], #composer-submit-button, [data-testid*="send" i], [aria-label*="send" i], [aria-label*="submit" i], [title*="send" i], [title*="submit" i], button[class*="send" i], .send-button, [id*="send-button" i], [id*="submit-button" i], form button:last-of-type, div[role="button"][data-testid*="send" i], button[aria-label*="Send"]',
};

/* ── Module-level state ──────────────────────────────────────────────────────
 *  These variables track the DOM elements we're controlling and the current
 *  guard state. They are module-scoped (not inside any function) so all
 *  handlers and helpers share the same references.
 * ───────────────────────────────────────────────────────────────────────── */
let inputEl = null;          // The currently active chat input element
let sendEl = null;           // The send button element
let reconnectObserver = null; // MutationObserver that re-acquires DOM elements after SPA navigation
let composerBound = null;    // The composer element currently wired up with input/drop listeners

/* ── Re-entrancy guard ────────────────────────────────────────────────────────
 *  When Pelta replays a safe/approved prompt back into the input and re-fires
 *  the send button, our own event listeners would normally intercept that
 *  replay and start another DLP check — causing an infinite loop.
 *  `replaying` is set to true during the replay window to skip interception.
 *  `isScanning` prevents a second submission while a check is in flight.
 * ───────────────────────────────────────────────────────────────────────── */
let replaying = false;
let isScanning = false;

/* ── One-shot approved text ───────────────────────────────────────────────────
 *  After the user edits and confirms a redacted prompt in the flag/block
 *  overlay, that exact text is stored here. The next time our intercept fires
 *  for that text we skip the backend check and let it through immediately.
 *  This prevents the user from getting stuck in an interception loop.
 * ───────────────────────────────────────────────────────────────────────── */
let approvedText = null;
// Normalise whitespace before comparing approved text so minor editor
// formatting differences don't cause a mismatch and re-trigger the guard.
const normApproved = (s) => (s || '').trim().replace(/\s+/g, ' ');

/* ── OCR engine detection ─────────────────────────────────────────────────────
 *  When a user pastes or drops an image/PDF into a chat, we need to extract
 *  its text before running the DLP check. We support two OCR engines:
 *
 *    1. Gemini Nano  — Chrome's built-in on-device AI (Chrome 128+ with flag).
 *                      Preferred because it's fast, free, and the image data
 *                      NEVER leaves the user's machine.
 *
 *    2. Tesseract.js — Fallback. We send the image as base64 to our own
 *                      localhost backend (/api/guard/ocr), which runs
 *                      Gemini Vision API server-side. Still within our system.
 *
 *  `nanoAvailable` is set once at startup and read by the OCR pipeline.
 * ───────────────────────────────────────────────────────────────────────── */
let nanoAvailable = false;

/**
 * Probes whether Chrome's Prompt API (window.ai.languageModel) is available
 * and ready. This is an experimental Chrome flag feature that exposes
 * Gemini Nano as an in-browser AI model for tasks like OCR.
 */
async function detectOcrEngine() {
  try {
    if (window.ai?.languageModel) {
      const caps = await window.ai.languageModel.capabilities();
      nanoAvailable = caps.available !== 'no';
    }
  } catch {
    nanoAvailable = false;
  }
  console.log(`[pelta] OCR engine: ${nanoAvailable ? 'Gemini Nano (on-device)' : 'Tesseract.js (WASM fallback)'}`);
}

/* ── OCR helper functions ─────────────────────────────────────────────────── */

/*
 * Converts a Blob (image file) into a base64 data URL string
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Runs OCR using Chrome's on-device Gemini Nano via the experimental
 * window.ai.languageModel API. The image is converted to a data URL and
 * sent as a multimodal prompt — the model returns the extracted text.
 *
 * If the installed Nano model doesn't support vision (text-only build),
 * we throw 'nano-no-vision' so the caller can fall back to Tesseract.
 *
 * PRIVACY: No data leaves the browser — Nano runs 100% on-device.
 */
async function ocrWithNano(blob) {
  const dataUrl = await blobToDataUrl(blob);
  // Chrome Prompt API — try multimodal, fall back gracefully if model is text-only
  const session = await window.ai.languageModel.create({
    systemPrompt:
      'You are an OCR tool. Extract ALL visible text from the image exactly as it appears. ' +
      'Return only the raw extracted text with no commentary, formatting, or markdown.',
  });
  let result;
  try {
    // Multimodal format (Chrome 128+ with vision flag)
    result = await session.prompt([
      {
        role: 'user', content: [
          { type: 'image', image: dataUrl },
          { type: 'text', text: 'Extract all text from this image verbatim.' },
        ]
      },
    ]);
  } catch {
    // This Nano build doesn't support vision — signal the caller to use Tesseract
    console.warn('[pelta] Nano vision not available, falling back to Tesseract');
    session.destroy();
    throw new Error('nano-no-vision');
  }
  session.destroy();
  return result.trim();
}

/**
 * Fallback OCR path. Instead of running Tesseract in the browser (which has
 * WASM worker and memory issues in a content-script context), we send the
 * raw base64 image to our own Next.js backend at /api/guard/ocr.
 * The backend uses the Gemini Vision API server-side to extract the text.
 *
 * PRIVACY: The image is sent to localhost (our own server), not to the AI
 * tool the user is chatting on. Still within the Pelta.ai trust boundary.
 */
async function ocrWithTesseract(blob) {
  // Send to our localhost backend — Node.js, no WASM/Worker issues in content scripts.
  // Image stays within our own system (localhost = zero leakage to third-party AI).
  const dataUrl = await blobToDataUrl(blob);
  const base64 = dataUrl.split(',')[1]; // strip the "data:image/png;base64," prefix

  // 15 s timeout — Gemini Vision API typically responds in 1-3 s
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE}/api/guard/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType: blob.type }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OCR backend error ${response.status}: ${err.detail || err.error || ''}`);
    }

    const { text } = await response.json();
    return (text || '').trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Top-level OCR dispatcher. Uses Gemini Nano if available (faster, on-device),
 * otherwise falls back to the server-side Tesseract/Gemini Vision path.
 */
async function extractTextFromImage(blob) {
  if (nanoAvailable) {
    return await ocrWithNano(blob);
  }
  return await ocrWithTesseract(blob);
}

/**
 * Full pipeline for a single pasted or dropped image:
 *   1. Lock the send button so the user can't submit while scanning
 *   2. Show the "reading image..." overlay
 *   3. Run OCR to extract text from the image
 *   4. If text was found, hand it to startCheck() for DLP inspection
 *
 * If OCR fails (network error, model unavailable) we unlock and show an error
 * rather than silently letting the image through unscanned.
 */
async function runImageDlpCheck(blob, filename) {
  lockSendButton();
  const engine = nanoAvailable ? 'Gemini Nano' : 'Tesseract.js';
  console.log(`[pelta] Image detected — starting OCR with ${engine}`);
  showOcrScanning(engine);
  try {
    let extractedText;
    if (nanoAvailable) {
      try {
        extractedText = await ocrWithNano(blob);
      } catch (nanoErr) {
        console.warn('[pelta] Nano OCR failed, falling back to Tesseract:', nanoErr.message);
        extractedText = await ocrWithTesseract(blob);
      }
    } else {
      extractedText = await ocrWithTesseract(blob);
    }
    console.log(`[pelta] OCR extracted ${extractedText.length} chars:`, extractedText.slice(0, 80));
    if (!extractedText || !extractedText.trim()) {
      unlockSendButton();
      showOcrNoText();
      return;
    }
    startCheck(extractedText, 'paste-image', { filename: filename || null });
  } catch (err) {
    unlockSendButton();
    console.error('[pelta] OCR pipeline failed:', err);
    showError('Image scan failed. Please type your prompt instead.');
  }
}

/**
 * Same as runImageDlpCheck but handles multiple images pasted at once.
 * Each image is OCR'd sequentially and their extracted texts are joined
 * with a separator before being sent as a single DLP check.
 */
async function runBatchImageDlpCheck(blobs) {
  lockSendButton();
  const engine = nanoAvailable ? 'Gemini Nano' : 'Tesseract.js';
  console.log(`[pelta] Batch images detected (${blobs.length}) — starting OCR with ${engine}`);
  showOcrScanning(engine);
  try {
    const texts = [];
    for (const blob of blobs) {
      let text;
      if (nanoAvailable) {
        try {
          text = await ocrWithNano(blob);
        } catch (err) {
          text = await ocrWithTesseract(blob);
        }
      } else {
        text = await ocrWithTesseract(blob);
      }
      if (text && text.trim()) texts.push(text.trim());
    }
    const combined = texts.join('\n\n---\n\n').trim();
    if (!combined) {
      unlockSendButton();
      showOcrNoText();
      return;
    }
    startCheck(combined, 'paste-image', { filename: `${blobs.length} images` });
  } catch (err) {
    unlockSendButton();
    console.error('[pelta] OCR batch pipeline failed:', err);
    showError('Image scan failed. Please type your prompt instead.');
  }
}

/**
 * Pipeline for a dropped or uploaded PDF file:
 *   1. Convert the PDF to base64 and send to /api/guard/pdf-extract
 *   2. The backend uses pdf.js to extract all text across all pages
 *   3. The combined text is then passed to startCheck() for DLP inspection
 *
 * Page count is passed through so the overlay can show "X pages scanned".
 */
async function runPdfDlpCheck(file) {
  lockSendButton();
  showOcrScanning('pdf.js');
  try {
    const base64 = await toBase64(file);
    const res = await fetch(`${API_BASE}/api/guard/pdf-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: base64.split(',')[1], filename: file.name })
    });
    if (!res.ok) throw new Error('PDF extraction failed');
    const { text, pageCount, filename } = await res.json();

    if (!text || !text.trim()) {
      unlockSendButton();
      showOcrNoText(true);
      return;
    }
    startCheck(text, 'paste-pdf', { filename: filename || null, pageCount });
  } catch (err) {
    unlockSendButton();
    console.error('[pelta] PDF pipeline failed:', err);
    showError('PDF scan failed. Please type your prompt instead.');
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/* ── Visual Active Badge ─────────────────────────────────────────────────────
 *  A small pill in the bottom-right corner of every AI chat page that shows
 *  "pelta.ai active" with a pulsing green dot. Lets the user know the
 *  extension is running and intercepting prompts on this tab.
 *  Removed automatically if the extension detaches (e.g. page unload).
 * ───────────────────────────────────────────────────────────────────────── */
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

/* ── Inline Status Badge ─────────────────────────────────────────────────────
 *  A second badge that sits above the active badge and reflects the current
 *  DLP state in real time. It cycles through these states:
 *
 *    clean    → user is typing, nothing suspicious detected yet
 *    caution  → medium-severity keywords found while typing (client-side scan)
 *    risky    → high-severity match found while typing (e.g. email, API key)
 *    scanning → prompt intercepted, waiting for backend verdict
 *    safe     → backend returned 'allow', message sent
 *    flag     → backend returned 'flag', overlay shown
 *    blocked  → backend returned 'block', overlay shown
 *    error    → backend unreachable or extension error
 * ───────────────────────────────────────────────────────────────────────── */
const STATUS_STATES = {
  scanning: { bg: '#18181b', border: '#c9922a', color: '#fbbf24', icon: '&#9203;' },
  safe: { bg: '#052e16', border: '#22c55e', color: '#4ade80', icon: '&#10003;' },
  flag: { bg: '#1c1917', border: '#f59e0b', color: '#fbbf24', icon: '&#9888;' },
  blocked: { bg: '#1a0e0e', border: '#ef4444', color: '#f87171', icon: '&#10007;' },
  error: { bg: '#18181b', border: '#f97316', color: '#fb923c', icon: '&#9888;' },
  clean: { bg: '#18181b', border: '#27272a', color: '#9e9b94', icon: '&#9670;' },
  caution: { bg: '#1c1917', border: '#a16207', color: '#facc15', icon: '&#9670;' },
  risky: { bg: '#1a0e0e', border: '#991b1b', color: '#fca5a5', icon: '&#9670;' },
};

function showStatusBadge(state, text) {
  const s = STATUS_STATES[state] || STATUS_STATES.clean;
  let badge = document.getElementById('pelta-status-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'pelta-status-badge';
    document.body.appendChild(badge);
  }
  badge.style.cssText = `
    position: fixed; bottom: 75px; right: 12px; z-index: 999999;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 11px; border-radius: 6px;
    background: ${s.bg}; border: 1px solid ${s.border};
    color: ${s.color};
    font-family: monospace; font-size: 10px; font-weight: 500;
    box-shadow: 0 4px 14px rgba(0,0,0,0.45);
    pointer-events: none;
    opacity: 1; transition: opacity 0.2s ease;
  `;
  badge.innerHTML = `<span style="color:${s.color}">${s.icon}</span><span>pelta.ai ${text}</span>`;
}

function removeStatusBadge() {
  const badge = document.getElementById('pelta-status-badge');
  if (badge) {
    badge.style.opacity = '0';
    setTimeout(() => { if (badge.parentNode) badge.remove(); }, 250);
  }
}

/* ── Inline (client-side) real-time scan ─────────────────────────────────────
 *  As the user types, we run a lightweight regex scan in the browser — no
 *  network call, no latency. This gives instant visual feedback via the
 *  status badge (clean / caution / risky) while the user is composing.
 *
 *  This is NOT the authoritative DLP check — that happens server-side when
 *  the user submits. This is purely a UX signal to warn early.
 * ───────────────────────────────────────────────────────────────────────── */

// High-severity patterns: a single match here turns the badge red immediately.
// These are structural patterns with very low false-positive rates.
const INLINE_REGEX = [
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi, label: 'email', severity: 'high' },
  { pattern: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, label: 'ssn', severity: 'high' },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: 'phone', severity: 'high' },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, label: 'credit-card', severity: 'high' },
  { pattern: /\b(sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|ghp_[a-zA-Z0-9]{20,})\b/g, label: 'api-key', severity: 'high' },
];

// Medium-severity keyword groups: two or more of these triggers 'caution' badge.
// Individual keyword hits produce a 'clean — 1 keyword' badge (informational only).
const INLINE_FINANCIAL = /\b(revenue|salary|payroll|budget|financial|compensation|pipeline|q[1-4]\s\d{4}|quarterly|forecast|profit|loss)\b/i;
const INLINE_CONFIDENTIAL = /\b(confidential|internal|proprietary|nda|trade\s?secret|restricted|sensitive|classified)\b/i;
const INLINE_SOURCE = /\b(function|class|import\s|require\s|export\s|public\skey|private\skey|api[\s_-]?key|endpoint|git\s|commit|pull\s?request|interface|async|await|token)\b/i;
const INLINE_PII = /\b(first\s?name|last\s?name|date\s?of\s?birth|passport|social\s?security|maiden\s?name|address|zip\s?code)\b/i;

let inlineDebounce = null;
let inputHandler = null;

/**
 * Runs the client-side inline DLP scan. Called on every input event
 * (debounced at 500ms) and updates the status badge in real time.
 *
 * Scoring logic:
 *   - Any high-severity regex match → badge turns red ('risky')
 *   - 2+ medium-severity keyword hits → badge turns yellow ('caution')
 *   - 1 medium hit → badge stays green but notes '1 keyword'
 *   - Nothing found → badge stays green ('clean')
 */
function inlineScan(text) {
  if (!text || !text.trim()) {
    showStatusBadge('clean', 'clean');
    return;
  }
  let highCount = 0;
  let mediumCount = 0;

  for (const rule of INLINE_REGEX) {
    const matches = text.match(rule.pattern);
    if (matches) {
      if (rule.severity === 'high') highCount += matches.length;
      else mediumCount += matches.length;
    }
  }

  if (INLINE_FINANCIAL.test(text)) mediumCount++;
  if (INLINE_CONFIDENTIAL.test(text)) mediumCount++;
  if (INLINE_SOURCE.test(text)) mediumCount++;
  if (INLINE_PII.test(text)) mediumCount++;

  if (highCount > 0) {
    showStatusBadge('risky', `risky (${highCount} match)`);
  } else if (mediumCount >= 2) {
    showStatusBadge('caution', `caution (${mediumCount} matches)`);
  } else if (mediumCount === 1) {
    showStatusBadge('clean', 'clean — 1 keyword');
  } else {
    showStatusBadge('clean', 'clean');
  }
}

inputHandler = () => {
  if (replaying || isScanning) return;
  if (inlineDebounce) clearTimeout(inlineDebounce);
  inlineDebounce = setTimeout(() => {
    const text = getPromptText();
    inlineScan(text);
  }, 500);
};

/* ── Bootstrap / DOM acquisition ────────────────────────────────────────── */
/**
 * Reads the current text from the active chat input.
 * Must handle both <textarea> (value property) and contenteditable divs
 * (ProseMirror / Quill / Gemini) which use innerText / textContent.
 */
function getPromptText() {
  if (!inputEl) return '';
  if (inputEl.tagName === 'TEXTAREA') return inputEl.value;
  return inputEl.innerText || inputEl.textContent || '';
}

/**
 * Checks if a given DOM element is the visible, active chat composer.
 * SPA frameworks like React/Next.js frequently unmount and remount the
 * composer on navigation, so we can't just check the reference once.
 * We verify: still in the DOM, matches our selectors, and is actually visible.
 */
function isComposerVisible(v) {
  if (!v || !document.contains(v)) return false;
  try {
    if (!v.matches(SELECTORS.input)) return false;
    const cs = window.getComputedStyle(v);
    return v.offsetHeight > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  } catch {
    return false;
  }
}

/**
 * Attaches input/drop listeners directly to the composer element.
 * Called every time we (re-)acquire the composer, because SPA route changes
 * can unmount the old element and mount a fresh one with the same selector.
 * We first remove listeners from the previously bound element to avoid leaks.
 */
function bindComposer(el) {
  if (composerBound === el) return; // Already bound to this exact element node
  if (composerBound) {
    // Clean up listeners from the old (now detached) composer element
    composerBound.removeEventListener('input', inputHandler, false);
    composerBound.removeEventListener('dragover', dragOverHandler, false);
    composerBound.removeEventListener('drop', dropHandler, false);
  }
  composerBound = el;
  if (el && inputHandler) {
    el.addEventListener('input', inputHandler, false);    // real-time inline scan
    el.addEventListener('dragover', dragOverHandler, false); // intercept file drags
    el.addEventListener('drop', dropHandler, false);        // intercept file drops
  }
}

/**
 * Scans the DOM for the active chat composer and send button, then wires up
 * all event listeners. Called on page load and after SPA navigations.
 *
 * Returns true if a composer was found, false if the page isn't ready yet
 * (in which case watchForMount() will retry via MutationObserver).
 */
function acquire() {
  const inputs = Array.from(document.querySelectorAll(SELECTORS.input));
  // Prefer the first visible, non-hidden element; fall back to any match
  inputEl = inputs.find((el) => isComposerVisible(el))
    || inputs.find((el) => el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none')
    || inputs[0];

  if (inputEl) {
    attachListeners();
    bindComposer(inputEl); // re-bind even on re-acquire (new node)
    showActiveBadge();
    return true;
  }
  return false;
}

/**
 * Sets up a MutationObserver on document.body to watch for SPA route changes.
 * AI chat apps (especially ChatGPT and Gemini) are React SPAs that tear down
 * and rebuild the entire chat composer on every new conversation. Without
 * this observer, our listeners would be bound to a detached ghost element.
 *
 * When we detect the composer has been removed from the DOM, we detach old
 * listeners and call acquire() to find the newly mounted composer.
 */
function watchForMount() {
  if (reconnectObserver) reconnectObserver.disconnect();
  reconnectObserver = new MutationObserver(() => {
    if (!inputEl || !document.contains(inputEl)) {
      detachListeners();
      if (acquire()) console.log('[pelta] re-acquired chat elements after SPA navigation');
    }
    // Also re-acquire sendEl if the button was replaced during re-render
    if (!sendEl || !document.contains(sendEl)) {
      sendEl = document.querySelector(SELECTORS.sendButton);
    }
  });
  reconnectObserver.observe(document.body, { childList: true, subtree: true });
}

/* ── Event handler references ─────────────────────────────────────────────────
 *  We store handler functions in variables so we can remove the exact same
 *  function reference later in detachListeners(). Arrow function literals
 *  can't be removed with removeEventListener — named references are required.
 * ───────────────────────────────────────────────────────────────────────── */
let keydownHandler = null;    // Intercepts Enter key send
let keyupHandler = null;      // Cleans up after Enter interception
let clickHandler = null;      // Intercepts send button clicks
let pasteHandler = null;      // Intercepts image pastes from clipboard
let dropHandler = null;       // Intercepts file drops onto the composer
let dragOverHandler = null;   // Prevents default dragover so we can handle drops
let fileInputHandler = null;  // Intercepts the file picker (upload button)
let escapeHandler = null;     // Allows Escape key to dismiss the Pelta overlay
let keypressHandler = null;   // Suppresses Enter keypress events during interception
let submitHandler = null;     // Catches any form submit events as a last resort

// Tracks whether we ate an Enter keydown so keyup/keypress handlers know to also suppress it
let interceptedEnter = false;

/* ── Global capture-phase handlers ───────────────────────────────────────────
 *  We register these at window level with useCapture=true so they fire BEFORE
 *  the AI tool's own React/event handlers. This is critical — if the host app
 *  sees the Enter key first, it will submit the prompt before we can intercept.
 *
 *  These global wrappers delegate to the real handlers (assigned inside
 *  attachListeners) so they can be safely removed/replaced without touching
 *  the window-level registrations.
 * ───────────────────────────────────────────────────────────────────────── */
const globalKeydownHandler = (e) => {
  if (keydownHandler) keydownHandler(e);
};
const globalKeyupHandler = (e) => {
  if (keyupHandler) keyupHandler(e);
};
const globalKeypressHandler = (e) => {
  if (keypressHandler) keypressHandler(e);
};
/**
 * Blanket suppressor for beforeinput and submit events while an overlay is
 * open or an Enter interception is active. We carve out an exception for
 * events targeting the Pelta overlay's own textarea so the user can still
 * edit the redacted prompt.
 */
const globalOtherHandler = (e) => {
  if (interceptedEnter || document.getElementById('pelta-overlay')) {
    const overlay = document.getElementById('pelta-overlay');
    // Let the user type inside the redact textarea — only block the host app
    if (overlay && e.target && overlay.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
};

// Register at window level with capture=true so we fire before host app handlers
window.addEventListener('keydown', globalKeydownHandler, true);
window.addEventListener('keyup', globalKeyupHandler, true);
window.addEventListener('keypress', globalKeypressHandler, true);
window.addEventListener('beforeinput', globalOtherHandler, true);
window.addEventListener('submit', globalOtherHandler, true);

/**
 * Wires up all interception event listeners. Called once per composer acquire.
 * Guard-checked with early return so we never double-attach.
 *
 * Interception strategy per event type:
 *  - keydown  : detect Enter/Ctrl+Enter send intent, immediately clear input
 *               to prevent the host app from seeing the text, call startCheck
 *  - click    : same but triggered by clicking the send button
 *  - submit   : last-resort catch for any form submit the above two missed
 *  - paste    : intercept image data from clipboard for OCR scanning
 *  - drop     : intercept image/PDF file drops for OCR scanning
 *  - change   : intercept file picker uploads (the upload button)
 */
function attachListeners() {
  if (keydownHandler || clickHandler || pasteHandler) return; // already attached

  /* ── Escape to dismiss overlay ── */
  escapeHandler = (e) => {
    if (e.key !== 'Escape') return;
    const overlay = document.getElementById('pelta-overlay');
    if (!overlay) return;
    e.preventDefault();
    e.stopPropagation();
    removeOverlay();
    unlockSendButton();
  };
  window.addEventListener('keydown', escapeHandler, true);

  keydownHandler = (e) => {
    // Block Enter key if overlay is open (unless typing inside the overlay's textarea)
    const overlay = document.getElementById('pelta-overlay');
    if (overlay && e.key === 'Enter') {
      if (!overlay.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        interceptedEnter = true;
        return;
      }
    }

    // Detect send intent: plain Enter (no Shift) OR Ctrl/Cmd+Enter
    // Shift+Enter = newline, isComposing = IME composition in progress (don't intercept)
    const isSendKey =
      (e.key === 'Enter' && !e.shiftKey && !e.isComposing) ||
      ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.isComposing);
    if (!isSendKey || replaying) return;

    if (!inputEl || (!inputEl.contains(e.target) && e.target !== inputEl)) {
      // Dynamic fallback: if the user is pressing Enter in any editable field
      // that doesn't match our stored inputEl (can happen after a re-render),
      // adopt that field as the current composer on the fly.
      const isEditable = e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || e.target.closest('[contenteditable="true"]');
      if (isEditable) {
        inputEl = e.target.tagName === 'TEXTAREA' ? e.target : e.target.closest('[contenteditable="true"]') || e.target;
      } else {
        return; // Not a composer — ignore this Enter key
      }
    }
    const text = getPromptText();
    if (!text || !text.trim()) return; // Empty input — nothing to intercept

    // One-shot bypass: if the text exactly matches the pre-approved redacted
    // prompt, let the host app send it without re-running the DLP check.
    if (approvedText && normApproved(text) === normApproved(approvedText)) {
      approvedText = null;
      showAllowToast();
      replaying = true;
      setTimeout(() => { replaying = false; }, 600);
      return;
    }
    approvedText = null;

    lockSendButton();

    // Prevent the host app's Enter handler from ever seeing this event.
    // We rely on capture-phase stopImmediatePropagation — we do NOT clear the
    // input here because doing so and then restoring it via typeIntoInput breaks
    // React's controlled component state and causes form.requestSubmit() to
    // submit an empty form, corrupting the ChatGPT input completely.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    interceptedEnter = true; // Signal keyup/keypress handlers to also suppress this key
    startCheck(text, 'keydown');
  };

  clickHandler = (e) => {
    if (replaying) return;
    const btn = e.target.closest(SELECTORS.sendButton);
    if (!btn) return;

    const text = getPromptText();
    if (!text || !text.trim()) return;

    // One-shot bypass: the confirmed rewrite is pre-approved — let the click reach the host app
    if (approvedText && normApproved(text) === normApproved(approvedText)) {
      approvedText = null;
      showAllowToast();
      replaying = true;
      setTimeout(() => { replaying = false; }, 600);
      return;
    }
    approvedText = null;

    lockSendButton();

    // Suppress the click from reaching the host app — text stays in the input.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    startCheck(text, 'click');
  };

  keyupHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !replaying && !e.isComposing) {
      if (interceptedEnter) {
        interceptedEnter = false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      if (!inputEl || (!inputEl.contains(e.target) && e.target !== inputEl)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  keypressHandler = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !replaying && !e.isComposing) {
      if (interceptedEnter) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      if (!inputEl || (!inputEl.contains(e.target) && e.target !== inputEl)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };

  submitHandler = (e) => {
    if (replaying || isScanning) return;
    const text = getPromptText();
    if (!text || !text.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    lockSendButton();
    // Do NOT clear the input — see keydownHandler comment for the reason.
    startCheck(text, 'form-submit');
  };

  pasteHandler = async (e) => {
    if (replaying) return;
    const items = Array.from(e.clipboardData?.items || []);
    console.log('[pelta] paste event — items:', items.map(i => i.type));
    const imageItems = items.filter((i) => i.type.startsWith('image/'));
    if (!imageItems.length) return;
    console.log(`[pelta] ${imageItems.length} image(s) paste intercepted`);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const blobs = imageItems.map(i => i.getAsFile());
    if (blobs.length === 1) {
      await runImageDlpCheck(blobs[0], null);
    } else {
      await runBatchImageDlpCheck(blobs);
    }
  };

  dragOverHandler = (e) => {
    const hasImage = Array.from(e.dataTransfer?.items || [])
      .some((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (hasImage) e.preventDefault();
  };

  dropHandler = async (e) => {
    if (replaying) return;
    const files = Array.from(e.dataTransfer?.files || []);
    const pdfFile = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (!pdfFile && !imageFile) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (pdfFile) {
      await runPdfDlpCheck(pdfFile);
    } else {
      await runImageDlpCheck(imageFile, imageFile.name);
    }
  };

  fileInputHandler = async (e) => {
    const target = e.target;
    if (target.tagName !== 'INPUT' || target.type !== 'file') return;
    const files = Array.from(target.files || []);
    const pdfFile = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (!pdfFile && !imageFile) return;

    console.log('[pelta] file input upload intercepted:', (pdfFile || imageFile).name, (pdfFile || imageFile).type);

    // Stop Gemini's own change handler from processing the file
    e.stopImmediatePropagation();

    // Clear the file input so Gemini can't read the file
    target.value = '';

    if (pdfFile) {
      await runPdfDlpCheck(pdfFile);
    } else {
      await runImageDlpCheck(imageFile, imageFile.name);
    }
  };

  document.addEventListener('click', clickHandler, true);
  document.addEventListener('mousedown', clickHandler, true);
  document.addEventListener('pointerdown', clickHandler, true);
  window.addEventListener('paste', pasteHandler, true);
  document.addEventListener('change', fileInputHandler, true);
  document.addEventListener('submit', submitHandler, true);
  document.addEventListener('dragover', dragOverHandler, false);
  document.addEventListener('drop', dropHandler, false);
}

function detachListeners() {
  if (clickHandler) {
    document.removeEventListener('click', clickHandler, true);
    document.removeEventListener('mousedown', clickHandler, true);
    document.removeEventListener('pointerdown', clickHandler, true);
  }
  if (pasteHandler) {
    window.removeEventListener('paste', pasteHandler, true);
  }
  if (fileInputHandler) {
    document.removeEventListener('change', fileInputHandler, true);
  }
  if (escapeHandler) {
    window.removeEventListener('keydown', escapeHandler, true);
  }
  if (keypressHandler) {
    window.removeEventListener('keypress', keypressHandler, true);
  }
  if (submitHandler) {
    document.removeEventListener('submit', submitHandler, true);
  }
  if (inputHandler) {
    if (composerBound) composerBound.removeEventListener('input', inputHandler, false);
  }
  if (dragOverHandler) {
    document.removeEventListener('dragover', dragOverHandler, false);
    if (composerBound) composerBound.removeEventListener('dragover', dragOverHandler, false);
  }
  if (dropHandler) {
    document.removeEventListener('drop', dropHandler, false);
    if (composerBound) composerBound.removeEventListener('drop', dropHandler, false);
  }
  composerBound = null;
  keydownHandler = null;
  keyupHandler = null;
  clickHandler = null;
  pasteHandler = null;
  dropHandler = null;
  dragOverHandler = null;
  fileInputHandler = null;
  escapeHandler = null;
  submitHandler = null;
  inputHandler = null;
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

/* ── Re-dispatch the send action ────────────────────────────────────── */
function replaySend() {
  replaying = true;
  unlockSendButton();

  /**
   * Because we no longer clear the input during interception, the text is
   * already in the composer and React's send button is already enabled.
   * We just need to click the button. A short retry loop handles the rare
   * case where the button is momentarily in a transitional state.
   *
   * We deliberately do NOT use form.requestSubmit() here — calling it on
   * ChatGPT's form after programmatic input changes corrupts React's state
   * and freezes the entire input area.
   */
  function tryClick(attemptsLeft) {
    try {
      const btn = document.querySelector(SELECTORS.sendButton);
      const isEnabled = btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';

      if (isEnabled) {
        // Fire the full mouse event sequence so React's synthetic event system
        // and any pointer/click listeners on the button all receive the event.
        btn.focus();
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true }));
        btn.dispatchEvent(new MouseEvent('mousedown',     { bubbles: true, cancelable: true, composed: true }));
        btn.dispatchEvent(new MouseEvent('mouseup',       { bubbles: true, cancelable: true, composed: true }));
        btn.dispatchEvent(new MouseEvent('click',         { bubbles: true, cancelable: true, composed: true }));
        btn.click();
        console.log('[pelta] replaySend: clicked send button ✓');
        setTimeout(() => { replaying = false; }, 400);

      } else if (attemptsLeft > 0) {
        // Button not ready yet — wait 50ms and retry
        setTimeout(() => tryClick(attemptsLeft - 1), 50);

      } else {
        // Last resort: synthesize Enter key sequence on the focused input.
        // This may not work on newest ChatGPT (isTrusted check) but works
        // on Claude, Gemini, DeepSeek, and older ChatGPT builds.
        console.warn('[pelta] replaySend: button never became enabled, falling back to Enter key');
        if (inputEl) {
          inputEl.focus();
          for (const type of ['keydown', 'keypress', 'keyup']) {
            inputEl.dispatchEvent(new KeyboardEvent(type, {
              key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
              bubbles: true, cancelable: true, composed: true,
            }));
          }
        }
        setTimeout(() => { replaying = false; }, 400);
      }
    } catch (err) {
      console.error('[pelta] replaySend error:', err);
      setTimeout(() => { replaying = false; }, 400);
    }
  }

  // Since the input was never cleared, the button should already be enabled.
  // Start almost immediately — 30ms is enough for one React render cycle.
  setTimeout(() => tryClick(6), 30);
}

/* ── Send button lock / unlock ───────────────────────────────────────────────
 *  While a DLP check is in flight we disable the send button visually and
 *  functionally. This prevents the user from double-submitting and also
 *  provides a clear UX signal that something is happening.
 *
 *  We use a `data-pelta-locked` attribute as a guard so we only lock once
 *  even if lockSendButton() is called multiple times.
 * ───────────────────────────────────────────────────────────────────────── */
function lockSendButton() {
  const btn = document.querySelector(SELECTORS.sendButton);
  if (!btn || btn.dataset.peltaLocked) return; // Already locked
  btn.dataset.peltaLocked = '1';
  btn.style.opacity = '0.35';        // Visual dimming
  btn.style.pointerEvents = 'none';  // Prevent clicks
  btn.style.transition = 'opacity 0.15s';
}

function unlockSendButton() {
  const btn = document.querySelector(SELECTORS.sendButton);
  if (!btn) return;
  delete btn.dataset.peltaLocked; // Clear our lock marker
  btn.style.opacity = '';         // Restore original opacity
  btn.style.pointerEvents = '';   // Re-enable clicks
}

/* ── Safe ✓ allow toast ───────────────────────────────────────────── */
function showAllowToast() {
  let toast = document.getElementById('pelta-allow-toast');
  if (toast) toast.remove();
  toast = document.createElement('div');
  toast.id = 'pelta-allow-toast';
  toast.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    <span>pelta.ai — no sensitive data detected</span>
  `;
  document.body.appendChild(toast);
  // Animate in
  requestAnimationFrame(() => toast.classList.add('pelta-toast-show'));
  // Animate out after 1.8 s
  setTimeout(() => {
    toast.classList.remove('pelta-toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 1800);
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
  approvedText = null;
  const el = document.getElementById('pelta-overlay');
  if (el) el.remove();
}

/* ── DLP Verification flow ───────────────────────────────────────────────────
 *  startCheck() is the central orchestrator. It is called by every interception
 *  handler (keydown, click, paste, drop, etc.) with the captured text.
 *
 *  Flow:
 *    1. Lock the send button and show 'scanning...' badge
 *    2. Send the text to the background script via chrome.runtime.sendMessage
 *    3. Background script forwards it to the Next.js backend (/api/guard/check)
 *    4. Backend runs regex scan → optional Gemini LLM → returns verdict
 *    5. Handle the three possible verdicts:
 *         allow  → replay the send action, show green toast
 *         flag   → show flag overlay with auto-redacted prompt + admin options
 *         block  → show block overlay, message does NOT get sent
 * ───────────────────────────────────────────────────────────────────────── */
function startCheck(text, trigger, meta = {}) {
  if (!text.trim()) {
    showStatusBadge('clean', 'nothing to scan');
    setTimeout(() => removeStatusBadge(), 2000);
    replaySend();
    return;
  }

  lockSendButton();
  isScanning = true;
  showStatusBadge('scanning', 'scanning...');
  showChecking(text);
  try {
    chrome.runtime.sendMessage({ type: 'CHECK_PROMPT', text, tool: getToolName(), trigger }, (response) => {
      if (chrome.runtime.lastError) {
        unlockSendButton();
        isScanning = false;
        showStatusBadge('error', 'check failed');
        showError(chrome.runtime.lastError.message || 'Extension error.');
        typeIntoInput(text);
        return;
      }
      unlockSendButton();
      isScanning = false;
      if (!response) {
        showStatusBadge('error', 'check failed');
        showError('No response from backend.');
        typeIntoInput(text);
        return;
      }
      if (response.error) {
        showStatusBadge('error', 'check failed');
        showError(response.error);
        typeIntoInput(text);
        return;
      }

      switch (response.verdict) {
        case 'allow':
          // Text is still in the input (we never cleared it), so we just need
          // to re-fire the send action. No typeIntoInput needed.
          removeOverlay();
          showAllowToast();
          showStatusBadge('safe', 'safe');
          setTimeout(() => removeStatusBadge(), 3000);
          replaySend();
          break;
        case 'flag': {
          // Clear the input NOW so the user sees the flag overlay has taken over.
          // We still have the original text in the `text` variable for the overlay.
          if (inputEl) {
            if (inputEl.tagName === 'TEXTAREA') inputEl.value = '';
            else inputEl.innerText = '';
            inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
          }
          showStatusBadge('flag', 'flag');
          showFlag(response, text, trigger, meta);
          break;
        }
        case 'block': {
          // Same — clear input and show block overlay.
          if (inputEl) {
            if (inputEl.tagName === 'TEXTAREA') inputEl.value = '';
            else inputEl.innerText = '';
            inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
          }
          showStatusBadge('blocked', 'blocked');
          showBlock(response, text, trigger, meta);
          break;
        }
        default:
          // Unknown verdict (future-proofing) — fail open and let it through
          removeOverlay();
          removeStatusBadge();
          replaySend();
      }
    });
  } catch (err) {
    unlockSendButton();
    isScanning = false;
    showStatusBadge('error', 'check failed');
    showError('Extension disconnected. Please reload the page.');
    typeIntoInput(text);
  }
}

/* ── Highlight & Redaction Utilities ────────────────────────────────────────
 *  These functions power the visual highlight overlay and auto-redaction in
 *  the flag/block modals. They work in two phases:
 *
 *    1. buildLocalHighlights(text) — runs regex patterns to locate sensitive
 *       character spans. Used as a fallback when the backend doesn't return
 *       span positions (e.g. LLM-only detections with no regex match).
 *
 *    2. buildRedactedText(text, highlights) — replaces each span with a
 *       label token like [Email 1] or [API key 1]. Works right-to-left
 *       through the string so earlier replacements don't shift later indices.
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Runs the inline regex patterns and keyword sets against the prompt text
 * and returns an array of character-span objects {start, end, pattern, severity}.
 * These spans drive both the visual highlighting and the auto-redaction.
 */
function buildLocalHighlights(text) {
  const spans = [];
  for (const rule of INLINE_REGEX) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, pattern: rule.label, severity: rule.severity || 'high' });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  // Keyword redaction for business-sensitive terms (LLM-only flags often have no regex spans)
  const keywordSets = [
    { re: /\b(revenue|salary|payroll|budget|financial|compensation|pipeline|quarterly|forecast|profit)\b/gi, label: 'Financial' },
    { re: /\b(confidential|internal|proprietary|nda|trade\s?secret|restricted|sensitive|classified)\b/gi, label: 'Confidential' },
    { re: /\b(password|credentials|ssn|passport|api[\s_-]?key|bearer|token)\b/gi, label: 'Secret' },
  ];
  for (const { re, label } of keywordSets) {
    let m;
    while ((m = re.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, pattern: label, severity: 'medium' });
    }
  }
  // Drop overlapping spans (keep earliest / longest)
  spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const cleaned = [];
  let lastEnd = -1;
  for (const s of spans) {
    if (s.start >= lastEnd) {
      cleaned.push(s);
      lastEnd = s.end;
    }
  }
  return cleaned;
}

/**
 * Takes the original prompt text and an array of sensitive spans, and
 * produces a redacted version where each sensitive value is replaced with
 * a placeholder like [Email 1], [API key 1], [Financial 2], etc.
 *
 * Deduplication: the same raw value always gets the same alias (e.g. the
 * same email appearing twice → [Email 1] both times, not [Email 2]).
 * Replacement is done right-to-left so index positions remain valid.
 */
function buildRedactedText(text, highlights) {
  const spans = (highlights && highlights.length > 0)
    ? highlights
    : buildLocalHighlights(text);
  if (!spans || spans.length === 0) return text;

  const aliasMap = new Map();
  const labelCounts = new Map();

  // First pass: assign aliases in order of appearance (left-to-right)
  const ascending = [...spans].sort((a, b) => a.start - b.start);
  for (const h of ascending) {
    const start = typeof h.start === 'number' ? h.start : h.index;
    const end = typeof h.end === 'number' ? h.end : (start + (h.match?.length || 0));
    if (start == null || end == null || start < 0 || end > text.length || start >= end) continue;
    const raw = text.slice(start, end);
    if (!raw || aliasMap.has(raw)) continue;
    const label = h.pattern || h.label || 'Secret';
    const count = (labelCounts.get(label) || 0) + 1;
    labelCounts.set(label, count);
    aliasMap.set(raw, `[${label} ${count}]`);
  }

  // Second pass: replace text from right-to-left to keep indices valid
  const sorted = [...spans]
    .map((h) => ({
      start: typeof h.start === 'number' ? h.start : h.index,
      end: typeof h.end === 'number' ? h.end : ((typeof h.start === 'number' ? h.start : h.index) + (h.match?.length || 0)),
    }))
    .filter((h) => h.start != null && h.end != null && h.start >= 0 && h.end <= text.length && h.start < h.end)
    .sort((a, b) => b.start - a.start);

  let redacted = text;
  for (const h of sorted) {
    const raw = text.slice(h.start, h.end);
    const alias = aliasMap.get(raw);
    if (!alias) continue;
    redacted = redacted.slice(0, h.start) + alias + redacted.slice(h.end);
  }
  return redacted;
}

/* ── Safe text insertion into the chat composer ──────────────────────────────
 *  After Pelta intercepts and clears the prompt, it eventually needs to put
 *  text back (either the original for 'allow', or the redacted version for
 *  confirmed flag/block). This is surprisingly difficult because:
 *
 *    - ChatGPT uses React controlled inputs — setting .value directly doesn't
 *      update React's internal state. We must use the prototype setter.
 *    - Gemini uses a Quill editor — we must use execCommand('insertText') or
 *      manipulate the DOM directly and fire an InputEvent.
 *    - Claude uses ProseMirror — similar to Gemini.
 *
 *  insertIntoComposer() tries three strategies in order:
 *    1. React textarea: property descriptor setter
 *    2. contenteditable: document.execCommand('insertText') — fires all
 *       the right React synthetic events
 *    3. Manual fallback: clear DOM + insert text node + dispatch InputEvent
 * ─────────────────────────────────────────────────────────────────────────── */
function insertIntoComposer(el, value) {
  if (el.tagName === 'TEXTAREA') {
    // Bypass React's synthetic value tracker
    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  // contenteditable (ProseMirror / Quill / Gemini)
  el.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
  // Preferred path — most editors listen for beforeinput/insertText
  let ok = false;
  try {
    ok = document.execCommand('insertText', false, value);
  } catch (_) {
    ok = false;
  }
  if (ok) return true;
  // Manual fallback: clear then insert a plain text node + fire InputEvent
  while (el.firstChild) el.removeChild(el.firstChild);
  const tool = getToolName();
  if (tool === 'Gemini') {
    el.textContent = value;
  } else {
    const p = document.createElement('p');
    p.textContent = value || '\u200b';
    el.appendChild(p);
  }
  el.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: value,
  }));
  return true;
}

function typeIntoInput(text) {
  const value = text ?? '';
  // Always target the visible composer — a stale/hidden node from a prior
  // remount is the #1 cause of "text never appears" on ChatGPT.
  if (!isComposerVisible(inputEl)) {
    acquire();
  }
  if (!inputEl) {
    console.warn('[pelta] typeIntoInput: no composer found');
    return;
  }

  insertIntoComposer(inputEl, value);
  inputEl.focus();

  if (normApproved(getPromptText()) !== normApproved(value)) {
    console.warn('[pelta] typeIntoInput: insert not verified, re-acquiring and retrying');
    acquire();
    if (inputEl) {
      insertIntoComposer(inputEl, value);
      inputEl.focus();
      if (normApproved(getPromptText()) !== normApproved(value)) {
        console.error('[pelta] typeIntoInput: FINAL mismatch.', { target: value, actual: getPromptText() });
      } else {
        console.log('[pelta] typeIntoInput: verified after retry');
      }
    }
  } else {
    console.log('[pelta] typeIntoInput: verified ok');
  }
}

/* ── Prompt highlight HTML builder ──────────────────────────────────────────
 *  Converts the backend's array of sensitive spans into an HTML string
 *  with <span class="pelta-hl pelta-hl-high"> wrapping each flagged portion.
 *  This HTML is rendered inside the flag/block overlay to show the user
 *  exactly which parts of their prompt were detected as sensitive.
 * ─────────────────────────────────────────────────────────────────────────── */
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

/* ── Overlay UI variants ──────────────────────────────────────────────────────
 *  All overlays are rendered directly onto the AI chat page as a fixed-position
 *  layer (z-index 999999) so they appear above the chat UI without an iframe.
 *
 *  Variants:
 *    showChecking()    — spinner shown while backend check is in progress
 *    showOcrScanning() — shown while OCR is extracting text from image/PDF
 *    showOcrNoText()   — shown when OCR completes but finds no text (auto-dismiss)
 *    showFlag()        — medium/high risk: editable redacted prompt + action buttons
 *    showBlock()       — high risk: hard block with report false positive option
 *    showError()       — backend unreachable or extension error
 * ───────────────────────────────────────────────────────────────────────── */

/** Scanning spinner — shown immediately when the user hits send. */
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

function showOcrScanning(engine) {
  const el = createOverlay();
  el.className = 'ocr-scanning';
  const isPdf = engine === 'pdf.js';
  const actionText = isPdf ? 'reading PDF' : 'reading image';
  el.innerHTML = `
    <div class="pelta-label">
      <span class="pelta-scan-bar"></span>
      <span>pelta.ai — ${actionText} with ${engine}...</span>
    </div>
    <div class="pelta-ocr-sub">Processing locally · no data leaves your device · first scan may take a few seconds</div>
  `;
}

function showOcrNoText(isPdf = false) {
  const el = createOverlay();
  el.className = 'ocr-no-text';
  const itemText = isPdf ? 'PDF' : 'image';
  el.innerHTML = `
    <div class="pelta-label">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      <span>No sensitive text detected in ${itemText}</span>
    </div>
    <div class="pelta-ocr-sub">${itemText.charAt(0).toUpperCase() + itemText.slice(1)} scanned locally — safe to paste</div>
  `;
  // Auto-dismiss after 2.5 s
  setTimeout(() => {
    const overlay = document.getElementById('pelta-overlay');
    if (overlay && overlay.className === 'ocr-no-text') removeOverlay();
  }, 2500);
}

/**
 * Flag overlay — shown when the backend returns verdict 'flag'.
 * Presents the user with three options:
 *   1. "Confirm Anonymized & Send"  — edit the auto-redacted prompt and send it
 *   2. "Request Admin Approval"     — sends an access request and polls for
 *                                     admin decision every 2 seconds; auto-sends
 *                                     if approved, shows rejection message if denied
 *   3. "Cancel"                     — restores original text, dismisses overlay
 *
 * Also handles the 'paste-image' and 'paste-pdf' trigger types, in which case
 * we show the extracted OCR text with an image/PDF source badge instead of the
 * raw prompt preview (since there's no prompt text to show).
 */
function showFlag(response, promptText, trigger, meta = {}) {
  const isImage = trigger === 'paste-image';
  const isPdf = trigger === 'paste-pdf';
  const isUpload = isImage || isPdf;
  const el = createOverlay();
  el.className = 'flag';
  const promptHtml = buildHighlightedPrompt(promptText, response.highlights);
  const promptLabel = isUpload
    ? (isPdf ? 'Extracted from PDF (highlighted)' : 'Extracted from image · OCR (highlighted)')
    : 'Submitted Prompt (highlighted)';
  const sourceBadge = isUpload
    ? `<span class="pelta-ocr-badge">${isPdf ? '📄 pdf-upload' : '🖼️ image-upload'}</span>`
    : '';
  const sourceMetaExtra = isUpload
    ? `source: ${isPdf ? 'pdf-upload' : 'image-upload'} <span>·</span> engine: ${isPdf ? 'pdf.js' : 'gemini-vision'} <span>·</span> `
    : '';
  const fileBadge = meta.filename ? `<div class="pelta-file-name">📎 ${meta.filename}${meta.pageCount ? ` (${meta.pageCount} pages)` : ''}</div>` : '';
  const rewrittenText = response.rewrittenPrompt || buildRedactedText(promptText, response.highlights);
  el.innerHTML = `
    <div class="pelta-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
      Flagged — ${response.riskLevel} risk
    </div>
    <div class="pelta-reason">${response.reason || 'No reason provided.'}</div>
    <div class="pelta-prompt-label">${promptLabel} ${sourceBadge}</div>
    ${fileBadge}
    ${!isUpload ? `<div class="pelta-prompt-preview" style="margin-bottom:12px;">${promptHtml}</div>` : ''}
    <div class="pelta-prompt-label" style="color:#c7d2fe; margin-top:0;">Auto-rewritten prompt (editable)</div>
    <textarea class="pelta-edit-area" id="pelta-edit-area">${escapeHtml(rewrittenText)}</textarea>
    <div class="pelta-meta">method: ${response.detectionMethod || '—'} <span>·</span> ${sourceMetaExtra}check with admin discretion</div>
    <div class="pelta-btn-group">
      <button class="pelta-btn pelta-btn-redact" id="pelta-confirm-send">Confirm Anonymized &amp; Send</button>
      <button class="pelta-btn pelta-btn-primary" id="pelta-allow">Request Admin Approval</button>
      <button class="pelta-btn pelta-btn-secondary" id="pelta-cancel">Cancel</button>
    </div>
  `;

  document.getElementById('pelta-confirm-send').onclick = () => {
    const area = document.getElementById('pelta-edit-area');
    const finalVal = area ? area.value : '';
    removeOverlay();
    removeStatusBadge();
    unlockSendButton();
    // Mark the confirmed rewrite as pre-approved so a manual re-send of it skips the guard
    approvedText = finalVal;
    // Mark replaying BEFORE typing so the real-time scanner doesn't re-flag the redacted text
    replaying = true;
    typeIntoInput(finalVal);
    // Give ProseMirror/React a tick to commit the value, then send
    setTimeout(() => {
      replaySend();
    }, 120);
  };

  // "Request Admin Approval" button — creates an access request record in the
  // backend and polls every 2s until admin approves or rejects it.
  document.getElementById('pelta-allow').onclick = async (e) => {
    const btn = e.target;
    btn.textContent = "Request Sent \u2713";
    btn.disabled = true;
    btn.className = "pelta-btn pelta-btn-secondary";
    try {
      const data = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'CREATE_ACCESS_REQUEST',
          payload: {
            employeeName: "Alice Chen",
            sections: ["Prompt Approval"],
            riskLevel: "medium",
            reason: "User requested bypass for prompt:\n\n" + (promptText.length > 1500 ? promptText.substring(0, 1500) + '...' : promptText),
          }
        }, resolve);
      });
      if (data && data.id) {
        btn.textContent = "Waiting for Admin...";
        const interval = setInterval(async () => {
          try {
            const allReqs = await new Promise(resolve => {
              chrome.runtime.sendMessage({ type: 'GET_ACCESS_REQUESTS' }, resolve);
            });
            const myReq = (allReqs || []).find(r => r.id === data.id);
            if (myReq) {
              if (myReq.status === 'approved') {
                clearInterval(interval);
                try { chrome.runtime.sendMessage({ type: 'NOTIFY_USER', status: 'approved' }); } catch (_) { }
                const overlayEl = document.getElementById('pelta-overlay');
                if (overlayEl) {
                  replaying = true;
                  typeIntoInput(promptText);
                  removeOverlay();
                  approvedText = promptText;
                  setTimeout(() => { replaySend(); }, 120);
                }
              } else if (myReq.status === 'rejected') {
                clearInterval(interval);
                try { chrome.runtime.sendMessage({ type: 'NOTIFY_USER', status: 'rejected', reason: myReq.adminComment || '' }); } catch (_) { }
                const overlayEl = document.getElementById('pelta-overlay');
                if (overlayEl) {
                  btn.textContent = "Request Denied";
                  btn.className = "pelta-btn pelta-btn-redact";
                }
              }
            }
          } catch (err) { }
        }, 2000);
      }
    } catch (err) { }
  };
  document.getElementById('pelta-cancel').onclick = () => {
    typeIntoInput(promptText); // Restore original so they don't lose work
    removeOverlay();
    removeStatusBadge();
  };
}

/**
 * Block overlay — shown when the backend returns verdict 'block'.
 * Stricter than flag: the message is NOT sent automatically.
 * Options:
 *   1. "Confirm Anonymized & Type" — types the redacted version into the input
 *                                    but does NOT send. User must review first.
 *   2. "Report False Positive"     — same admin approval flow as the flag overlay
 *   3. "Dismiss"                   — clears the input entirely and closes overlay
 */
function showBlock(response, promptText, trigger, meta = {}) {
  const isImage = trigger === 'paste-image';
  const isPdf = trigger === 'paste-pdf';
  const isUpload = isImage || isPdf;
  const el = createOverlay();
  el.className = 'block';
  const promptHtml = buildHighlightedPrompt(promptText, response.highlights);
  const promptLabel = isUpload
    ? (isPdf ? 'Extracted from PDF (highlighted)' : 'Extracted from image · OCR (highlighted)')
    : 'Submitted Prompt (highlighted)';
  const sourceBadge = isUpload
    ? `<span class="pelta-ocr-badge">${isPdf ? '📄 pdf-upload' : '🖼️ image-upload'}</span>`
    : '';
  const sourceMetaExtra = isUpload
    ? `source: ${isPdf ? 'pdf-upload' : 'image-upload'} <span>·</span> engine: ${isPdf ? 'pdf.js' : 'gemini-vision'} <span>·</span> `
    : '';
  const fileBadge = meta.filename ? `<div class="pelta-file-name">📎 ${meta.filename}${meta.pageCount ? ` (${meta.pageCount} pages)` : ''}</div>` : '';
  const rewrittenText = response.rewrittenPrompt || buildRedactedText(promptText, response.highlights);
  el.innerHTML = `
    <div class="pelta-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      Blocked by governance policy
    </div>
    <div class="pelta-reason">${response.reason || 'No reason provided.'}</div>
    <div class="pelta-prompt-label">${promptLabel} ${sourceBadge}</div>
    ${fileBadge}
    ${!isUpload ? `<div class="pelta-prompt-preview" style="margin-bottom:12px;">${promptHtml}</div>` : ''}
    <div class="pelta-prompt-label" style="color:#c7d2fe; margin-top:0;">Auto-rewritten prompt (editable)</div>
    <textarea class="pelta-edit-area" id="pelta-edit-area">${escapeHtml(rewrittenText)}</textarea>
    <div class="pelta-meta">method: ${response.detectionMethod || '—'} <span>·</span> ${sourceMetaExtra}message not sent</div>
    <div class="pelta-btn-group">
      <button class="pelta-btn pelta-btn-redact" id="pelta-confirm-type">Confirm Anonymized &amp; Type</button>
      <button class="pelta-btn pelta-btn-primary" id="pelta-report">Report False Positive</button>
      <button class="pelta-btn pelta-btn-secondary" id="pelta-dismiss">Dismiss</button>
    </div>
  `;

  document.getElementById('pelta-confirm-type').onclick = () => {
    const area = document.getElementById('pelta-edit-area');
    const finalVal = area ? area.value : '';
    removeOverlay();
    removeStatusBadge();
    unlockSendButton();
    // Mark the confirmed rewrite as pre-approved so the next send of it skips the guard
    approvedText = finalVal;
    replaying = true;
    typeIntoInput(finalVal);
    // Keep replaying true briefly so inline scanner doesn't re-flag the typed text
    setTimeout(() => { replaying = false; }, 500);
  };

  document.getElementById('pelta-report').onclick = async (e) => {
    const btn = e.target;
    btn.textContent = "Reporting...";
    btn.disabled = true;
    btn.className = "pelta-btn pelta-btn-secondary";
    try {
      const data = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'CREATE_ACCESS_REQUEST',
          payload: {
            employeeName: "Alice Chen",
            sections: ["Prompt Approval"],
            riskLevel: "high",
            reason: "User reported false positive for blocked prompt:\n\n" + (promptText.length > 1500 ? promptText.substring(0, 1500) + '...' : promptText),
          }
        }, resolve);
      });
      if (data && data.id) {
        btn.textContent = "Waiting for Admin...";
        const interval = setInterval(async () => {
          try {
            const allReqs = await new Promise(resolve => {
              chrome.runtime.sendMessage({ type: 'GET_ACCESS_REQUESTS' }, resolve);
            });
            const myReq = (allReqs || []).find(r => r.id === data.id);
            if (myReq) {
              if (myReq.status === 'approved') {
                clearInterval(interval);
                try { chrome.runtime.sendMessage({ type: 'NOTIFY_USER', status: 'approved' }); } catch (_) { }
                const overlayEl = document.getElementById('pelta-overlay');
                if (overlayEl) {
                  btn.textContent = "Approved by Admin \u2713";
                  btn.style.background = "#10b981";
                  btn.style.borderColor = "#10b981";
                  btn.style.color = "white";
                  setTimeout(() => {
                    typeIntoInput(promptText);
                    removeOverlay();
                  }, 1500);
                }
              } else if (myReq.status === 'rejected') {
                clearInterval(interval);
                try { chrome.runtime.sendMessage({ type: 'NOTIFY_USER', status: 'rejected', reason: myReq.adminComment || '' }); } catch (_) { }
                const overlayEl = document.getElementById('pelta-overlay');
                if (overlayEl) {
                  btn.textContent = "Report Denied";
                  btn.className = "pelta-btn pelta-btn-redact";
                }
              }
            }
          } catch (err) { }
        }, 2000);
      }
    } catch (err) {
      btn.textContent = "Error reporting";
    }
  };
  document.getElementById('pelta-dismiss').onclick = () => {
    typeIntoInput(promptText); // Restore original
    clearPrompt();
    removeOverlay();
    removeStatusBadge();
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
  document.getElementById('pelta-dismiss-error').onclick = () => {
    removeOverlay();
    removeStatusBadge();
  };
}

/* ── Initialisation ──────────────────────────────────────────────────────────
 *  Bootstraps the extension when the content script first loads.
 *
 *  Step 1: Start background async tasks (non-blocking)
 *    - detectOcrEngine() — probes for Gemini Nano availability
 *    - resolveApiBase()  — reads the backend URL from chrome.storage.sync
 *
 *  Step 2: Acquire the chat composer
 *    - If the page is still loading, wait for DOMContentLoaded
 *    - Try acquire() immediately; if the composer isn't in the DOM yet
 *      (common on ChatGPT which lazy-renders the input), retry once after
 *      800ms, and if still not found start watchForMount() to observe
 *      mutations until it appears.
 *
 *  This three-stage strategy handles: normal pages, lazy-rendered SPAs,
 *  and pages that build their composer dynamically after hydration.
 * ───────────────────────────────────────────────────────────────────────── */
detectOcrEngine(); // async — result is cached in `nanoAvailable` before any paste event
resolveApiBase();  // async — result is cached in `API_BASE` before any network call

if (document.readyState === 'loading') {
  // Page HTML is still being parsed — wait for full DOM before querying
  document.addEventListener('DOMContentLoaded', () => {
    if (!acquire()) {
      // Composer not found yet (ChatGPT renders it after initial paint)
      // — retry once after 800ms, then fall back to MutationObserver
      setTimeout(() => { if (!acquire()) watchForMount(); }, 800);
    } else {
      watchForMount(); // Composer found — watch for future SPA re-mounts
    }
  });
} else {
  // Page is already parsed (e.g. extension installed mid-session)
  if (!acquire()) {
    setTimeout(() => { if (!acquire()) watchForMount(); }, 800);
  } else {
    watchForMount();
  }
}
