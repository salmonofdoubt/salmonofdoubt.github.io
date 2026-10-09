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
   $('lastConsolidated').textContent='Last consolidated: '+fmt(data.last_consolidated_at);
   $('lastChecked').textContent='Last source check: '+fmt(data.last_checked_at)+' · '+data.question_count+' public questions · '+(data.new_questions_ingested||0)+' newly ingested · '+data.question_status.pending+' pending independent verification'+(data.course_alignment?' · '+(data.course_alignment.supported+data.course_alignment.qualified)+' booklet checks':'');
   const sources=data.source_status||[];
   $('sourceCoverage').replaceChildren(...sources.map(s=>{
    const el=document.createElement('span');
    el.textContent=s.name+': '+(s.status==='reachable-shell'?'page checked'+(s.content_changed===true?' · changed':'')+'; no external questions imported':s.status==='unavailable'?'unavailable':s.status==='not-connected'?'private source not connected':s.status);
    return el;
   }));
   return data;
  }catch(e){console.warn('Consolidation source unavailable:',path,e.message)}
 }
 $('lastConsolidated').textContent='Last consolidated: Published report currently unavailable';
 $('lastChecked').textContent='The most recent report could not be loaded; check the workflow run for details.';
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