// Automated screenshot generator — drives the app in headless Edge.
// Usage: start a local server first (python -m http.server 8000), then `node scripts/screenshot.mjs`
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.BASE_URL ?? 'http://localhost:8000';

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 945 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: 'networkidle' });

// 1. Generate demo students
await page.getByRole('button', { name: '演示数据' }).click();
await page.locator('.modal .modal-foot button', { hasText: '生成' }).click();
await page.waitForTimeout(600);

// 2. Run one arrangement pass
await page.getByRole('button', { name: '智能排座 ▾' }).click();
await page.getByText('一键智能排座').click();
await page.waitForFunction(
  () => document.querySelectorAll('.seat-grid .seat').length > 0
    && [...document.querySelectorAll('.seat-grid .seat')].some(s => s.textContent.trim().length > 0),
  { timeout: 15000 },
);
await page.waitForTimeout(1200); // let FLIP animations settle

// 3. Main screenshot (light theme, full app)
await page.screenshot({ path: 'docs/screenshot.png' });
console.log('saved docs/screenshot.png');

// 4. Scoring report modal
await page.locator('[title="点击查看评分报告"]').click();
await page.waitForSelector('.modal', { timeout: 5000 });
await page.waitForTimeout(900);
await page.screenshot({ path: 'docs/report.png' });
console.log('saved docs/report.png');

await browser.close();
