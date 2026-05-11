// charts.js — zero-dependency charting for proof-of-skill dashboard
// Uses Canvas 2D for main charts, inline SVG for sparklines.

const API_BASE = ''; // Same origin
const REFRESH_INTERVAL = 30000; // 30 seconds
const THRESHOLD = 85;
const NEAR_MISS_MARGIN = 5;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function scoreColor(score) {
  if (score >= THRESHOLD) return '#3fb950'; // green
  if (score >= THRESHOLD - NEAR_MISS_MARGIN) return '#d29922'; // yellow (80-84)
  return '#f85149'; // red
}

function scoreClass(score) {
  if (score >= THRESHOLD) return 'green';
  if (score >= THRESHOLD - NEAR_MISS_MARGIN) return 'yellow';
  return 'red';
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchData() {
  const response = await fetch(`${API_BASE}/api/dashboard`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ---------------------------------------------------------------------------
// Summary cards
// ---------------------------------------------------------------------------

function renderSummaryCards(data) {
  const container = document.getElementById('summary-cards');
  if (!container) return;

  const { summary } = data;
  const avgScoreDisplay = summary.avgScore !== null ? summary.avgScore.toFixed(1) : '--';
  const avgScoreClass = summary.avgScore !== null ? scoreClass(summary.avgScore) : '';

  container.innerHTML = `
    <div class="card">
      <div class="card-label">Monitored Skills</div>
      <div class="card-value blue">${summary.totalSkills}</div>
    </div>
    <div class="card">
      <div class="card-label">Avg Quality Score</div>
      <div class="card-value ${avgScoreClass}">${avgScoreDisplay}</div>
    </div>
    <div class="card">
      <div class="card-label">Active Degradations</div>
      <div class="card-value ${summary.activeDegradations > 0 ? 'red' : 'green'}">${summary.activeDegradations}</div>
    </div>
    <div class="card">
      <div class="card-label">Near-Miss Skills</div>
      <div class="card-value ${summary.nearMissCount > 0 ? 'yellow' : 'green'}">${summary.nearMissCount}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Bar chart — Invocations per Skill
// ---------------------------------------------------------------------------

function drawBarChart(canvas, data) {
  const invocations = data.invocations;
  const skills = data.skills || [];
  const entries = Object.entries(invocations).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 20, bottom: 60, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Build skill->score map for coloring
  const scoreMap = {};
  for (const skill of skills) {
    scoreMap[skill.name] = skill.latestScore;
  }

  const maxCount = Math.max(...entries.map(([, v]) => v), 1);
  const barWidth = Math.min(60, (chartWidth / entries.length) * 0.7);
  const gap = (chartWidth - barWidth * entries.length) / (entries.length + 1);

  // Y-axis gridlines
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 0.5;
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = padding.top + (chartHeight * i) / yTicks;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Y-axis labels
    const val = Math.round(maxCount * (1 - i / yTicks));
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(val), padding.left - 8, y);
  }

  // Bars
  entries.forEach(([name, count], i) => {
    const x = padding.left + gap + i * (barWidth + gap);
    const barHeight = (count / maxCount) * chartHeight;
    const y = padding.top + chartHeight - barHeight;

    const score = scoreMap[name];
    ctx.fillStyle = score !== null && score !== undefined ? scoreColor(score) : '#58a6ff';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
    } else {
      ctx.rect(x, y, barWidth, barHeight);
    }
    ctx.fill();

    // X-axis labels
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Truncate long names
    const label = name.length > 12 ? name.slice(0, 11) + '\u2026' : name;
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartHeight + 8);
    ctx.rotate(-0.4);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------
// Line chart — Quality Scores Over Time
// ---------------------------------------------------------------------------

function drawLineChart(canvas, data) {
  const scores = data.scores || [];
  const skills = data.skills || [];

  if (scores.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Group scores by skill
  const bySkill = {};
  for (const s of scores) {
    if (!bySkill[s.skill_name]) bySkill[s.skill_name] = [];
    bySkill[s.skill_name].push(s);
  }

  // Time range
  const allTimestamps = scores.map((s) => new Date(s.timestamp).getTime());
  const minTime = Math.min(...allTimestamps);
  const maxTime = Math.max(...allTimestamps);
  const timeRange = maxTime - minTime || 1;

  // Score range: always 0-100 for quality scores
  const minScore = 0;
  const maxScore = 100;
  const scoreRange = maxScore - minScore;

  function xPos(timestamp) {
    return padding.left + ((new Date(timestamp).getTime() - minTime) / timeRange) * chartWidth;
  }

  function yPos(score) {
    return padding.top + chartHeight - ((score - minScore) / scoreRange) * chartHeight;
  }

  // Y-axis gridlines
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 0.5;
  for (let score = 0; score <= 100; score += 20) {
    const y = yPos(score);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = '#8b949e';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(score), padding.left - 8, y);
  }

  // Threshold reference line
  const thresholdY = yPos(THRESHOLD);
  ctx.strokeStyle = '#d29922';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, thresholdY);
  ctx.lineTo(width - padding.right, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Threshold label
  ctx.fillStyle = '#d29922';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`threshold: ${THRESHOLD}`, padding.left + 4, thresholdY - 3);

  // Draw lines per skill
  const skillColors = generateSkillColors(Object.keys(bySkill));
  for (const [skillName, skillScores] of Object.entries(bySkill)) {
    const color = skillColors[skillName] || '#58a6ff';

    // Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    skillScores.forEach((s, i) => {
      const x = xPos(s.timestamp);
      const y = yPos(s.score);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    for (const s of skillScores) {
      const x = xPos(s.timestamp);
      const y = yPos(s.score);
      ctx.fillStyle = scoreColor(s.score);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // X-axis date labels
  ctx.fillStyle = '#8b949e';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const dateLabels = 5;
  for (let i = 0; i <= dateLabels; i++) {
    const t = minTime + (timeRange * i) / dateLabels;
    const d = new Date(t);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const x = padding.left + (chartWidth * i) / dateLabels;
    ctx.fillText(label, x, height - padding.bottom + 8);
  }

  // Legend
  const legendY = padding.top + 4;
  let legendX = padding.left + 8;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textBaseline = 'middle';

  for (const [skillName, color] of Object.entries(skillColors)) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legendX, legendY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e6edf3';
    ctx.textAlign = 'left';
    const truncated = skillName.length > 15 ? skillName.slice(0, 14) + '\u2026' : skillName;
    ctx.fillText(truncated, legendX + 8, legendY);
    legendX += ctx.measureText(truncated).width + 24;
  }
}

function generateSkillColors(skillNames) {
  // Distinct hues for different skills
  const baseColors = [
    '#58a6ff', '#bc8cff', '#f778ba', '#ffa657',
    '#79c0ff', '#7ee787', '#ff7b72', '#d2a8ff',
  ];
  const colors = {};
  skillNames.forEach((name, i) => {
    colors[name] = baseColors[i % baseColors.length];
  });
  return colors;
}

// ---------------------------------------------------------------------------
// Sparklines (inline SVG)
// ---------------------------------------------------------------------------

function drawSparkline(scores) {
  if (!scores || scores.length === 0) {
    return '<span style="color:#8b949e">--</span>';
  }

  const w = 100;
  const h = 24;
  const padding = 2;
  const n = scores.length;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const points = scores.map((score, i) => {
    const x = padding + ((w - 2 * padding) * i) / Math.max(n - 1, 1);
    const y = h - padding - ((score - min) / range) * (h - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Determine trend color
  let strokeColor = '#8b949e'; // stable
  if (n >= 2) {
    const first = scores[0];
    const last = scores[scores.length - 1];
    if (last > first + 2) strokeColor = '#3fb950'; // improving
    else if (last < first - 2) strokeColor = '#f85149'; // declining
  }

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sparkline showing recent score trend">
    <polyline
      points="${points.join(' ')}"
      fill="none"
      stroke="${strokeColor}"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>`;
}

// ---------------------------------------------------------------------------
// Health table
// ---------------------------------------------------------------------------

function renderHealthTable(data) {
  const tbody = document.getElementById('health-table-body');
  if (!tbody) return;

  const skills = data.skills || [];

  if (skills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#8b949e">No monitored skills</td></tr>';
    return;
  }

  // Sort: degraded first, then by score ascending
  const sorted = [...skills].sort((a, b) => {
    if (a.hasDegradation !== b.hasDegradation) return a.hasDegradation ? -1 : 1;
    const aScore = a.latestScore ?? -1;
    const bScore = b.latestScore ?? -1;
    return aScore - bScore;
  });

  tbody.innerHTML = sorted
    .map((skill) => {
      const score = skill.latestScore;
      const scoreDisplay = score !== null ? String(score) : '--';
      const scoreColorClass = score !== null ? scoreClass(score) : '';

      // Trend arrow
      let trendArrow = '';
      let trendClass = 'stable';
      if (skill.trend === 'improving') {
        trendArrow = '\u2191';
        trendClass = 'improving';
      } else if (skill.trend === 'declining') {
        trendArrow = '\u2193';
        trendClass = 'declining';
      } else {
        trendArrow = '\u2192';
        trendClass = 'stable';
      }

      // Status badge
      let statusLabel = 'Healthy';
      let statusClass = 'healthy';
      if (skill.hasDegradation) {
        statusLabel = 'Degraded';
        statusClass = 'degraded';
      } else if (skill.isNearMiss) {
        statusLabel = 'Near-Miss';
        statusClass = 'near-miss';
      }

      return `<tr>
        <td><strong>${escapeHtml(skill.name)}</strong></td>
        <td><span class="score-badge ${scoreColorClass}">${scoreDisplay}</span></td>
        <td><span class="trend-arrow ${trendClass}">${trendArrow}</span> ${capitalize(skill.trend)}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td>${skill.invocationCount}</td>
        <td class="sparkline-cell">${drawSparkline(skill.recentScores)}</td>
      </tr>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Optimization timeline
// ---------------------------------------------------------------------------

function renderOptimizationTimeline(data) {
  const container = document.getElementById('timeline');
  if (!container) return;

  const optimizations = data.optimizations || [];

  if (optimizations.length === 0) {
    container.innerHTML = '<div class="timeline-empty">No optimization events recorded</div>';
    return;
  }

  // Most recent first
  const sorted = [...optimizations].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  container.innerHTML = sorted
    .map((opt) => {
      // Determine status
      let dotClass = 'in-progress';
      let statusText = 'In Progress';
      if (opt.result_score !== null && opt.result_score !== undefined) {
        if (opt.result_score >= THRESHOLD) {
          dotClass = 'converged';
          statusText = 'Converged';
        } else {
          dotClass = 'failed';
          statusText = 'Below Threshold';
        }
      }

      const triggerDisplay = opt.trigger_score;
      const resultDisplay =
        opt.result_score !== null && opt.result_score !== undefined
          ? opt.result_score
          : '...';

      const date = new Date(opt.timestamp);
      const dateStr = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const typeLabel = opt.optimization_type === 'ralph-loop' ? 'Ralph Loop' : capitalize(opt.optimization_type);

      return `<div class="timeline-item">
        <div class="timeline-dot ${dotClass}"></div>
        <div class="timeline-info">
          <div class="timeline-skill">${escapeHtml(opt.skill_name)}</div>
          <div class="timeline-meta">${typeLabel} &middot; ${dateStr}</div>
        </div>
        <div class="timeline-scores">
          <span class="score-badge ${scoreClass(triggerDisplay)}">${triggerDisplay}</span>
          &rarr;
          <span class="score-badge ${typeof resultDisplay === 'number' ? scoreClass(resultDisplay) : ''}">${resultDisplay}</span>
        </div>
      </div>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function renderEmptyState() {
  const content = document.getElementById('dashboard-content');
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  if (content) {
    content.style.display = 'none';
  }

  const main = document.getElementById('main-content');
  if (!main) return;

  // Check if empty state already exists
  if (document.getElementById('empty-state')) return;

  const empty = document.createElement('div');
  empty.id = 'empty-state';
  empty.className = 'empty-state';
  empty.innerHTML = `
    <h2>No monitored skills</h2>
    <p>Start recording skill invocations and eval scores to see data here.</p>
  `;
  main.appendChild(empty);
}

function removeEmptyState() {
  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();
}

// ---------------------------------------------------------------------------
// Main refresh loop
// ---------------------------------------------------------------------------

let isRefreshing = false;

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const data = await fetchData();

    if (data.summary.totalSkills === 0) {
      renderEmptyState();
      document.getElementById('last-updated').textContent =
        'Updated: ' + new Date().toLocaleTimeString();
      return;
    }

    removeEmptyState();

    const loading = document.getElementById('loading');
    const content = document.getElementById('dashboard-content');
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';

    renderSummaryCards(data);
    drawBarChart(document.getElementById('invocation-canvas'), data);
    drawLineChart(document.getElementById('score-canvas'), data);
    renderHealthTable(data);
    renderOptimizationTimeline(data);

    document.getElementById('last-updated').textContent =
      'Updated: ' + new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Dashboard refresh failed:', err);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.textContent = 'Failed to load dashboard data. Retrying...';
      loading.style.display = 'block';
    }
  } finally {
    isRefreshing = false;
  }
}

// Initial load + auto-refresh
refresh();
setInterval(refresh, REFRESH_INTERVAL);
