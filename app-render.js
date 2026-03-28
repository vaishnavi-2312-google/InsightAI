'use strict';
// ═══════════════════════════════════════════════
//  RENDER + CHARTS + CHATBOT + VOICE + PDF + INIT
// ═══════════════════════════════════════════════

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pct(n, t) { return Math.round(n / Math.max(t, 1) * 100) + '%'; }

// ─── RENDER ALL PANELS ───
function renderAllPanels() {
  if (!analysisData) return;
  const d = analysisData;
  // Topbar
  const apText = document.getElementById('apText');
  if (apText) apText.textContent = `${d.reviews.length} reviews analyzed`;
  // KPIs
  setText('kpiTotal', d.reviews.length);
  const avgScore = (d.reviews.reduce((a, r) => a + r.score, 0) / Math.max(d.reviews.length, 1));
  setText('kpiSentiment', (avgScore * 100).toFixed(0) + '%');
  setText('kpiCritical', d.urgency.critical.length);
  setText('kpiDupes', d.duplicates.reduce((a, g) => a + g.count, 0) || 0);
  setText('kpiChurn', d.churnRisks.filter(r => r.churnRisk === 'critical' || r.churnRisk === 'high').length);
  setText('kpiToxic', d.toxic.length);
  // Smart Alerts
  renderAlerts(d);
  // Charts
  buildDonut(d._raw);
  buildCategoryBar(d.themes);
  buildTrendLine(d.reviews);
  renderWordCloud(d.reviews);
  renderUrgencyHeatmap(d.reviews);
  // All panels
  renderInsightsPanel(d);
  renderSentimentCards(d.reviews);
  renderThemesGrid(d.themes);
  renderUrgencyBands(d.urgency);
  renderRICETable(d.rice);
  renderReport(d);
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ─── SMART ALERTS (strip only, no bell) ───
function renderAlerts(d) {
  const strip = document.getElementById('smartAlerts');
  if (!strip) return;
  const alerts = [];
  if (d.urgency.critical.length) alerts.push({ ico: '🚨', txt: `${d.urgency.critical.length} CRITICAL issue${d.urgency.critical.length > 1 ? 's' : ''} require immediate attention!` });
  if (d.churnRisks.filter(r => r.churnRisk === 'critical').length) alerts.push({ ico: '⚠️', txt: `${d.churnRisks.filter(r => r.churnRisk === 'critical').length} user${d.churnRisks.filter(r => r.churnRisk === 'critical').length > 1 ? 's are' : ' is'} at CRITICAL churn risk. Contact them now.` });
  if (d.toxic.filter(r => r.toxicity === 'high').length) alerts.push({ ico: '☣️', txt: `${d.toxic.filter(r => r.toxicity === 'high').length} severely toxic feedback entries detected.` });
  if (d.dupPct > 20) alerts.push({ ico: '🔄', txt: `${d.dupPct}% duplicate feedback — consider merging similar tickets.` });
  if (alerts.length) {
    strip.style.display = 'flex';
    strip.innerHTML = alerts.map(a => `<div class="alert-item"><span class="ai-ico">${a.ico}</span><span class="ai-txt">${esc(a.txt)}</span></div>`).join('');
  } else {
    strip.style.display = 'none';
  }
}

// ─── CHART: DONUT ───
function buildDonut(raw) {
  const ctx = document.getElementById('sentimentDonut');
  if (!ctx) return;
  if (charts.donut) { charts.donut.destroy(); charts.donut = null; }
  const dnutNum = document.getElementById('dnutNum');
  const posP = Math.round(raw.pos / Math.max(raw.total, 1) * 100);
  if (dnutNum) dnutNum.textContent = posP + '%';
  ['lPos', 'lNeu', 'lNeg'].forEach((id, i) => {
    setText(id, [pct(raw.pos, raw.total), pct(raw.neu, raw.total), pct(raw.neg, raw.total)][i]);
  });
  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Positive', 'Neutral', 'Negative'], datasets: [{ data: [raw.pos, raw.neu, raw.neg], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderColor: 'transparent', hoverOffset: 12, borderRadius: 6, spacing: 4 }] },
    options: { responsive: true, maintainAspectRatio: true, cutout: '70%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.label}: ${c.raw} (${Math.round(c.parsed / raw.total * 100)}%)` } } }, animation: { animateRotate: true, duration: 900 } },
  });
}

// ─── CHART: CATEGORY BAR ───
function buildCategoryBar(themes) {
  const ctx = document.getElementById('categoryBar');
  if (!ctx) return;
  if (charts.bar) { charts.bar.destroy(); charts.bar = null; }
  const labels = themes.map(t => t.theme.split(' ').slice(1).join(' '));
  const data = themes.map(t => t.priority_score);
  const colors = themes.map(t => t.priority_score >= 8 ? 'rgba(239,68,68,.7)' : t.priority_score >= 5 ? 'rgba(245,158,11,.7)' : 'rgba(16,185,129,.7)');
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Priority Score', data, backgroundColor: colors, borderRadius: 8, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 10, beginAtZero: true, ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.04)' } }, x: { ticks: { color: '#94a3b8', maxRotation: 30, font: { size: 10 } }, grid: { display: false } } }, animation: { duration: 800 } },
  });
}

// ─── CHART: TREND LINE ───
function buildTrendLine(reviews) {
  const ctx = document.getElementById('trendLine');
  if (!ctx) return;
  if (charts.trend) { charts.trend.destroy(); charts.trend = null; }
  const days = 7, dayLabels = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
  }
  // Distribute reviews across days
  const chunk = Math.ceil(reviews.length / days);
  const dailyScores = [];
  for (let i = 0; i < days; i++) {
    const slice = reviews.slice(i * chunk, (i + 1) * chunk);
    const avg = slice.length ? slice.reduce((a, r) => a + r.score, 0) / slice.length : 0.5;
    dailyScores.push(parseFloat((avg * 100).toFixed(1)));
  }
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: { labels: dayLabels, datasets: [{ label: 'Sentiment %', data: dailyScores, borderColor: '#00E5FF', backgroundColor: 'rgba(0,229,255,.08)', fill: true, tension: 0.4, pointBackgroundColor: '#00E5FF', pointRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { color: '#64748b', callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,.04)' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } }, animation: { duration: 800 } },
  });
}

// ─── WORD CLOUD (Canvas) ───
function renderWordCloud(reviews) {
  const canvas = document.getElementById('wordCloudCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const STOP = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'off', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'just', 'with', 'this', 'that', 'have', 'from', 'they', 'been', 'your', 'what', 'will', 'there', 'these', 'those', 'like', 'more', 'even', 'than', 'then', 'when', 'very', 'also', 'only', 'most', 'ever', 'much', 'over', 'such', 'into', 'some', 'time', 'want', 'well', 'very', 'really', 'about']);
  const freq = {};
  reviews.forEach(r => {
    r.text.toLowerCase().split(/\W+/).forEach(w => {
      if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
    });
  });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30);
  if (!sorted.length) return;
  const max = sorted[0][1];
  const colors = ['#00E5FF', '#9B5DE5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
  const placed = [];
  canvas.width = canvas.offsetWidth || 400;
  const W = canvas.width, H = canvas.height || 200;
  sorted.forEach(([word, count]) => {
    const size = Math.round(12 + ((count / max) * 28));
    ctx.font = `${size}px Inter`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(word).width;
    let x, y, tries = 0, ok = false;
    while (!ok && tries < 60) {
      x = w / 2 + Math.random() * (W - w);
      y = size + Math.random() * (H - size - 4);
      ok = placed.every(p => Math.abs(p.x - x) > p.w / 2 + w / 2 + 4 || Math.abs(p.y - y) > p.s + size);
      tries++;
    }
    if (ok) {
      placed.push({ x, y, w, s: size });
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.globalAlpha = 0.6 + 0.4 * (count / max);
      ctx.fillText(word, x, y);
      ctx.globalAlpha = 1;
    }
  });
}

// ─── URGENCY HEATMAP ───
function renderUrgencyHeatmap(reviews) {
  const el = document.getElementById('urgencyHeatmap');
  if (!el) return;
  el.innerHTML = '';
  const items = [...reviews].sort((a, b) => {
    const ord = { critical: 0, high: 1, medium: 2, low: 3 };
    return ord[a.urgency] - ord[b.urgency];
  }).slice(0, 30);
  items.forEach(r => {
    const cell = document.createElement('div');
    cell.className = `uhm-cell ${r.urgency === 'critical' ? 'crit' : r.urgency === 'high' ? 'high' : r.urgency === 'medium' ? 'med' : 'low'}`;
    cell.title = r.text.slice(0, 80);
    el.appendChild(cell);
  });
  // Fill empties
  for (let i = items.length; i < 30; i++) {
    const cell = document.createElement('div');
    cell.className = 'uhm-cell none';
    el.appendChild(cell);
  }
}

function rebuildCharts() {
  if (!analysisData) return;
  buildDonut(analysisData._raw);
  buildCategoryBar(analysisData.themes);
  buildTrendLine(analysisData.reviews);
  renderWordCloud(analysisData.reviews);
  renderUrgencyHeatmap(analysisData.reviews);
}

// ─── INSIGHTS PANEL ───
function renderInsightsPanel(d) {
  // Duplicates
  const dupPct = document.getElementById('dupePct');
  if (dupPct) dupPct.textContent = `${d.dupPct}% duplicates`;
  const dupeList = document.getElementById('dupeList');
  if (dupeList) {
    dupeList.innerHTML = d.duplicates.length
      ? d.duplicates.map(g => `<div class="insight-item"><div class="ii-text">🔄 ${g.count} similar entries</div><div class="ii-meta">${g.items.map(t => `<span class="ii-score">"${esc(t.slice(0, 60))}…"</span>`).join('')}</div></div>`).join('')
      : `<div class="insight-item"><div class="ii-text" style="color:var(--pos)">✅ No significant duplicates detected</div></div>`;
  }
  // Toxic
  const toxicCount = document.getElementById('toxicCount');
  if (toxicCount) toxicCount.textContent = `${d.toxic.length} flagged`;
  const toxicList = document.getElementById('toxicList');
  if (toxicList) {
    toxicList.innerHTML = d.toxic.length
      ? d.toxic.map(r => `<div class="insight-item"><div class="ii-text">"${esc(r.text.slice(0, 100))}"</div><div class="ii-meta"><span class="ii-chip ${r.toxicity === 'high' ? 'crit' : r.toxicity === 'medium' ? 'high' : 'med'}">${r.toxicSeverity}</span></div>${r.safeRephrase ? `<div class="ii-safe-rephrase">💬 Safe: "${esc(r.safeRephrase.slice(0, 100))}"</div>` : ''}</div>`).join('')
      : `<div class="insight-item"><div class="ii-text" style="color:var(--pos)">✅ No toxic feedback detected</div></div>`;
  }
  // Churn
  const churnCount = document.getElementById('churnCount');
  if (churnCount) churnCount.textContent = `${d.churnRisks.length} at risk`;
  const churnList = document.getElementById('churnList');
  if (churnList) {
    churnList.innerHTML = d.churnRisks.length
      ? d.churnRisks.sort((a, b) => b.churnPct - a.churnPct).map(r => `<div class="insight-item"><div class="ii-text">"${esc(r.text.slice(0, 100))}"</div><div class="ii-meta"><span class="ii-chip ${r.churnRisk}">${r.churnRisk === 'critical' ? '🚨' : '⚠️'} ${r.churnRisk} (${r.churnPct}% risk)</span><span class="ii-chip ${r.sentiment}">${r.emoji} ${r.label}</span></div></div>`).join('')
      : `<div class="insight-item"><div class="ii-text" style="color:var(--pos)">✅ No high churn risk detected</div></div>`;
  }
  // Personas
  const personaList = document.getElementById('personaList');
  if (personaList) {
    const icons = { 'Frustrated User': '😤', 'At-Risk User': '⚠️', 'Power User': '💪', 'Brand Champion': '🎉', 'New Customer': '👋', 'Neutral Observer': '😐' };
    personaList.innerHTML = Object.entries(d.personaCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => `<div class="persona-chip"><div class="pc-ico">${icons[name] || '👤'}</div><div class="pc-name">${esc(name)}</div><div class="pc-count">${count} user${count > 1 ? 's' : ''}</div></div>`).join('');
  }
}

// ─── SENTIMENT CARDS ───
function renderSentimentCards(reviews) {
  const grid = document.getElementById('sentimentCards');
  if (!grid) return;
  const filtered = sentimentFilter === 'all' ? reviews : reviews.filter(r => r.label === sentimentFilter);
  grid.innerHTML = '';
  if (!filtered.length) { grid.innerHTML = '<div class="dash-card" style="text-align:center;color:var(--txt2)">No entries for this filter.</div>'; return; }
  filtered.forEach((r, i) => {
    const card = document.createElement('div');
    card.className = 'sent-card';
    card.style.animationDelay = (i * 0.04) + 's';
    card.innerHTML = `
      <div class="sc-top">
        <div class="sc-emoji">${r.emoji}</div>
        <div class="sc-text">${esc(r.text)}</div>
      </div>
      <div class="sc-bottom">
        <span class="sc-score ${r.label}">${r.emoji} ${r.label} · ${(r.score * 100).toFixed(0)}%</span>
        <div class="sc-score-bar"><div class="sc-score-fill ${r.label}" style="width:${r.score * 100}%"></div></div>
        <span class="ii-chip ${r.urgency}">${r.urgency}</span>
      </div>`;
    grid.appendChild(card);
  });
}

// ─── THEMES GRID ───
function renderThemesGrid(themes) {
  const grid = document.getElementById('themesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!themes.length) { grid.innerHTML = '<div class="dash-card" style="grid-column:1/-1;text-align:center;color:var(--txt2)">No themes identified. Try adding more feedback.</div>'; return; }
  themes.forEach((t, i) => {
    const lvl = t.priority_score >= 8 ? 'high' : t.priority_score >= 5 ? 'medium' : 'low';
    const lbl = t.priority_score >= 8 ? '🔴 High' : t.priority_score >= 5 ? '🟡 Medium' : '🟢 Low';
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.style.animationDelay = (i * 0.07) + 's';
    card.innerHTML = `
      <div class="tc-head"><div class="tc-name">${esc(t.theme)}</div><div class="pri-badge ${lvl}">${lbl} · ${t.priority_score}/10</div></div>
      <div class="tc-summary">${esc(t.summary)}</div>
      <div class="tc-ex-label">Example Feedback</div>
      ${t.examples.slice(0, 2).map(ex => `<div class="tc-ex">"${esc(ex.slice(0, 130))}${ex.length > 130 ? '…' : ''}"</div>`).join('')}
      <div class="tc-score-row">
        <div class="tc-bar"><div class="tc-bar-fill" style="width:${t.priority_score * 10}%"></div></div>
        <div class="tc-score-txt">Priority ${t.priority_score}/10 · ${t.negRatio}% negative · ${t.matches} mentions</div>
      </div>`;
    grid.appendChild(card);
  });
}

// ─── URGENCY BANDS ───
function renderUrgencyBands(urgency) {
  ['critical', 'high', 'medium', 'low'].forEach(lvl => {
    const el = document.getElementById('urg-' + lvl);
    if (!el) return;
    el.innerHTML = urgency[lvl].length
      ? urgency[lvl].map(r => `<div class="ub-item">${r.emoji} ${esc(r.text.slice(0, 120))}</div>`).join('')
      : `<div class="ub-item" style="color:var(--txt3)">No ${lvl} urgency items.</div>`;
  });
}

// ─── RICE TABLE ───
function renderRICETable(rice) {
  const tbody = document.getElementById('riceTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rice.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--txt2);padding:30px">No feature requests detected in feedback.</td></tr>'; return; }
  rice.forEach((item, i) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${esc(item.theme)}</strong><br><small style="color:var(--txt3)">${esc((item.examples[0] || '').slice(0, 60))}…</small></td>
      <td>${item.reach}</td>
      <td>${item.impact}</td>
      <td>${(item.confidence * 100).toFixed(0)}%</td>
      <td>${item.effort}</td>
      <td><div class="rice-score">${item.riceScore}</div><div class="rice-bar"><div class="rice-bar-fill" style="width:${Math.min(item.riceScore / 15 * 100, 100)}%"></div></div></td>
      <td><span class="rice-pri ${item.priority}">${item.priority === 'critical' ? '🚨' : item.priority === 'high' ? '⚠️' : item.priority === 'medium' ? '📌' : '✅'} ${item.priority}</span></td>`;
    tbody.appendChild(row);
  });
}
// ─── REPORT ───
function renderReport(d) {
  const rp = document.getElementById('rpBody');
  const rpDate = document.getElementById('rp-date');
  if (rpDate) rpDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (!rp) return;
  rp.innerHTML = '';
  d.report.split('\n\n').filter(p => p.trim()).forEach((para, i) => {
    const div = document.createElement('div');
    div.className = 'rp';
    div.style.animationDelay = (i * 0.1) + 's';
    div.innerHTML = para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    rp.appendChild(div);
  });
}

// ─── PDF EXPORT ───
function downloadPDF() {
  if (!analysisData) { alert('Please run an analysis first!'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const d = analysisData;
  const W = 210, M = 16, TW = W - M * 2;
  let y = 0;
  const COL = { hdr: [0, 229, 255], title: [155, 93, 229], body: [220, 225, 235], muted: [140, 150, 170], white: [255, 255, 255], dark: [8, 12, 28] };

  function newPage() { doc.addPage(); y = 20; }
  function checkY(need) { if (y + need > 282) newPage(); }

  function heading(text, level) {
    checkY(10);
    if (level === 1) {
      doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COL.hdr);
    } else if (level === 2) {
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COL.title);
    } else {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COL.white);
    }
    doc.text(text, M, y); y += 6;
  }

  function body(text, indent) {
    checkY(6);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COL.body);
    const lines = doc.splitTextToSize(String(text), TW - (indent || 0));
    lines.forEach(ln => { checkY(5); doc.text(ln, M + (indent || 0), y); y += 4.8; });
    y += 1;
  }

  function bullet(text, indent) {
    checkY(6);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COL.body);
    const x = M + (indent || 0) + 4;
    doc.setFillColor(...COL.hdr); doc.circle(M + (indent || 0) + 1, y - 1.2, 1, 'F');
    const lines = doc.splitTextToSize(String(text), TW - (indent || 0) - 6);
    lines.forEach((ln, i) => { checkY(5); doc.text(ln, i === 0 ? x : x + 1, y); y += 4.6; });
  }

  function divider() { checkY(4); doc.setDrawColor(...COL.title); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 5; }
  function spacer(n) { y += n || 4; }
  function chip(text, x, cy, bg, tc) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    const tw = doc.getTextWidth(text) + 6;
    doc.setFillColor(...bg); doc.roundedRect(x, cy - 4, tw, 6, 1.5, 1.5, 'F');
    doc.setTextColor(...tc); doc.text(text, x + 3, cy);
    return tw + 3;
  }

  // ── COVER PAGE ──
  doc.setFillColor(8, 12, 28); doc.rect(0, 0, W, 297, 'F');
  // Header stripe
  doc.setFillColor(0, 50, 80); doc.rect(0, 0, W, 55, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...COL.hdr);
  doc.text('PulseAI Feedback Intelligence', M, 26);
  doc.setFontSize(14); doc.setTextColor(...COL.white);
  doc.text('Full Analysis Report', M, 36);
  doc.setFontSize(9); doc.setTextColor(...COL.muted);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, M, 46);
  doc.text(`Total Reviews Analyzed: ${d.reviews.length}`, W - M - 60, 46);

  // Summary boxes on cover
  const metrics = [
    { l: 'Total Reviews', v: d.reviews.length },
    { l: 'Positive', v: d.sentiment.positive },
    { l: 'Negative', v: d.sentiment.negative },
    { l: 'Critical Issues', v: d.urgency.critical.length },
    { l: 'Churn Risk', v: d.churnRisks.length },
    { l: 'Themes Found', v: d.themes.length },
  ];
  const bw = 30, bh = 18, bstart = 65;
  metrics.forEach((m, i) => {
    const bx = M + (i % 3) * (bw + 4), by = bstart + Math.floor(i / 3) * (bh + 4);
    doc.setFillColor(15, 22, 52); doc.roundedRect(bx, by, bw, bh, 2, 2, 'F');
    doc.setDrawColor(...COL.hdr); doc.setLineWidth(0.3); doc.roundedRect(bx, by, bw, bh, 2, 2, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...COL.hdr);
    doc.text(String(m.v), bx + bw / 2, by + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...COL.muted);
    doc.text(m.l, bx + bw / 2, by + 15, { align: 'center' });
  });

  // Table of Contents on cover
  const toc = [
    '1. Sentiment Analysis Summary',
    '2. Feedback Themes and Categories',
    '3. Urgency Classification',
    '4. Top Priority Issues',
    '5. Feature Requests (RICE Framework)',
    '6. Duplicate Feedback Detection',
    '7. Toxic Feedback Report',
    '8. Churn Risk Predictions',
    '9. User Persona Analysis',
    '10. All Reviewed Feedback Entries',
    '11. AI-Generated Insights and Recommendations',
  ];
  let ty = 120;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COL.title);
  doc.text('TABLE OF CONTENTS', M, ty); ty += 8;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COL.body);
  toc.forEach(item => { doc.text(item, M + 4, ty); ty += 7; });

  doc.setFontSize(8); doc.setTextColor(...COL.muted);
  doc.text('PulseAI v2.0 • 100% Local Processing • All data stays on your device', M, 290);

  // ══ PAGE 2 ONWARDS ══
  newPage();

  // ── SECTION 1: SENTIMENT ──
  heading('1. SENTIMENT ANALYSIS SUMMARY', 1); divider();
  const pos = parseInt(d.sentiment.positive), neu = parseInt(d.sentiment.neutral), neg = parseInt(d.sentiment.negative);
  body(`This section breaks down the overall emotional tone of all ${d.reviews.length} feedback entries. Each review was scored on a scale of 0 to 1, where 1 is fully positive and 0 is fully negative. The scores were then grouped into three categories: Positive, Neutral, and Negative.`);
  spacer(3);
  bullet(`Positive Feedback: ${d.sentiment.positive} of reviews (${d._raw.pos} entries) — These users are happy and satisfied. They mention quality, support, ease of use, and value. Retaining and amplifying their experience is key.`);
  bullet(`Neutral Feedback: ${d.sentiment.neutral} of reviews (${d._raw.neu} entries) — These users have a mixed or indifferent experience. They are neither delighted nor frustrated. A small improvement in service could convert them to advocates.`);
  bullet(`Negative Feedback: ${d.sentiment.negative} of reviews (${d._raw.neg} entries) — These users are dissatisfied. They report problems with delivery, bugs, pricing, or support. Addressing their issues directly is essential to reduce churn.`);
  spacer(3);
  const avgScore = (d.reviews.reduce((a, r) => a + r.score, 0) / Math.max(d.reviews.length, 1) * 100).toFixed(1);
  body(`Average sentiment score: ${avgScore}%. ${pos >= 60 ? 'The majority of customers are satisfied. Focus on eliminating the remaining pain points.' : pos >= 45 ? 'Sentiment is mixed. There are clear opportunities for improvement in specific areas.' : 'The overall sentiment is predominantly negative. Urgent action is required across multiple touchpoints.'}`);

  spacer(4); heading('Individual Review Sentiments (Sample)', 2); spacer(2);
  d.reviews.slice(0, 10).forEach((r, i) => {
    checkY(8);
    const label = r.label === 'positive' ? 'POSITIVE' : r.label === 'negative' ? 'NEGATIVE' : 'NEUTRAL';
    const bg = r.label === 'positive' ? [16, 100, 60] : r.label === 'negative' ? [120, 20, 20] : [120, 90, 10];
    const tc = [255, 255, 255];
    let cx = M;
    cx += chip(`#${i + 1}`, cx, y, bg, tc) + 2;
    cx += chip(label, cx, y, bg, tc) + 2;
    cx += chip(`${(r.score * 100).toFixed(0)}%`, cx, y, [30, 40, 80], COL.hdr) + 2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...COL.body);
    const txt = r.text.length > 70 ? r.text.slice(0, 70) + '...' : r.text;
    const lines = doc.splitTextToSize(txt, TW - cx + M);
    lines.forEach((ln, li) => { checkY(5); doc.text(ln, cx, li === 0 ? y : y + 4.5 * li); });
    y += Math.max(6, lines.length * 4.5) + 2;
  });
  if (d.reviews.length > 10) { body(`... and ${d.reviews.length - 10} more feedback entries. See Section 10 for the full list.`); }

  // ── SECTION 2: THEMES ──
  newPage();
  heading('2. FEEDBACK THEMES AND CATEGORIES', 1); divider();
  body(`PulseAI automatically grouped all feedback into key topic areas. Each theme is scored from 0 to 10 based on how many users mentioned it, how negative the mentions were, and how severely critical the language was. A score of 8 or higher means the theme needs immediate attention.`);
  spacer(3);
  if (d.themes.length === 0) {
    body('No significant themes were detected. Try providing more feedback entries (10 or more recommended).');
  } else {
    d.themes.forEach((t, i) => {
      checkY(22);
      heading(`Theme ${i + 1}: ${t.theme}`, 2);
      body(`Priority Score: ${t.priority_score}/10 | Total Mentions: ${t.matches} | Negative Mentions: ${t.negRatio}%`);
      body(`What this means: ${t.priority_score >= 8 ? 'This is a CRITICAL area. A large number of users are reporting serious problems here. This should be escalated immediately to the relevant team.' : t.priority_score >= 5 ? 'This is a MODERATE concern. Multiple users have flagged issues in this area. It should be scheduled for improvement in the near term.' : 'This area appears mostly fine. A small number of users mentioned it, mostly in a neutral or positive way. Monitor over time.'}`);
      if (t.examples.length) {
        body('Example feedback from users:', 4);
        t.examples.forEach(ex => bullet(`"${ex.slice(0, 110)}${ex.length > 110 ? '...' : ''}"`, 4));
      }
      spacer(4);
    });
  }

  // ── SECTION 3: URGENCY ──
  newPage();
  heading('3. URGENCY CLASSIFICATION', 1); divider();
  body(`Every feedback entry was classified into one of four urgency levels based on the language used, sentiment score, and severity of the issue. This helps product and support teams know exactly where to focus first.`);
  spacer(2);

  const urgLevels = [
    { key: 'critical', label: 'CRITICAL', icon: 'CRITICAL', desc: 'These entries use highly negative language and report serious failures. They must be addressed within 24 hours.', bg: [120, 20, 20], tc: [255, 180, 180] },
    { key: 'high', label: 'HIGH URGENCY', icon: 'HIGH', desc: 'These users are clearly frustrated and report significant issues. They should be addressed this week.', bg: [120, 60, 10], tc: [255, 200, 140] },
    { key: 'medium', label: 'MEDIUM', icon: 'MEDIUM', desc: 'These users report noticeable issues but without extreme language. Address within the next sprint cycle.', bg: [100, 80, 0], tc: [255, 230, 100] },
    { key: 'low', label: 'LOW', icon: 'LOW', desc: 'These entries are generally positive or mildly negative. No immediate action required.', bg: [10, 80, 50], tc: [150, 255, 180] },
  ];

  urgLevels.forEach(level => {
    const items = d.urgency[level.key] || [];
    checkY(14);
    chip(` ${level.label} (${items.length} entries) `, M, y, level.bg, level.tc); y += 8;
    body(level.desc);
    if (items.length) {
      items.slice(0, 3).forEach(r => bullet(`"${r.text.slice(0, 100)}${r.text.length > 100 ? '...' : ''}"`, 4));
      if (items.length > 3) body(`  ... and ${items.length - 3} more ${level.key} urgency entries.`);
    } else {
      body('  No entries at this urgency level.', 4);
    }
    spacer(4);
  });

  // ── SECTION 4: PRIORITY ISSUES ──
  newPage();
  heading('4. TOP PRIORITY ISSUES', 1); divider();
  body(`These are the most important issues identified from the feedback, ranked by their overall priority score. Each issue represents a theme or category where customer dissatisfaction is highest. Resolving these will have the greatest positive impact on customer satisfaction.`);
  spacer(3);
  if (d.priorities.length === 0) {
    body('No priority issues identified. Your feedback appears to be mostly positive.');
  } else {
    d.priorities.forEach((p, i) => {
      checkY(18);
      heading(`Issue #${i + 1}: ${p.theme}`, 2);
      body(`Severity Score: ${p.score}/10 — ${p.score >= 8 ? 'CRITICAL — This issue affects many users severely and must be fixed immediately.' : p.score >= 5 ? 'HIGH — This issue is reported by multiple users and should be prioritized.' : 'MODERATE — This issue is worth addressing but is not yet critical.'}`);
      body(`Why it matters: ${p.reason}`);
      spacer(4);
    });
  }

  // ── SECTION 5: RICE ──
  newPage();
  heading('5. FEATURE REQUESTS (RICE FRAMEWORK)', 1); divider();
  body(`RICE is a scoring framework used to prioritize feature requests. It stands for: Reach (how many users want it), Impact (how much it will improve their experience), Confidence (how certain we are), and Effort (how hard it is to build). A higher RICE score means a feature should be built sooner.`);
  spacer(3);
  if (d.rice.length === 0) {
    body('No explicit feature requests were detected in the feedback. Feature requests typically include phrases like "I wish", "please add", "would like", "missing feature", etc.');
  } else {
    d.rice.forEach((r, i) => {
      checkY(22);
      heading(`Feature #${i + 1}: ${r.theme}`, 2);
      body(`RICE Score: ${r.riceScore} | Priority: ${r.priority.toUpperCase()}`);
      body(`Breakdown:`);
      bullet(`Reach: ${r.reach} users mentioned this feature — meaning ${r.reach} different customers would benefit immediately.`);
      bullet(`Impact: ${r.impact}/10 — This is an estimate of how much satisfaction would improve if this feature were built.`);
      bullet(`Confidence: ${(r.confidence * 100).toFixed(0)}% — How confident we are that building this will have the expected impact.`);
      bullet(`Effort: ${r.effort}/3 — How difficult the feature is to implement (1 = easy, 3 = complex).`);
      if (r.examples.length) { body('What users said:', 4); r.examples.slice(0, 2).forEach(ex => bullet(`"${ex.slice(0, 100)}"`, 4)); }
      spacer(4);
    });
  }

  // ── SECTION 6: DUPLICATES ──
  newPage();
  heading('6. DUPLICATE FEEDBACK DETECTION', 1); divider();
  body(`PulseAI uses a technique called cosine similarity to compare every piece of feedback against every other entry. When two entries are more than 65% similar, they are grouped together as duplicates. This tells you when the same complaint or praise is being repeated by different users.`);
  spacer(2);
  body(`Duplication Rate: ${d.dupPct}% of feedback entries are similar to at least one other entry.`);
  body(`Total duplicate groups found: ${d.duplicates.length}`);
  spacer(2);
  if (d.duplicates.length === 0) {
    body('Great news — no significant duplicates were found. Each piece of feedback appears to be unique.');
  } else {
    body('The following groups of feedback were found to be very similar to each other:');
    spacer(2);
    d.duplicates.slice(0, 6).forEach((grp, i) => {
      checkY(16);
      body(`Duplicate Group ${i + 1} (${grp.count} similar entries):`);
      grp.items.slice(0, 3).forEach(item => bullet(`"${item.slice(0, 100)}"`, 4));
      spacer(2);
    });
  }

  // ── SECTION 7: TOXIC FEEDBACK ──
  newPage();
  heading('7. TOXIC FEEDBACK REPORT', 1); divider();
  body(`This section identifies feedback that contains abusive, offensive, or toxic language. Detecting toxic feedback is important for two reasons: first, it signals extreme customer frustration that may lead to churn; second, it helps support teams prepare appropriate responses.`);
  spacer(2);
  body(`Total toxic entries found: ${d.toxic.length} out of ${d.reviews.length} reviews (${pct(d.toxic.length, d.reviews.length)}).`);
  spacer(2);
  if (d.toxic.length === 0) {
    body('No toxic or abusive feedback was detected. Customers are expressing their concerns respectfully.');
  } else {
    d.toxic.forEach((r, i) => {
      checkY(20);
      heading(`Entry ${i + 1} — Severity: ${r.toxicSeverity}`, 3);
      body(`Original: "${r.text.slice(0, 120)}${r.text.length > 120 ? '...' : ''}"`);
      if (r.safeRephrase) body(`Safe version: "${r.safeRephrase.slice(0, 120)}"`);
      body(`Urgency level of this user: ${r.urgency.toUpperCase()}`);
      spacer(3);
    });
  }

  // ── SECTION 8: CHURN RISK ──
  newPage();
  heading('8. CHURN RISK PREDICTIONS', 1); divider();
  body(`Churn risk measures the likelihood that a user who left this feedback will stop using your product or service. PulseAI calculates churn risk using four signals: sentiment score (how negative the feedback is), urgency level (how serious the complaint is), toxicity level (how angry the user is), and complaint density (how many negative keywords appear).`);
  spacer(2);
  body(`Total users with elevated churn risk: ${d.churnRisks.length} out of ${d.reviews.length} (${pct(d.churnRisks.length, d.reviews.length)}).`);
  const crit = d.churnRisks.filter(r => r.churnRisk === 'critical'), high = d.churnRisks.filter(r => r.churnRisk === 'high'), med = d.churnRisks.filter(r => r.churnRisk === 'medium');
  bullet(`Critical Risk (70%+ churn probability): ${crit.length} users — Immediate personal outreach is recommended.`);
  bullet(`High Risk (45-69% churn probability): ${high.length} users — Contact within 48 hours.`);
  bullet(`Medium Risk (20-44% churn probability): ${med.length} users — Monitor and improve their experience.`);
  spacer(3);
  if (d.churnRisks.length === 0) {
    body('Great news — no users show elevated churn risk based on their feedback. Keep maintaining high satisfaction levels.');
  } else {
    body('Users most at risk of churning:');
    spacer(2);
    d.churnRisks.sort((a, b) => b.churnPct - a.churnPct).slice(0, 8).forEach((r, i) => {
      checkY(14);
      heading(`Risk #${i + 1}: ${r.churnRisk.toUpperCase()} — ${r.churnPct}% probability`, 3);
      body(`"${r.text.slice(0, 110)}${r.text.length > 110 ? '...' : ''}"`);
      body(`Why at risk: Sentiment ${(r.score * 100).toFixed(0)}% positive, Urgency: ${r.urgency}, Toxicity: ${r.toxicity}.`);
      spacer(3);
    });
  }

  // ── SECTION 9: PERSONAS ──
  newPage();
  heading('9. USER PERSONA ANALYSIS', 1); divider();
  body(`PulseAI classifies every user into a behavioral persona based on their language, sentiment, and the type of issues they raised. Understanding your user personas helps you tailor your communication, product updates, and support responses.`);
  spacer(3);
  const personaDesc = {
    'Frustrated User': 'This user is clearly unhappy. They use negative language and report multiple issues. They need prompt, empathetic support. Risk of leaving is high.',
    'At-Risk User': 'This user shows strong signals of churning. Their feedback is very negative, urgent, or toxic. Immediate personal outreach is recommended.',
    'Power User': 'This user understands your product deeply. They are asking for new features and improvements. Engage them in beta programs and feedback loops.',
    'Brand Champion': 'This user loves your product and recommends it to others. These are your best advocates. Thank them and encourage reviews.',
    'New Customer': 'This user is likely new to your product. Their feedback is often about onboarding, first impressions, and ease of use. Improve their early experience.',
    'Neutral Observer': 'This user has a balanced view. They are not strongly positive or negative. A small improvement in their experience could turn them into an advocate.',
  };
  Object.entries(d.personaCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    checkY(16);
    heading(name, 2);
    body(`Count: ${count} user${count > 1 ? 's' : ''} (${pct(count, d.reviews.length)} of all respondents)`);
    body(personaDesc[name] || 'A unique user type identified in your feedback.');
    spacer(3);
  });

  // ── SECTION 10: ALL FEEDBACK ──
  newPage();
  heading('10. ALL REVIEWED FEEDBACK ENTRIES', 1); divider();
  body(`This section lists every individual feedback entry that was analyzed, along with its sentiment label, urgency level, persona classification, and churn risk score.`);
  spacer(3);
  d.reviews.forEach((r, i) => {
    checkY(12);
    let cx = M;
    const sentBg = r.label === 'positive' ? [10, 70, 45] : r.label === 'negative' ? [100, 15, 15] : [90, 70, 0];
    cx += chip(`${i + 1}`, cx, y, [20, 30, 60], COL.hdr) + 3;
    cx += chip(r.label.toUpperCase(), cx, y, sentBg, [255, 255, 255]) + 3;
    cx += chip(r.urgency.toUpperCase(), cx, y, [40, 30, 70], COL.title) + 3;
    const txt = r.text.length > 85 ? r.text.slice(0, 85) + '...' : r.text;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...COL.body);
    const lines = doc.splitTextToSize(txt, TW - cx + M - 2);
    lines.forEach((ln, li) => { checkY(5); doc.text(ln, cx, li === 0 ? y : y + 4.2 * li); });
    y += Math.max(7, lines.length * 4.2) + 2;
  });

  // ── SECTION 11: AI REPORT ──
  newPage();
  heading('11. AI-GENERATED INSIGHTS AND RECOMMENDATIONS', 1); divider();
  body('The following analysis and recommendations were automatically generated by PulseAI based on all the data collected above. This section is designed to be shared with product managers, leadership teams, or used in sprint planning.');
  spacer(4);
  d.report.split('\n\n').filter(p=>p.trim()).forEach(para=>{
    const clean=para.replace(/\*\*(.*?)\*\*/g,'$1');
    const firstDot=clean.indexOf('.');
    if(firstDot>0&&firstDot<35){
      heading(clean.slice(0,firstDot+1),2);
      body(clean.slice(firstDot+2).trim());
    } else {
      body(clean);
    }
    spacer(4);
  });

  // Final page
  newPage();
  doc.setFillColor(8,12,28);doc.rect(0,0,W,297,'F');
  doc.setFillColor(0,50,80);doc.rect(0,110,W,60,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(...COL.hdr);
  doc.text('Thank you for using PulseAI.',W/2,137,{align:'center'});
  doc.setFontSize(11);doc.setTextColor(...COL.white);
  doc.text('Your feedback data drives better products.',W/2,150,{align:'center'});
  doc.setFontSize(8);doc.setTextColor(...COL.muted);
  doc.text('PulseAI v2.0 • 100% Local Processing • Zero API keys required',W/2,290,{align:'center'});

  doc.save('PulseAI-Full-Report-'+new Date().toISOString().slice(0,10)+'.pdf');
}

// ─── CHATBOT ───
const CHAT_PATTERNS = [
    {
      re: /top complaint|biggest issue|main problem/i, fn: d => {
        const top = d.themes.filter(t => t.priority_score >= 5).slice(0, 3);
        return `**Top Complaints:**\n${top.length ? top.map((t, i) => `${i + 1}. **${t.theme}** — ${t.matches} mentions, ${t.negRatio}% negative, Priority ${t.priority_score}/10`).join('\n') : 'No major complaints found! 🎉'}`;
      }
    },
    {
      re: /critical|urgent|fix first|most urgent/i, fn: d => {
        const crits = d.urgency.critical.slice(0, 4);
        return `**🚨 Critical Issues (${d.urgency.critical.length} total):**\n${crits.length ? crits.map((r, i) => `${i + 1}. "${r.text.slice(0, 90)}"`).join('\n') : 'No critical urgency items. Great news!'}`;
      }
    },
    {
      re: /churn|leaving|at risk|who.s at risk/i, fn: d => {
        const high = d.churnRisks.filter(r => r.churnRisk === 'critical' || r.churnRisk === 'high').slice(0, 4);
        return `**⚠️ Churn Risk (${high.length} high/critical):**\n${high.length ? high.map((r, i) => `${i + 1}. ${r.churnRisk.toUpperCase()} (${r.churnPct}%): "${r.text.slice(0, 80)}"`).join('\n') : 'Great news — no high churn risk detected!'}`;
      }
    },
    {
      re: /sentiment|positive|negative|how.s.*feeling/i, fn: d => {
        return `**😊 Sentiment Breakdown:**\n• Positive: **${d.sentiment.positive}**\n• Neutral: **${d.sentiment.neutral}**\n• Negative: **${d.sentiment.negative}**\n• Total reviews: ${d.reviews.length}\n\n${parseInt(d.sentiment.positive) >= 55 ? 'Most customers are satisfied! Focus on resolving the flagged issues.' : 'Significant negative signals detected. Prioritize critical issues immediately.'}`;
      }
    },
    {
      re: /feature|request|want|wish|add|prioriti/i, fn: d => {
        const top = d.rice.slice(0, 3);
        return `**🎯 Top Feature Requests (RICE scored):**\n${top.length ? top.map((r, i) => `${i + 1}. **${r.theme}** — RICE: ${r.riceScore}, Priority: ${r.priority.toUpperCase()}`).join('\n') : 'No explicit feature requests identified.'}`;
      }
    },
    {
      re: /toxic|abusive|offensive|language/i, fn: d => {
        const tx = d.toxic.slice(0, 4);
        return `**☣️ Toxic Feedback (${d.toxic.length} entries):**\n${tx.length ? tx.map((r, i) => `${i + 1}. ${r.toxicSeverity}: "${r.text.slice(0, 80)}"`).join('\n') : '✅ No toxic language detected!'}`;
      }
    },
    {
      re: /duplicate|similar|repeat/i, fn: d => {
        return `**🔄 Duplicate Analysis:**\n• Duplication rate: **${d.dupPct}%**\n• Duplicate groups found: ${d.duplicates.length}\n${d.duplicates.slice(0, 2).map(g => `• Group of ${g.count}: "${g.items[0]?.slice(0, 60)}…"`).join('\n') || 'No significant duplicates.'}`;
      }
    },
    {
      re: /persona|type of user|who/i, fn: d => {
        return `**👤 User Personas:**\n${Object.entries(d.personaCounts).sort((a, b) => b[1] - a[1]).map(([n, c]) => `• **${n}**: ${c} user${c > 1 ? 's' : ''}`).join('\n')}`;
      }
    },
    {
      re: /theme|categor|cluster/i, fn: d => {
        return `**🧩 Feedback Themes (${d.themes.length} identified):**\n${d.themes.map((t, i) => `${i + 1}. **${t.theme}** — ${t.matches} mentions · Priority ${t.priority_score}/10`).join('\n')}`;
      }
    },
    {
      re: /trend|improv|better|worse|over time/i, fn: d => {
        const pos = parseInt(d.sentiment.positive), neg = parseInt(d.sentiment.negative);
        return `**📈 Trend Analysis:**\nCurrent snapshot: ${pos}% positive, ${neg}% negative.\n${pos >= 60 ? '📈 Sentiment is generally POSITIVE. Keep up the good work!' : neg >= 40 ? '📉 Significant NEGATIVE signals detected. Act quickly on critical issues.' : '📊 MIXED sentiment. Address top issues to improve the score.'}\n\nTop driver of negative trend: **${d.themes.filter(t => t.priority_score >= 6)[0]?.theme || 'General issues'}**`;
      }
    },
    {
      re: /summar|overview|tell me about|what.s happening/i, fn: d => {
        return `**⚡ PulseAI Summary:**\n• ${d.reviews.length} reviews analyzed\n• Sentiment: ${d.sentiment.positive} positive · ${d.sentiment.negative} negative\n• ${d.urgency.critical.length} critical issues · ${d.urgency.high.length} high urgency\n• ${d.churnRisks.length} users at churn risk\n• ${d.toxic.length} toxic entries\n• ${d.themes.length} themes · ${d.rice.length} feature requests\n\nTop issue: **${d.themes[0]?.theme || 'N/A'}** (${d.themes[0]?.priority_score || 0}/10)\nBiggest churn risk: ${d.urgency.critical.length > 0 ? `🚨 ${d.urgency.critical.length} critical issues need immediate attention` : '✅ Low churn risk overall'}`;
      }
    },
    {
      re: /report|recommend|what should|action/i, fn: d => {
        return `**📋 Action Recommendations:**\n1. 🚨 Fix **${d.themes[0]?.theme || 'top issue'}** immediately — highest priority score\n2. ⚠️ Reach out to **${d.churnRisks.filter(r => r.churnRisk === 'critical').length} critical**-risk users within 48h\n3. 🎯 Fast-track **${d.rice[0]?.theme || 'top feature request'}** — highest RICE score\n4. 🔄 Merge ${d.duplicates.length} duplicate ticket groups\n5. 📊 Schedule weekly PulseAI cycles to track improvement`;
      }
    },
  ];

  let ttsEnabled = true;

  function sendChat(text) {
    const input = document.getElementById('chatInput');
    const msg = (text || (input ? input.value : '')).trim();
    if (!msg) return;
    if (input) input.value = '';
    appendChatMsg('user', esc(msg));
    if (!analysisData) {
      appendChatMsg('bot', '⚡ Please run an analysis first! Go to the <strong>Analyze</strong> page and paste your feedback.');
      return;
    }
    // Thinking indicator
    const thinkId = 'think-' + Date.now();
    appendChatMsg('bot', '<span class="msg-thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>', thinkId);
    setTimeout(() => {
      const reply = queryAnalysis(msg, analysisData);
      const thinkEl = document.getElementById(thinkId);
      if (thinkEl) {
        const bubble = thinkEl.querySelector('.msg-bubble');
        if (bubble) bubble.innerHTML = reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      }
      if (ttsEnabled) speakText(reply.replace(/\*\*/g, '').split('\n')[0]);
    }, 700);
  }

  function queryAnalysis(msg, d) {
    for (const p of CHAT_PATTERNS) {
      if (p.re.test(msg)) {
        try { return p.fn(d); } catch (e) { console.error(e); }
      }
    }
    return `I analyzed ${d.reviews.length} reviews. I can tell you about:\n**top complaints** · **critical issues** · **churn risk** · **sentiment** · **feature requests** · **toxicity** · **duplicates** · **personas** · **themes** · **summary** · **recommendations**\n\nTry asking: "What should we fix first?"`;
  }

  function appendChatMsg(role, html, id) {
    const win = document.getElementById('chatWindow');
    if (!win) return;
    const avt = role === 'user' ? '👤' : '⚡';
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    if (id) div.id = id;
    div.innerHTML = `<div class="msg-avatar">${avt}</div><div class="msg-bubble">${html}</div>`;
    win.appendChild(div);
    win.scrollTop = win.scrollHeight;
  }

  // ─── VOICE INPUT/OUTPUT ───
  function toggleVoice() {
    const btn = document.getElementById('voiceBtn');
    const status = document.getElementById('voiceStatus');
    if (voiceActive) {
      if (voiceRec) voiceRec.stop();
      voiceActive = false;
      if (btn) btn.classList.remove('listening');
      if (status) status.textContent = '';
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice input not supported in this browser. Try Chrome.'); return; }
    voiceRec = new SR();
    voiceRec.continuous = false;
    voiceRec.interimResults = true;
    voiceRec.lang = 'en-US';
    voiceRec.onstart = () => {
      voiceActive = true;
      if (btn) btn.classList.add('listening');
      if (status) status.textContent = '🎤 Listening… speak your question';
    };
    voiceRec.onresult = e => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      const input = document.getElementById('chatInput');
      if (input) input.value = transcript;
      if (e.results[0].isFinal) {
        voiceActive = false;
        if (btn) btn.classList.remove('listening');
        if (status) status.textContent = '✅ Got it! Processing…';
        setTimeout(() => { sendChat(); if (status) status.textContent = ''; }, 300);
      }
    };
    voiceRec.onerror = e => {
      voiceActive = false;
      if (btn) btn.classList.remove('listening');
      if (status) status.textContent = `❌ Error: ${e.error}. Try again.`;
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
    };
    voiceRec.onend = () => { voiceActive = false; if (btn) btn.classList.remove('listening'); };
    voiceRec.start();
  }

  function speakText(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 300));
    utt.rate = 1.0; utt.pitch = 1.0; utt.volume = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find(v => v.name.includes('Google') && v.lang === 'en-US') || voices.find(v => v.lang === 'en-US') || voices[0];
    if (pref) utt.voice = pref;
    window.speechSynthesis.speak(utt);
  }

  // ─── INIT ───
  document.addEventListener('DOMContentLoaded', () => {
    // Theme
    const saved = localStorage.getItem('pulse-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    ['pubThemeBtn', 'shellThemeBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = saved === 'dark' ? '🌙' : '☀️';
    });
    // Textarea counter
    const ta = document.getElementById('feedbackInput');
    if (ta) ta.addEventListener('input', updateCtr);
    // Drag & Drop
    const dz = document.getElementById('dropZone');
    if (dz) {
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragging'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('dragging'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('dragging');
        const file = e.dataTransfer.files[0];
        if (!file) return;
        const input = document.getElementById('fileInput');
        if (input) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; }
        handleFile({ target: { files: [file] } });
      });
    }
    // Voice Activation (pre-load voices)
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
    // Navigate to home
    showPage('home');
  });
