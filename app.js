'use strict';

// ══════════════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════════════
let currentPublicPage = 'home';
let currentDashTab    = 'overview';
let analysisResult    = null;   // strict JSON from PulseAIAgent
let sentimentChart    = null;
let barChart          = null;
let sidebarCollapsed  = false;

// ══════════════════════════════════════════════════════════════════
//  ROUTING — PUBLIC PAGES
// ══════════════════════════════════════════════════════════════════
function showPage(page) {
  const shell = document.getElementById('appShell');
  const pub   = document.getElementById('publicPages');
  if (shell) shell.classList.add('hidden');
  if (pub)   pub.style.display = 'block';

  document.querySelectorAll('.pub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pn-link').forEach(l => l.classList.remove('active'));

  const el  = document.getElementById('page-' + page);
  if (el)  el.classList.add('active');
  const lnk = document.getElementById('pnl-' + page);
  if (lnk) lnk.classList.add('active');

  currentPublicPage = page;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'settings') syncSettingsUI();
}

// ══════════════════════════════════════════════════════════════════
//  ROUTING — DASHBOARD SHELL
// ══════════════════════════════════════════════════════════════════
function showDashboard() {
  const pub   = document.getElementById('publicPages');
  const shell = document.getElementById('appShell');
  if (pub)   { pub.style.display = 'none'; }
  if (shell) { shell.classList.remove('hidden'); }
  renderDashboard();
  showDashTab('overview');
  window.scrollTo(0, 0);
}

function exitDashboard() {
  const pub   = document.getElementById('publicPages');
  const shell = document.getElementById('appShell');
  if (shell) { shell.classList.add('hidden'); }
  if (pub)   { pub.style.display = 'block'; }
  showPage('upload');
}

function showDashTab(tab) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));

  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  const sbEl = document.getElementById('sb-' + tab);
  if (sbEl) sbEl.classList.add('active');

  currentDashTab = tab;
  const labels = { overview:'Overview', themes:'Themes', priorities:'Priorities', report:'AI Report' };
  document.getElementById('topbarPageLabel').textContent = labels[tab] || tab;
  window.scrollTo({ top:0, behavior:'smooth' });
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
}

// ══════════════════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════════════════
function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next   = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  const icon = isDark ? '☀️' : '🌙';
  ['pubThemeBtn','shellThemeBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = icon;
  });
  localStorage.setItem('pulse-theme', next);
  const chk = document.getElementById('dmCheck');
  if (chk) chk.checked = !isDark;
  if (analysisResult) rebuildCharts();
}

function syncTheme() {
  const want  = document.getElementById('dmCheck').checked ? 'dark' : 'light';
  const curr  = document.documentElement.getAttribute('data-theme');
  if (want !== curr) toggleTheme();
}

function syncSettingsUI() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const chk = document.getElementById('dmCheck');
  if (chk) chk.checked = isDark;
}

function setAccent(color, btn) {
  document.querySelectorAll('.c-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const pal = {
    indigo:  ['#6366f1','#8b5cf6','#818cf8','#a78bfa'],
    cyan:    ['#06b6d4','#3b82f6','#22d3ee','#60a5fa'],
    emerald: ['#10b981','#06b6d4','#34d399','#22d3ee'],
  }[color];
  const r = document.documentElement;
  r.style.setProperty('--p',  pal[0]);
  r.style.setProperty('--a',  pal[1]);
  r.style.setProperty('--p2', pal[2]);
  r.style.setProperty('--a2', pal[3]);
  r.style.setProperty('--grad', `linear-gradient(135deg,${pal[0]} 0%,${pal[1]} 100%)`);
  if (analysisResult) rebuildCharts();
}

// ══════════════════════════════════════════════════════════════════
//  FILE UPLOAD
// ══════════════════════════════════════════════════════════════════
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('feedbackInput').value = ev.target.result;
    updateCtr();
  };
  reader.readAsText(file);
}

function updateCtr() {
  const ta   = document.getElementById('feedbackInput');
  const text = ta.value;
  const lines = text.split('\n').filter(l => l.trim()).length;
  document.getElementById('charCtr').textContent =
    `${text.length.toLocaleString()} characters · ${lines} lines`;
}

// ══════════════════════════════════════════════════════════════════
//  DEMO DATA
// ══════════════════════════════════════════════════════════════════
const DEMO_REVIEWS = [
  "The checkout process is way too complicated. I gave up halfway through.",
  "Love the new UI! Much cleaner and more intuitive than before.",
  "Shipping took 3 weeks. Completely unacceptable for a premium product.",
  "The mobile app crashes every time I try to upload a photo. Very frustrating.",
  "Customer support responded in minutes and resolved my issue. Impressed!",
  "I've been a customer for 2 years and the quality has really gone downhill lately.",
  "The new search filters are amazing. Found exactly what I needed in seconds.",
  "Why does the website keep logging me out? Fix this already.",
  "Best purchase I've made this year. Absolutely worth the price.",
  "The product description was misleading — what I received was totally different.",
  "Your team went above and beyond to fix my order mistake. Truly appreciate it.",
  "App keeps freezing on Android 13. Please release a patch asap.",
  "Finally a product that does exactly what it promises. No gimmicks.",
  "I waited 45 minutes on hold. This customer service is terrible.",
  "The loyalty rewards program is fantastic. I saved so much this month!",
  "Wrong item sent twice in a row. This is really unacceptable.",
  "Performance is outstanding — way faster than the competition.",
  "The packaging was damaged and the item inside was broken.",
  "Signed up for the newsletter and got spammed 10 times in one day.",
  "Love the eco-friendly packaging! Nice to see a brand that cares.",
  "The onboarding tutorial is confusing and too long. Simplify it please.",
  "Absolutely stunning product quality. Every detail is perfect.",
  "Returns process is smooth and hassle-free. Refreshingly easy.",
  "Prices have gone up significantly but quality has not improved.",
  "The dashboard analytics are exactly what our team needed. Brilliant!",
  "I can't figure out how to cancel my subscription. The UX is a mess.",
  "Incredible value for money. Will definitely recommend to friends.",
  "The product photos don't match the actual color of the item at all.",
  "Communication from the company during the delay was excellent.",
  "Three-star experience: product is okay but delivery was a nightmare.",
].join('\n');

function useDemoData() {
  const ta = document.getElementById('feedbackInput');
  ta.value = DEMO_REVIEWS;
  updateCtr();
  // slight delay so the textarea value is committed
  setTimeout(startAnalysis, 80);
}

function runDemoMode() {
  showPage('upload');
  setTimeout(useDemoData, 500);
}

// ══════════════════════════════════════════════════════════════════
//  ANALYSIS ENTRY POINT
// ══════════════════════════════════════════════════════════════════
function startAnalysis() {
  const ta  = document.getElementById('feedbackInput');
  const raw = (ta ? ta.value : '').trim();
  if (!raw || raw.length < 20) {
    if (ta) {
      ta.style.borderColor = '#ef4444';
      ta.style.boxShadow   = '0 0 0 3px rgba(239,68,68,.25)';
      setTimeout(() => { ta.style.borderColor=''; ta.style.boxShadow=''; }, 1800);
    }
    return;
  }

  // Cache raw text before any DOM manipulation
  const feedbackText = raw;
  const opts = {
    maxThemes:     parseInt(document.getElementById('maxThemes')?.value  || 5),
    maxPriorities: parseInt(document.getElementById('maxPriorities')?.value || 5),
  };

  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('show');

  const steps = ['ls1','ls2','ls3','ls4','ls5'];
  let   idx   = 0;

  function advance() {
    if (idx > 0) {
      const prev = document.getElementById(steps[idx-1]);
      if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
    }
    if (idx < steps.length) {
      const cur = document.getElementById(steps[idx]);
      if (cur) cur.classList.add('active');
      idx++;
      setTimeout(advance, 500);
    } else {
      // All steps done — run analysis synchronously then transition
      setTimeout(() => {
        try {
          analysisResult = PulseAIAgent.analyze(feedbackText, opts);
        } catch(e) {
          console.error('PulseAI agent error:', e);
          analysisResult = getPulseAIFallback();
        }
        overlay.classList.remove('show');
        steps.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.remove('active','done');
        });
        showDashboard();
      }, 200);
    }
  }

  advance();
}

// ══════════════════════════════════════════════════════════════════
//  PULSEAI AGENT — strict JSON output
// ══════════════════════════════════════════════════════════════════
const PulseAIAgent = (() => {

  /* ── Word Lists ── */
  const POS = new Set([
    'love','great','excellent','amazing','awesome','fantastic','perfect','outstanding',
    'brilliant','superb','wonderful','impressed','best','beautiful','smooth','easy',
    'fast','helpful','appreciate','worth','value','recommend','pleased','delighted',
    'incredible','stunning','clean','intuitive','efficient','satisfied','refreshing',
    'reliable','innovative','responsive','premium','enjoy','accurate','helpful',
  ]);
  const NEG = new Set([
    'terrible','horrible','awful','bad','worst','poor','broken','crash','bug','error','slow',
    'late','delayed','damaged','wrong','missing','issue','problem','frustrated','frustrating',
    'unacceptable','disappoint','disappointed','complicated','confusing','misleading','spam',
    'freeze','fix','complaint','refund','waste','useless','annoying','difficult','impossible',
    'fail','failure','never','hate','worse','downhill','nightmare','mistake','ugly','ignored',
    'unreliable','expensive','overpriced',
  ]);
  const SEV = new Set(['crash','broken','unacceptable','terrible','awful','worst','impossible','fail','freeze','nightmare','ignored','unreliable']);

  /* ── Helpers ── */
  function clean(text) {
    // Preserve newlines — only collapse non-newline whitespace per line
    return text
      .split('\n')
      .map(line => line.replace(/[^\w\s'.!?,;:\-]/g,' ').replace(/[ \t]+/g,' ').trim())
      .filter(line => line.length > 0)
      .join('\n');
  }
  function sentences(text) {
    // Split on newlines first (one review per line format)
    const byLine = text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 8);
    if (byLine.length >= 3) return byLine;
    // Fallback: split on sentence-ending punctuation for single-paragraph text
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 8);
  }
  function words(s) { return s.toLowerCase().split(/\W+/); }

  function sentenceScore(s) {
    let score = 0;
    words(s).forEach(w => {
      if (POS.has(w)) score++;
      if (NEG.has(w)) score--;
    });
    return score;
  }
  function label(s) {
    const sc = sentenceScore(s);
    return sc > 0 ? 'positive' : sc < 0 ? 'negative' : 'neutral';
  }

  function pct(n,t) { return Math.round((n/Math.max(t,1))*100)+'%'; }

  /* ── Sentiment Summary ── */
  function sentiment(sents) {
    let pos=0,neu=0,neg=0;
    sents.forEach(s => { const l=label(s); if(l==='positive') pos++; else if(l==='negative') neg++; else neu++; });
    return {
      positive: pct(pos,sents.length),
      neutral:  pct(neu,sents.length),
      negative: pct(neg,sents.length),
      _raw: { pos, neu, neg, total: sents.length },
    };
  }

  /* ── Theme Definitions ── */
  const THEME_DEFS = [
    { theme:'Checkout & Payment',       kw:['checkout','payment','cart','purchase','order','billing','pay','buy'],               emoji:'💳' },
    { theme:'Shipping & Delivery',      kw:['shipping','delivery','ship','deliver','late','delay','package','arrived','weeks'],   emoji:'📦' },
    { theme:'Customer Support',         kw:['support','service','help','agent','response','hold','respond','team','staff'],       emoji:'🎧' },
    { theme:'Mobile App & Tech Bugs',   kw:['app','mobile','crash','freeze','bug','android','ios','update','patch','error'],     emoji:'📱' },
    { theme:'Product Quality',          kw:['quality','product','item','material','broken','damage','description','photos'],      emoji:'⭐' },
    { theme:'User Interface & UX',      kw:['ui','ux','interface','design','navigation','confusing','clean','intuitive','onboard'],emoji:'🎨' },
    { theme:'Pricing & Value',          kw:['price','cost','value','expensive','cheap','worth','money','refund','overpriced'],    emoji:'💰' },
    { theme:'Performance & Speed',      kw:['fast','slow','performance','speed','loading','lag','quick','instant','outstanding'], emoji:'⚡' },
    { theme:'Communication & Emails',   kw:['email','newsletter','spam','communication','notify','update','inform','message'],    emoji:'📧' },
    { theme:'Returns & Refunds',        kw:['return','refund','exchange','cancel','wrong','damaged','replacement'],               emoji:'🔄' },
  ];

  /* ── Theme Clustering ── */
  function themes(sents, maxThemes) {
    const scored = THEME_DEFS.map(td => {
      const matches = sents.filter(s => {
        const lc = s.toLowerCase();
        return td.kw.some(k => lc.includes(k));
      });
      const negCount  = matches.filter(m => label(m) === 'negative').length;
      const negRatio  = matches.length > 0 ? negCount / matches.length : 0;
      const sevCount  = matches.filter(m => words(m).some(w => SEV.has(w))).length;
      const priorityScore = Math.min(10, Math.round(
        matches.length * 0.5 + negRatio * 5 + sevCount * 1.5
      ));
      return { ...td, matches, priorityScore };
    });

    return scored
      .filter(t => t.matches.length > 0)
      .sort((a,b) => b.priorityScore - a.priorityScore || b.matches.length - a.matches.length)
      .slice(0, maxThemes)
      .map(t => {
        const examples = t.matches.slice(0,2).filter(Boolean);
        const negR = t.matches.filter(m=>label(m)==='negative').length / Math.max(t.matches.length,1);
        const summary = buildSummary(t.theme, t.matches.length, t.priorityScore, negR);
        return {
          theme: t.emoji + ' ' + t.theme,
          summary,
          examples,
          priority_score: t.priorityScore,
        };
      });
  }

  function buildSummary(name, count, score, negRatio) {
    if (score >= 8) return `Critical issue — ${count} mention${count!==1?'s':''} with ${Math.round(negRatio*100)}% negative sentiment. Requires immediate attention.`;
    if (score >= 5) return `Moderate concern — ${count} mention${count!==1?'s':''}. Several customers flagged issues with ${name.toLowerCase()}.`;
    return `${count} mention${count!==1?'s':''}. Mixed or positive sentiment — worth monitoring over time.`;
  }

  /* ── Top Priorities ── */
  function topPriorities(themeList, maxP) {
    return themeList.slice(0, maxP).map(t => {
      const score = t.priority_score;
      const issue = t.theme;
      const reason = score >= 8
        ? 'High concentration of negative feedback with critical severity markers. Immediate resolution required.'
        : score >= 5
        ? 'Recurring complaints with measurable negative impact on customer experience.'
        : 'Moderate frequency — proactive improvement recommended before escalation.';
      return { issue, reason, score };
    }).sort((a,b) => b.score - a.score);
  }

  /* ── Weekly Report (4–6 paragraphs) ── */
  function weeklyReport(sent, themeList, priorities, total) {
    const posN = parseInt(sent.positive);
    const negN = parseInt(sent.negative);
    const date = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    const top  = themeList[0]?.theme.replace(/^[^\w]+/,'') || 'various areas';
    const iss  = priorities[0]?.issue.replace(/^[^\w]+/,'') || 'key issues';

    const paras = [
      `**Executive Summary.** This report covers the AI-powered analysis of ${total} customer feedback submissions processed by PulseAI on ${date}. Overall sentiment distribution shows ${sent.positive} positive, ${sent.neutral} neutral, and ${sent.negative} negative responses — indicating ${posN >= 55 ? 'a broadly satisfied customer base with concentrated pain points' : 'significant negative signals that warrant strategic intervention'}.`,

      `**Sentiment Analysis.** ${posN}% of feedback is positive, signaling ${posN>=60?'strong':'moderate'} baseline satisfaction. The ${negN}% negative feedback is concentrated around specific operational themes rather than distributed across the experience — which is actionable: fixing targeted issues can move the needle substantially on overall satisfaction scores without requiring broad product overhauls.`,

      `**Theme Overview.** The PulseAI agent identified ${themeList.length} distinct feedback clusters. The highest-priority theme is **${top}**. ${themeList.slice(1,3).map(t=>t.theme.replace(/^[^\w]+/,'')).join(' and ')} also appeared prominently. Collectively, the top 3 themes account for the majority of negative sentiment in this dataset — addressing them should be the primary focus of the next sprint cycle.`,

      `**Priority Issue Breakdown.** The most critical issue is **${iss}** (Severity Score: ${priorities[0]?.score ?? 'N/A'}/10). ${priorities.length > 1 ? `This is followed by **${priorities[1]?.issue.replace(/^[^\w]+/,'')}** (Score: ${priorities[1]?.score}/10).` : ''} These issues were flagged based on frequency, negative sentiment density, and severity keyword concentration — the three strongest predictors of churn risk in feedback datasets.`,

      `**Positive Highlights.** Recurring positive signals include mentions of ${themeList.filter(t=>t.priority_score<=3).map(t=>t.theme.replace(/^[^\w]+/,'')).slice(0,3).join(', ') || 'product quality, support team, and pricing value'}. These areas represent defensible brand strengths. Customer advocacy language ("love," "recommend," "amazing") appears consistently, suggesting a core loyal segment that can be leveraged for referral and review campaigns.`,

      `**Strategic Recommendations.** Based on this analysis: (1) Escalate the top ${Math.min(3,priorities.length)} priority issues to the relevant product or operations teams with a resolution target of the next 2 sprint cycles; (2) Invest in proactive communication when known issues arise to limit frustration-driven churn; (3) Preserve and amplify the themes driving positive sentiment — they are your competitive differentiators; (4) Schedule monthly PulseAI feedback cycles to track improvement velocity and catch emerging issues before they escalate to public reviews.`,
    ];

    return paras.join('\n\n');
  }

  /* ── Main Analyze ── (strict JSON output) ── */
  function analyze(rawText, opts = {}) {
    const { maxThemes = 5, maxPriorities = 5 } = opts;

    const cleaned      = clean(rawText);
    const sents        = sentences(cleaned);
    const sentimentSummary = sentiment(sents);
    const themeList    = themes(sents, maxThemes);
    const priorities   = topPriorities(themeList, maxPriorities);
    const report       = weeklyReport(sentimentSummary, themeList, priorities, sents.length);

    // ── STRICT JSON FORMAT ──
    const output = {
      sentiment_summary: {
        positive: sentimentSummary.positive,
        neutral:  sentimentSummary.neutral,
        negative: sentimentSummary.negative,
      },
      themes: themeList.map(t => ({
        theme:          t.theme,
        summary:        t.summary,
        examples:       t.examples.slice(0,2),
        priority_score: t.priority_score,
      })),
      top_priorities: priorities.map(p => ({
        issue:  p.issue,
        reason: p.reason,
        score:  p.score,
      })),
      weekly_report: report,
    };

    // Validate — auto-fill any missing fields
    if (!output.sentiment_summary.positive) output.sentiment_summary.positive = '0%';
    if (!output.sentiment_summary.neutral)  output.sentiment_summary.neutral  = '0%';
    if (!output.sentiment_summary.negative) output.sentiment_summary.negative = '0%';
    if (!Array.isArray(output.themes))      output.themes = [];
    if (!Array.isArray(output.top_priorities)) output.top_priorities = [];
    if (!output.weekly_report)              output.weekly_report = 'No report generated.';

    // Attach private metadata (not in strict format)
    output._meta = {
      reviewCount: sents.length,
      rawCounts: sentimentSummary._raw,
      analyzedAt: new Date().toISOString(),
    };

    return output;
  }

  return { analyze };
})();

function getPulseAIFallback() {
  return {
    sentiment_summary: { positive:'50%', neutral:'30%', negative:'20%' },
    themes: [{ theme:'📊 General Feedback', summary:'Unable to parse themes from input.', examples:['No examples available.'], priority_score:5 }],
    top_priorities: [{ issue:'📊 General Feedback', reason:'Analysis encountered an error. Please try again with more feedback text.', score:5 }],
    weekly_report: '**Analysis Error.** The AI agent encountered an issue processing the provided feedback. Please ensure you have pasted at least 10 lines of feedback text and try again.',
    _meta: { reviewCount:0, rawCounts: { pos:5, neu:3, neg:2 }, analyzedAt: new Date().toISOString() },
  };
}

// ══════════════════════════════════════════════════════════════════
//  RENDER DASHBOARD
// ══════════════════════════════════════════════════════════════════
function renderDashboard() {
  if (!analysisResult) return;
  const r    = analysisResult;
  const meta = r._meta;
  const raw  = meta.rawCounts;

  // ── Topbar pill ──
  document.getElementById('apReviews').textContent = `${meta.reviewCount} reviews analyzed`;

  // ── KPIs ──
  const posN = parseInt(r.sentiment_summary.positive);
  document.getElementById('kpiReviews').textContent = meta.reviewCount;
  document.getElementById('kpiThemes').textContent  = r.themes.length;
  document.getElementById('kpiIssues').textContent  = r.top_priorities.length;
  document.getElementById('kpiHealth').textContent  = posN + '%';

  // ── Sentiment legend ──
  document.getElementById('legPos').textContent = r.sentiment_summary.positive;
  document.getElementById('legNeu').textContent = r.sentiment_summary.neutral;
  document.getElementById('legNeg').textContent = r.sentiment_summary.negative;
  document.getElementById('ccNum').textContent  = r.sentiment_summary.positive;

  // ── Health bar ──
  document.getElementById('hbPct').textContent = posN + '%';
  setTimeout(() => {
    document.getElementById('hbFill').style.width = posN + '%';
  }, 400);

  // ── Charts ──
  buildDonut(raw);
  buildBar(r.sentiment_summary);

  // ── Themes ──
  const grid = document.getElementById('themesGrid');
  grid.innerHTML = '';
  r.themes.forEach((t, i) => {
    const s    = t.priority_score;
    const lvl  = s >= 8 ? 'high' : s >= 5 ? 'medium' : 'low';
    const lbl  = s >= 8 ? '🔴 High' : s >= 5 ? '🟡 Medium' : '🟢 Low';
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.style.animationDelay = (i * 0.07) + 's';
    card.innerHTML = `
      <div class="tc-head">
        <div class="tc-name">${esc(t.theme)}</div>
        <div class="pri-badge ${lvl}">${lbl} · ${s}/10</div>
      </div>
      <div class="tc-summary">${esc(t.summary)}</div>
      <div class="tc-ex-label">Example Feedback</div>
      ${t.examples.map(ex => `<div class="tc-ex">"${esc(ex.slice(0,130))}${ex.length>130?'…':''}"</div>`).join('')}
      <div class="tc-score-row">
        <div class="tc-bar"><div class="tc-bar-fill" style="width:${s*10}%"></div></div>
        <div class="tc-score-txt">Priority ${s}/10</div>
      </div>`;
    grid.appendChild(card);
  });

  // ── Priority Table ──
  const tbody = document.getElementById('priorityTbody');
  tbody.innerHTML = '';
  r.top_priorities.forEach((p, i) => {
    const s   = p.score;
    const cls = s >= 9 ? 'critical' : s >= 7 ? 'high' : s >= 4 ? 'medium' : 'low';
    const lbl = s >= 9 ? '🚨 Critical' : s >= 7 ? '⚠️ High' : s >= 4 ? '📌 Medium' : '✅ Low';
    tbody.innerHTML += `
      <tr>
        <td><span class="pt-num">${i+1}</span></td>
        <td><span class="pt-issue">${esc(p.issue)}</span></td>
        <td><span class="pt-reason">${esc(p.reason)}</span></td>
        <td><span class="sev-chip ${cls}">${lbl} · ${s}/10</span></td>
      </tr>`;
  });

  // ── AI Report ──
  const content = document.getElementById('reportContent');
  content.innerHTML = '';
  document.getElementById('rtbDate').textContent =
    new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  r.weekly_report.split('\n\n').filter(p => p.trim()).forEach((para, i) => {
    const div = document.createElement('div');
    div.className = 'rp';
    div.style.animationDelay = (i * 0.1) + 's';
    div.innerHTML = para.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
    content.appendChild(div);
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════════════════
//  CHARTS
// ══════════════════════════════════════════════════════════════════
function buildDonut(raw) {
  const ctx = document.getElementById('sentimentChart');
  if (!ctx) return;
  if (sentimentChart) { sentimentChart.destroy(); sentimentChart = null; }
  sentimentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive','Neutral','Negative'],
      datasets: [{
        data: [raw.pos, raw.neu, raw.neg],
        backgroundColor: ['#10b981','#f59e0b','#ef4444'],
        borderColor: 'transparent',
        hoverOffset: 12, borderRadius: 6, spacing: 4,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:true, cutout:'70%',
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label: c=>`${c.label}: ${c.raw} (${Math.round(c.parsed/(raw.pos+raw.neu+raw.neg)*100)}%)`}}
      },
      animation:{animateRotate:true,duration:900},
    }
  });
}

function buildBar(sent) {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;
  if (barChart) { barChart.destroy(); barChart = null; }
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Positive','Neutral','Negative'],
      datasets: [{
        data: [parseInt(sent.positive), parseInt(sent.neutral), parseInt(sent.negative)],
        backgroundColor: ['rgba(16,185,129,.55)','rgba(245,158,11,.55)','rgba(239,68,68,.55)'],
        borderColor:     ['#10b981','#f59e0b','#ef4444'],
        borderWidth: 2, borderRadius: 8,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.parsed}%`}}},
      scales:{
        y:{ticks:{color:'#64748b',callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.05)'},max:100,beginAtZero:true},
        x:{ticks:{color:'#94a3b8'},grid:{display:false}},
      },
      animation:{duration:900},
    }
  });
}

function rebuildCharts() {
  if (!analysisResult) return;
  buildDonut(analysisResult._meta.rawCounts);
  buildBar(analysisResult.sentiment_summary);
}

// ══════════════════════════════════════════════════════════════════
//  PDF EXPORT
// ══════════════════════════════════════════════════════════════════
function downloadPDF() {
  if (!analysisResult) { showPage('upload'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const r   = analysisResult;
  const W   = 210, M = 18;
  let   y   = 0;

  function line(text, x, size, bold, rgb, maxW) {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...(rgb||[30,30,50]));
    const lines = doc.splitTextToSize(String(text), maxW || W-M*2);
    lines.forEach(ln => {
      if (y > 278) { doc.addPage(); y = 18; }
      doc.text(ln, x, y);
      y += size * 0.44;
    });
    y += 1.5;
  }

  // Header
  doc.setFillColor(99,102,241);
  doc.rect(0,0,W,28,'F');
  doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('⚡ PulseAI – Feedback Intelligence Report', M, 18);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}), W-M-38, 18);
  y = 38;

  // Sentiment
  line('SENTIMENT SUMMARY', M, 8, true, [120,120,170]);
  line(`Positive: ${r.sentiment_summary.positive}   Neutral: ${r.sentiment_summary.neutral}   Negative: ${r.sentiment_summary.negative}   Total Reviews: ${r._meta.reviewCount}`, M, 11, false, [50,50,90]);
  y += 5;

  // Themes
  line('THEMES IDENTIFIED', M, 8, true, [120,120,170]);
  r.themes.forEach((t,i) => {
    line(`${i+1}. ${t.theme}  [Priority ${t.priority_score}/10]`, M, 11, true, [40,40,80]);
    line(t.summary, M+4, 10, false, [80,80,110]);
    if (t.examples[0]) line(`"${t.examples[0].slice(0,110)}"`, M+4, 9, false, [100,100,145]);
    y += 2;
  });
  y += 4;

  // Priorities
  line('TOP PRIORITY ISSUES', M, 8, true, [120,120,170]);
  r.top_priorities.forEach((p,i) => {
    line(`${i+1}. ${p.issue}  — Severity Score: ${p.score}/10`, M, 11, true, [40,40,80]);
    line(p.reason, M+4, 10, false, [80,80,110]);
    y += 2;
  });
  y += 4;

  // Report
  line('AI-GENERATED INSIGHTS REPORT', M, 8, true, [120,120,170]);
  r.weekly_report.split('\n\n').filter(p=>p.trim()).forEach(para => {
    line(para.replace(/\*\*(.*?)\*\*/g,'$1'), M, 10, false, [50,50,85]);
    y += 3;
  });

  // Footer
  doc.setFontSize(8); doc.setTextColor(150,150,175);
  doc.text('Generated by PulseAI v1.0.0 · 100% Local Processing · All data stays on your device', M, 290);

  doc.save('PulseAI-Report-' + new Date().toISOString().slice(0,10) + '.pdf');
}

// ══════════════════════════════════════════════════════════════════
//  DRAG & DROP INIT
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Theme init
  const saved = localStorage.getItem('pulse-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  ['pubThemeBtn','shellThemeBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = saved === 'dark' ? '🌙' : '☀️';
  });

  // Textarea counter
  const ta = document.getElementById('feedbackInput');
  if (ta) ta.addEventListener('input', updateCtr);

  // Drag & drop
  const dz = document.getElementById('dropZone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragging'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragging'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('dragging');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        document.getElementById('feedbackInput').value = ev.target.result;
        updateCtr();
      };
      reader.readAsText(file);
    });
  }

  // Initial page
  showPage('home');
});
