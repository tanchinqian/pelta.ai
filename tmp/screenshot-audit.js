const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3000";
const OUT_DIR = path.join(__dirname, "screenshots", "audit");
fs.mkdirSync(OUT_DIR, { recursive: true });

const DARK_MODE_JS = async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
    localStorage.setItem("pelta-theme", "dark");
  });
  await page.waitForTimeout(500);
};

const LIGHT_MODE_JS = async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
    localStorage.setItem("pelta-theme", "light");
  });
  await page.waitForTimeout(500);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const screenshots = [];

  // Helper to take screenshot
  async function snap(filename) {
    const fp = path.join(OUT_DIR, filename);
    await page.screenshot({ path: fp, fullPage: false });
    screenshots.push(filename);
    console.log(`  [OK] ${filename}`);
  }

  // ---- DARK MODE SCREENSHOTS ----
  console.log("=== DARK MODE ===");

  // 1. Landing
  console.log("1/9 Landing...");
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("01-landing-dark.png");

  // 2. Employee Workspace
  console.log("2/9 Employee Workspace...");
  await page.goto(BASE + "/employee", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("02-employee-dark.png");

  // 3. Request Tool
  console.log("3/9 Request Tool...");
  await page.goto(BASE + "/employee/requests/new", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("03-requesttool-dark.png");

  // 4. Redress — click flagged event to show detail
  console.log("4/9 Redress...");
  await page.goto(BASE + "/employee/redress", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(2000); // wait for logs to load
  // Click the first flagged event button in the left panel
  const redressBtn = await page.locator('[class*="divide-y"] button').first();
  if (await redressBtn.count() > 0) {
    await redressBtn.click();
    await page.waitForTimeout(1500); // wait for detail to render
  }
  await snap("04-redress-dark.png");

  // 5. Admin Dashboard
  console.log("5/9 Dashboard...");
  await page.goto(BASE + "/admin/dashboard", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(1500); // wait for charts to load
  await snap("05-dashboard-dark.png");

  // 6. Classify — click preset + Classify Tool
  console.log("6/9 Classify...");
  await page.goto(BASE + "/admin/tools/new", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(1000);

  // Click a quick suggestion preset (e.g., "DeepSeek Coder")
  const presetBtn = page.locator('button:has-text("DeepSeek Coder")').first();
  if (await presetBtn.count() > 0) {
    await presetBtn.click();
    await page.waitForTimeout(500);
  }

  // Click the "Classify Tool" submit button
  const classifyBtn = page.locator('button[type="submit"]:has-text("Classify Tool")');
  if (await classifyBtn.count() > 0) {
    await classifyBtn.click();
    // Wait for the API response and result card to appear
    await page.waitForTimeout(5000);
  }
  await snap("06-classify-dark.png");

  // 7. Tools Registry — click tool row to open detail
  console.log("7/9 Tools Registry...");
  await page.goto(BASE + "/admin/tools", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(1500);
  // Click the first tool row in the table body
  const toolRow = page.locator("tbody tr").first();
  if (await toolRow.count() > 0) {
    await toolRow.click();
    await page.waitForTimeout(1000); // wait for detail panel
  }
  await snap("07-tools-dark.png");

  // 8. Requests
  console.log("8/9 Requests...");
  await page.goto(BASE + "/admin/requests", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("08-requests-dark.png");

  // 9. Logs
  console.log("9/9 Logs...");
  await page.goto(BASE + "/admin/logs", { waitUntil: "networkidle", timeout: 30000 });
  await DARK_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("09-logs-dark.png");

  // ---- LIGHT MODE SCREENSHOTS ----
  console.log("\n=== LIGHT MODE ===");

  // Switch to light mode
  await LIGHT_MODE_JS(page);

  // 1. Landing
  console.log("1/9 Landing...");
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("01-landing-light.png");

  // 2. Employee Workspace
  console.log("2/9 Employee Workspace...");
  await page.goto(BASE + "/employee", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("02-employee-light.png");

  // 3. Request Tool
  console.log("3/9 Request Tool...");
  await page.goto(BASE + "/employee/requests/new", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("03-requesttool-light.png");

  // 4. Redress — click flagged event
  console.log("4/9 Redress...");
  await page.goto(BASE + "/employee/redress", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(2000);
  const redressBtn2 = await page.locator('[class*="divide-y"] button').first();
  if (await redressBtn2.count() > 0) {
    await redressBtn2.click();
    await page.waitForTimeout(1500);
  }
  await snap("04-redress-light.png");

  // 5. Admin Dashboard
  console.log("5/9 Dashboard...");
  await page.goto(BASE + "/admin/dashboard", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(1500);
  await snap("05-dashboard-light.png");

  // 6. Classify
  console.log("6/9 Classify...");
  await page.goto(BASE + "/admin/tools/new", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(1000);
  const presetBtn2 = page.locator('button:has-text("DeepSeek Coder")').first();
  if (await presetBtn2.count() > 0) {
    await presetBtn2.click();
    await page.waitForTimeout(500);
  }
  const classifyBtn2 = page.locator('button[type="submit"]:has-text("Classify Tool")');
  if (await classifyBtn2.count() > 0) {
    await classifyBtn2.click();
    await page.waitForTimeout(5000);
  }
  await snap("06-classify-light.png");

  // 7. Tools Registry
  console.log("7/9 Tools Registry...");
  await page.goto(BASE + "/admin/tools", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(1500);
  const toolRow2 = page.locator("tbody tr").first();
  if (await toolRow2.count() > 0) {
    await toolRow2.click();
    await page.waitForTimeout(1000);
  }
  await snap("07-tools-light.png");

  // 8. Requests
  console.log("8/9 Requests...");
  await page.goto(BASE + "/admin/requests", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("08-requests-light.png");

  // 9. Logs
  console.log("9/9 Logs...");
  await page.goto(BASE + "/admin/logs", { waitUntil: "networkidle", timeout: 30000 });
  await LIGHT_MODE_JS(page);
  await page.waitForTimeout(1000);
  await snap("09-logs-light.png");

  await browser.close();

  console.log(`\n=== DONE === ${screenshots.length} screenshots saved:`);
  screenshots.forEach((f) => console.log(`  ${f}`));
})();
