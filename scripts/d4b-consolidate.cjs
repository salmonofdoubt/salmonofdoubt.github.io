'use strict';
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../demos/d4b-quiz'),phase=process.argv[2]||'audit';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),time=()=>new Date().toISOString();
function read(name){try{return JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
function put(name,obj){fs.writeFileSync(path.join(dir,name),JSON.stringify(obj,null,2)+'\n')}
function fetchHtml(url,depth=0){return new Promise((resolve,reject)=>{
 if(depth>3)return reject(Error('Too many redirects'));
 const req=https.get(url,{timeout:10000,headers:{'User-Agent':'D4B-Evidence-Source-Check'}},res=>{
  if([301,302,307,308].includes(res.statusCode)){let loc=res.headers.location;res.resume();return loc?resolve(fetchHtml(new URL(loc,url).href,depth+1)):reject(Error('Invalid redirect'))}
  if(res.statusCode!==200){res.resume();return reject(Error('HTTP '+res.statusCode))}
  let chunks=[],size=0;res.on('data',x=>{size+=x.length;if(size>1048576)return req.destroy(Error('Oversize'));chunks.push(x)});
  res.on('end',()=>{const buffer=Buffer.concat(chunks);resolve({fingerprint:hash(buffer),bytes:size,body:buffer.toString('utf8')})});res.on('error',reject);
 });req.on('timeout',()=>req.destroy(Error('Timeout')));req.on('error',reject);
})}
async function discover(){const previous=read('source-check.json')?.sources||[];const result={checked_at:time(),sources:[]};for(const s of read('sources.json').sources){
 let record={id:s.id,name:s.name,mode:s.mode};
 if(s.kind==='public'){
  try{
   const page=await fetchHtml(s.url),origin=new URL(s.url).origin;
   const scripts=[...page.body.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
    .map(m=>{try{return new URL(m[1],s.url)}catch{return null}})
    .filter(u=>u&&u.origin===origin&&/\.js$/i.test(u.pathname))
    .map(u=>u.href);
   const unique=[...new Set(scripts)].slice(0,8),assets=[];
   for(const url of unique){
    try{const file=await fetchHtml(url);assets.push({path:new URL(url).pathname,fingerprint:file.fingerprint,status:'checked'})}
    catch(e){assets.push({path:new URL(url).pathname,status:'unavailable',error:String(e.message).slice(0,80)})}
   }
   const checked=assets.filter(a=>a.status==='checked').length;
   Object.assign(record,{status:'reachable-shell',bytes:page.bytes,
    html_fingerprint:page.fingerprint,assets_checked:checked,assets_total:assets.length,assets,
    fingerprint:hash(JSON.stringify({page:page.fingerprint,assets}))});
   if(checked!==assets.length)record.note='Some same-origin scripts were unavailable; change detection is incomplete.';
  }catch(e){record.status='unavailable';record.error=String(e.message).slice(0,100)}
 }
 else record.status='not-connected';
 const old=previous.find(x=>x.id===s.id);
 record.content_changed=record.status==='reachable-shell'&&old?.status==='reachable-shell'?record.fingerprint!==old.fingerprint:null;
 result.sources.push(record);console.log(s.id+': '+record.status);
}put('source-check.json',result)}

// Parse the two frozen JSON assignments at known, anchored boundaries.
// Literal ");" within question text, explanation or source citations is ordinary data.
function parseFrozenJson(code,name,nextMarker){
 const marker='window.D4B_'+name+'=Object.freeze(';
 const prefix=code.indexOf(marker);
 if(prefix<0)throw Error(name+' assignment missing');
 const start=prefix+marker.length;
 const stop=nextMarker?code.indexOf(nextMarker,start):code.length;
 if(stop<0)throw Error(name+' following assignment missing');
 const raw=code.slice(start,stop).trimEnd();
 if(!raw.endsWith(');'))throw Error(name+' assignment must end with );');
 const json=raw.slice(0,-2);
 return {list:JSON.parse(json),start,end:start+json.length};
}
function parseBank(code){return parseFrozenJson(code,'QUESTIONS')}
function parseCurriculum(code){return parseFrozenJson(code,'CURRICULUM','window.D4B_QUESTIONS=Object.freeze(').list}
function normalize(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function validateCandidate(q,curriculum){
 const bad=[];
 if(!/^d4b-[0-9]{3,5}$/.test(q.id||''))bad.push('stable ID');
 if(!Array.isArray(curriculum[q.module])||!Number.isInteger(q.week)||q.week<1||q.week>curriculum[q.module].length)bad.push('module/week');
 if(typeof q.stem!=='string'||q.stem.length<18)bad.push('stem');
 if(!Array.isArray(q.choices)||q.choices.length!==4||q.choices.some(x=>typeof x!=='string'||x.trim().length<3))bad.push('choices');
 if(!Number.isInteger(q.correct)||q.correct<0||q.correct>3)bad.push('key');
 if(typeof q.explanation!=='string'||q.explanation.trim().length<15)bad.push('explanation');
 if(typeof q.source!=='string'||!q.source.includes('Booklet'))bad.push('source');
 if(q.origin!=='booklet-derived'||q.verification!=='pending')bad.push('provenance');
 if(q.evidence?.originalMaterialChecked!==false||typeof q.evidence?.source!=='string')bad.push('evidence');
 return bad;
}
function ingest(){
 const file=path.join(dir,'questions.js'),code=fs.readFileSync(file,'utf8');
 const bank=parseBank(code),curriculum=parseCurriculum(code);
 const proposals=read('candidates.json')?.items||[],existingIds=new Set(bank.list.map(q=>q.id)),existingStems=new Set(bank.list.map(q=>normalize(q.stem)));
 const errors=[],additions=[],dupes=[];
 for(const q of proposals){
  const bad=validateCandidate(q,curriculum);
  if(bad.length){errors.push(q.id+': '+bad.join(', '));continue}
  if(existingIds.has(q.id)){
   const prev=bank.list.find(x=>x.id===q.id);
   if(normalize(prev.stem)!==normalize(q.stem)||prev.correct!==q.correct)errors.push(q.id+': ID collision changed stem or answer');
   else dupes.push(q.id);
   continue;
  }
  if(existingStems.has(normalize(q.stem))){errors.push(q.id+': duplicate stem with another ID');continue}
  existingStems.add(normalize(q.stem));existingIds.add(q.id);additions.push(q);
 }
 if(errors.length)throw Error('Publication blocked. Candidate validation: '+errors.join('; '));
 // Sync the PWA assets for *any* bank change, not only when questions are added.
 // In particular, verification-only audits must not keep an obsolete question cache.
 const revised=additions.length
  ? code.slice(0,bank.start)+JSON.stringify([...bank.list,...additions],null,2)+code.slice(bank.end)
  : code;
 if(revised!==code)fs.writeFileSync(file,revised);
 const version='bank-'+hash(revised).slice(0,10);
 const indexPath=path.join(dir,'index.html'),swPath=path.join(dir,'service-worker.js');
 const beforeIndex=fs.readFileSync(indexPath,'utf8'),beforeSw=fs.readFileSync(swPath,'utf8');
 const index=beforeIndex.replace(/(questions\.js\?v=)[^"]+/g,'$1'+version);
 const sw=beforeSw.replace(/(questions\.js\?v=)[^']+/g,'$1'+version)
  .replace(/(const CACHE_NAME = ')[^']+(')/,"$1salmon-d4b-evidence-quiz-"+version+"$2");
 if(!index.includes('questions.js?v='+version)||!sw.includes('questions.js?v='+version))
  throw Error('Versioned asset path could not be updated');
 if(index!==beforeIndex)fs.writeFileSync(indexPath,index);
 if(sw!==beforeSw)fs.writeFileSync(swPath,sw);
 const report={processed_at:time(),staged:proposals.length,added:additions.length,already_present:dupes.length,added_ids:additions.map(q=>q.id),
  source:'User booklet-derived original candidate set only. No Moodle or peer-site questions automatically copied.',
  independent_factual_verification_performed:false};
 put('ingestion-report.json',report);
 console.log('New questions incorporated: '+report.added+'; already present: '+report.already_present);
}

function audit(){const code=fs.readFileSync(path.join(dir,'questions.js'),'utf8');
 const questions=parseBank(code).list,ids=new Set(),stems=new Set(),errors=[],statuses={verified:0,pending:0,flagged:0},byWeek={},courseAlignment={supported:0,qualified:0,notReviewed:0};
 for(const q of questions){
  if(!q.id||ids.has(q.id))errors.push('duplicate id '+q.id);ids.add(q.id);
  const norm=normalize(q.stem);if(stems.has(norm))errors.push(q.id+': duplicate question wording');stems.add(norm);
  if(typeof q.stem!=='string'||q.stem.length<10||!Array.isArray(q.choices)||q.choices.length!==4||q.choices.some(a=>typeof a!=='string'||!a.trim()))errors.push(q.id+': options/stem');
  if(!Number.isInteger(q.correct)||q.correct<0||q.correct>3||!q.explanation||!q.source)errors.push(q.id+': key/evidence');
  if(!q.origin||!q.verification||!q.evidence?.source)errors.push(q.id+': provenance');
  const k=q.module+':'+q.week;byWeek[k]=(byWeek[k]||0)+1;
  const ca=q.course_alignment;
  if(ca){
   if(!['supported','qualified'].includes(ca.status)||ca.module!==q.module||ca.week!==q.week||!ca.booklet_locator||!ca.reviewed_at||ca.original_moodle_key_checked!==false)errors.push(q.id+': invalid module alignment metadata');
   else courseAlignment[ca.status]++;
  }else courseAlignment.notReviewed++;
  if(q.verification==='verified'){if(!q.evidence||q.evidence.originalMaterialChecked!==true||!q.evidence.locator||!q.evidence.reviewed_at||!/^https:\/\//.test(q.evidence.url||''))errors.push(q.id+': verification without documented source URL, locator and date');statuses.verified++}
  else if(q.verification==='flagged')statuses.flagged++;
  else if(['pending','key-pending','official-key-confirmed'].includes(q.verification))statuses.pending++;
  else errors.push(q.id+': unknown verification status');
 }
 const curriculum=parseCurriculum(code);
 const missing=Object.entries(curriculum).flatMap(([m,weeks])=>weeks.map((_,i)=>m+':'+(i+1))).filter(k=>!byWeek[k]);
 const reviewItems=questions.map(q=>({
 id:q.id,module:q.module,week:q.week,topic:q.topic,
 origin:q.origin,verification:q.verification,booklet_section:q.source,course_alignment:q.course_alignment?.status||'not-reviewed',course_qualification:q.course_alignment?.status==='qualified'?q.course_alignment.note:null,
 primary_reference:q.evidence?.url||null,primary_locator:q.evidence?.locator||null,
 last_independent_review:q.evidence?.reviewed_at||null,
 next_action:q.verification==='verified'?'Recheck when source or question changes':q.verification==='flagged'?'Resolve ambiguity before scoring':'Check full answer, all three distractors and precise primary/lecturer-source evidence'
}));
 const reviewQueue={generated_at:time(),source:'Public original-question bank only; private Moodle material excluded',total:reviewItems.length,
 waiting_primary_review:reviewItems.filter(q=>q.verification!=='verified').length,
 items:reviewItems};
 put('review-queue.json',reviewQueue);
 const result={checked_at:time(),count:questions.length,bank_fingerprint:hash(code),statuses,course_alignment:courseAlignment,by_week:byWeek,uncovered_weeks:missing,structural_errors:errors,independently_verified:statuses.pending===0&&statuses.flagged===0&&errors.length===0};
 put('audit-report.json',result);console.log('questions '+result.count+', pending '+statuses.pending+', schema errors '+errors.length);
 if(errors.length)throw Error(errors.join('; '));
}
// Human-reviewed publication records are explicit provenance, not claims that
// the public Actions runner can access private teaching material.
function publicationLedger(){
 const doc=read('content-updates.json');
 const events=doc?.events||[];
 if(doc?.schema_version!==1||!Array.isArray(events))throw Error('Invalid content release ledger');
 const questions=parseBank(fs.readFileSync(path.join(dir,'questions.js'),'utf8')).list;
 const bank=new Map(questions.map(q=>[q.id,q]));
 const knownEvents=new Set(),knownQuestions=new Set();
 const releases=[];
 for(const row of events){
  if(!row||typeof row!=='object'||!row.id||knownEvents.has(row.id))throw Error('Missing or duplicate release ID');
  knownEvents.add(row.id);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(row.accepted_at||'')||!Number.isFinite(Date.parse(row.accepted_at)))throw Error(row.id+': invalid accepted_at');
  if(!['GEN','AIB','INN','DTR'].includes(row.module)||!Number.isInteger(row.week)||row.week<1)throw Error(row.id+': invalid module/week');
  if(!['drive','leprechaun','get-styled','chats','staged-original'].includes(row.source_id))throw Error(row.id+': unrecognised source');
  if(typeof row.source_name!=='string'||!row.source_name.trim()||typeof row.material!=='string'||!row.material.trim()||typeof row.source_access!=='string'||!row.source_access.trim())throw Error(row.id+': missing source provenance');
  if(!/^https:\/\/github\.com\/salmonofdoubt\/salmonofdoubt\.github\.io\/pull\/\d+$/.test(row.release_url||''))throw Error(row.id+': untrusted release URL');
  if(!Array.isArray(row.question_ids)||row.question_ids.length===0||new Set(row.question_ids).size!==row.question_ids.length)throw Error(row.id+': empty/duplicate question IDs');
  for(const id of row.question_ids){
   const q=bank.get(id);
   if(!q||q.module!==row.module||q.week!==row.week)throw Error(row.id+': missing/mismatched released question '+id);
   if(knownQuestions.has(id))throw Error(row.id+': question counted twice as new content '+id);
   knownQuestions.add(id);
  }
  releases.push({
   id:row.id,accepted_at:row.accepted_at,source_id:row.source_id,
   source_name:row.source_name,source_access:row.source_access,material:row.material,
   module:row.module,week:row.week,
   question_count:row.question_ids.length,question_ids:row.question_ids,
   release_url:row.release_url,review_scope:row.review_scope||'',
  });
 }
 releases.sort((a,b)=>b.accepted_at.localeCompare(a.accepted_at));
 // A single reviewed PR can publish source-supported questions to several
 // modules/weeks. Retain per-question traceability while reporting that PR
 // as ONE accepted release on the website, not eight misleading "last" entries.
 const byPublication=new Map();
 for(const r of releases){
  const key=r.release_url+'|'+r.source_id;
  if(!byPublication.has(key))byPublication.set(key,{
   accepted_at:r.accepted_at,source_id:r.source_id,source_name:r.source_name,
   source_access:r.source_access,release_url:r.release_url,question_count:0,
   question_ids:[],module_weeks:[],material:''
  });
  const g=byPublication.get(key);
  if(g.accepted_at!==r.accepted_at||g.source_access!==r.source_access)
   throw Error('Inconsistent metadata for one accepted release '+r.release_url);
  g.question_count+=r.question_count;
  g.question_ids.push(...r.question_ids);
  g.module_weeks.push({module:r.module,week:r.week,question_count:r.question_count,material:r.material});
 }
 const groups=[...byPublication.values()].map(g=>{
  g.module_weeks.sort((a,b)=>a.module.localeCompare(b.module)||a.week-b.week);
  g.material=g.module_weeks.map(m=>m.module+' W'+String(m.week).padStart(2,'0')).join(' · ');
  return g;
 }).sort((a,b)=>b.accepted_at.localeCompare(a.accepted_at));
 return {
  latest:releases[0]||null,recent:releases.slice(0,6),
  recorded_releases:releases.length,releases,
  latest_group:groups[0]||null,recent_groups:groups.slice(0,6)
 };
}

function consolidate(){const audit=read('audit-report.json'),discovery=read('source-check.json'),ingestion=read('ingestion-report.json'),prev=read('consolidation.json');
 if(!audit||!discovery||!ingestion||audit.structural_errors.length)throw Error('Ingest, audit and discovery required');
 const digest=hash(JSON.stringify({bank:audit.bank_fingerprint,external:discovery.sources.map(s=>({id:s.id,fingerprint:s.fingerprint||null}))})),at=time(),changed=!prev||prev.content_fingerprint!==digest;
 const published=publicationLedger();
 const output={schema_version:1,last_checked_at:at,last_consolidated_at:changed?at:prev.last_consolidated_at,last_question_bank_change_at:!prev||prev.bank_fingerprint!==audit.bank_fingerprint?at:prev.last_question_bank_change_at,
 content_fingerprint:digest,content_changed:changed,bank_fingerprint:audit.bank_fingerprint,question_count:audit.count,question_status:audit.statuses,course_alignment:audit.course_alignment,by_week:audit.by_week,uncovered_weeks:audit.uncovered_weeks,new_questions_ingested:ingestion.added,
 ingestion_tracking:{
  updated_at:at,
  last_automated_check_at:discovery.checked_at,
  last_automation_ingest_at:ingestion.processed_at,
  last_automation_ingested_count:ingestion.added,
  last_automation_added_ids:ingestion.added_ids||[],
  staged_candidate_count:ingestion.staged,
  staged_already_present:ingestion.already_present,
  last_reviewed_material_release:published.latest,
  recent_reviewed_material_releases:published.recent,
  last_reviewed_release_group:published.latest_group,
  recent_reviewed_release_groups:published.recent_groups,
  reviewed_release_count:published.recorded_releases,
  explicit_source_boundary:'GitHub fingerprints public pages and reconciles already-staged original questions. It cannot independently read private Drive, ChatGPT, or Moodle content; private material releases require a separate authorised review.'
 },
 source_status:discovery.sources,
 audit:{structural_errors:0,independently_verified:audit.independently_verified},
 limitation:'Public GitHub checks only stage previously authored original practice questions and monitor peer-site fingerprints. Changes to private Google Drive and ChatGPT material are not read by this workflow; original-source verification of pending answers remains a separate review.'};
 put('consolidation.json',output);console.log('consolidation '+(changed?'changed':'unchanged'));
}
module.exports={parseBank,parseCurriculum,publicationLedger};
if(require.main===module)(async()=>{try{if(phase==='discover')await discover();else if(phase==='ingest')ingest();else if(phase==='audit')audit();else if(phase==='consolidate')consolidate();else if(phase==='all'){await discover();ingest();audit();consolidate()}else throw Error('Unknown phase')}catch(e){console.error(e);process.exitCode=1}})();
