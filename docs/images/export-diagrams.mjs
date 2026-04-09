import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const capabilitySpaceHTML = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 700px; background: #1e1e2e; font-family: -apple-system, 'Segoe UI', sans-serif; color: #e5e5e5; overflow: hidden; }
  .container { display: flex; padding: 30px; gap: 40px; height: 100%; }
  .left { flex: 0 0 520px; position: relative; display: flex; align-items: center; justify-content: center; }
  .right { flex: 1; background: rgba(26, 77, 77, 0.4); border-radius: 16px; border: 1px solid #555; padding: 30px; display: flex; flex-direction: column; }
  .title { text-align: center; font-size: 28px; font-weight: 700; margin-bottom: 6px; color: #e5e5e5; }
  .subtitle { text-align: center; font-size: 16px; color: #a0a0a0; margin-bottom: 20px; }

  .orbit { position: absolute; border-radius: 50%; border: 1px solid rgba(139, 92, 246, 0.4); }
  .orbit.outer { width: 420px; height: 420px; background: rgba(45, 27, 105, 0.2); }
  .orbit.mid { width: 300px; height: 300px; background: rgba(45, 27, 105, 0.3); }
  .orbit.inner { width: 170px; height: 170px; background: rgba(92, 26, 26, 0.5); border-color: #ef4444; border-width: 2px; }

  .center-label { position: absolute; text-align: center; font-size: 15px; color: #ef4444; font-weight: 600; }
  .outer-label { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); font-size: 15px; color: #8b5cf6; }

  .dot { position: absolute; width: 12px; height: 12px; border-radius: 50%; }
  .dot.green { background: #22c55e; }
  .dot.red { background: #ef4444; width: 9px; height: 9px; }
  .score { position: absolute; font-size: 13px; color: #22c55e; font-weight: 700; }

  .arrow { position: absolute; border-top: 2px dashed #22c55e; transform-origin: left center; }

  .legend-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; }
  .section-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
  .section-title.red { color: #ef4444; }
  .section-title.green { color: #22c55e; }
  .section-body { font-size: 14px; color: #a0a0a0; line-height: 1.6; margin-bottom: 12px; }
  .divider { border-top: 1px solid #555; margin: 14px 0; }
  .highlight { font-size: 16px; color: #f59e0b; font-weight: 600; line-height: 1.6; }
</style></head><body>
  <div class="title">The Capability Space Problem</div>
  <div class="subtitle">Why untested skills land in the average neighborhood</div>
  <div class="container">
    <div class="left">
      <div class="orbit outer"></div>
      <div class="orbit mid"></div>
      <div class="orbit inner"></div>
      <div class="center-label" style="top:50%;left:50%;transform:translate(-50%,-50%)">Generic Center<br>2-7% quality</div>
      <div class="outer-label">Rare, high-value regions</div>

      <div class="dot green" style="top:60px;left:80px;"></div>
      <div class="score" style="top:42px;left:68px;">86%</div>
      <div class="dot green" style="top:110px;right:40px;"></div>
      <div class="score" style="top:95px;right:22px;">91%</div>
      <div class="dot green" style="bottom:55px;left:120px;"></div>
      <div class="score" style="bottom:68px;left:108px;">88%</div>
      <div class="dot green" style="bottom:110px;right:20px;"></div>
      <div class="score" style="bottom:122px;right:10px;">85%</div>
      <div class="dot green" style="top:200px;left:50px;"></div>

      <div class="dot red" style="top:46%;left:46%;"></div>
      <div class="dot red" style="top:52%;left:52%;"></div>
      <div class="dot red" style="top:48%;left:54%;"></div>
      <div class="dot red" style="top:54%;left:48%;"></div>
      <div class="dot red" style="top:44%;left:50%;"></div>
    </div>
    <div class="right">
      <div class="legend-title">How skills navigate capability space</div>
      <div class="section-title red">Generic Prompts (untested)</div>
      <div class="section-body">"Review this code"<br>"Create a skill for X"<br>"Write an implementation plan"</div>
      <div class="section-body">Result: Average output. Predictable.<br>Every model produces the same thing.</div>
      <div class="divider"></div>
      <div class="section-title green">Tested Skills (proof-of-skill)</div>
      <div class="section-body">Persona stacking<br>&nbsp;&nbsp;+ Constraint chaining<br>&nbsp;&nbsp;+ Rationalization counters<br>&nbsp;&nbsp;+ Empirical validation</div>
      <div class="section-body">Result: Precise coordinates.<br>Rare output that generic prompts<br>never reach. Measurably better.</div>
      <div class="divider"></div>
      <div class="highlight">The difference:<br>&nbsp;&nbsp;2-7% baseline &rarr; 86%+ validated<br>Not incremental. Categorical.</div>
    </div>
  </div>
</body></html>`;

const beforeAfterHTML = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 750px; background: #1e1e2e; font-family: -apple-system, 'Segoe UI', sans-serif; color: #e5e5e5; overflow: hidden; }
  .header { text-align: center; padding: 16px 0 8px; }
  .title { font-size: 26px; font-weight: 700; }
  .subtitle { font-size: 15px; color: #a0a0a0; margin-top: 4px; }
  .columns { display: flex; gap: 20px; padding: 12px 24px; height: calc(100% - 80px); }
  .col { flex: 1; border-radius: 16px; padding: 20px 24px; position: relative; }
  .col.bad { background: rgba(92, 26, 26, 0.15); border: 2px solid rgba(239, 68, 68, 0.4); }
  .col.good { background: rgba(26, 77, 46, 0.15); border: 2px solid rgba(34, 197, 94, 0.4); }
  .col-title { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  .col-title.red { color: #ef4444; }
  .col-title.green { color: #22c55e; }
  .col-score { font-size: 15px; color: #a0a0a0; margin-bottom: 16px; }

  .chain-step { background: rgba(92, 26, 26, 0.5); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 10px; padding: 10px 16px; margin-bottom: 6px; font-size: 14px; text-align: center; color: #e5e5e5; }
  .chain-step.last { border-color: #ef4444; font-weight: 700; font-size: 16px; color: #ef4444; }
  .chain-arrow { text-align: center; color: #ef4444; font-size: 14px; margin: 2px 0; }

  .good-step { background: rgba(26, 77, 46, 0.5); border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 10px; padding: 10px 16px; margin-bottom: 6px; font-size: 14px; text-align: center; color: #e5e5e5; }
  .good-step.last { border-color: #22c55e; border-width: 2px; font-weight: 700; font-size: 16px; color: #22c55e; }
  .good-step.red-phase { background: rgba(30, 58, 95, 0.5); border-color: rgba(239, 68, 68, 0.4); }
  .good-arrow { text-align: center; color: #22c55e; font-size: 14px; margin: 2px 0; }

  .label { font-size: 16px; font-weight: 700; margin-top: 14px; margin-bottom: 6px; }
  .label.red { color: #ef4444; }
  .label.green { color: #22c55e; }
  .detail { font-size: 13px; color: #a0a0a0; line-height: 1.6; }
  .result { font-size: 15px; font-weight: 600; line-height: 1.6; margin-top: 12px; }
  .result.red { color: #ef4444; }
  .result.green { color: #22c55e; }

  .vs { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 20px; color: #f59e0b; font-weight: 700; background: #1e1e2e; padding: 4px 10px; border-radius: 8px; z-index: 10; }
</style></head><body>
  <div class="header">
    <div class="title">Before & After proof-of-skill</div>
    <div class="subtitle">What happens when you test skills instead of assuming they work</div>
  </div>
  <div class="columns" style="position:relative;">
    <div class="vs">vs</div>
    <div class="col bad">
      <div class="col-title red">WITHOUT proof-of-skill</div>
      <div class="col-score">Baseline: 2-7%</div>
      <div class="chain-step">"User asked me to create X"</div>
      <div class="chain-arrow">&darr;</div>
      <div class="chain-step">"I know what X is"</div>
      <div class="chain-arrow">&darr;</div>
      <div class="chain-step">"I found the file format"</div>
      <div class="chain-arrow">&darr;</div>
      <div class="chain-step">"I'll make it comprehensive"</div>
      <div class="chain-arrow">&darr;</div>
      <div class="chain-step last">"Done."</div>
      <div class="label red">SKIPPED:</div>
      <div class="detail">
        Interview (0 questions asked)<br>
        Discovery (0 locations searched)<br>
        Baseline testing (0 scenarios run)<br>
        Empirical eval (0 measurements)<br>
        Iteration (0 refinement loops)
      </div>
      <div class="result red">Result: Generic checklist.<br>Duplicate of existing skill.<br>Untested. Unmeasured.</div>
    </div>
    <div class="col good">
      <div class="col-title green">WITH proof-of-skill</div>
      <div class="col-score">Validated: 86%+</div>
      <div class="good-step">Interview: 3+ questions, one at a time</div>
      <div class="good-arrow">&darr;</div>
      <div class="good-step">Discovery: search 5 locations first</div>
      <div class="good-arrow">&darr;</div>
      <div class="good-step red-phase">RED: 3+ pressure scenarios, no skill</div>
      <div class="good-arrow">&darr;</div>
      <div class="good-step">GREEN: minimal SKILL.md, verify all pass</div>
      <div class="good-arrow">&darr;</div>
      <div class="good-step last">REFACTOR: tessl eval >= 85%</div>
      <div class="label green">ENFORCED:</div>
      <div class="detail">
        Interview (3+ questions, answered)<br>
        Discovery (5 locations searched)<br>
        Baseline (3+ scenarios documented)<br>
        Empirical eval (tessl score measured)<br>
        Iteration (ralph-loop until passing)
      </div>
      <div class="result green">Result: Precise, targeted skill.<br>Addresses observed failures only.<br>Tested. Measured. 86%.</div>
    </div>
  </div>
</body></html>`;

async function renderHTML(browser, html, outName) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: html.includes('750px') ? 750 : 700, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 500));

  const outPath = resolve(__dirname, `${outName}.png`);
  await page.screenshot({ path: outPath, type: 'png' });
  console.log(`Exported ${outPath}`);
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  await renderHTML(browser, capabilitySpaceHTML, 'capability-space');
  await renderHTML(browser, beforeAfterHTML, 'before-after');

  await browser.close();
})();
