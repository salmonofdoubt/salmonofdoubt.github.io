'use strict';
(async function updateGuideStats(){
  const el=id=>document.getElementById(id);
  try{
    const [catalogueResponse,discoveryResponse,live]=await Promise.all([
      fetch('./data/tools.json',{cache:'no-store'}),
      fetch('./data/discoveries.json',{cache:'no-store'}),
      window.EnvAILive?.load()||Promise.resolve(null)
    ]);
    if(!catalogueResponse.ok)throw new Error('Catalogue unavailable');
    const data=await catalogueResponse.json();
    const list=Array.isArray(data.items)?data.items:[];
    const available=t=>{
      const h=live?.toolHealth?.[t.id];
      return ['online','install','access'].includes(t.toolUse)&&
        !(h?.state==='retired'&&h.url===t.url);
    };
    const usable=list.filter(available);
    const fields=['Biodiversity & wildlife','Land & satellites','Climate & energy','Water & oceans'];
    const shown=fields.reduce((n,field)=>n+
      Math.min(15,usable.filter(item=>item.domain===field&&item.mapVisible!==false).length),0);
    el('toolCount').textContent=String(usable.length);
    el('mappedCount').textContent=String(shown);
    el('reviewDate').textContent=data.reviewedAt||'Not recorded';
    const retired=list.filter(t=>live?.toolHealth?.[t.id]?.state==='retired'&&
      live.toolHealth[t.id].url===t.url).length;
    el('toolCount').title=retired?
      retired+' confirmed unavailable links excluded; preserved in the source catalogue.':
      'Current user-facing catalogue, excluding research-only references.';
    const seeds=discoveryResponse.ok?(await discoveryResponse.json()).items||[]:[];
    const candidates=[...seeds,...(live?.leads||[])].filter(x=>
      x.accessType==='web'&&x.siteReachable===true);
    el('queueCount').textContent=String(new Set(candidates.map(x=>x.id)).size);
    if(live?.lastSuccessAt)el('queueCount').title='Latest automatic source scan: '+live.lastSuccessAt;
  }catch(e){
    console.warn('EnvAI guide stats unavailable',e);
    for(const id of ['toolCount','mappedCount','queueCount'])el(id).textContent='—';
    el('reviewDate').textContent='Unavailable';
  }
})();
