import puppeteer from 'puppeteer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const titleHTML = `<!DOCTYPE html>
<html><head>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 800px; height: 280px; background: #1e1e2e; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; }

  .title-row { display: flex; align-items: baseline; gap: 0; margin-bottom: 8px; }
  .title-row span { font-family: 'Caveat', cursive; font-size: 80px; font-weight: 700; }
  .t-proof { color: #e5e5e5; }
  .t-of { color: #8b5cf6; }
  .t-skill { color: #22c55e; }

  .underline { width: 580px; height: 3px; background: linear-gradient(90deg, #8b5cf6 0%, #22c55e 100%); opacity: 0.35; border-radius: 2px; margin-bottom: 16px; }

  .tags { display: flex; gap: 8px; align-items: center; font-family: 'Caveat', cursive; font-size: 24px; margin-bottom: 18px; }
  .tag-tested { color: #ef4444; }
  .tag-measured { color: #f59e0b; }
  .tag-validated { color: #22c55e; }
  .tag-dot { color: #555; font-size: 20px; }

  .badges { display: flex; align-items: center; gap: 10px; }
  .badge { padding: 4px 16px; border-radius: 8px; font-family: -apple-system, sans-serif; font-size: 16px; font-weight: 700; }
  .badge-bad { background: rgba(92, 26, 26, 0.7); border: 1px solid #ef4444; color: #ef4444; }
  .badge-good { background: rgba(26, 77, 46, 0.7); border: 2px solid #22c55e; color: #22c55e; }
  .arrow { color: #f59e0b; font-size: 20px; font-weight: 700; }

  .glow { position: absolute; border-radius: 50%; }
  .g1 { width: 8px; height: 8px; background: #8b5cf6; opacity: 0.5; top: 55px; left: 85px; }
  .g2 { width: 6px; height: 6px; background: #22c55e; opacity: 0.5; top: 65px; right: 80px; }
  .g3 { width: 5px; height: 5px; background: #f59e0b; opacity: 0.4; bottom: 60px; right: 70px; }
  .g4 { width: 7px; height: 7px; background: #ef4444; opacity: 0.4; bottom: 55px; left: 75px; }
</style></head><body>
  <div class="glow g1"></div>
  <div class="glow g2"></div>
  <div class="glow g3"></div>
  <div class="glow g4"></div>

  <div class="title-row">
    <span class="t-proof">proof</span>
    <span class="t-of">-of-</span>
    <span class="t-skill">skill</span>
  </div>
  <div class="underline"></div>
  <div class="tags">
    <span class="tag-tested">tested</span>
    <span class="tag-dot">.</span>
    <span class="tag-measured">measured</span>
    <span class="tag-dot">.</span>
    <span class="tag-validated">validated</span>
    <span class="tag-dot">.</span>
  </div>
  <div class="badges">
    <span class="badge badge-bad">2-7%</span>
    <span class="arrow">&rarr;</span>
    <span class="badge badge-good">86%+</span>
  </div>
</body></html>`;

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 280, deviceScaleFactor: 2 });
  await page.setContent(titleHTML, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000)); // wait for Google Font

  const outPath = resolve(__dirname, 'title.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Exported ' + outPath);

  await browser.close();
})();
