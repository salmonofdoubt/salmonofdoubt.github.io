
(function(){'use strict';
const $=id=>document.getElementById(id); const NS='http://www.w3.org/2000/svg';
const types={'AI-native':'native','AI-augmented':'augmented','Traditional digital':'digital','Unverified':'unverified'};
const classColors={native:'#FFA56B',augmented:'#F2F178',digital:'#76C0FF',unverified:'#B9B6D0'};
const domains={
 'Biodiversity & wildlife':{name:'NATURE',short:'Nature',color:'#92e5c1',cx:410,cy:440,mx:195,my:300},
 'Land & satellites':{name:'LAND',short:'Land',color:'#c9a6ef',cx:1010,cy:355,mx:550,my:300},
 'Climate & energy':{name:'CLIMATE',short:'Climate',color:'#f7bf8f',cx:1150,cy:735,mx:545,my:770},
 'Water & oceans':{name:'WATER',short:'Water',color:'#7fbef0',cx:460,cy:770,mx:220,my:785}
};
const state={catalog:[],searchIndex:[],queryResults:{hits:[],total:0,dominantDomain:null},searchCoords:new Map(),items:[],edges:[],nodes:new Map(),links:new Map(),groupMap:new Map(),openGroup:null,mobileDomain:'Biodiversity & wildlife',selected:null,selectedType:null,search:'',view:'desktop',W:1550,H:930,zoom:1,tx:0,ty:0,dragging:false,lastPt:null,moved:false};
const MAX_GROUP_NODES_DESKTOP=6,MAX_GROUP_NODES_MOBILE=3; // all tools remain in group browsers and search
const publicTool=t=>['online','install','access'].includes(t.toolUse); // reference items stay in JSON, not the experience
const SEARCH_LIMIT=6; // temporary, query-specific labels; never all search results
const lookupTool=id=>state.catalog.find(t=>t.id===String(id||'').replace(/^search:/,''));
function toolDestination(tool){
 try{
  const url=new URL(tool?.url);
  return ['https:','http:'].includes(url.protocol)?url.href:null;
 }catch{return null}
}
// Real links preserve the expanded constellation, support mobile taps and
// keyboard activation, and don't depend on popup-blocker heuristics.
function externalAttributes(url){return {href:url,target:'_blank',rel:'noopener noreferrer'}}
function preserveExternalActivation(el){
 el.addEventListener('click',ev=>{ev.stopPropagation();if(state.moved)ev.preventDefault()});
 el.addEventListener('keydown',ev=>{if(ev.key===' '){ev.preventDefault();el.click()}});
}
let uiTimer=0,autoPrompt=null;
function dateRecent(str){if(!str)return false;const d=new Date(str+'T12:00:00Z'),today=new Date();const diff=today-d;return Number.isFinite(diff)&&diff>=0&&diff<=90*86400000}
function seednum(s){let k=2166136261;for(let i=0;i<s.length;i++){k^=s.charCodeAt(i);k=Math.imul(k,16777619)}return k>>>0}
function rng(s){let v=seednum(s);return ()=>{v=(Math.imul(1664525,v)+1013904223)>>>0;return v/4294967296}}
function sortscore(a,b){const A=new Set(a.signals||[]),B=new Set(b.signals||[]);let sig=0;for(const k of A)if(B.has(k))sig++;
 const tagsA=new Set((a.tags||[]).map(x=>x.toLowerCase())), tagsB=new Set((b.tags||[]).map(x=>x.toLowerCase()));let tags=0;for(const k of tagsA)if(tagsB.has(k))tags++;
 const sameDomain=a.domain===b.domain,sameCap=a.capability===b.capability;
 return (sameDomain?1.2:0)+(sameCap?3:0)+sig*3.8+Math.min(tags,3)*2.4+(a.aiType===b.aiType?.25:0)}
function reason(a,b){const shared=(a.signals||[]).filter(x=>(b.signals||[]).includes(x));if(shared.length)return shared[0].toLowerCase();if(a.capability===b.capability)return a.capability.toLowerCase();const sharedTags=(a.tags||[]).filter(x=>(b.tags||[]).includes(x));if(sharedTags.length)return sharedTags[0].toLowerCase();if(a.domain===b.domain)return 'shared environmental field';return 'related workflow'}
function initEdges(){const links=new Map();const actual=state.items.filter(t=>!t._group);for(const a of actual){const scored=actual.filter(b=>b.id!==a.id).map(b=>({b,score:sortscore(a,b)})).sort((a,b)=>b.score-a.score);let chosen=scored.filter(x=>x.score>=3.4).slice(0,3);if(chosen.length<2)chosen=scored.slice(0,2);
  for(const {b,score} of chosen){const key=[a.id,b.id].sort().join('|');if(!links.has(key))links.set(key,{a:a.id,b:b.id,score,why:reason(a,b),cross:a.domain!==b.domain})}}
 state.edges=[...links.values()].sort((a,b)=>b.score-a.score).filter(x=>x.score>2.9).slice(0,115);
 state.links.clear();for(const t of state.items)state.links.set(t.id,new Set());for(const e of state.edges){state.links.get(e.a).add(e.b);state.links.get(e.b).add(e.a)}
}
function computeLayout(){
 const mobile=window.innerWidth<=690;
 state.view=mobile?'mobile':'desktop';
 state.W=mobile?440:1550;state.H=mobile?440:930;
 const byDom={};
 for(const t of state.items)(byDom[t.domain] ||= []).push(t);
 const bound=(v,min,max)=>Math.max(min,Math.min(max,v));
 for(const [name,arr] of Object.entries(byDom)){
  const d=domains[name],cx=mobile?220:d.cx,cy=mobile?216:d.cy;
  const groups=arr.filter(t=>t._group);
  const groupRadius=mobile?138:172;
  // Positions follow environmental purpose nodes. Count changes or the source
  // order cannot create arbitrary "featured" top-level tool exceptions.
  groups.forEach((group,i)=>{
   const angle=-Math.PI/2+2*Math.PI*i/groups.length;
   group._angle=angle;
   group._x=bound(cx+Math.cos(angle)*groupRadius,24,state.W-24);
   group._y=bound(cy+Math.sin(angle)*groupRadius*.83,34,state.H-36);
  });
  const byParent=new Map();
  for(const t of arr.filter(x=>x._groupParent)){
   const list=byParent.get(t._groupParent)||[];
   list.push(t);byParent.set(t._groupParent,list);
  }
  for(const [parentId,children] of byParent){
   const group=groups.find(x=>x.id===parentId);
   if(!group)continue;
   const centre=group._angle;
   const radius=mobile?195:242;
   const spread=mobile?.39:.65;
   children.forEach((tool,index)=>{
    const fraction=children.length===1?0:index/(children.length-1)-.5;
    const angle=centre+fraction*spread*2;
    tool._x=bound(cx+Math.cos(angle)*radius,23,state.W-23);
    tool._y=bound(cy+Math.sin(angle)*radius*(mobile?.82:.87),30,state.H-38);
   });
  }
 }
 // Only expanded tool siblings may shift to avoid collision. Purpose anchors
 // remain fixed so the user can develop a stable mental map of the field.
 const children=state.items.filter(t=>t._groupParent);
 for(let pass=0;pass<45;pass++)for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
  const a=children[i],b=children[j];
  if(a.domain!==b.domain)continue;
  const dx=a._x-b._x,dy=a._y-b._y,dist=Math.hypot(dx,dy)||1,min=mobile?43:52;
  if(dist>=min)continue;
  const step=(min-dist)*.16,ux=dx/dist,uy=dy/dist;
  a._x=bound(a._x+ux*step,22,state.W-22);
  b._x=bound(b._x-ux*step,22,state.W-22);
  a._y=bound(a._y+uy*step,30,state.H-38);
  b._y=bound(b._y-uy*step,30,state.H-38);
 }
}
function elem(name,attrs,parent){const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);parent?.append(e);return e}
function curved(a,b,bend=.12){const dx=b.x-a.x,dy=b.y-a.y,mx=(a.x+b.x)/2,my=(a.y+b.y)/2,offset=bend*Math.min(100,Math.hypot(dx,dy)*.25);return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx-dy/Math.hypot(dx,dy)*offset).toFixed(1)},${(my+dx/Math.hypot(dx,dy)*offset).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`}
// Four understated dotted lavender contours: visual geography, never controls.
// Derive each outline from the *actual* positioned tools rather than a fixed
// desktop ellipse; this keeps it accurate when the catalogue grows or the
// browser changes from desktop to mobile.
function background(){
 const layer=$('nebula');layer.replaceChildren();
 for(const [dom,d] of Object.entries(domains)){
  if(state.view==='mobile'&&dom!==state.mobileDomain)continue;
  const {x:cx,y:cy}=hubXY(dom);
  elem('circle',{cx,cy,r:state.view==='mobile'?245:320,fill:'url(#fieldGlow)',opacity:'.7'},layer);
  const tools=state.items.filter(t=>t.domain===dom);
  const margin=state.view==='mobile'?24:39;
  const maxDX=Math.max(0,...tools.map(t=>Math.abs(t._x-cx)));
  const maxDY=Math.max(0,...tools.map(t=>Math.abs(t._y-cy)));
  const rx=Math.max(state.view==='mobile'?152:215,maxDX+margin);
  const ry=Math.max(state.view==='mobile'?126:192,maxDY+margin);
  // A single fine dotted perimeter, plus a near-invisible atmosphere.
  const outline=elem('ellipse',{cx,cy,rx:rx.toFixed(1),ry:ry.toFixed(1),
   class:'cluster-boundary','data-field':dom,'aria-hidden':'true'},layer);
  outline.style.setProperty('--outline-order',Object.keys(domains).indexOf(dom));
 }
}
function hubXY(dom){const d=domains[dom];return {x:state.view==='mobile'?220:d.cx,y:state.view==='mobile'?216:d.cy}}
function draw(){const svg=$('graph');svg.setAttribute('viewBox',`0 0 ${state.W} ${state.H}`);const g=$('edges'), hubs=$('hubs'),n=$('nodes');g.replaceChildren();hubs.replaceChildren();n.replaceChildren();background();state.nodes.clear();
 const coords=new Map(state.items.map(x=>[x.id,{x:x._x,y:x._y}]));
 for(const link of state.edges){const path=elem('path',{d:curved(coords.get(link.a),coords.get(link.b),.23),class:'line'+(link.cross?' cross':''),'data-a':link.a,'data-b':link.b},g);link.el=path}
 for(const [dom,d] of Object.entries(domains)){
   if(state.view==='mobile'&&dom!==state.mobileDomain)continue;
   const p=hubXY(dom);
   for(const t of state.items.filter(x=>x.domain===dom)){
    const parent=t._groupParent?coords.get(t._groupParent):p;
    const originId=t._groupParent||'hub:'+dom;
    if(!parent)continue;
    const path=elem('path',{d:curved(parent,coords.get(t.id),0),
      class:'line '+(t._groupParent?'categoryline':'hubline'),
      'data-a':originId,'data-b':t.id},g);
    path.dataset.hub=dom;
   }
 const r=state.view==='mobile'?45:57;const group=elem('g',{class:'node hub','data-id':'hub:'+dom,role:'button',tabindex:'0','aria-label':`Show ${d.short} tools`,transform:`translate(${p.x},${p.y})`},hubs);
 elem('circle',{r:r+20,fill:'none',stroke:d.color,'stroke-opacity':'.16','stroke-width':'1','class':'hub-arc'},group);elem('circle',{r,fill:d.color,'fill-opacity':'.045',stroke:d.color,'stroke-opacity':'.7','stroke-width':'1.3','class':'outer'},group);elem('circle',{r:12,fill:d.color,'fill-opacity':'.1',stroke:d.color,'stroke-opacity':'.4'},group);elem('text',{y:-8,'text-anchor':'middle',class:'node-label'},group).textContent=d.name;elem('text',{y:11,'text-anchor':'middle',class:'sub-label'},group).textContent=`${state.catalog.filter(x=>x.domain===dom&&!x.id.startsWith('lead:')&&x.mapVisible!==false).length} TOOLS`;group.style.setProperty('--nodeColor',d.color);state.nodes.set('hub:'+dom,group);bindNode(group,'hub:'+dom)}
 const newSet=new Set(state.catalog.filter(x=>dateRecent(x.eventDate)).map(x=>x.id));$('newCount').textContent=String(newSet.size);
 for(const t of state.items){
   const d=domains[t.domain],color=d?.color||'#bad9db',AI=types[t.aiType]||'unverified';
   const url=t._group?null:toolDestination(t);
   const gTool=elem(url?'a':'g',{
    class:'node tool'+(t._group?' category-node':'')+
      (t._purpose?' purpose-node':'')+(t._pending?' pending-node':'')+
      (t._group?' primary':''),
    'data-id':t.id,role:url?'link':'button',tabindex:'0',
    'aria-label':t._purpose?`${t.label}, ${t._members.length} tools`:
      url?`Open ${t.title} in a new tab, ${t.aiType}`:
      `${t.title}, ${t.aiType}, information`,
    transform:`translate(${t._x.toFixed(1)},${t._y.toFixed(1)})`,
    ...(url?externalAttributes(url):{})
   },n);
   gTool.style.setProperty('--nodeColor',color);
   gTool.style.setProperty('--class-color',t._purpose?color:classColors[AI]);
  if(state.view==='mobile')elem('circle',{r:29,fill:'transparent',class:'touch-target'},gTool);
  elem('circle',{r:17,fill:'none',stroke:color,'stroke-opacity':'.20','stroke-width':'1.2',class:'outer'},gTool);
  elem('circle',{r:8,fill:t._purpose?color:AI==='native'?color:AI==='augmented'?color:'#09121e','fill-opacity':t._purpose?'.46':AI==='native'?'.83':AI==='augmented'?'.2':'1',stroke:t._purpose?color:classColors[AI], 'stroke-opacity':AI==='unverified'&&!t._purpose?'.3':'.85','stroke-width':t._purpose?'2':AI==='digital'?'1.5':'1.2','stroke-dasharray':t._pending?'2 3':null,class:'inner'},gTool);
  elem('circle',{r:19,class:'glow-ring'},gTool);
  if(t._purpose){
   // Miniature composition key: a topic mixes technologies while each
   // individual tool retains its real AI classification.
   const mix=[['Traditional digital','digital'],['AI-augmented','augmented'],['AI-native','native']];
   for(let i=0;i<mix.length;i++){
    const [type,key]=mix[i],count=t._aiCounts?.[type]||0;
    const dot=elem('circle',{cx:(i-1)*10,cy:24,r:3.5,
      fill:classColors[key],'fill-opacity':count?'.93':'.12',
      'aria-hidden':'true',class:'topic-ai-dot'},gTool);
   }
  }
  if(newSet.has(t.id)){const flare=elem('g',{class:'new-flare',transform:'translate(11,-10)'},gTool);elem('circle',{r:3.1,class:'flare-dot'},flare);elem('path',{d:'M0 -7 V-4 M0 4 V7 M-7 0 H-4 M4 0 H7',class:'flare-ray'},flare)}
  // The compact label is part of the clickable SVG node: no floating cards,
  // no second click, and no separate overlay that can intercept the map.
  const tether=elem('path',{class:'chip-tether',d:'M 0 0 L 20 0'},gTool);
  const chip=elem('g',{class:'tool-chip'},gTool);
  elem('rect',{class:'chip-bg',x:20,y:-19,width:110,height:27,rx:8},chip);
  const marker=elem('circle',{class:'chip-type',cx:32,cy:-5.5,r:3.3},chip);
  marker.setAttribute('fill',classColors[AI]);
  const lab=elem('text',{class:'node-label',x:43,y:-1.5},chip);lab.textContent=truncate(t.title,state.view==='mobile'?19:24);
  if(t._group){const mobile=state.view==='mobile';const label=mobile?(t.short||t.label):t.label;elem('text',{x:mobile?0:23,y:mobile?-33:5,'text-anchor':mobile?'middle':'start',class:'group-name','aria-hidden':'true'},gTool).textContent=label+' · '+t._members.length;}
   const title=elem('title',{},gTool);title.textContent=t._purpose?
   t.title+' · Traditional '+(t._aiCounts?.['Traditional digital']||0)+
   ', AI-augmented '+(t._aiCounts?.['AI-augmented']||0)+
   ', AI-native '+(t._aiCounts?.['AI-native']||0):
   t._group?t.title+' · pending review':t.title+' · '+t.aiType;state.nodes.set(t.id,gTool);bindNode(gTool,t.id)}
 drawSearchCandidates();styleFocus();updateCamera(false)}
function truncate(s,n){return s.length>n?s.slice(0,n-1).trim()+'…':s}
function bindNode(el,id){const isExternal=el.tagName.toLowerCase()==='a';el.addEventListener('pointerenter',ev=>{if(state.dragging)return;const x=ev.clientX,y=ev.clientY;const target=state.items.find(t=>t.id===id);const peer=state.selected&&!state.selected.startsWith('hub:')?state.items.find(t=>t.id===state.selected):null;
 const isConnected=peer&&target&&state.links.get(peer.id)?.has(target.id);
 $('tooltip').textContent=target?(isConnected?`${target.title}  ·  connected by ${reason(peer,target)}`:target.title):domains[id.slice(4)]?.short+' tools';$('tooltip').hidden=false;positionTooltip(x,y)});el.addEventListener('pointermove',ev=>positionTooltip(ev.clientX,ev.clientY));el.addEventListener('pointerleave',()=>{$('tooltip').hidden=true});if(isExternal){preserveExternalActivation(el);return}
 el.addEventListener('click',ev=>{ev.stopPropagation();if(state.moved)return;select(id)});
 el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select(id)}})}
function positionTooltip(x,y){const stage=$('stage').getBoundingClientRect();$('tooltip').style.left=Math.min(x-stage.left+8,stage.width-190)+'px';$('tooltip').style.top=Math.max(4,y-stage.top-10)+'px'}
function linkedIds(id){const result=new Set();if(!id)return result;result.add(id);if(id.startsWith('hub:')){const dom=id.slice(4);state.items.filter(x=>x.domain===dom).forEach(x=>result.add(x.id));return result}
 if(id.startsWith('search:')){const t=lookupTool(id);if(t)result.add('hub:'+t.domain);return result}
 const group=state.groupMap.get(id);
  if(group){for(const member of group._members)result.add(member);result.add('hub:'+group.domain);return result}
  const node=state.items.find(x=>x.id===id);
  if(node?._groupParent)result.add(node._groupParent);
  for(const peer of state.links.get(id)||[])result.add(peer);
  if(node)result.add('hub:'+node.domain);
  return result}

function traceSignals(){
 const layer=$('signals');if(!layer)return;layer.replaceChildren();
 if(!state.selected)return;
 const selected=state.selected,isHub=selected.startsWith('hub:');
 const paths=[...$('edges').querySelectorAll('.line.lit')].slice(0,isHub?11:12);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(let i=0;i<paths.length;i++){
  const path=paths[i],d=path.getAttribute('d');if(!d)continue;
  // A soft halo follows the same shape as the chosen connection.
  elem('path',{d,fill:'none',stroke:path.classList.contains('cross')?'#bdb5ff':'#8affdf',
    'stroke-opacity':i<5?'.14':'.08','stroke-width':i<5?'7':'5',filter:'url(#edgeGlow)',
    'stroke-linecap':'round'},layer);
  if(reduced)continue;
  const color=path.classList.contains('cross')?'#d4bcff':'#b8ffe4';
  const one=elem('circle',{r:i<5?'3.8':'2.8',fill:color,'fill-opacity':'.93',class:'signal'},layer);
  elem('animateMotion',{dur:(2.4+(i%5)*.26).toFixed(2)+'s',begin:'-'+(i*.29).toFixed(2)+'s',repeatCount:'indefinite',path:d},one);
  if(i<5){const two=elem('circle',{r:'1.9',fill:color,'fill-opacity':'.5',class:'signal small'},layer);
    elem('animateMotion',{dur:(2.4+(i%5)*.26).toFixed(2)+'s',begin:'-'+(i*.29+1.05).toFixed(2)+'s',repeatCount:'indefinite',path:d},two)}
 }
}


function arrangeFocusLabels(){
 // Show every revealed tool at the first fan-out, not just the five strongest
 // neighbours. Place labels OUTWARD from the selected centre and distribute
 // their rows on each side, like a gentle two-column constellation.
 for(const t of state.items){const g=state.nodes.get(t.id);if(!g)continue;
   g.classList.remove('revealed-label');g.style.removeProperty('--tag-delay');
 }
 if(!state.selected&&!state.search.trim())return;
 const hub=!!state.selected&&state.selected.startsWith('hub:');
 const selectedTool=hub?null:state.items.find(t=>t.id===state.selected);
 const group=state.groupMap.get(state.selected);
 const searchMode=!!state.search.trim()&&(!state.selected||state.selected.startsWith('search:'));
 if(!hub&&!selectedTool&&!searchMode)return;
 const domain=searchMode?state.queryResults.dominantDomain:null;
 const origin=hub?hubXY(state.selected.slice(4)):searchMode?hubXY(domain||'Water & oceans'):{x:selectedTool._x,y:selectedTool._y};
 const listed=hub?state.items.filter(t=>t.domain===state.selected.slice(4))
    :group?state.items.filter(t=>t._groupParent===group.id)
    :searchMode?state.queryResults.hits.map(h=>state.items.find(t=>t.id===h.tool.id)).filter(Boolean)
    :[selectedTool,...[...(state.links.get(selectedTool.id)||[])].map(id=>state.items.find(t=>t.id===id)).filter(Boolean)];
 // Two independent lanes avoid most label collisions without moving nodes or
 // altering the camera. Rows still point back to their own circles.
 const lanes={left:[],right:[]};
 for(const t of listed){const g=state.nodes.get(t.id),lab=g?.querySelector('.node-label');if(!lab)continue;
   const title=lab.textContent||t.title;
   const fontSize=state.view==='mobile'?19:15;
   const measured=typeof lab.getComputedTextLength==='function'?lab.getComputedTextLength():0;
   const width=Math.min(state.view==='mobile'?232:244,Math.max(82,Math.ceil(measured||title.length*fontSize*.54)+36));
   const side=t._x<origin.x?'left':'right';
   // Keep the currently focused tool visible even when its neighbours fan out.
   const preferredY=t._y-(state.view==='mobile'?15:14);
   lanes[side].push({t,g,lab,width,side,preferredY});
 }
 const height=state.view==='mobile'?32:29;
 const gap=state.view==='mobile'?5:5;
 const pad=15;
 for(const [side,entries] of Object.entries(lanes)){
   entries.sort((a,b)=>a.preferredY-b.preferredY);
   // Shift overlapping pill labels apart while keeping each near its node.
   const maxY=state.H-height-pad, minY=pad;
   entries.forEach((entry,i)=>{entry.y=Math.max(minY,Math.min(maxY,entry.preferredY));if(i)entry.y=Math.max(entry.y,entries[i-1].y+height+gap)});
   if(entries.length&&entries.at(-1).y>maxY){let overflow=entries.at(-1).y-maxY;
      for(let i=entries.length-1;i>=0;i--){entries[i].y-=overflow;if(i>0)overflow=Math.max(0,entries[i-1].y+height+gap-entries[i].y)}
      if(entries[0].y<minY){const add=minY-entries[0].y;for(const e of entries)e.y+=add}
   }
   for(const [i,e] of entries.entries()){
     const {t,g,lab,width}=e;
     const out=side==='left'?-1:1;
     // Clamp to SVG bounds, but keep a small connector to the originating dot.
     let x=out<0?t._x-27-width:t._x+27;
     x=Math.max(9,Math.min(state.W-width-9,x));
     const y=e.y;
     const bg=g.querySelector('.chip-bg'),chip=g.querySelector('.tool-chip'),marker=g.querySelector('.chip-type'),tether=g.querySelector('.chip-tether');
     bg.setAttribute('x',x-t._x);bg.setAttribute('y',y-t._y);bg.setAttribute('width',width);bg.setAttribute('height',height);
     marker.setAttribute('cx',x-t._x+12);marker.setAttribute('cy',y-t._y+height/2);
     lab.setAttribute('x',x-t._x+22);lab.setAttribute('y',y-t._y+height/2+5);
     lab.removeAttribute('text-anchor');
     const endX=(out<0?x+width:x)-t._x;
     const endY=y-t._y+height/2;
     tether.setAttribute('d',`M 0 0 Q ${endX*.55} ${endY*.30} ${endX} ${endY}`);
     g.classList.add('revealed-label');g.style.setProperty('--tag-delay',(i*25)+'ms');
   }
 }
}

function drawSearchCandidates(){
 const layer=$('searchCandidates');if(!layer)return;
 layer.replaceChildren();state.searchCoords.clear();
 if(!state.search.trim())return;
 const extras=state.queryResults.hits.filter(h=>!state.nodes.has(h.tool.id)&&(state.view!=='mobile'||h.tool.domain===state.mobileDomain));
 const groups={};for(const h of extras)(groups[h.tool.domain]||=[]).push(h.tool);
 for(const [domain,tools] of Object.entries(groups)){
  if(!domains[domain])continue;const hub=hubXY(domain),rows=Math.ceil(tools.length/2);
  tools.forEach((t,i)=>{
   const side=i%2===0?1:-1,row=Math.floor(i/2),Y=hub.y+(row-(rows-1)/2)*(state.view==='mobile'?50:49);
   const X=hub.x+side*(state.view==='mobile'?94:128);
   const label=truncate(t.title,state.view==='mobile'?17:23),width=Math.max(100,Math.min(state.view==='mobile'?206:224,label.length*(state.view==='mobile'?9.6:8.0)+29));
   let lx=side>0?X+14:X-14-width;lx=Math.max(5,Math.min(state.W-width-5,lx));
   const y=Math.max(28,Math.min(state.H-35,Y));
   state.searchCoords.set(t.id,{x:X,y});
   const href=toolDestination(t);
    const group=elem(href?'a':'g',{
      class:'search-candidate','data-tool-id':t.id,role:href?'link':'button',
      tabindex:'0','aria-label':href?
        `Open ${t.title} in a new tab, ${t.aiType}`:
        `${t.title}, ${t.aiType}, search result`,
      ...(href?externalAttributes(href):{})
    },layer);
   group.style.setProperty('--class-color',classColors[types[t.aiType]||'unverified']);
   elem('path',{d:`M${hub.x},${hub.y} Q${(hub.x+X)/2},${(hub.y+y)/2-14} ${X},${y}`,class:'search-thread'},group);
   elem('circle',{cx:X,cy:y,r:12,class:'search-node-ring'},group);
   elem('circle',{cx:X,cy:y,r:4.3,class:'search-node-core'},group);
   elem('rect',{x:lx,y:y-15,width,height:30,rx:7,class:'search-chip'},group);
   elem('circle',{cx:lx+12,cy:y,r:3.3,class:'search-dot'},group);
   elem('text',{x:lx+22,y:y+5,class:'search-name'},group).textContent=label;
   elem('title',{},group).textContent=t.title+' · '+t.aiType;
   if(href)preserveExternalActivation(group);
   else {
    group.addEventListener('click',e=>{e.stopPropagation();if(!state.moved)selectSearch(t.id)});
    group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectSearch(t.id)}});
   }
  });
 }
}
function searchNow(){
 state.queryResults=window.EnvAISemantic.search(state.searchIndex,state.search,SEARCH_LIMIT);
 if(state.view==='mobile'&&state.queryResults.dominantDomain&&state.queryResults.dominantDomain!==state.mobileDomain){state.mobileDomain=state.queryResults.dominantDomain;rebuildMap()}
 drawSearchCandidates();styleFocus();
}
function styleFocus(){
 const focused=!!state.selected,search=state.search.trim();
 const hits=new Set(state.queryResults.hits.map(h=>h.tool.id));const connected=linkedIds(state.selected);
 const searchDomain=search?state.queryResults.dominantDomain:null;
 const chosenDomain=state.selected?(state.selected.startsWith('hub:')?state.selected.slice(4):(state.groupMap.get(state.selected)||lookupTool(state.selected))?.domain):searchDomain;
 $('app').classList.toggle('has-focus',focused);$('app').classList.toggle('has-search',!!search);$('resetBtn').hidden=!focused&&!search;
 for(const boundary of $('nebula').querySelectorAll('.cluster-boundary')){
  boundary.classList.toggle('in-focus',!!chosenDomain&&boundary.dataset.field===chosenDomain);
  boundary.classList.toggle('out-of-focus',!!chosenDomain&&boundary.dataset.field!==chosenDomain);
 }
 for(const [id,g] of state.nodes){
  const isHub=id.startsWith('hub:');const hubMatch=isHub&&id==='hub:'+searchDomain;
  g.classList.toggle('selected',id===state.selected);
  g.classList.toggle('related',(focused&&connected.has(id)&&id!==state.selected)||(!focused&&!!search&&hubMatch));
  g.classList.toggle('faded',focused&&!connected.has(id));
  g.classList.toggle('search-faded',!!search&&!hits.has(id)&&!hubMatch);
  g.classList.toggle('hit',!!search&&hits.has(id));if(g.tagName.toLowerCase()==='a')g.removeAttribute('aria-pressed');else g.setAttribute('aria-pressed',String(id===state.selected));
 }
 for(const e of state.edges){const on=focused&&!state.selected.startsWith('hub:')&&(e.a===state.selected||e.b===state.selected);e.el.classList.toggle('lit',on);e.el.classList.toggle('faded',focused&&!on)}
 for(const path of $('edges').querySelectorAll('.hubline,.categoryline')){
   const a=path.dataset.a,b=path.dataset.b;
   const selectedTool=state.items.find(x=>x.id===state.selected);
   const selectedParent=selectedTool?._groupParent;
   const parentHub=selectedParent&&'hub:'+selectedTool.domain;
   const on=(focused&&(state.selected===a||state.selected===b||
       (selectedParent&&a===parentHub&&b===selectedParent)))||
      (!focused&&!!search&&a==='hub:'+searchDomain&&hits.has(b));
   path.classList.toggle('lit',on);
   path.classList.toggle('faded',focused&&!on);
  }
 for(const g of $('searchCandidates').querySelectorAll('.search-candidate')){
  const selected='search:'+g.dataset.toolId===state.selected;
  g.classList.toggle('selected',selected);
  g.classList.toggle('dimmed',focused&&!selected);
 }
 if(search){
  $('searchCaption').hidden=false;
  const res=state.queryResults;
  const area=res.dominantDomain?domains[res.dominantDomain].short+' · ':'';
  $('searchCaption').textContent=res.total?`${area}${Math.min(res.total,SEARCH_LIMIT)} of ${res.total} relevant ${res.total===1?'tool':'tools'} · tap a name to open the tool`:
   (res.dominantDomain?`${area}No direct matches indexed yet · try a related term`:'No indexed matches — try an environmental topic or method');
 }else $('searchCaption').hidden=true;
 arrangeFocusLabels();traceSignals();queueKeyPosition();
 if(!focused&&!search){$('hint').innerHTML='<b>↗ CLICK ANY POINT</b> TO REVEAL ITS CONNECTIONS<br>Drag to wander · scroll to zoom · Esc to reset'}
 else{$('hint').innerHTML='<b>CLICK A NAME</b> TO FOLLOW A CONNECTION<br>Click the background to show everything'}
}
function rebuildMap(){
 const mobile=window.innerWidth<=690;
 const model=window.EnvAIClusters.organise(state.catalog,Object.keys(domains),
   state.openGroup,mobile?MAX_GROUP_NODES_MOBILE:MAX_GROUP_NODES_DESKTOP);
 state.items=mobile?model.items.filter(t=>t.domain===state.mobileDomain):model.items;state.groupMap=model.groups;
 // A member can never sit on the overview: all member nodes have a parent.

 if(state.openGroup&&!state.groupMap.has(state.openGroup))state.openGroup=null;
 initEdges();computeLayout();draw();updateMobileTabs();
}
function select(id){
 if(id===state.selected){reset();return}
 if(state.groupMap.has(id)){state.openGroup=id;state.selected=id;rebuildMap()}
 else if(id.startsWith('hub:')||(!state.items.some(t=>t.id===id&&t._groupParent===state.openGroup))){
   if(state.openGroup){state.openGroup=null;rebuildMap()}
   state.selected=id;
 }else state.selected=id;
 state.search='';$('search').value='';state.queryResults={hits:[],total:0,dominantDomain:null};
 drawSearchCandidates();$('tooltip').hidden=true;styleFocus();renderInfo();updateCamera(true);revealMobileDetail()
}
function selectSearch(id){const key='search:'+id;if(key===state.selected){reset();return}const t=lookupTool(id);if(state.view==='mobile'&&t&&t.domain!==state.mobileDomain){state.mobileDomain=t.domain;rebuildMap()}state.selected=key;$('tooltip').hidden=true;styleFocus();renderInfo();updateCamera(true);revealMobileDetail()}
function reset(){state.selected=null;state.search='';$('search').value='';state.queryResults={hits:[],total:0,dominantDomain:null};if(state.openGroup){state.openGroup=null;rebuildMap()}drawSearchCandidates();$('tooltip').hidden=true;state.zoom=1;state.tx=0;state.ty=0;styleFocus();updateCamera(false)}
function newButton(text,onclick,klass){const b=document.createElement('button');b.textContent=text;b.className=klass||'';b.type='button';b.addEventListener('click',onclick);return b}
function showGroupTools(group){
 const modal=$('dialog'),body=$('dialogBody');body.replaceChildren();
 const h=document.createElement('h2');h.textContent=group.title;body.append(h);
 const p=document.createElement('p');p.textContent=group.summary;body.append(p);
 const list=document.createElement('div');list.className='group-browser';
 for(const id of group._members){
  const t=lookupTool(id);if(!t)continue;
  const row=document.createElement('div');row.className='group-browser-row';
  const href=toolDestination(t);
  const name=document.createElement(href?'a':'button');
  name.textContent=t.title+(href?' ↗':'');
  if(href){
   Object.assign(name,{href,target:'_blank',rel:'noopener noreferrer'});
   name.setAttribute('aria-label','Open '+t.title+' website in a new tab');
  }else{
   name.type='button';
   name.setAttribute('aria-label','Inspect '+t.title+' details');
   name.onclick=()=>{modal.close();selectSearch(id)};
  }
  name.className='group-tool-link';
  row.append(name);
  const kind=document.createElement('span');kind.textContent=t.aiType.replace('Traditional digital','Traditional');
  row.append(kind);
  list.append(row);
 }
 body.append(list);modal.showModal()
}
function renderInfo(){
 const root=$('focusContent');root.replaceChildren();const id=state.selected;if(!id)return;
 const isHub=id.startsWith('hub:');const isSearch=id.startsWith('search:');const group=state.groupMap.get(id);const t=isHub?null:(group||lookupTool(id));
 const dom=isHub?id.slice(4):t.domain;
 const related=isHub?state.catalog.filter(x=>x.domain===dom&&!x.id.startsWith('lead:')).length:group?group._members.length:isSearch?state.queryResults.total:(state.links.get(id)||new Set()).size;
 const glyph=document.createElement('div');glyph.className='focus-glyph';glyph.style.setProperty('--glyphColor',domains[dom].color);
 const main=document.createElement('div');main.className='focus-main';const top=document.createElement('div');top.className='focus-top';
 const h=document.createElement('h2');h.className='focus-title';h.textContent=isHub?domains[dom].short:t.title;top.append(h);
 const pill=document.createElement('span');pill.className='focus-pill'+(isHub?'':' class-'+(types[t.aiType]||'unverified'));
 pill.textContent=isHub?'Field':group?(group._pending?'Needs review':'Environmental purpose'):t.aiType.replace('Traditional digital','Digital');top.append(pill);main.append(top);
 const sub=document.createElement('div');sub.className='focus-sub';sub.textContent=isHub?`${related} approved tools in ${domains[dom].short.toLowerCase()} · organised by what they help investigate or accomplish.`:t.summary;main.append(sub);
 const foot=document.createElement('div');foot.className='focus-footer';foot.textContent=isHub?`Only practical tools are shown · source/research records remain archived in the catalogue`:group?`${related} tools · expanded on map · full list available`:isSearch?`Search match · ${t.capability} · ${domains[dom].short} · ${t.toolUse==='install'?'Install locally':t.toolUse==='access'?'Access may be restricted':'Use online'}`:`${dateRecent(t.eventDate)?'✦ NEW RELEASE / UPDATE  ·  ':''}${related} linked ${related===1?'tool':'tools'}  ·  ${t.toolUse==='install'?'Install locally':t.toolUse==='access'?'Access required':'Use online'}${t.accessNote?' · '+t.accessNote:''}`;main.append(foot);
 root.append(glyph,main);
 if(group&&related){const b=newButton('Browse '+related+' tools ↗',()=>showGroupTools(group),'focus-visit focus-group-trigger');b.setAttribute('aria-label','Browse '+related+' '+group.title+' tools');root.append(b)}
 else if(group){const tag=document.createElement('span');tag.className='focus-ghost';tag.textContent='No available tools';root.append(tag)}
 else if(!isHub&&t.url){const a=document.createElement('a');a.className='focus-visit';a.href=t.url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`Visit ${t.title} website`);a.innerHTML=(t.toolUse==='install'?'Get app':t.toolUse==='access'?'Access details':'Open tool')+' <span class="link-icon" aria-hidden="true">↗</span>';root.append(a)}
 else{const tag=document.createElement('span');tag.className='focus-ghost';tag.textContent='Explore the glowing points ↗';root.append(tag)}
}


// The legend is now docked in the bottom status rail, outside the map.
// Kept as a no-op for older focus, zoom and pan call sites.
function queueKeyPosition(){}
function revealMobileDetail(){if(state.view==='mobile'&&state.selected&&document.activeElement!==$('search'))requestAnimationFrame(()=>$('focusInfo').scrollIntoView({behavior:'smooth',block:'nearest'}))}
function updateCamera(focus){
 // Visual-first focus. Keep desktop camera exactly where the explorer left it.
 // Phone only: a small opening zoom makes touch targets legible, then pan only
 // when the selected point would otherwise fall outside the visible area.
 if(!state.selected){state.zoom=1;state.tx=0;state.ty=0}
 else if(focus&&state.view==='mobile'){
   const pt=state.selected.startsWith('hub:')?hubXY(state.selected.slice(4)):state.selected.startsWith('search:')?(state.searchCoords.get(state.selected.slice(7))||hubXY(lookupTool(state.selected)?.domain||'Water & oceans')):(()=>{const t=state.items.find(x=>x.id===state.selected);return{x:t._x,y:t._y}})();
   if(state.zoom<1.04){state.zoom=1.08;state.tx=(state.W*.5-pt.x*state.zoom)*.40;state.ty=(state.H*.49-pt.y*state.zoom)*.40}
   let x=pt.x*state.zoom+state.tx,y=pt.y*state.zoom+state.ty;
   const minX=state.W*.16,maxX=state.W*.83,minY=state.H*.17,maxY=state.H*.82;
   if(x<minX)state.tx+=minX-x;else if(x>maxX)state.tx+=maxX-x;
   if(y<minY)state.ty+=minY-y;else if(y>maxY)state.ty+=maxY-y;
 }
 const g=$('mapVisual');g.setAttribute('transform',`translate(${state.tx.toFixed(2)} ${state.ty.toFixed(2)}) scale(${state.zoom.toFixed(3)})`);queueKeyPosition()
}

function pointInMap(e){const rect=$('graph').getBoundingClientRect(),ratio=Math.min(rect.width/state.W,rect.height/state.H),offX=(rect.width-state.W*ratio)/2,offY=(rect.height-state.H*ratio)/2;return{x:(e.clientX-rect.left-offX)/ratio,y:(e.clientY-rect.top-offY)/ratio}}
function enableControls(){const svg=$('graph'),stage=$('stage');let down=null;
 svg.addEventListener('pointerdown',e=>{if(state.view==='mobile'&&e.pointerType==='touch')return;if(e.button!==0&&e.pointerType!=='touch')return;down={x:e.clientX,y:e.clientY,tx:state.tx,ty:state.ty};state.moved=false;state.dragging=false;});
 svg.addEventListener('pointermove',e=>{if(state.view==='mobile'&&e.pointerType==='touch')return;if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;if(!state.dragging&&Math.hypot(dx,dy)<5)return;state.dragging=true;state.moved=true;svg.setPointerCapture(e.pointerId);stage.classList.add('dragging');$('mapVisual').classList.add('dragging');const r=svg.getBoundingClientRect(),ratio=Math.min(r.width/state.W,r.height/state.H);state.tx=down.tx+dx/ratio;state.ty=down.ty+dy/ratio;updateCamera(false)});
 const stop=()=>{down=null;stage.classList.remove('dragging');$('mapVisual').classList.remove('dragging');state.dragging=false;setTimeout(()=>state.moved=false,0)};svg.addEventListener('pointerup',stop);svg.addEventListener('pointercancel',stop);
 svg.addEventListener('click',e=>{if(!state.moved&&!e.target.closest('.node')&&!e.target.closest('.search-candidate'))reset()});
 svg.addEventListener('wheel',e=>{e.preventDefault();const pt=pointInMap(e),scale=Math.exp(-e.deltaY*.0012),newZ=Math.min(2.9,Math.max(.72,state.zoom*scale));const localX=(pt.x-state.tx)/state.zoom,localY=(pt.y-state.ty)/state.zoom;state.tx=pt.x-localX*newZ;state.ty=pt.y-localY*newZ;state.zoom=newZ;$('mapVisual').classList.add('dragging');updateCamera(false);clearTimeout(uiTimer);uiTimer=setTimeout(()=>$('mapVisual').classList.remove('dragging'),150)},{passive:false});svg.addEventListener('dblclick',e=>{e.preventDefault();reset()});
 $('closeFocus').onclick=reset;$('resetBtn').onclick=reset;$('homeBrand').onclick=e=>{e.preventDefault();reset()};
 let searchDelay=0;
 $('search').addEventListener('input',e=>{state.search=e.target.value;if(state.selected){state.selected=null;renderInfo();state.zoom=1;state.tx=0;state.ty=0;updateCamera(false)}clearTimeout(searchDelay);searchDelay=setTimeout(searchNow,100)});
 $('search').addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(searchDelay);searchNow();const first=state.queryResults.hits[0]?.tool;if(first){if(state.nodes.has(first.id))select(first.id);else selectSearch(first.id);$('search').blur();e.preventDefault()}}if(e.key==='Escape'){reset();$('search').blur()}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){reset();$('menu').hidden=true;$('menuBtn').setAttribute('aria-expanded','false');if($('dialog').open)$('dialog').close()}if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('search').focus()}});
 window.addEventListener('resize',()=>{const want=window.innerWidth<=690?'mobile':'desktop';if(want!==state.view){if(state.selected&&!state.selected.startsWith('hub:')&&!state.selected.startsWith('group:'))state.mobileDomain=lookupTool(state.selected)?.domain||state.mobileDomain;rebuildMap();updateCamera(!!state.selected)}});
}
function toast(str){const el=$('toast');el.textContent=str;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),2700)}
function setModal(type){const body=$('dialogBody');body.replaceChildren();const h=document.createElement('h2');const p=document.createElement('p');if(type==='method'){h.textContent='AI isn’t a marketing label.';p.textContent='EnvAI describes the role of AI in a tool’s actual environmental workflow. Traditional digital tools work without AI; AI-augmented tools add AI to a broader workflow; AI-native tools depend on AI for their central purpose. “Unverified” means we need better evidence.';body.append(h,p);let t=document.createElement('p');t.textContent='Links between tools indicate shared environmental data, tasks and technical methods. They do not imply investments, interoperability, ownership or partnerships. All classifications are preliminary editorial assessments.';body.append(t)}else if(type==='cite'){h.textContent='Cite EnvAI';p.textContent='Salmon of Doubt (2026). EnvAI: Environmental Technology & AI Landscape [Interactive software demo].';body.append(h,p);const doi=window.SOD_ATLAS_CONFIG?.doi;if(doi){let a=document.createElement('a');a.href='https://doi.org/'+doi;a.textContent=doi;a.target='_blank';a.rel='noopener';body.append(a)}else{const t=document.createElement('p');t.textContent='DOI pending. This is a new demo; no DOI from another project is used.';body.append(t)}}else{h.textContent='Install EnvAI';p.textContent='Once published via HTTPS, choose “Install app” in a compatible browser. On iPhone or iPad in Safari, use Share → Add to Home Screen. Local file previews cannot install a PWA.';body.append(h,p)}$('dialog').showModal()}
function misc(){const menu=$('menu'),btn=$('menuBtn');btn.onclick=()=>{menu.hidden=!menu.hidden;btn.setAttribute('aria-expanded',String(!menu.hidden))};document.addEventListener('click',e=>{if(!e.target.closest('.topbar')){menu.hidden=true;btn.setAttribute('aria-expanded','false')}});
 $('methodBtn').onclick=()=>{menu.hidden=true;btn.setAttribute('aria-expanded','false')};$('citeBtn').onclick=()=>{menu.hidden=true;setModal('cite')};$('dialogClose').onclick=()=>$('dialog').close();$('installBtn').onclick=()=>{menu.hidden=true;if(autoPrompt){autoPrompt.prompt();autoPrompt=null}else setModal('install')};window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();autoPrompt=e});
 if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{}))}
function updateMobileTabs(){
 const nav=$('mobileFields');if(!nav)return;
 for(const button of nav.querySelectorAll('[data-field]')){
  const domain=button.dataset.field;
  const count=state.catalog.filter(t=>t.domain===domain&&!t.id.startsWith('lead:')&&t.mapVisible!==false).length;
  button.querySelector('.field-count').textContent=String(count);
  const on=domain===state.mobileDomain;
  button.setAttribute('aria-pressed',String(on));
  button.classList.toggle('active',on);
 }
}
function showMobileField(domain){
 if(!domains[domain]||state.view!=='mobile'||domain===state.mobileDomain)return;
 state.mobileDomain=domain;state.openGroup=null;state.selected=null;state.search='';
 $('search').value='';state.queryResults={hits:[],total:0,dominantDomain:null};
 state.zoom=1;state.tx=0;state.ty=0;
 rebuildMap();drawSearchCandidates();styleFocus();renderInfo();updateCamera(false);
}
function setup(list){
 state.catalog=list.filter(t=>t&&t.id&&t.domain&&domains[t.domain]&&t.title&&publicTool(t)).map(t=>({...t,aiType:t.aiType||'Unverified'}));
 state.searchIndex=window.EnvAISemantic.prepare(state.catalog);
 state.openGroup=null;rebuildMap();
 const approved=state.catalog.filter(t=>!t.id.startsWith('lead:')).length;
 $('totalNum').textContent=String(approved);
 $('stats').querySelector('small').textContent=`${approved} practical tools · ${state.items.filter(t=>t._group).length} topic nodes · select a topic to explore`;
 if(state.view!=='mobile')toast('Explore environmental topics, or search any tool.')
}
function loadFocusFromUrl(){
 const id=new URLSearchParams(location.search).get('tool');
 if(id&&state.catalog.some(x=>x.id===id))requestAnimationFrame(()=>{if(state.nodes.has(id))select(id);else{$('search').value=lookupTool(id).title;state.search=lookupTool(id).title;searchNow();selectSearch(id)}});
}
function loadError(){
 $('totalNum').textContent='—';
 $('newCount').textContent='—';
 $('hint').textContent='Catalogue unavailable. Please check your connection or reload the page.';
 $('stats').querySelector('small').textContent='No data loaded';
}
$('mapVisual').addEventListener('transitionend',e=>{if(e.target===$('mapVisual')&&e.propertyName==='transform')queueKeyPosition()});
enableControls();misc();$('mobileFields')?.addEventListener('click',e=>{const button=e.target.closest('[data-field]');if(button)showMobileField(button.dataset.field)});
const embedded=$('fallbackCatalog');
if(embedded){
 try{const fallback=JSON.parse(embedded.textContent);setup(fallback.items||[]);loadFocusFromUrl()}
 catch(e){console.error('EnvAI preview data error',e);loadError()}
}else{
 Promise.all([fetch('./data/tools.json',{cache:'no-store'}),window.EnvAILive?.load()||Promise.resolve(null)])
  .then(async ([r,live])=>{if(!r.ok)throw new Error('HTTP '+r.status);
    const data=await r.json();if(!data||!Array.isArray(data.items))throw new Error('Missing catalogue items');
    const merged=window.EnvAILive?.mergeCatalog(data.items,live)||data.items;
    setup(merged);loadFocusFromUrl();
    if(live&&live.scanStatus!=='not-started'&&live.scanStatus!=='unavailable'){
      const indicator=$('stats').querySelector('small');
      if(indicator){const date=live.lastSuccessAt||'never';indicator.textContent+=` · auto scan ${date}`;}
    }
  })
  .catch(e=>{console.error('EnvAI catalogue error',e);loadError()});
}
})();
