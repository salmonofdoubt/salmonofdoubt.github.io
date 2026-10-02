(function(root){
  'use strict';
  function assess(monitor,job={},now=Date.now()) {
    if(job.running)return {fresh:false,reason:'Refresh in progress'};
    if(job.last_error)return {fresh:false,reason:'Latest refresh failed'};
    const summary=monitor.refresh_summary;
    const age=now-Date.parse(summary?.at||'');
    if(!summary?.complete || !Number.isFinite(age) || age<0)return {fresh:false,reason:'No completed full refresh recorded'};
    if(age>26*60*60*1000)return {fresh:false,reason:'Evidence refresh is older than 26 hours'};
    const failed=Array.isArray(summary.failed)?summary.failed.length:0;
    const successful=Number(summary.successful)||0;
    const total=Number(summary.total)||0;
    return {
      fresh:true,
      reason:failed
        ? `Latest snapshot is current: ${successful} / ${total} sources captured; ${failed} source${failed===1?' is':'s are'} currently unavailable or blocked`
        : 'Latest full evidence refresh succeeded and is current'
    };
  }
  root.ModelLabelFreshness={assess};
  if(typeof module!=='undefined')module.exports={assess};
})(typeof globalThis!=='undefined'?globalThis:this);
