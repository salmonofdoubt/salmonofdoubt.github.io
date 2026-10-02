(function(root){
  'use strict';
  function assess(monitor,job={},now=Date.now()) {
    if(job.running)return {fresh:false,reason:'Refresh in progress'};
    if(job.last_error)return {fresh:false,reason:'Latest refresh failed'};
    const summary=monitor.refresh_summary;
    const age=now-Date.parse(summary?.at||'');
    if(!summary?.complete || !Number.isFinite(age) || age<0)return {fresh:false,reason:'No completed full refresh recorded'};
    if(age>26*60*60*1000)return {fresh:false,reason:'Evidence refresh is older than 26 hours'};
    if(summary.failed?.length)return {fresh:false,reason:`Latest refresh: ${summary.successful} / ${summary.total} sources captured; some checks failed or were blocked`};
    return {fresh:true,reason:'Latest full evidence refresh succeeded and is current'};
  }
  root.ModelLabelFreshness={assess};
  if(typeof module!=='undefined')module.exports={assess};
})(typeof globalThis!=='undefined'?globalThis:this);
