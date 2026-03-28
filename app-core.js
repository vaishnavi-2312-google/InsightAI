'use strict';
// ─── GLOBAL STATE ───
let currentPage='home', currentPanel='dashboard';
let analysisData=null, sidebarCollapsed=false;
let charts={}, sentimentFilter='all', chatHistory=[];
let voiceActive=false, voiceRec=null;
let uploadMode='paste'; // 'paste' | 'multi'
let entryIdCounter=0;

// ─── DEMO DATA (30 reviews) ───
const DEMO_REVIEWS=[
  "The checkout process is way too complicated. I gave up halfway through.",
  "Love the new UI! Much cleaner and more intuitive than before.",
  "Shipping took 3 weeks. Completely unacceptable for a premium product.",
  "The mobile app crashes every time I try to upload a photo. Very frustrating.",
  "Customer support responded in minutes and resolved my issue. Impressed!",
  "I've been a customer for 2 years and quality has really gone downhill.",
  "The new search filters are amazing. Found exactly what I needed in seconds.",
  "Why does the website keep logging me out? Fix this already!!",
  "Best purchase I've made this year. Absolutely worth the price.",
  "Product description was misleading — what I received was totally different.",
  "Your team went above and beyond to fix my order. Truly appreciate it.",
  "App keeps freezing on Android 13. Please release a patch ASAP.",
  "Finally a product that does exactly what it promises. No gimmicks.",
  "I waited 45 minutes on hold. This customer service is absolutely terrible.",
  "The loyalty rewards program is fantastic. I saved so much this month!",
  "Wrong item sent twice in a row. This is really unacceptable behaviour.",
  "Performance is outstanding — way faster than the competition.",
  "The packaging was damaged and the item inside was completely broken.",
  "Signed up for newsletter and got spammed 10 times in one day. Disgusting!",
  "Love the eco-friendly packaging! Nice to see a brand that cares.",
  "Onboarding tutorial is confusing and too long. Please simplify it.",
  "Absolutely stunning product quality. Every single detail is perfect.",
  "Returns process is smooth and hassle-free. Refreshingly easy experience.",
  "Prices have gone up significantly but quality has not improved at all.",
  "The dashboard analytics are exactly what our team needed. Brilliant work!",
  "I can't figure out how to cancel my subscription. The UX is a complete mess!",
  "Incredible value for money. Will definitely recommend to all my friends.",
  "The product photos don't match the actual color of the item at all.",
  "Communication from your team during the delay was excellent. Thank you.",
  "Three-star — product is okay but delivery was an absolute nightmare.",
].join('\n');

// ─── UPLOAD MODE TABS ───
function switchUploadMode(mode, btn){
  uploadMode=mode;
  document.querySelectorAll('.upload-tab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const pasteMode=document.getElementById('dropZone');
  const taWrap=document.querySelector('.ta-wrap');
  const multiMode=document.getElementById('multiEntryMode');
  if(mode==='paste'){
    if(pasteMode) pasteMode.style.display='';
    if(taWrap) taWrap.style.display='';
    if(multiMode) multiMode.style.display='none';
  } else {
    if(pasteMode) pasteMode.style.display='none';
    if(taWrap) taWrap.style.display='none';
    if(multiMode) multiMode.style.display='';
    // Pre-populate if empty
    const list=document.getElementById('entriesList');
    if(list&&list.children.length===0){
      addFeedbackEntry();addFeedbackEntry();addFeedbackEntry();
    }
  }
}

// ─── MULTI-ENTRY FUNCTIONS ───
function addFeedbackEntry(prefillText){
  const list=document.getElementById('entriesList');
  if(!list) return;
  entryIdCounter++;
  const id='entry-'+entryIdCounter;
  const n=list.children.length+1;
  const card=document.createElement('div');
  card.className='entry-card';
  card.id=id;
  card.innerHTML=`
    <div class="entry-card-header">
      <span class="entry-number">#${n}</span>
      <span class="entry-label">Feedback entry ${n}</span>
      <span class="entry-result-pill" id="${id}-result" style="display:none"></span>
    </div>
    <textarea class="entry-ta" id="${id}-ta" rows="3"
      placeholder="Type or paste a single feedback entry here…"
      oninput="updateEntryCounts()">${prefillText||''}</textarea>
    <button class="remove-entry-btn" onclick="removeFeedbackEntry('${id}')" title="Remove">✕</button>`;
  list.appendChild(card);
  updateEntryCounts();
  card.querySelector('textarea').focus();
}

function removeFeedbackEntry(id){
  const card=document.getElementById(id);
  if(card){card.style.opacity='0';card.style.transform='translateX(30px)';card.style.transition='all .2s';setTimeout(()=>{card.remove();renumberEntries();updateEntryCounts();},200);}
}

function renumberEntries(){
  const list=document.getElementById('entriesList');
  if(!list) return;
  Array.from(list.children).forEach((card,i)=>{
    const numEl=card.querySelector('.entry-number');
    const lblEl=card.querySelector('.entry-label');
    if(numEl) numEl.textContent=`#${i+1}`;
    if(lblEl) lblEl.textContent=`Feedback entry ${i+1}`;
  });
}

function updateEntryCounts(){
  const list=document.getElementById('entriesList');
  if(!list) return;
  const filled=Array.from(list.querySelectorAll('.entry-ta')).filter(ta=>ta.value.trim().length>3).length;
  const total=list.children.length;
  const countEl=document.getElementById('multiCount');
  if(countEl) countEl.textContent=`${filled} / ${total} entries filled`;
  const badge=document.getElementById('entryCountBadge');
  if(badge) badge.textContent=filled;
}

function clearAllEntries(){
  const list=document.getElementById('entriesList');
  if(list) list.innerHTML='';
  entryIdCounter=0;
  updateEntryCounts();
  addFeedbackEntry();addFeedbackEntry();addFeedbackEntry();
}

function getMultiEntryText(){
  const list=document.getElementById('entriesList');
  if(!list) return '';
  return Array.from(list.querySelectorAll('.entry-ta'))
    .map(ta=>ta.value.trim()).filter(v=>v.length>3).join('\n');
}

// Show per-entry result pills after analysis
function showEntryResults(){
  const list=document.getElementById('entriesList');
  if(!list||!analysisData) return;
  const entries=Array.from(list.querySelectorAll('.entry-ta'));
  entries.forEach((ta,i)=>{
    const text=ta.value.trim();
    if(!text) return;
    const match=analysisData.reviews.find(r=>r.text.startsWith(text.slice(0,40)));
    const card=ta.closest('.entry-card');
    const pill=card?card.querySelector('[id$="-result"]'):null;
    if(pill&&match){
      pill.textContent=`${match.emoji} ${match.label} · ${(match.score*100).toFixed(0)}%`;
      pill.className=`entry-result-pill ${match.label==='positive'?'pos':match.label==='negative'?'neg':'neu'}`;
      pill.style.display='';
    }
  });
}

// ─── ROUTING: PUBLIC PAGES ───
function showPage(p){
  const shell=document.getElementById('appShell');
  const pub=document.getElementById('publicPages');
  if(shell) shell.classList.add('hidden');
  if(pub) pub.style.display='block';
  document.querySelectorAll('.pub-page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.pn-lnk').forEach(x=>x.classList.remove('active'));
  const el=document.getElementById('page-'+p);
  if(el) el.classList.add('active');
  const ln=document.getElementById('pnl-'+p);
  if(ln) ln.classList.add('active');
  currentPage=p;
  window.scrollTo({top:0,behavior:'smooth'});
  if(p==='settings') syncSettingsUI();
}

// ─── ROUTING: DASHBOARD SHELL ───
function showDashboard(){
  if(!analysisData){showPage('upload');return;}
  const pub=document.getElementById('publicPages');
  const shell=document.getElementById('appShell');
  if(pub) pub.style.display='none';
  if(shell) shell.classList.remove('hidden');
  renderAllPanels();
  showShell('dashboard');
  window.scrollTo(0,0);
}

function showShell(panel){
  document.querySelectorAll('.shell-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById('panel-'+panel);
  if(el) el.classList.add('active');
  const btn=document.getElementById('sbn-'+panel);
  if(btn) btn.classList.add('active');
  currentPanel=panel;
  const labels={dashboard:'Dashboard',insights:'Insights',sentiment:'Sentiment',themes:'Themes',urgency:'Urgency',prioritization:'Prioritization',chatbot:'AI Chatbot',report:'Report'};
  const lbl=document.getElementById('tbLabel');
  if(lbl) lbl.textContent=labels[panel]||panel;
}

function exitDashboard(){
  const shell=document.getElementById('appShell');
  const pub=document.getElementById('publicPages');
  if(shell) shell.classList.add('hidden');
  if(pub) pub.style.display='block';
  showPage('upload');
}

function toggleSidebar(){
  sidebarCollapsed=!sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed',sidebarCollapsed);
}

// ─── THEME ───
function toggleTheme(){
  const html=document.documentElement;
  const dark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',dark?'light':'dark');
  ['pubThemeBtn','shellThemeBtn'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent=dark?'☀️':'🌙';
  });
  localStorage.setItem('pulse-theme',dark?'light':'dark');
  const chk=document.getElementById('dmCheck');
  if(chk) chk.checked=!dark;
  if(analysisData) rebuildCharts();
}

function syncTheme(){
  const want=document.getElementById('dmCheck').checked?'dark':'light';
  if(document.documentElement.getAttribute('data-theme')!==want) toggleTheme();
}

function syncSettingsUI(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const chk=document.getElementById('dmCheck');
  if(chk) chk.checked=dark;
}

function setAccent(color,btn){
  document.querySelectorAll('.c-opt').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const pals={
    neon:  ['#00E5FF','#9B5DE5','#22d3ee','#b97ef5','linear-gradient(135deg,#00E5FF,#9B5DE5)'],
    indigo:['#6366f1','#8b5cf6','#818cf8','#a78bfa','linear-gradient(135deg,#6366f1,#8b5cf6)'],
    emerald:['#10b981','#06b6d4','#34d399','#22d3ee','linear-gradient(135deg,#10b981,#06b6d4)'],
  };
  const pal=pals[color]||pals.neon;
  const r=document.documentElement;
  r.style.setProperty('--p',pal[0]);
  r.style.setProperty('--a',pal[1]);
  r.style.setProperty('--p2',pal[2]);
  r.style.setProperty('--a2',pal[3]);
  r.style.setProperty('--grad',pal[4]);
  if(analysisData) rebuildCharts();
}

// ─── FILE HANDLING ───
function handleFile(e){
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    let text=ev.target.result;
    if(file.name.endsWith('.csv')) text=parseCSV(text);
    else if(file.name.endsWith('.json')) text=parseJSON(text);
    document.getElementById('feedbackInput').value=text;
    updateCtr();
  };
  reader.readAsText(file);
}

function parseCSV(text){
  return text.split('\n').map(r=>{
    const cols=r.split(',');
    return (cols[0]||'').replace(/^"|"$/g,'').trim();
  }).filter(r=>r.length>5).join('\n');
}

function parseJSON(text){
  try{
    const data=JSON.parse(text);
    if(Array.isArray(data)){
      return data.map(item=>{
        if(typeof item==='string') return item;
        return item.text||item.review||item.feedback||item.comment||JSON.stringify(item);
      }).join('\n');
    }
    if(data.reviews) return parseJSON(JSON.stringify(data.reviews));
    if(data.feedback) return parseJSON(JSON.stringify(data.feedback));
    return JSON.stringify(data);
  }catch(err){return text;}
}

function clearInput(){
  document.getElementById('feedbackInput').value='';
  updateCtr();
}

function countLines(){
  const ta=document.getElementById('feedbackInput');
  const lines=ta.value.split('\n').filter(l=>l.trim()).length;
  alert(`📊 Feedback count: ${lines} entries\n${ta.value.length} characters`);
}

function updateCtr(){
  const ta=document.getElementById('feedbackInput');
  if(!ta) return;
  const lines=ta.value.split('\n').filter(l=>l.trim()).length;
  const ctr=document.getElementById('charCtr');
  if(ctr) ctr.textContent=`${ta.value.length.toLocaleString()} characters · ${lines} lines`;
}

// ─── DEMO DATA & ANALYSIS ───
function useDemoData(){
  const ta=document.getElementById('feedbackInput');
  if(ta){ ta.value=DEMO_REVIEWS; updateCtr(); }
  setTimeout(startAnalysis,100);
}

function runDemoMode(){
  showPage('upload');
  setTimeout(useDemoData,500);
}

// ─── ANALYSIS ENTRY ───
function startAnalysis(){
  // Collect text from the active input mode
  let feedbackText='';
  if(uploadMode==='multi'){
    feedbackText=getMultiEntryText();
    if(!feedbackText||feedbackText.length<10){
      // Shake the add-entry button
      const btn=document.querySelector('.add-entry-btn');
      if(btn){btn.style.boxShadow='0 0 0 3px rgba(239,68,68,.4)';setTimeout(()=>btn.style.boxShadow='',2000);}
      alert('Please fill in at least one feedback entry before analyzing.');
      return;
    }
  } else {
    const ta=document.getElementById('feedbackInput');
    feedbackText=ta?ta.value.trim():'';
    if(!feedbackText||feedbackText.length<15){
      if(ta){
        ta.style.borderColor='#ef4444';
        ta.style.boxShadow='0 0 0 3px rgba(239,68,68,.25)';
        setTimeout(()=>{ta.style.borderColor='';ta.style.boxShadow='';},2000);
      }
      return;
    }
  }
  const opts={
    maxThemes:parseInt(document.getElementById('maxThemes')?.value||5),
    maxPriorities:parseInt(document.getElementById('maxPriorities')?.value||5),
    isMultiMode: uploadMode==='multi',
  };
  const overlay=document.getElementById('loadingOverlay');
  if(overlay) overlay.classList.add('show');
  const steps=['ls1','ls2','ls3','ls4','ls5','ls6','ls7','ls8'];
  let idx=0;
  const pcts=[12,25,38,50,62,74,87,100];
  function advance(){
    if(idx>0){
      const prev=document.getElementById(steps[idx-1]);
      if(prev){prev.classList.remove('active');prev.classList.add('done');}
    }
    const bar=document.getElementById('lcBar');
    if(bar) bar.style.width=(pcts[idx]||100)+'%';
    if(idx<steps.length){
      const cur=document.getElementById(steps[idx]);
      if(cur) cur.classList.add('active');
      idx++;
      setTimeout(advance,380);
    } else {
      setTimeout(()=>{
        try{ analysisData=PulseAIAgent.analyze(feedbackText,opts); }
        catch(e){ console.error(e); analysisData=PulseAIAgent.fallback(); }
        if(overlay) overlay.classList.remove('show');
        steps.forEach(id=>{
          const el=document.getElementById(id);
          if(el) el.classList.remove('active','done');
        });
        // If multi-mode, update per-entry result pills
        if(uploadMode==='multi') showEntryResults();
        showDashboard();
      },200);
    }
  }
  advance();
}

// ─── EXPORTS ───
function exportCSV(){
  if(!analysisData){alert('Run an analysis first!');return;}
  const rows=[['Review','Sentiment','Label','Score','Urgency','Persona','ChurnRisk']];
  analysisData.reviews.forEach(r=>{
    rows.push([`"${r.text.replace(/"/g,'""')}"`,r.sentiment,r.label,r.score,r.urgency,r.persona,r.churnRisk]);
  });
  const csv=rows.map(r=>r.join(',')).join('\n');
  dlFile('PulseAI-Export.csv',csv,'text/csv');
}

function exportJSON(){
  if(!analysisData){alert('Run an analysis first!');return;}
  const out={
    metadata:{exportedAt:new Date().toISOString(),totalReviews:analysisData.reviews.length},
    sentiment_summary:analysisData.sentiment,
    themes:analysisData.themes,
    top_priorities:analysisData.priorities,
    rice_scores:analysisData.rice,
    churn_risks:analysisData.churnRisks,
    toxic_items:analysisData.toxic,
    duplicates:analysisData.duplicates,
    personas:analysisData.personas,
    weekly_report:analysisData.report,
  };
  dlFile('PulseAI-Data.json',JSON.stringify(out,null,2),'application/json');
}

function dlFile(name,content,type){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type}));
  a.download=name;
  a.click();
}

// ─── FILTER SENTIMENT ───
function filterSentiment(filter,btn){
  sentimentFilter=filter;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(analysisData) renderSentimentCards(analysisData.reviews);
}
