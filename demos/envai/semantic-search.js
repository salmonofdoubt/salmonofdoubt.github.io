/* EnvAI concept-aware local discovery. Deliberately transparent: a small,
 * editable environmental vocabulary + evidence-bearing catalogue metadata,
 * not a claimed LLM or semantic embedding service. Never infers AI class. */
(function(root){'use strict';
const FAMILIES=[
 ['cetaceans','Water & oceans','whale|whales|cetacean|orca|orcas|killer whale|humpback|blue whale|right whale|dolphin|porpoise|marine mammal','whale|orca|cetacean|marine mammal|hydrophone|acoustic detection|bioacoustic|photo identification|photo id|animal tracking'],
 ['marine-ecology','Water & oceans','ocean|marine ecosystem|sea|marine biology|coastal habitat|sea life|kelp|seagrass|saltmarsh','ocean|marine|coastal|habitat|fishery|seagrass|kelp|marine ecosystem'],
 ['coral','Water & oceans','coral|reef|reef bleaching|coral bleaching','coral|reef|bleaching|marine habitat|satellite imagery'],
 ['fisheries','Water & oceans','fishing|fisheries|bycatch|trawling|illegal fishing|vessel tracking|salmon|salmonids|fish migration','fishing|fisheries|bycatch|vessel|ais|ship|ocean monitoring'],
 ['water-quality','Water & oceans','water quality|water pollution|microplastic|microplastics|eutrophication|algal bloom|algae','water quality|water chemistry|pollution|ocean monitoring|algae|algal bloom'],
 ['rivers','Water & oceans','river|stream|catchment|watershed|freshwater|lake','river|freshwater|watershed|water quality|hydrology|flood'],
 ['floods','Climate & energy','flood|flooding|flood risk|storm surge','flood|inundation|disaster|hazard|weather|hydrology'],
 ['drought','Climate & energy','drought|water scarcity|aridity','drought|hydrology|climate risk|weather|soil moisture'],
 ['wildfire','Land & satellites','wildfire|bushfire|forest fire|fire detection|fire risk','wildfire|fire|forest|heat anomaly|satellite imagery'],
 ['forests','Land & satellites','forest|tree cover|trees|deforestation|logging|canopy','forest|trees|land cover|deforestation|canopy|remote sensing'],
 ['land-cover','Land & satellites','land cover|land use|vegetation|habitat mapping|earth observation','land cover|land use|habitat|satellite imagery|geospatial data|earth observation'],
 ['soil','Land & satellites','soil|erosion|topsoil|land degradation','soil|erosion|land cover|land restoration|agriculture'],
 ['agriculture','Land & satellites','agriculture|farming|farmland|crops|crop yield|precision agriculture','agriculture|crop|land use|satellite imagery|soil'],
 ['biodiversity','Biodiversity & wildlife','biodiversity|ecosystem|species richness|nature conservation|habitat conservation','biodiversity|species|habitat|conservation|ecological monitoring'],
 ['birds','Biodiversity & wildlife','bird|birds|avian|ornithology|birdsong|bird calls|bird migration','bird|avian|birdsong|bird calls|ornithology|migration'],
 ['insects','Biodiversity & wildlife','insect|pollinator|bee|bees|butterfly|moth','insect|pollinator|bee|biodiversity|species identification|image recognition'],
 ['mammals','Biodiversity & wildlife','wildlife|terrestrial mammals|camera trap|animal monitoring','wildlife|camera trap|species identification|biodiversity|animal tracking'],
 ['bioacoustics','Biodiversity & wildlife','bioacoustics|acoustic ecology|passive acoustic|sound monitoring|animal sounds|hydrophone','bioacoustic|acoustic|audio|sound|species identification|hydrophone'],
 ['conservation','Biodiversity & wildlife','conservation|restoration|protected area|ecosystem restoration|nature recovery','conservation|restoration|habitat|biodiversity|ecosystem'],
 ['climate','Climate & energy','climate|global warming|climate change|climate adaptation|climate risk','climate|temperature|weather|emissions|climate risk|adaptation'],
 ['carbon','Climate & energy','carbon|co2|greenhouse gas|methane|emissions|carbon footprint','emissions|carbon|methane|greenhouse gas|co2'],
 ['renewables','Climate & energy','solar|wind turbine|wind energy|renewable energy|photovoltaic|clean energy','solar|wind|electricity|renewable|energy'],
 ['weather','Climate & energy','weather|meteorology|forecast|storms|heatwave|temperature','weather|forecast|temperature|climate|storm|meteorology'],
 ['air-quality','Climate & energy','air pollution|air quality|pm2.5|particulate|smoke','air quality|pollution|emissions|particulate|weather'],
 ['geospatial','Land & satellites','gis|geospatial|remote sensing|satellite|earth observation|mapping','gis|geospatial|satellite imagery|mapping|remote sensing'],
 ['species-id','Biodiversity & wildlife','species identification|recognise species|identify wildlife|animal recognition|computer vision','species identification|wildlife|computer vision|image recognition|bioacoustic']
];
const normal=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
function word(s){return s.length>4&&s.endsWith('ies')?s.slice(0,-3)+'y':s.length>4&&s.endsWith('s')&&!s.endsWith('ss')?s.slice(0,-1):s;}
const STOP=new Set('about above after again against almost also among and another are around because been before being below between both but can could data does doing during each even every from further had has have having into its just made might more most much need once only other over same should since some such than that their them then there these they this those through under until very were what when where which while will with would your'.split(' '));
const tokenize=s=>normal(s).split(' ').filter(x=>x.length>2&&!STOP.has(x)).map(word);
const stemPhrase=s=>normal(s).split(' ').map(word).join(' ');
const has=(hay,needle)=>(' '+hay+' ').includes(' '+needle+' ');
const concepts=FAMILIES.map(([id,domain,aliases,related])=>({id,domain,aliases:aliases.split('|').map(stemPhrase),related:related.split('|').map(stemPhrase)}));
function prepare(items){return(items||[]).map(tool=>{
 const tags=[...(tool.tags||[]),...(tool.topics||[])];
 const arr=fields=>fields.map(normal).join(' ');
 return {tool,title:normal(tool.title),tags:arr(tags),summary:normal(tool.summary),domain:normal(tool.domain),capability:normal(tool.capability),signals:arr(tool.signals||[]),organisation:normal(tool.organisation),ai:normal(tool.aiType),terms:new Set(tokenize([tool.title,...tags,tool.summary].join(' ')))};
});}
function search(index,raw,limit=6){
 const query=normal(raw),stemmed=stemPhrase(raw),tokens=tokenize(query);if(!query||!tokens.length)return {hits:[],total:0,dominantDomain:null,concepts:[]};
 const families=concepts.filter(c=>c.aliases.some(alias=>has(stemmed,alias)));
 const conceptsFound=families.map(f=>f.id);
 const domainVotes=new Map();for(const f of families)domainVotes.set(f.domain,(domainVotes.get(f.domain)||0)+70);
 const found=[];
 for(const d of index){let score=0,why='';
  const direct=(txt,weight)=>{if(has(txt,query)){if(weight>score){score=weight;why='direct match'}return true}return false};
  direct(d.title,110);direct(d.tags,83);direct(d.signals,65);direct(d.capability,45);direct(d.summary,50);direct(d.organisation,35);direct(d.domain,22);direct(d.ai,22);
  for(const tok of tokens){
   const own=word(tok);if(d.terms.has(own))score=Math.max(score,32);
   else if(d.title.split(' ').some(x=>word(x)===own))score=Math.max(score,76);
  }
  for(const f of families){
   if((d.tool.topics||[]).map(normal).includes(f.id)){score+=58;why=why||'related environmental topic'}
   for(const term of f.related){
    if(has(stemPhrase(d.title),term)){score+=33;why=why||'related term';break}
    if(has(stemPhrase(d.tags),term)){score+=23;why=why||'related tag';break}
    if(has(stemPhrase(d.signals),term)){score+=11;why=why||'related method';break}
   }
   // Domain matches are used for map orientation, NOT evidence that every
   // tool in a field is a whale (or otherwise specific) tool.
  }
  if(score>=24){found.push({tool:d.tool,score,why:why||'matching content'});domainVotes.set(d.tool.domain,(domainVotes.get(d.tool.domain)||0)+Math.min(85,score));}
 }
 found.sort((a,b)=>b.score-a.score||a.tool.title.localeCompare(b.tool.title));
 const dominantDomain=[...domainVotes].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
 return {hits:found.slice(0,Math.max(1,Math.min(8,limit))),total:found.length,dominantDomain,concepts:conceptsFound};
}
root.EnvAISemantic={prepare,search,concepts,normal};
})(typeof window==='undefined'?globalThis:window);
