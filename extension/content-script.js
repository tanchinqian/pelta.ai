/* ── pelta.ai Prompt Guard — Content Script ────────────────
 *   Injected into chat.openai.com and chatgpt.com.
 *   Intercepts the send action, checks via local API, overlays result.
 *   v2: Image OCR pipeline via Gemini Nano (Chrome) / Tesseract.js (fallback)
 * ─────────────────────────────────────────────────────────── */

function getToolName() {
  const host = window.location.hostname;
  if (host.includes('gemini')) return 'Gemini';
  if (host.includes('claude')) return 'Claude';
  if (host.includes('deepseek')) return 'DeepSeek';
  if (host.includes('copilot')) return 'Copilot';
  return 'ChatGPT';
}

/* ── API Base resolver ─────────────────────────────────── */
const STORAGE_KEY = 'pelta_api_base';
const LOCAL_URL = 'http://localhost:3000';

let API_BASE = LOCAL_URL;

async function resolveApiBase() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const stored = await new Promise((resolve) => {
        chrome.storage.sync.get(STORAGE_KEY, resolve);
      });
      API_BASE = stored[STORAGE_KEY] || LOCAL_URL;
    }
  } catch {}
}

/* ── Selectors (supports ChatGPT, Gemini, Claude, DeepSeek, Copilot) ──────── */
const SELECTORS = {
  input: '#prompt-textarea, div.ql-editor[contenteditable="true"], div[contenteditable="true"].ProseMirror, div[contenteditable="true"][role="textbox"], textarea#chat-input, textarea[placeholder*="Ask"], textarea[placeholder*="DeepSeek"], textarea[aria-label*="Ask"], textarea',
  sendButton: 'button[type="submit"], #composer-submit-button, [data-testid*="send" i], [aria-label*="send" i], [aria-label*="submit" i], [title*="send" i], [title*="submit" i], button[class*="send" i], .send-button',
};

/* ── State ───────────────────────────────────────────────── */
let inputEl = null;
let sendEl = null;
let reconnectObserver = null;

/* ── Re-entrancy guard ────────────────────────────────── */
let replaying = false;

/* ── Approved Prompt Cache ────────────────────────────── */
const approvedPrompts = new Set();

/* ── OCR engine state ────────────────────────────────────── */
let nanoAvailable = false;

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

/* ── OCR helpers ─────────────────────────────────────────── */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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
      { role: 'user', content: [
        { type: 'image', image: dataUrl },
        { type: 'text', text: 'Extract all text from this image verbatim.' },
      ]},
    ]);
  } catch {
    // Fallback: describe image as text prompt — will likely be empty, triggers Tesseract below
    console.warn('[pelta] Nano vision not available, falling back to Tesseract');
    session.destroy();
    throw new Error('nano-no-vision');
  }
  session.destroy();
  return result.trim();
}

async function ocrWithTesseract(blob) {
  // Send to our localhost backend — Node.js Tesseract, no WASM/Worker issues.
  // Image stays on the user's machine (localhost = zero data leakage).
  const dataUrl = await blobToDataUrl(blob);
  const base64 = dataUrl.split(',')[1]; // strip "data:image/png;base64," prefix

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

async function extractTextFromImage(blob) {
  if (nanoAvailable) {
    return await ocrWithNano(blob);
  }
  return await ocrWithTesseract(blob);
}

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
function getPromptText() {
  if (!inputEl) return '';
  if (inputEl.tagName === 'TEXTAREA') return inputEl.value;
  return inputEl.innerText || inputEl.textContent || '';
}

function acquire() {
  const inputs = Array.from(document.querySelectorAll(SELECTORS.input));
  inputEl = inputs.find(el => el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none') || inputs[0];

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
let pasteHandler = null;
let dropHandler = null;
let dragOverHandler = null;
let fileInputHandler = null;
let escapeHandler = null;
let keypressHandler = null;

let interceptedEnter = false;

const globalKeydownHandler = (e) => {
  if (keydownHandler) keydownHandler(e);
};
const globalKeyupHandler = (e) => {
  if (keyupHandler) keyupHandler(e);
};
const globalKeypressHandler = (e) => {
  if (keypressHandler) keypressHandler(e);
};
const globalOtherHandler = (e) => {
  if (interceptedEnter || document.getElementById('pelta-overlay')) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
};

window.addEventListener('keydown', globalKeydownHandler, true);
window.addEventListener('keyup', globalKeyupHandler, true);
window.addEventListener('keypress', globalKeypressHandler, true);
window.addEventListener('beforeinput', globalOtherHandler, true);
window.addEventListener('submit', globalOtherHandler, true);

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

    if (e.key === 'Enter' && !e.shiftKey && !replaying && !e.isComposing) {
      if (!inputEl || (!inputEl.contains(e.target) && e.target !== inputEl)) {
        // Fallback: If user is pressing Enter in ANY editable field, dynamically capture it
        const isEditable = e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || e.target.closest('[contenteditable="true"]');
        if (isEditable) {
          inputEl = e.target.tagName === 'TEXTAREA' ? e.target : e.target.closest('[contenteditable="true"]') || e.target;
        } else {
          return;
        }
      }
      const text = getPromptText();
      if (!text || !text.trim()) return;
      
      // Aggressively rip focus away
      if (e.target && typeof e.target.blur === 'function') {
        e.target.blur();
      }
      
      // Definitively prevent the host app from sending the prompt by deleting it from the DOM immediately
      if (inputEl.tagName === 'TEXTAREA') {
        inputEl.value = '';
      } else {
        inputEl.innerText = '';
      }
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      interceptedEnter = true;
      startCheck(text, 'keydown');
    }
  };

  clickHandler = (e) => {
    if (replaying) return;
    const btn = e.target.closest(SELECTORS.sendButton);
    if (!btn) return;

    const text = getPromptText();
    if (!text || !text.trim()) return;

    // Definitively prevent the host app from sending the prompt by deleting it
    if (inputEl.tagName === 'TEXTAREA') {
      inputEl.value = '';
    } else {
      inputEl.innerText = '';
    }
    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));

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
  // File picker upload interception (capture phase — fires before Gemini's handlers)
  document.addEventListener('change', fileInputHandler, true);
  if (inputEl) {
    inputEl.addEventListener('dragover', dragOverHandler, false);
    inputEl.addEventListener('drop', dropHandler, false);
  }
  // Fallback: catch drops anywhere on the document
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
  if (dragOverHandler) {
    document.removeEventListener('dragover', dragOverHandler, false);
    if (inputEl) inputEl.removeEventListener('dragover', dragOverHandler, false);
  }
  if (dropHandler) {
    document.removeEventListener('drop', dropHandler, false);
    if (inputEl) inputEl.removeEventListener('drop', dropHandler, false);
  }
  keydownHandler = null;
  keyupHandler = null;
  clickHandler = null;
  pasteHandler = null;
  dropHandler = null;
  dragOverHandler = null;
  fileInputHandler = null;
  escapeHandler = null;
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
  requestAnimationFrame(() => {
    const btn = document.querySelector(SELECTORS.sendButton);
    if (btn) btn.click();
    replaying = false;
  });
}

/* ── Send button lock ────────────────────────────────────────── */
function lockSendButton() {
  const btn = document.querySelector(SELECTORS.sendButton);
  if (!btn || btn.dataset.peltaLocked) return;
  btn.dataset.peltaLocked = '1';
  btn.style.opacity = '0.35';
  btn.style.pointerEvents = 'none';
  btn.style.transition = 'opacity 0.15s';
}

function unlockSendButton() {
  const btn = document.querySelector(SELECTORS.sendButton);
  if (!btn) return;
  delete btn.dataset.peltaLocked;
  btn.style.opacity = '';
  btn.style.pointerEvents = '';
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
  const el = document.getElementById('pelta-overlay');
  if (el) el.remove();
}

/* ── Verification flow ──────────────────────────────────── */
function startCheck(text, trigger, meta = {}) {
  if (!text.trim()) {
    replaySend();
    return;
  }
  if (approvedPrompts.has(text.trim())) {
    console.log('[pelta] Prompt was previously approved in this session. Bypassing check.');
    typeIntoInput(text);
    replaySend();
    return;
  }

  lockSendButton();
  showChecking(text);
  chrome.runtime.sendMessage({ type: 'CHECK_PROMPT', text, tool: getToolName(), trigger }, (response) => {
    unlockSendButton();
    if (!response) {
      showError('No response from backend.');
      typeIntoInput(text); // Restore original
      return;
    }
    if (response.error) {
      showError(response.error);
      typeIntoInput(text); // Restore original
      return;
    }

    switch (response.verdict) {
      case 'allow':
        removeOverlay();
        showAllowToast();
        typeIntoInput(text); // Restore original
        replaySend();
        break;
      case 'flag':
        showFlag(response, text, trigger, meta);
        break;
      case 'block':
        showBlock(response, text, trigger, meta);
        break;
      default:
        removeOverlay();
        replaySend();
    }
  });
}

/* ── Build redacted text string ── */
function buildRedactedText(text, highlights) {
  if (!highlights || highlights.length === 0) return text;

  const aliasMap = new Map();
  const labelCounts = new Map();

  // First pass: assign aliases in order of appearance (left-to-right)
  const ascending = [...highlights].sort((a, b) => a.start - b.start);
  for (const h of ascending) {
    const raw = text.slice(h.start, h.end);
    if (!aliasMap.has(raw)) {
      const label = h.pattern || 'Secret';
      const count = (labelCounts.get(label) || 0) + 1;
      labelCounts.set(label, count);
      aliasMap.set(raw, `[${label} ${count}]`);
    }
  }

  // Second pass: replace text from right-to-left to keep indices valid
  const sorted = [...highlights].sort((a, b) => b.start - a.start);
  let redacted = text;
  for (const h of sorted) {
    const raw = text.slice(h.start, h.end); // Use original text to lookup map
    const alias = aliasMap.get(raw);
    redacted = redacted.slice(0, h.start) + alias + redacted.slice(h.end);
  }
  return redacted;
}

/* ── Type clean text into chat input ── */
function typeIntoInput(text) {
  if (!inputEl) return;
  if (inputEl.tagName === 'TEXTAREA') {
    inputEl.value = text;
  } else {
    // ProseMirror / Quill / Gemini contenteditable
    inputEl.innerText = text;
  }
  inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  inputEl.dispatchEvent(new Event('change',    { bubbles: true, cancelable: true }));
  inputEl.focus();
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
  const redactedText = buildRedactedText(promptText, response.highlights);
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
    <textarea class="pelta-edit-area" id="pelta-edit-area">${escapeHtml(redactedText)}</textarea>
    <div class="pelta-meta">method: ${response.detectionMethod || '—'} <span>·</span> ${sourceMetaExtra}check with admin discretion</div>
    <div class="pelta-btn-group">
      <button class="pelta-btn pelta-btn-redact" id="pelta-confirm-send">Confirm Anonymized &amp; Send</button>
      <button class="pelta-btn pelta-btn-primary" id="pelta-allow">Request Admin Approval</button>
      <button class="pelta-btn pelta-btn-secondary" id="pelta-cancel">Cancel</button>
    </div>
  `;

  document.getElementById('pelta-confirm-send').onclick = () => {
    const finalVal = document.getElementById('pelta-edit-area').value;
    typeIntoInput(finalVal);
    removeOverlay();
    replaySend();
  };

  document.getElementById('pelta-allow').onclick = async (e) => {
    const btn = e.target;
    btn.textContent = "Request Sent \u2713";
    btn.disabled = true;
    btn.className = "pelta-btn pelta-btn-secondary";
    try {
      const res = await fetch(`${API_BASE}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: "Alice Chen",
          sections: ["Prompt Approval"],
          riskLevel: "medium",
          reason: "User requested bypass for prompt:\n\n" + (promptText.length > 1500 ? promptText.substring(0, 1500) + '...' : promptText),
        })
      });
      const data = await res.json();
      if (data.id) {
        btn.textContent = "Waiting for Admin...";
        const interval = setInterval(async () => {
          try {
            const checkRes = await fetch(`${API_BASE}/api/access-requests`);
            const allReqs = await checkRes.json();
            const myReq = allReqs.find(r => r.id === data.id);
            if (myReq) {
              if (myReq.status === 'approved') {
                approvedPrompts.add(promptText.trim());
                clearInterval(interval);
                // Fire desktop notification in case overlay was already dismissed
                try { chrome.runtime.sendMessage({ type: 'NOTIFY_USER', status: 'approved' }); } catch(_) {}
                const overlayEl = document.getElementById('pelta-overlay');
                if (overlayEl) {
                  typeIntoInput(promptText);
                  removeOverlay();
                  replaySend();
                }
              } else if (myReq.status === 'rejected') {
                clearInterval(interval);
                try { chrome.runtime.sendMessage({ type: 'NOTIFY_USER', status: 'rejected', reason: myReq.adminComment || '' }); } catch(_) {}
                const overlayEl = document.getElementById('pelta-overlay');
                if (overlayEl) {
                  btn.textContent = "Request Denied";
                  btn.className = "pelta-btn pelta-btn-redact";
                }
              }
            }
          } catch (err) {}
        }, 2000);
      }
    } catch(err) {}
  };
  document.getElementById('pelta-cancel').onclick = () => {
    typeIntoInput(promptText); // Restore original so they don't lose work
    removeOverlay();
  };
}

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
  const redactedText = buildRedactedText(promptText, response.highlights);
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
    <textarea class="pelta-edit-area" id="pelta-edit-area">${escapeHtml(redactedText)}</textarea>
    <div class="pelta-meta">method: ${response.detectionMethod || '—'} <span>·</span> ${sourceMetaExtra}message not sent</div>
    <div class="pelta-btn-group">
      <button class="pelta-btn pelta-btn-redact" id="pelta-confirm-type">Confirm Anonymized &amp; Type</button>
      <button class="pelta-btn pelta-btn-primary" id="pelta-report">Report False Positive</button>
      <button class="pelta-btn pelta-btn-secondary" id="pelta-dismiss">Dismiss</button>
    </div>
  `;

  document.getElementById('pelta-confirm-type').onclick = () => {
    const finalVal = document.getElementById('pelta-edit-area').value;
    typeIntoInput(finalVal);
    removeOverlay();
  };

  document.getElementById('pelta-report').onclick = async (e) => {
    const btn = e.target;
    btn.textContent = "Reporting...";
    btn.disabled = true;
    btn.className = "pelta-btn pelta-btn-secondary";
    try {
      const res = await fetch(`${API_BASE}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: "Alice Chen",
          sections: ["Prompt Approval"],
          riskLevel: "high",
          reason: "User reported false positive for blocked prompt:\n\n" + (promptText.length > 1500 ? promptText.substring(0, 1500) + '...' : promptText),
        })
      });
      const data = await res.json();
      if (data.id) {
        btn.textContent = "Waiting for Admin...";
        const interval = setInterval(async () => {
          try {
            const checkRes = await fetch(`${API_BASE}/api/access-requests`);
            const allReqs = await checkRes.json();
            const myReq = allReqs.find(r => r.id === data.id);
            if (myReq) {
              if (myReq.status === 'approved') {
                approvedPrompts.add(promptText.trim());
                clearInterval(interval);
                // Fire desktop notification in case overlay was already dismissed
                try { chrome.runtime.sendMessage({ type: 'NOTIFY_USER', status: 'approved' }); } catch(_) {}
                const overlayEl = document.getElementById('pelta-overlay');
                if (overlayEl) {
                  btn.textContent = "Approved by Admin \u2713";
                  btn.style.background = "#10b981";
                  btn.style.borderColor = "#10b981";
                  btn.style.color = "white";
                  setTimeout(() => {
                    typeIntoInput(promptText);
                    removeOverlay();
                    // No auto-send; user can manually send now.
                  }, 1500);
                }
              } else if (myReq.status === 'rejected') {
                clearInterval(interval);
                try { chrome.runtime.sendMessage({ type: 'NOTIFY_USER', status: 'rejected', reason: myReq.adminComment || '' }); } catch(_) {}
                const overlayEl = document.getElementById('pelta-overlay');
                if (overlayEl) {
                  btn.textContent = "Report Denied";
                  btn.className = "pelta-btn pelta-btn-redact";
                }
              }
            }
          } catch (err) {}
        }, 2000);
      }
    } catch(err) {
      btn.textContent = "Error reporting";
    }
  };
  document.getElementById('pelta-dismiss').onclick = () => {
    typeIntoInput(promptText); // Restore original
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
detectOcrEngine(); // async, runs in background — result cached before any paste
resolveApiBase();  // async, resolves the API base URL from storage before first use

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
