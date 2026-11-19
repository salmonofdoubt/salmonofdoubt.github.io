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
    const resp=await fetch('./data/discoveries.json',{cache:'no-store'});if(!resp.ok)throw new Error('Queue unavailable');
    const data=await resp.json();el('queueCount').textContent=String(Array.isArray(data.items)?data.items.length:0);
  }catch(e){el('queueCount').textContent='—';}
})();
