(()=>{
'use strict';
const workflow='https://github.com/salmonofdoubt/salmonofdoubt.github.io/actions/workflows/d4b-refresh.yml';
const api='https://api.github.com/repos/salmonofdoubt/salmonofdoubt.github.io/actions';
const phases=['Check external sources','Audit question bank','Consolidate evidence report','Publish consolidation report'];
const $=id=>document.getElementById(id);
let pendingSince=0,tick=null,lastRunId=null;
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
 try{
  const r=await fetch('./consolidation.json?check='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('Not published');
  const data=await r.json();
  $('lastConsolidated').textContent='Last consolidated: '+fmt(data.last_consolidated_at);
  $('lastChecked').textContent='Last refresh checked: '+fmt(data.last_checked_at)+' · '+data.question_count+' public questions · '+data.question_status.pending+' pending independent verification';
  const sources=data.source_status||[];
  $('sourceCoverage').replaceChildren(...sources.map(s=>{
   const el=document.createElement('span');
   el.textContent=s.name+': '+(s.status==='reachable-shell'?'page checked, questions not imported':s.status==='unavailable'?'unavailable':s.status==='not-connected'?'private connection needed':s.status);
   return el;
  }));
  return data;
 }catch{
  $('lastConsolidated').textContent='Last consolidated: No published refresh record yet';
  $('lastChecked').textContent='The first refresh must be run through GitHub Actions after this change is merged.';
  return null;
 }
}
async function check(){
 try{
  const result=await getJson(api+'/workflows/d4b-refresh.yml/runs?event=workflow_dispatch&per_page=1');
  const run=result.workflow_runs?.[0];
  if(!run){notice('No refresh workflow run has been recorded.');showProgress([]);return}
  if(pendingSince&&new Date(run.created_at).getTime()<pendingSince-5000){
   notice('Waiting for you to start a new workflow run in GitHub…');
   return;
  }
  pendingSince=0;lastRunId=run.id;
  $('runLink').hidden=false;$('runLink').href=run.html_url;
  const jobs=await getJson(api+'/runs/'+encodeURIComponent(run.id)+'/jobs?per_page=50');
  const steps=jobs.jobs?.flatMap(j=>j.steps||[])||[];
  showProgress(steps);
  await manifest();
  if(run.status==='completed'){
   notice(run.conclusion==='success'?'GitHub consolidation finished. Check the timestamp above; publication may take a moment.':'Refresh did not complete successfully. Open the workflow log to see the failed step.');
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
 pendingSince=Date.now();
 window.open(workflow,'_blank','noopener,noreferrer');
 notice('GitHub authentication is required. In the opened page select Run workflow; this page will then report progress.');
 showProgress([]);
 if(!tick)tick=setInterval(check,20000);
});
$('refreshPoll').addEventListener('click',()=>{check()});
manifest();check();
})();