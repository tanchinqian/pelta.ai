const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const DARK_MODE_JS = async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    localStorage.setItem('pelta-theme', 'dark');
  });
  await page.waitForTimeout(500);
};

(async () => {
  console.log('Launching browser to capture screenshots...');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.log('Chromium launch failed, trying with channel chrome or msedge...', err.message);
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
    } catch {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // Retinal high resolution
  });
  const page = await context.newPage();

  // Helper snap
  async function snap(filename) {
    const fp = path.join(OUT_DIR, filename);
    await page.screenshot({ path: fp, fullPage: false });
    console.log(`[OK] Saved ${filename}`);
  }

  try {
    // 1. Landing Page with Live Prompt Guard Interceptor Active
    console.log('1/5 Capturing 01_prompt_guard_intercept.png...');
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await DARK_MODE_JS(page);
    await page.waitForTimeout(1000);

    // Type a prompt that triggers the guard in the live simulator
    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0) {
      await textarea.fill('Analyze internal Q3 customer churn: user Alice (alice@company.com) with token sk-live-9874823489234823');
      await page.waitForTimeout(1000);
    }
    await snap('01_prompt_guard_intercept.png');

    // 2. Admin Dashboard
    console.log('2/5 Capturing 02_admin_dashboard.png...');
    await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await DARK_MODE_JS(page);
    await page.waitForTimeout(2000); // Allow Recharts to animate
    await snap('02_admin_dashboard.png');

    // 3. Tool Classification RAG
    console.log('3/5 Capturing 03_tool_classification_rag.png...');
    await page.goto(`${BASE}/admin/tools/new`, { waitUntil: 'networkidle', timeout: 30000 });
    await DARK_MODE_JS(page);
    await page.waitForTimeout(1000);

    // Click a preset button like "DeepSeek Coder"
    const presetBtn = page.locator('button:has-text("DeepSeek Coder")').first();
    if (await presetBtn.count() > 0) {
      await presetBtn.click();
      await page.waitForTimeout(500);
    }
    const classifyBtn = page.locator('button[type="submit"]:has-text("Classify Tool")');
    if (await classifyBtn.count() > 0) {
      await classifyBtn.click();
      await page.waitForTimeout(4000); // wait for LLM / fallback classification
    }
    await snap('03_tool_classification_rag.png');

    // 4. Redress & Dispute Portal
    console.log('4/5 Capturing 04_redress_appeal.png...');
    await page.goto(`${BASE}/employee/redress`, { waitUntil: 'networkidle', timeout: 30000 });
    await DARK_MODE_JS(page);
    await page.waitForTimeout(2000);

    // Select the first flagged item if available
    const firstEvent = page.locator('button:has-text("FLAG"), button:has-text("BLOCK")').first();
    if (await firstEvent.count() > 0) {
      await firstEvent.click();
      await page.waitForTimeout(1000);
    }
    await snap('04_redress_appeal.png');

    // 5. Architecture Diagram (Render high-res SVG / diagram card)
    console.log('5/5 Capturing 05_architecture_diagram.png...');
    // Create a beautiful dedicated HTML slide for the architecture diagram
    const archHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            padding: 40px;
            background: #0d0d0c;
            color: #f3f3f0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            box-sizing: border-box;
          }
          .card {
            width: 100%;
            max-width: 1200px;
            background: #141413;
            border: 1px solid #242422;
            border-radius: 16px;
            padding: 36px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          }
          .title-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #242422;
            padding-bottom: 20px;
            margin-bottom: 28px;
          }
          .title {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
            color: #bf9143;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .badge {
            background: rgba(191, 145, 67, 0.15);
            color: #bf9143;
            border: 1px solid rgba(191, 145, 67, 0.3);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-family: monospace;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr auto 1.3fr auto 1fr;
            gap: 16px;
            align-items: center;
          }
          .layer {
            background: #1c1c1a;
            border: 1px solid #2e2e2a;
            border-radius: 12px;
            padding: 20px;
          }
          .layer-title {
            font-size: 13px;
            font-family: monospace;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #bf9143;
            margin-bottom: 12px;
            font-weight: 600;
          }
          .item {
            background: #242420;
            border: 1px solid #33332c;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 10px;
            font-size: 13px;
            color: #e4e4e0;
          }
          .item:last-child { margin-bottom: 0; }
          .arrow {
            color: #bf9143;
            font-size: 24px;
            font-weight: bold;
            display: flex;
            justify-content: center;
          }
          .fast { border-left: 3px solid #10b981; }
          .llm { border-left: 3px solid #8b5cf6; }
          .gov { border-left: 3px solid #bf9143; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title-bar">
            <div class="title">🛡️ pelta.ai — System Architecture & Real-Time Data Flow</div>
            <div class="badge">NIST AI RMF 1.0 & EU AI Act Ready</div>
          </div>
          <div class="grid">
            <!-- Layer 1 -->
            <div class="layer">
              <div class="layer-title">1. Client Interceptor</div>
              <div class="item">🌐 Chrome Manifest V3</div>
              <div class="item">⌨️ Event Capture & Traps</div>
              <div class="item">📱 ChatGPT · Claude · Gemini · DeepSeek · Copilot</div>
              <div class="item">👁️ Gemini Nano / Tesseract</div>
            </div>

            <div class="arrow">➔</div>

            <!-- Layer 2 -->
            <div class="layer">
              <div class="layer-title">2. Hybrid Analysis Layer</div>
              <div class="item fast">⚡ Fast-Path Regex (&lt;5ms)<br><small style="color:#96958f">PII, Credentials, SSN, Jailbreaks</small></div>
              <div class="item fast">🔓 Base64 & URL Param Unpacker</div>
              <div class="item llm">🧠 Gemini 2.5/3.5 Flash Escalation<br><small style="color:#96958f">Contextual Risk &amp; Financials</small></div>
              <div class="item llm">🔄 3 Safe Prompt Alternative Rewrites</div>
            </div>

            <div class="arrow">➔</div>

            <!-- Layer 3 -->
            <div class="layer">
              <div class="layer-title">3. Governance &amp; Compliance</div>
              <div class="item gov">📊 Real-Time Analytics Dashboard</div>
              <div class="item gov">🏛️ NIST RAG Tool Classifier</div>
              <div class="item gov">⚖️ EU AI Act Redress Portal</div>
              <div class="item gov">📜 Immutable Audit Logging</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    await page.setContent(archHtml, { waitUntil: 'load' });
    await snap('05_architecture_diagram.png');

    console.log('\nAll 5 screenshots captured successfully!');
  } finally {
    await browser.close();
  }
})();
