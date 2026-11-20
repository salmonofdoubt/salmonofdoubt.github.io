/* EnvAI live source. Read a bot-updated JSON snapshot directly from GitHub raw
   when hosted on GitHub Pages. GitHub Actions bot commits do not rebuild Pages.
   Localhost always reads local files for development; data is read-only. */
(function(){
'use strict';
const LOCAL='./data/live-updates.json';
const REMOTE='https://raw.githubusercontent.com/salmonofdoubt/salmonofdoubt.github.io/master/demos/envai/data/live-updates.json';
function valid(j){return j&&j.schemaVersion===1&&Array.isArray(j.releaseEvents)&&Array.isArray(j.leads)}
async function request(url){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6000);
  try{const resp=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!resp.ok)throw Error('HTTP '+resp.status);
    const j=await resp.json();if(!valid(j))throw Error('Invalid EnvAI snapshot');return j;
  } finally{clearTimeout(timeout)}
}
async function load(){
 const remote=location.hostname==='salmonofdoubt.github.io';
 if(remote){
   try{return await request(REMOTE+'?hour='+Math.floor(Date.now()/3600000))}
   catch(e){console.warn('Live EnvAI data unavailable; using last published snapshot',e)}
 }
 try{return await request(LOCAL+'?hour='+Math.floor(Date.now()/3600000))}
 catch(e){console.warn('EnvAI live snapshot unavailable',e);
   return {schemaVersion:1,scanStatus:'unavailable',lastSuccessAt:null,
           releaseEvents:[],leads:[],errorSummary:['Snapshot unavailable']}}
}
function freshDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;
 const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.valueOf())?d:null}
function validLink(v){try{const u=new URL(v);return u.protocol==='https:'?u.href:null}catch{return null}}
function isToolSite(url){try{const h=new URL(url).hostname.toLowerCase();return h!=='github.com'&&h!=='www.github.com'&&h!=='gitlab.com'&&h!=='www.gitlab.com'}catch{return false}}
function mergeCatalog(curated,live){
 // Retire only after two explicit 404/410 checks of the exact catalogued URL.
 // Do not treat anti-bot responses, outages or access restrictions as retirement.
 const rows=curated.filter(x=>{
   const h=live?.toolHealth?.[x.id];return !(h?.state==='retired'&&h.url===x.url);
 }).map(x=>({...x}));const index=new Map(rows.map(x=>[x.id,x]));
 for(const r of live?.releaseEvents||[]){
   const tool=index.get(r.toolId),when=freshDate(r.eventDate);
   if(!tool||!when||!validLink(r.evidence))continue;
   const old=freshDate(tool.eventDate);
   if(!old||old<when){tool.eventDate=r.eventDate;
     tool.eventType='Official GitHub release'+(r.tag?' · '+String(r.tag).slice(0,40):'');
     tool.evidence=r.evidence;}
 }
 // Candidates join *search only*, remain clearly Unverified, and never join
 // the default star map. Its cap and existing node positions are preserved.
 const knownUrls=new Set(rows.map(t=>String(t.url||'').toLowerCase().replace(/\/$/,'')));
 for(const r of (live?.leads||[]).slice(0,120)){
  if(!r.id||!r.title||!r.domain||!validLink(r.url)||r.accessType!=='web'||r.siteReachable!==true||!isToolSite(r.url))continue;
  if(knownUrls.has(r.url.toLowerCase().replace(/\/$/,'')))continue;
  rows.push({id:'lead:'+r.id,title:String(r.title).slice(0,150),
    domain:r.domain,capability:'Explore & decide',signals:[],organisation:'Unverified discovery',
    summary:'UNVERIFIED TOOL CANDIDATE · '+String(r.note||'A reachable tool website was indexed; its functionality has not been independently verified.').slice(0,280),
    url:r.url,evidence:validLink(r.evidence)||r.url,
    eventDate:null,eventType:null,addedAt:null,
    access:'Website · unverified',tags:Array.isArray(r.tags)?r.tags.slice(0,8):[],
    aiType:'Unverified',toolUse:'online',mapVisible:false,accessNote:'Candidate website reachable during scan; functionality unverified.',classificationEvidence:'Website was reachable during discovery, but functionality and AI status are not yet verified. Not an approved EnvAI tool.'});
 }
 return rows;
}
window.EnvAILive=Object.freeze({load,mergeCatalog});
})();
