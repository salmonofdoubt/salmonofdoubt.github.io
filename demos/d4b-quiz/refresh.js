(()=>{
'use strict';
const workflow='https://github.com/salmonofdoubt/salmonofdoubt.github.io/actions/workflows/d4b-refresh.yml';
const api='https://api.github.com/repos/salmonofdoubt/salmonofdoubt.github.io/actions';
const phases=['Check external sources','Incorporate vetted candidate questions','Audit question bank','Consolidate evidence report','Publish consolidation report'];
const $=id=>document.getElementById(id);
let tick=null;
const fmt=d=>d?new Intl.DateTimeFormat('en-IE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Dublin'}).format(new Date(d)):'Not yet recorded';
function notice(message){$('refreshMessage').textContent=message}
function showProgress(steps){
 const done=phases.filter(name=>steps.some(step=>step.name===name&&step.conclusion==='success')).length;
 const p=Math.round(done/phases.length*100);
 $('refreshBar').style.width=p+'%';
 $('refreshProgress').setAttribute('aria-valuenow',String(p));
 const list=$('refreshStages');list.replaceChildren(...phases.map(name=>{
  const item=document.createElement('li'),step=steps.find(x=>x.name===name);
  item.textContent=(step?.conclusion==='success'?'✓ ':step?.conclusion==='failure'?'✕ ':step?.status==='in_progress'?'… ':'○ ')+name;
  if(step?.conclusion==='success')item.className='is-complete';
  else if(step?.conclusion==='failure')item.className='has-failed';
  return item;
 }));
}
async function getJson(url){
 const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
 if(!r.ok)throw Error('HTTP '+r.status);
 return r.json();
}
function renderIngestion(data){
 const tracking=data.ingestion_tracking||null;
 const accepted=tracking?.last_reviewed_material_release||null;
 $('lastContentLink').hidden=true;
 $('lastContentLink').removeAttribute('href');
 if(accepted){
  const label=accepted.module+' Week '+String(accepted.week).padStart(2,'0')+' · '+accepted.question_count+' questions';
  $('lastContentTitle').textContent=label;
  $('lastContentDetail').textContent=fmt(accepted.accepted_at)+' · '+accepted.material+' · '+accepted.source_name+'. Reviewed original practice content; this was not an automatic private Drive import by GitHub.';
  if(/^https:\/\/github\.com\/salmonofdoubt\/salmonofdoubt\.github\.io\/pull\/\d+$/.test(accepted.release_url||'')){
   $('lastContentLink').href=accepted.release_url;
   $('lastContentLink').hidden=false;
  }
 }else{
  $('lastContentTitle').textContent='No reviewed source release recorded';
  $('lastContentDetail').textContent='Past releases may predate the ledger. No ingestion is inferred from source fingerprints.';
 }
 const count=tracking?.last_automation_ingested_count;
 $('lastRunIngest').textContent=Number.isInteger(count)?count+' new questions':'No ingestion record';
 $('lastRunIngestDetail').textContent=Number.isInteger(count)
  ?fmt(tracking.last_automation_ingest_at)+' · '+tracking.staged_candidate_count+' candidate questions staged; '+tracking.staged_already_present+' already present. These are GitHub-staged originals, not newly accessed Drive or peer-site material.'
  :'The automated question-ingestion count has not been published.';
 const list=$('sourceCoverage');
 list.replaceChildren(...(data.source_status||[]).map(s=>{
  const row=document.createElement('li');row.className='source-ledger-row';
  const name=document.createElement('strong');name.textContent=s.name;
  const mode=document.createElement('p');mode.className='fine';
  const release=tracking?.recent_reviewed_material_releases?.find(x=>x.source_id===s.id)||null;
  if(s.status==='reachable-shell'){
   mode.textContent='Public page fingerprint checked '+fmt(tracking?.last_automated_check_at||data.last_checked_at)
    +' · '+(s.content_changed===true?'Changed since previous check':s.content_changed===false?'No change detected':'No previous comparison')
    +' · 0 peer-site questions automatically imported';
  }else if(s.status==='unavailable'){
   mode.textContent='Public source unavailable at last check · '+(s.error||'See GitHub report')+' · no questions imported';
  }else if(s.status==='not-connected'){
   mode.textContent='Not connected to GitHub Actions · no automatic content retrieval or ingestion';
  }else{
   mode.textContent='Status: '+(s.status||'unknown')+' · no independent ingestion evidence';
  }
  row.append(name,mode);
  if(release){
   const accepted=document.createElement('p');accepted.className='fine source-reviewed';
   accepted.textContent='Last separately reviewed material: '+fmt(release.accepted_at)+' · '+release.material+' · '+release.question_count+' original questions included in the approved public release';
   row.append(accepted);
  }
  return row;
 }));
}
async function manifest(){
 const paths=[
  'https://raw.githubusercontent.com/salmonofdoubt/salmonofdoubt.github.io/master/demos/d4b-quiz/consolidation.json',
  './consolidation.json'
 ];
 for(const path of paths){
  try{
   const r=await fetch(path+(path.includes('?')?'&':'?')+'check='+Date.now(),{cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   if(!data||typeof data.question_count!=='number'||!data.question_status||!data.last_checked_at)throw Error('Incomplete consolidation record');
   $('lastConsolidated').textContent='Last consolidation with changed source/bank fingerprint: '+fmt(data.last_consolidated_at);
   $('lastChecked').textContent='Last GitHub source check: '+fmt(data.last_checked_at)+' · '+data.question_count+' public questions · '+data.question_status.pending+' pending independent verification'
    +(data.course_alignment?' · '+(data.course_alignment.supported+data.course_alignment.qualified)+' booklet checks':'');
   renderIngestion(data);
   return data;
  }catch(e){console.warn('Consolidation source unavailable:',path,e.message)}
 }
 $('lastConsolidated').textContent='Last consolidated: Latest published report unavailable';
 $('lastChecked').textContent='Source and ingestion claims cannot be verified until the report becomes available.';
 $('lastContentTitle').textContent='Not available';
 $('lastContentDetail').textContent='The provenance record could not be loaded.';
 $('lastRunIngest').textContent='Not available';
 $('lastRunIngestDetail').textContent='No new-ingestion claim can be made.';
 $('sourceCoverage').replaceChildren();
 return null;
}
async function check(){
 try{
  const result=await getJson(api+'/workflows/d4b-refresh.yml/runs?branch=master&per_page=1');
  const run=result.workflow_runs?.[0];
  if(!run){notice('No automated refresh run has been recorded yet.');showProgress([]);await manifest();return}
  $('runLink').hidden=false;$('runLink').href=run.html_url;
  const jobs=await getJson(api+'/runs/'+encodeURIComponent(run.id)+'/jobs?per_page=50');
  const steps=jobs.jobs?.flatMap(j=>j.steps||[])||[];
  showProgress(steps);
  await manifest();
  if(run.status==='completed'){
   notice(run.conclusion==='success'?'Latest automated check finished successfully. Public question updates require an approved release.':'Automatic refresh failed. The existing question bank remains available; see the GitHub workflow log.');
   clearInterval(tick);tick=null;
  }else{
   notice('Refresh '+run.status.replaceAll('_',' ')+'. Progress shows actual completed GitHub Actions steps.');
   if(!tick)tick=setInterval(check,20000);
  }
 }catch(e){
  notice('Workflow status unavailable ('+e.message+'). Use the GitHub Actions link to inspect the run.');
  clearInterval(tick);tick=null;
 }
}
$('refreshWorkflow').addEventListener('click',()=>{
 window.open(workflow,'_blank','noopener,noreferrer');
 notice('Automatic checks run daily and after approved releases. GitHub shows the full audit history.');
});
$('refreshPoll').addEventListener('click',()=>{check()});
manifest();check();
})();