---
id: FEAT-dashboard
title: "Local static dashboard for skill quality metrics"
priority: P3
category: features
status: done
depends_on:
  - FEAT-sqlite-store
estimated_effort: M
files_to_touch:
  - dashboard/index.html
  - dashboard/charts.js
---

# Local Static Dashboard

## Context

proof-of-skill collects rich metrics in its SQLite store: invocation counts, eval scores, degradation events, and optimization history. This data is currently only accessible via programmatic queries or raw database inspection. A visual dashboard makes the data immediately actionable -- trends that are invisible in raw numbers become obvious in charts. A developer should be able to glance at the dashboard and know: which skills are healthy, which are degrading, and which were recently optimized.

## Problem Statement

1. **No visual overview**: There is no way to see the health of all monitored skills at a glance. Users must query the SQLite database manually or read JSONL files
2. **No trend visualization**: A skill scoring 85 today could mean "stable at 85" or "dropped from 95 last week." Without trend lines, point-in-time scores lack context
3. **No optimization visibility**: When background optimizations run, there is no visual record of the improvement trajectory. Did the ralph-loop converge? How many iterations did it take?
4. **External dashboard dependencies**: Langfuse provides visualization but requires infrastructure. The local dashboard must work with zero dependencies beyond a browser

## Desired Outcome

- A single-page HTML dashboard served via a simple HTTP server
- Visualizations for: invocation counts (bar chart), quality scores (line chart with threshold), score sparklines, optimization timeline, near-miss detection count
- Data sourced from the local SQLite store
- The server runs on a configurable port (default: 3095)
- The dashboard refreshes automatically at a configurable interval

## Implementation Guide

### Step 1: Create the dashboard HTML shell

Create `dashboard/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>proof-of-skill dashboard</title>
  <style>
    /* Dark theme, minimal CSS. No external dependencies. */
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --muted: #8b949e;
      --green: #3fb950;
      --red: #f85149;
      --yellow: #d29922;
      --blue: #58a6ff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    /* ... layout grid, card styles, chart containers */
  </style>
</head>
<body>
  <header>
    <h1>proof-of-skill</h1>
    <span id="last-updated"></span>
  </header>
  <main>
    <section id="summary-cards">
      <!-- Total skills, avg score, active degradations, recent optimizations -->
    </section>
    <section id="invocation-chart">
      <h2>Invocations per Skill</h2>
      <canvas id="invocation-canvas"></canvas>
    </section>
    <section id="score-chart">
      <h2>Quality Scores Over Time</h2>
      <canvas id="score-canvas"></canvas>
    </section>
    <section id="skill-table">
      <h2>Skill Health</h2>
      <table id="health-table">
        <!-- Rows: skill name, latest score, sparkline, trend, status -->
      </table>
    </section>
    <section id="optimization-timeline">
      <h2>Optimization History</h2>
      <div id="timeline"></div>
    </section>
  </main>
  <script src="charts.js"></script>
</body>
</html>
```

### Step 2: Create the charting module

Create `dashboard/charts.js`:

This file handles all visualizations using Canvas 2D API directly -- no charting library dependency.

```javascript
// charts.js — zero-dependency charting for proof-of-skill dashboard

const API_BASE = ''; // Same origin

async function fetchData() {
  const response = await fetch(`${API_BASE}/api/dashboard`);
  return response.json();
}

function drawBarChart(canvas, data, options) {
  const ctx = canvas.getContext('2d');
  // ... bar chart implementation
  // Bars: one per skill, height = invocation count
  // Color: green if score >= threshold, yellow if within 5, red if below
}

function drawLineChart(canvas, data, options) {
  const ctx = canvas.getContext('2d');
  // ... line chart implementation
  // Lines: one per skill, x = date, y = score
  // Horizontal dashed line at threshold (85)
  // Points colored by status
}

function drawSparkline(container, scores) {
  // Tiny inline SVG sparkline for the health table
  // Shows last 20 scores as a miniature line chart
  // Red if trend is declining, green if improving, gray if stable
}

function renderSummaryCards(data) {
  // Total monitored skills
  // Average quality score (weighted by invocation count)
  // Active degradation count (with red highlight if > 0)
  // Optimizations in last 7 days
  // Near-miss count (scores within 5 points of threshold)
}

function renderHealthTable(data) {
  // One row per monitored skill
  // Columns: name, latest score, sparkline (last 20), trend arrow, status badge
  // Sorted by: degraded first, then by score ascending
}

function renderOptimizationTimeline(data) {
  // Horizontal timeline showing optimization events
  // Each event: dot with before/after score, colored by outcome
  // Green dot = converged, red dot = failed, yellow dot = in progress
}

// Auto-refresh
const REFRESH_INTERVAL = 30000; // 30 seconds
async function refresh() {
  const data = await fetchData();
  renderSummaryCards(data);
  drawBarChart(document.getElementById('invocation-canvas'), data.invocations);
  drawLineChart(document.getElementById('score-canvas'), data.scores);
  renderHealthTable(data);
  renderOptimizationTimeline(data.optimizations);
  document.getElementById('last-updated').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

refresh();
setInterval(refresh, REFRESH_INTERVAL);
```

### Step 3: Create the HTTP server with API endpoint

The dashboard needs a tiny HTTP server that serves the static files and exposes a `/api/dashboard` endpoint that queries the SQLite store:

```typescript
// dashboard/server.ts
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MetricsStore } from '../core/metrics-store';

const PORT = parseInt(process.env.PROOF_OF_SKILL_PORT || '3095');
const store = new MetricsStore();

const server = createServer((req, res) => {
  if (req.url === '/api/dashboard') {
    const data = {
      skills: store.getMonitoredSkills(),
      invocations: store.getInvocationCounts('30d'),
      scores: store.getAllRecentScores('30d'),
      degradations: store.getUnresolvedDegradations(),
      optimizations: store.getOptimizationHistory('30d'),
      nearMisses: store.getNearMissCount(5), // within 5 points of threshold
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } else if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync(resolve(__dirname, 'index.html')));
  } else if (req.url === '/charts.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(readFileSync(resolve(__dirname, 'charts.js')));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`proof-of-skill dashboard: http://localhost:${PORT}`);
});
```

### Step 4: Near-miss detection

A "near-miss" is a skill whose latest score is within N points of its threshold. These skills are not yet degraded but are at risk:

```typescript
// In metrics-store.ts
getNearMissCount(margin: number = 5): number {
  const stmt = this.db.prepare(`
    SELECT COUNT(DISTINCT skill_name) as count
    FROM eval_scores e1
    WHERE timestamp = (
      SELECT MAX(timestamp) FROM eval_scores e2
      WHERE e2.skill_name = e1.skill_name
    )
    AND score >= (SELECT threshold FROM ... ) -- joined with config
    AND score < (SELECT threshold FROM ... ) + ?
  `);
  return stmt.get(margin).count;
}
```

The dashboard highlights near-misses with a yellow badge to encourage proactive attention.

## Acceptance Criteria

- [ ] `dashboard/index.html` is a single self-contained HTML file (CSS inlined, JS in separate file)
- [ ] `dashboard/charts.js` renders all visualizations without external charting libraries
- [ ] Invocation count bar chart shows one bar per skill, colored by health status
- [ ] Quality score line chart shows score trends over time with a threshold reference line
- [ ] Sparklines in the health table show the last 20 scores for each skill
- [ ] Summary cards show: total skills, average score, active degradations, near-miss count
- [ ] Optimization timeline shows events with before/after scores and convergence status
- [ ] The HTTP server serves static files and a `/api/dashboard` JSON endpoint
- [ ] The server port is configurable via `PROOF_OF_SKILL_PORT` environment variable (default: 3095)
- [ ] The dashboard auto-refreshes every 30 seconds
- [ ] The dashboard uses a dark theme consistent with developer tooling conventions
- [ ] The dashboard works in all modern browsers (Chrome, Firefox, Safari, Edge)
- [ ] Near-miss detection identifies skills within 5 points of their threshold

## Technical Notes

- **Zero dependencies**: The dashboard must not require npm install, webpack, or any build step. It is pure HTML + vanilla JS + Canvas 2D API. This keeps it aligned with proof-of-skill's "zero-config, invisible" philosophy
- **Canvas 2D vs SVG**: Use Canvas for the main charts (bar, line) where performance matters for many data points. Use inline SVG for sparklines where crispness at small sizes matters
- **Server**: The HTTP server is intentionally minimal -- no Express, no framework. `http.createServer` is sufficient. If the dashboard grows complex, consider upgrading to a lightweight framework later
- **SQLite access from server**: The server reads from SQLite in the same process. This is fine for a single-user local dashboard. Do not expose this server to the network
- **CORS**: Not needed since the dashboard is served from the same origin as the API
- **Responsive design**: The dashboard should work on both wide screens (side-by-side charts) and narrow screens (stacked). Use CSS Grid with `minmax()` for responsive layout
- **Color choices**: Use the same color semantics throughout: green = healthy (>= threshold), yellow = near-miss (within 5 points), red = degraded (below threshold). Respect `prefers-color-scheme` but default to dark
- **Accessibility**: Ensure chart data is also available in the table (screen readers). Use `aria-label` on canvases

## Verification

```bash
# 1. Start the dashboard server
node dashboard/server.js &
# Expect: "proof-of-skill dashboard: http://localhost:3095"

# 2. Open in browser
open http://localhost:3095
# Expect: Dashboard renders with summary cards, charts, and health table

# 3. Verify API endpoint
curl -s http://localhost:3095/api/dashboard | jq .
# Expect: JSON with skills, invocations, scores, degradations, optimizations

# 4. Verify auto-refresh
# Add a new eval score to the database
# Wait 30 seconds
# Expect: Dashboard updates without manual refresh

# 5. Verify with no data
# Start with empty database
# Expect: Dashboard shows "No monitored skills" or similar empty state

# 6. Verify port configuration
PROOF_OF_SKILL_PORT=9999 node dashboard/server.js &
curl -s http://localhost:9999/api/dashboard
# Expect: Dashboard accessible on port 9999

# 7. Cleanup
kill %1 %2
```
