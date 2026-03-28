'use strict';
// ═══════════════════════════════════════════════
//  PULSEAI AGENT v2 — 9 AI Modules
// ═══════════════════════════════════════════════
const PulseAIAgent=(()=>{

// ── Word Banks ──
const POS=new Set(['love','great','excellent','amazing','awesome','fantastic','perfect','outstanding','brilliant','superb','wonderful','impressed','best','beautiful','smooth','easy','fast','helpful','appreciate','worth','value','recommend','pleased','delighted','incredible','stunning','clean','intuitive','efficient','satisfied','refreshing','reliable','innovative','responsive','premium','enjoy','accurate','clear','transparent','solved','resolved','happy','glad']);
const NEG=new Set(['terrible','horrible','awful','bad','worst','poor','broken','crash','bug','error','slow','late','delayed','damaged','wrong','missing','issue','problem','frustrated','frustrating','unacceptable','disappoint','complicated','confusing','misleading','spam','freeze','fix','complaint','refund','waste','useless','annoying','difficult','impossible','fail','failure','never','hate','worse','downhill','nightmare','mistake','ugly','ignored','unreliable','expensive','overpriced','disgusting','pathetic','ridiculous']);
const SEV=new Set(['crash','broken','unacceptable','terrible','awful','worst','impossible','fail','freeze','nightmare','ignored','unreliable','disgusting','pathetic','can\'t','unable','stuck','error','not working','keeps']);
const TOXIC=new Set(['idiot','stupid','moron','dumb','scam','fraud','liar','garbage','trash','crap','sucks','hell','damn','useless','worthless','fake','cheat','bully','hate','disgusting','pathetic','ridiculous']);
const FEAT_KW=['would like','should have','add','need feature','want','wish','suggest','request','could you add','please add','hope to see','would be great','love to have','missing feature','why not add','need to add','should add','feature request'];
const THEME_DEFS=[
  {name:'🐛 Bugs & Crashes',    kw:['crash','freeze','bug','error','broken','fix','not working','fails','glitch','stuck'],category:'Bugs'},
  {name:'🎨 UI/UX Issues',      kw:['ui','ux','interface','design','navigation','confusing','ugly','cluttered','hard to find','layout','button','screen','page','menu'],category:'UI/UX'},
  {name:'💰 Pricing & Value',   kw:['price','cost','expensive','cheap','worth','money','refund','overpriced','billing','subscription','cancel','fee'],category:'Pricing'},
  {name:'⚡ Performance',        kw:['slow','fast','performance','speed','loading','lag','quick','instant','responsive','laggy','delay'],category:'Performance'},
  {name:'✨ Feature Requests',   kw:['add','feature','would like','missing','need','want','wish','suggest','should have','could you'],category:'Features'},
  {name:'😤 Complaints',        kw:['terrible','horrible','unacceptable','worst','awful','disappointed','complaint','never again','waste'],category:'Complaints'},
  {name:'📦 Shipping & Delivery',kw:['shipping','delivery','ship','deliver','late','delay','package','arrived','weeks','days','dispatch'],category:'Shipping'},
  {name:'🎧 Customer Support',   kw:['support','service','help','agent','response','hold','respond','team','staff','chat','call','email'],category:'Support'},
];
const PERSONAS={
  'Frustrated User':   r=>r.sentiment==='negative'&&r.score<0.3,
  'At-Risk User':      r=>r.churnRisk==='critical'||r.churnRisk==='high',
  'Power User':        r=>FEAT_KW.some(k=>r.text.toLowerCase().includes(k)),
  'Brand Champion':    r=>r.sentiment==='positive'&&r.score>0.75,
  'New Customer':      r=>r.text.toLowerCase().match(/first time|just started|new customer|recently|first order|just bought/),
  'Neutral Observer':  r=>r.sentiment==='neutral',
};

// ── Helpers ──
function cleanText(t){
  return t.split('\n').map(l=>l.replace(/[^\w\s'.!?,;:\-]/g,' ').replace(/\s+/g,' ').trim()).filter(l=>l.length>5).join('\n');
}
function getSentences(text){
  const byLine=text.split('\n').map(s=>s.trim()).filter(s=>s.length>8);
  if(byLine.length>=3) return byLine;
  return text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>8);
}
function tokenize(s){return s.toLowerCase().split(/\W+/).filter(w=>w.length>2);}
function sentScore(s){
  let sc=0;
  tokenize(s).forEach(w=>{if(POS.has(w))sc+=1;if(NEG.has(w))sc-=1;});
  return sc;
}
function normScore(s){
  const raw=sentScore(s);
  const words=tokenize(s).length||1;
  return Math.max(0,Math.min(1,(raw/Math.max(words,5))*5*0.5+0.5));
}
function sentLabel(score){return score>0.6?'positive':score<0.4?'negative':'neutral';}
function sentEmoji(label){return label==='positive'?'😊':label==='negative'?'😞':'😐';}

// ── 1. Sentiment ──
function analyzeSentiment(sents){
  return sents.map(text=>{
    const score=parseFloat(normScore(text).toFixed(2));
    const label=sentLabel(score);
    return{text,score,label,emoji:sentEmoji(label),sentiment:label};
  });
}

// ── 2. Urgency ──
function classifyUrgency(reviews){
  return reviews.map(r=>{
    const lc=r.text.toLowerCase();
    const hasSev=[...SEV].some(k=>lc.includes(k));
    const hasNeg=r.label==='negative';
    let urg='low';
    if(hasSev&&r.score<0.25) urg='critical';
    else if(hasSev||r.score<0.3) urg='high';
    else if(hasNeg||r.score<0.45) urg='medium';
    return{...r,urgency:urg};
  });
}

// ── 3. Toxicity ──
const SAFE_REPHRASE={
  'terrible':'very poor quality',
  'horrible':'quite bad',
  'awful':'very disappointing',
  'disgusting':'deeply unsatisfactory',
  'pathetic':'very poor',
  'idiot':'unprofessional',
  'garbage':'very low quality',
  'trash':'poor quality',
  'crap':'low quality',
};
function detectToxicity(reviews){
  return reviews.map(r=>{
    const lc=r.text.toLowerCase();
    const hits=[...TOXIC].filter(w=>lc.includes(w));
    let toxicity='none', severity='—', safe=null;
    if(hits.length>=3){toxicity='high';severity='🔴 Severe';}
    else if(hits.length===2){toxicity='medium';severity='🟡 Moderate';}
    else if(hits.length===1){toxicity='low';severity='🟢 Mild';}
    if(hits.length>0){
      let s=r.text;
      hits.forEach(h=>{const rpl=SAFE_REPHRASE[h]||'[removed]';s=s.replace(new RegExp(h,'gi'),rpl);});
      safe=s;
    }
    return{...r,toxicity,toxicSeverity:severity,safeRephrase:safe};
  });
}

// ── 4. Duplicate Detection (cosine sim via TF-IDF) ──
function tfidf(docs){
  const tf=docs.map(d=>{
    const words=tokenize(d), freq={};
    words.forEach(w=>{freq[w]=(freq[w]||0)+1;});
    Object.keys(freq).forEach(w=>{freq[w]/=words.length;});
    return freq;
  });
  const df={};
  docs.forEach(d=>{const words=new Set(tokenize(d));words.forEach(w=>{df[w]=(df[w]||0)+1;});});
  return tf.map(f=>{
    const vec={};
    Object.keys(f).forEach(w=>{vec[w]=f[w]*Math.log(docs.length/(df[w]||1));});
    return vec;
  });
}
function cosine(a,b){
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  let dot=0,na=0,nb=0;
  keys.forEach(k=>{dot+=(a[k]||0)*(b[k]||0);na+=(a[k]||0)**2;nb+=(b[k]||0)**2;});
  return na&&nb?dot/(Math.sqrt(na)*Math.sqrt(nb)):0;
}
function findDuplicates(reviews){
  const vecs=tfidf(reviews.map(r=>r.text));
  const groups=[], used=new Set();
  for(let i=0;i<reviews.length;i++){
    if(used.has(i)) continue;
    const grp=[i];
    for(let j=i+1;j<reviews.length;j++){
      if(!used.has(j)&&cosine(vecs[i],vecs[j])>0.65){grp.push(j);used.add(j);}
    }
    if(grp.length>1) groups.push(grp);
    used.add(i);
  }
  return groups;
}

// ── 5. RICE Framework (Feature Requests) ──
function scoreRICE(reviews){
  const feats=reviews.filter(r=>FEAT_KW.some(k=>r.text.toLowerCase().includes(k)));
  const themeMap={};
  feats.forEach(r=>{
    // Find best theme match
    let bestTheme='General Feature Request', bestScore=0;
    THEME_DEFS.forEach(td=>{
      const hits=td.kw.filter(k=>r.text.toLowerCase().includes(k)).length;
      if(hits>bestScore){bestScore=hits;bestTheme=td.name;}
    });
    if(!themeMap[bestTheme]) themeMap[bestTheme]={theme:bestTheme,reviews:[],totalScore:0};
    themeMap[bestTheme].reviews.push(r);
    themeMap[bestTheme].totalScore+=r.score;
  });
  return Object.values(themeMap).map(item=>{
    const reach=item.reviews.length;
    const avgScore=item.totalScore/reach;
    const impact=Math.round(((1-avgScore)*10+reach)*10)/10;
    const confidence=parseFloat((0.5+reach*0.05).toFixed(1));
    const effort=Math.max(1,Math.round(3-reach*0.3));
    const riceScore=parseFloat(((reach*impact*Math.min(confidence,1))/effort).toFixed(1));
    const priority=riceScore>8?'critical':riceScore>5?'high':riceScore>2?'medium':'low';
    return{theme:item.theme,reach,impact,confidence:Math.min(confidence,1),effort,riceScore,priority,examples:item.reviews.slice(0,2).map(r=>r.text)};
  }).sort((a,b)=>b.riceScore-a.riceScore);
}

// ── 6. Theme Clustering ──
function clusterThemes(reviews,maxThemes){
  return THEME_DEFS.map(td=>{
    const matches=reviews.filter(r=>td.kw.some(k=>r.text.toLowerCase().includes(k)));
    if(!matches.length) return null;
    const negCount=matches.filter(r=>r.label==='negative').length;
    const negRatio=negCount/matches.length;
    const sevCount=matches.filter(r=>[...SEV].some(k=>r.text.toLowerCase().includes(k))).length;
    const priScore=Math.min(10,Math.round(matches.length*0.5+negRatio*5+sevCount*1.5));
    return{
      theme:td.name,
      category:td.category,
      matches:matches.length,
      priority_score:priScore,
      negRatio:Math.round(negRatio*100),
      examples:matches.slice(0,2).map(r=>r.text),
      summary:priScore>=8?`🚨 Critical — ${matches.length} mentions, ${Math.round(negRatio*100)}% negative. Immediate action needed.`:priScore>=5?`⚠️ Moderate — ${matches.length} mentions flagged. Monitor closely.`:`ℹ️ ${matches.length} mention${matches.length>1?'s':''}. Generally positive or neutral.`,
    };
  }).filter(Boolean).filter(t=>t.matches>0).sort((a,b)=>b.priority_score-a.priority_score).slice(0,maxThemes);
}

// ── 7. Churn Risk ──
function predictChurn(reviews){
  return reviews.map(r=>{
    let risk=0;
    if(r.score<0.25) risk+=40;
    else if(r.score<0.4) risk+=20;
    if(r.urgency==='critical') risk+=30;
    else if(r.urgency==='high') risk+=15;
    if(r.toxicity==='high') risk+=20;
    else if(r.toxicity==='medium') risk+=10;
    if([...NEG].filter(w=>r.text.toLowerCase().includes(w)).length>=3) risk+=10;
    const churnPct=Math.min(risk,95);
    const churnRisk=churnPct>=70?'critical':churnPct>=45?'high':churnPct>=20?'medium':'low';
    return{...r,churnPct,churnRisk};
  });
}

// ── 8. Persona Detection ──
function detectPersonas(reviews){
  const counts={};
  reviews.forEach(r=>{
    let assigned=false;
    Object.entries(PERSONAS).forEach(([name,fn])=>{
      if(!assigned&&fn(r)){counts[name]=(counts[name]||0)+1;r.persona=name;assigned=true;}
    });
    if(!assigned){counts['Neutral Observer']=(counts['Neutral Observer']||0)+1;r.persona='Neutral Observer';}
  });
  return{counts,reviews};
}

// ── 9. Report Generation ──
function generateReport(data){
  const {reviews,sentiment,themes,priorities,churnRisks,toxic,rice}=data;
  const total=reviews.length;
  const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const topTheme=themes[0]?.theme||'various areas';
  const topIssue=priorities[0]?.theme||'key issues';
  const highChurn=churnRisks.filter(r=>r.churnRisk==='critical'||r.churnRisk==='high').length;
  const posN=parseInt(sentiment.positive);
  const negN=parseInt(sentiment.negative);
  return [
    `**Executive Summary.** PulseAI analyzed ${total} customer feedback entries on ${date}. Sentiment distribution: ${sentiment.positive} positive · ${sentiment.neutral} neutral · ${sentiment.negative} negative. ${posN>=55?'The majority of customers are satisfied, though targeted issues need resolution.':'Significant negative signals require strategic intervention across multiple areas.'}`,
    `**Sentiment Breakdown.** ${posN}% of responses are positive, indicating ${posN>=60?'strong':'moderate'} baseline satisfaction. The ${negN}% negative feedback concentrates around ${themes.filter(t=>t.priority_score>=6).map(t=>t.theme).slice(0,3).join(', ')||topTheme}. Targeted fixes in these areas can significantly improve overall sentiment without broad product changes.`,
    `**Critical Themes.** PulseAI identified ${themes.length} feedback clusters. Top priority: **${topTheme}** (Score: ${themes[0]?.priority_score||'N/A'}/10). ${themes.slice(1,3).map(t=>t.theme).join(' and ')} also require attention. Themes with 70%+ negative sentiment represent highest churn driver risk.`,
    `**Churn Risk Alert.** ${highChurn} user${highChurn!==1?'s':''} (${Math.round(highChurn/total*100)}% of respondents) show high-to-critical churn risk based on sentiment score, urgency, toxicity, and complaint frequency. Immediate personal outreach is recommended for critical-risk users. ${toxic.filter(r=>r.toxicity!=='none').length} entries contain toxic language indicating extreme frustration.`,
    `**Feature Request Prioritization (RICE).** ${rice.length} distinct feature requests identified. Top-scored request: **${rice[0]?.theme||'General improvements'}** (RICE Score: ${rice[0]?.riceScore||'N/A'}). Prioritize based on Reach (how many asked) × Impact × Confidence ÷ Effort. High-RICE items deliver maximum satisfaction improvement per engineering hour.`,
    `**Recommendations.** (1) Escalate ${priorities.slice(0,3).map(p=>p.theme).join(', ')} to engineering immediately. (2) Personal outreach to ${highChurn} at-risk users within 48 hours. (3) Fast-track top 2 RICE-scored features in next sprint. (4) Implement automated toxic-feedback alerts for real-time monitoring. (5) Schedule bi-weekly PulseAI analysis cycles to track improvement velocity.`,
  ].join('\n\n');
}

// ── Main Analyze ──
function analyze(rawText,opts={}){
  const{maxThemes=5,maxPriorities=5}=opts;
  const cleaned=cleanText(rawText);
  const sentences=getSentences(cleaned);
  let reviews=analyzeSentiment(sentences);
  reviews=classifyUrgency(reviews);
  reviews=detectToxicity(reviews);
  reviews=predictChurn(reviews);
  const personaResult=detectPersonas(reviews);
  reviews=personaResult.reviews;
  const personaCounts=personaResult.counts;
  const dupGroups=findDuplicates(reviews);
  const themes=clusterThemes(reviews,maxThemes);
  const rice=scoreRICE(reviews);
  const priorities=themes.slice(0,maxPriorities).map(t=>({theme:t.theme,reason:t.summary,score:t.priority_score}));
  const pos=reviews.filter(r=>r.label==='positive').length;
  const neg=reviews.filter(r=>r.label==='negative').length;
  const neu=reviews.length-pos-neg;
  const sentiment={
    positive:Math.round(pos/reviews.length*100)+'%',
    neutral: Math.round(neu/reviews.length*100)+'%',
    negative:Math.round(neg/reviews.length*100)+'%',
    _raw:{pos,neu,neg,total:reviews.length},
  };
  const toxic=reviews.filter(r=>r.toxicity!=='none');
  const churnRisks=reviews.filter(r=>r.churnRisk!=='low');
  const duplicates=dupGroups.map(g=>({items:g.map(i=>reviews[i]?.text||''),count:g.length}));
  const dupPct=Math.round(reviews.filter((_,i)=>dupGroups.some(g=>g.includes(i))).length/reviews.length*100);
  const urgency={
    critical:reviews.filter(r=>r.urgency==='critical'),
    high:reviews.filter(r=>r.urgency==='high'),
    medium:reviews.filter(r=>r.urgency==='medium'),
    low:reviews.filter(r=>r.urgency==='low'),
  };
  const data={reviews,sentiment,themes,priorities,rice,toxic,churnRisks,duplicates,dupPct,urgency,personaCounts,_raw:{pos,neu,neg,total:reviews.length}};
  data.report=generateReport(data);
  return data;
}

function fallback(){
  return{
    reviews:[],sentiment:{positive:'50%',neutral:'30%',negative:'20%',_raw:{pos:5,neu:3,neg:2,total:10}},
    themes:[],priorities:[],rice:[],toxic:[],churnRisks:[],duplicates:[],dupPct:0,
    urgency:{critical:[],high:[],medium:[],low:[]},personaCounts:{},
    report:'Analysis error. Please try again with more feedback text.',_raw:{pos:5,neu:3,neg:2,total:10},
  };
}

return{analyze,fallback};
})();
