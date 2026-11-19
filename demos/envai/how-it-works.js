'use strict';
(async function updateGuideStats(){
  const el=id=>document.getElementById(id);
  try{
    const resp=await fetch('./data/tools.json',{cache:'no-store'});if(!resp.ok)throw new Error('Catalogue unavailable');
    const data=await resp.json();const list=Array.isArray(data.items)?data.items:[];
    const fields=['Biodiversity & wildlife','Land & satellites','Climate & energy','Water & oceans'];
    const shown=fields.reduce((n,field)=>n+Math.min(15,list.filter(item=>item.domain===field&&item.mapVisible!==false).length),0);
    el('toolCount').textContent=String(list.length);el('mappedCount').textContent=String(shown);
    el('reviewDate').textContent=data.reviewedAt||'Not recorded';
  }catch(e){el('toolCount').textContent='—';el('mappedCount').textContent='—';el('reviewDate').textContent='Unavailable';}
  try{
    const [resp,live]=await Promise.all([fetch('./data/discoveries.json',{cache:'no-store'}),
      window.EnvAILive?.load()||Promise.resolve(null)]);
    const seeds=resp.ok?(await resp.json()).items||[]:[];
    // Count only candidates with a direct web-tool URL, not bare repositories.
    const visible=[...seeds,...(live?.leads||[])].filter(x=>x.accessType==='web'&&x.siteReachable===true);
    const pending=new Set(visible.map(x=>x.id));
    el('queueCount').textContent=String(pending.size);
    if(live?.lastSuccessAt){el('queueCount').title='Latest automatic source scan: '+live.lastSuccessAt}
  }catch(e){el('queueCount').textContent='—';}
})();
