(()=>{'use strict';
const $=id=>document.getElementById(id), today=new Date(), ms=86400000;
let data={items:[],reviewedAt:null}, seeds={items:[]}, live={releaseEvents:[],leads:[],scanStatus:'not-started'}, type='launch';
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?new Date(s+'T12:00:00Z'):null;
const daysAgo=s=>{const d=date(s);return d?Math.floor((today-d)/ms):Infinity};
const fmt=s=>{const d=date(s);return d?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(d):'Not yet'};
function safe(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}}
function elt(tag,cls,content){const a=document.createElement(tag);if(cls)a.className=cls;if(content!==undefined)a.textContent=content;return a}
function link(text,url){const u=safe(url);if(!u)return elt('span',null,text);const a=elt('a',null,text);a.href=u;a.target='_blank';a.rel='noopener noreferrer';return a}
function isToolSite(url){try{const h=new URL(url).hostname.toLowerCase();return h!=='github.com'&&h!=='www.github.com'&&h!=='gitlab.com'&&h!=='www.gitlab.com'}catch{return false}}
function records(){
 const rows=[];
 const usable=t=>['online','install','access'].includes(t.toolUse);
 const approved=new Map(data.items.filter(usable).map(t=>[t.id,t]));
 const curatedRelease=new Set();
 for(const t of data.items.filter(usable)){
  if(t.eventDate&&t.eventType){
   rows.push({kind:'launch',date:t.eventDate,title:t.title,detail:t.eventType+' · '+(t.organisation||''),
    summary:t.summary,url:t.url,evidence:t.evidence,id:t.id,aiType:t.aiType,toolUse:t.toolUse});
   curatedRelease.add(t.id+'|'+t.eventDate);
  }
  if(t.addedAt&&!t.baselineEntry)rows.push({kind:'added',date:t.addedAt,title:t.title,detail:'Newly indexed in EnvAI · '+t.domain,
    summary:t.summary,url:t.url,evidence:t.evidence,id:t.id,aiType:t.aiType,toolUse:t.toolUse});
 }
 for(const r of live.releaseEvents||[]){
  const t=approved.get(r.toolId);
  if(!t||!date(r.eventDate)||!safe(r.evidence))continue;
  if(curatedRelease.has(r.toolId+'|'+r.eventDate))continue;
  rows.push({kind:'launch',date:r.eventDate,title:t.title+' · '+(r.tag||'release'),
   detail:(r.eventType||'Official GitHub release')+' · automatically recorded',
   summary:r.summary||'A source-dated official repository release; its significance has not yet been independently assessed.',
   url:t.url,evidence:r.evidence,id:t.id,aiType:t.aiType,toolUse:t.toolUse});
 }
 const leadMap=new Map();
 // Keep announcements and code repositories out of the public tool feed.
 // Only directly reachable, tool-like candidate websites are shown.
 for(const r of seeds.items||[])if(r.id&&r.accessType==='web'&&r.siteReachable===true&&isToolSite(r.url))leadMap.set(r.id,r);
 for(const r of live.leads||[])if(r.id&&r.accessType==='web'&&r.siteReachable===true&&isToolSite(r.url))leadMap.set(r.id,r);
 for(const r of leadMap.values()){
  rows.push({kind:'lead',date:r.discoveredAt||r.eventDate,title:r.title,
   detail:'TOOL WEBSITE · '+(r.status||'functionality unverified')+(r.domain?' · '+r.domain:''),
   summary:r.note||'Discovery lead pending editorial review.',url:r.url,evidence:r.evidence||r.url,
   id:r.id,aiType:'Unverified',toolUse:'online'});
 }
 return rows.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||({launch:0,added:1,lead:2}[a.kind]-{launch:0,added:1,lead:2}[b.kind]));
}
function scanLabel(){
 if(live.scanStatus==='not-started')return 'Daily scanner installed · first run pending';
 if(live.scanStatus==='unavailable')return 'Live scanner unavailable · showing saved catalogue';
 const d=live.lastSuccessAt;
 if(!d)return 'Daily scan has not succeeded';
 const age=daysAgo(d), state=live.scanStatus==='partial'?' · some sources unavailable':live.scanStatus==='error'?' · latest attempt failed':'';
 return 'Last successful scan '+fmt(d)+(age>2?' · CHECK FRESHNESS':'')+state;
}
function render(){
 const period=Number($('period').value),q=$('search').value.toLowerCase().trim();const all=records();
 const rows=all.filter(x=>(type==='all'||x.kind===type)&&(!period||(daysAgo(x.date)>=0&&daysAgo(x.date)<=period))&&
  [x.title,x.detail,x.summary].join(' ').toLowerCase().includes(q));
 const feed=$('feedList');feed.replaceChildren();
 for(const r of rows){
  const card=elt('article','news-card');
  const badge=elt('span','news-tag '+r.kind,r.kind==='launch'?'✦ DATED RELEASE / UPDATE':r.kind==='added'?'＋ NEW TO ENVAI':'◇ TOOL CANDIDATE · UNVERIFIED');
  const header=elt('div','meta',fmt(r.date)+' · '+(r.kind==='launch'?'RELEASE SIGNAL':r.kind==='added'?'ADDED TO DIRECTORY':'LEAD FOUND'));
  const title=elt('h3',null,r.title),detail=elt('div','meta',r.detail),summary=elt('p',null,r.summary);
  const classMap={'Traditional digital':['traditional','Traditional'],'AI-augmented':['augmented','AI-augmented'],
   'AI-native':['native','AI-native'],'Unverified':['unverified','Unverified']};
  const [classToken,classText]=classMap[r.aiType]||classMap.Unverified;
  const titleRow=elt('div','news-title-row');titleRow.append(title,elt('span','news-ai-label '+classToken,classText));
  const actions=elt('div','actions');actions.append(link(r.kind==='lead'?'Try website ↗':r.toolUse==='install'?'Get app ↗':r.toolUse==='access'?'Access details ↗':'Open tool ↗',r.url),link('Source / evidence ↗',r.evidence));
  if(r.kind!=='lead'){
   const a=elt('a',null,'Locate on map ↗');a.href='./?tool='+encodeURIComponent(r.id)+'#atlas';actions.append(a);
  }else if(r.id?.startsWith('candidate:')){
   const a=elt('a',null,'Search on map ↗');a.href='./?tool='+encodeURIComponent('lead:'+r.id)+'#atlas';actions.append(a);
  }
  card.append(badge,header,titleRow,detail,summary,actions);feed.append(card);
 }
 if(!rows.length)feed.append(elt('div','empty-feed','No signals match these filters. Try a longer date range or another category.'));
 $('resultCount').textContent=rows.length+' SIGNALS SHOWN';
 $('eventCount').textContent=all.filter(t=>t.kind==='launch'&&daysAgo(t.date)<=90&&daysAgo(t.date)>=0).length+' recent release signals';
 $('addedCount').textContent=all.filter(t=>t.kind==='added'&&daysAgo(t.date)<=90&&daysAgo(t.date)>=0).length+' newly indexed';
 $('leadCount').textContent=all.filter(t=>t.kind==='lead').length+' leads in review';
 $('reviewStamp').textContent='Catalogue reviewed '+fmt(data.reviewedAt);
 $('scanStamp').textContent=scanLabel();
 $('scanStamp').title='The public feed prioritises usable apps and installable software. Repository-only research, initial seed entries and code-only releases are kept out; a reachable URL is not a functional guarantee.';
}
async function load(){
 try{
  const [a,b,c]=await Promise.all([
   fetch('./data/tools.json',{cache:'no-store'}),fetch('./data/discoveries.json',{cache:'no-store'}),
   window.EnvAILive?.load()||Promise.resolve(null)]);
  if(!a.ok)throw new Error('Cannot load catalogue');data=await a.json();
  if(b.ok)seeds=await b.json();if(c)live=c;
 }catch(e){console.warn('EnvAI news load failed',e);
  $('feedList').replaceChildren(elt('div','empty-feed','Could not load the catalogue. Check your connection or reload.'));
  $('resultCount').textContent='DATA UNAVAILABLE';return;
 }
 render();
}
document.querySelectorAll('.news-filter').forEach(b=>b.onclick=()=>{
 type=b.dataset.type;document.querySelectorAll('.news-filter').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));render();
});
$('period').onchange=render;$('search').oninput=render;load();
})();
