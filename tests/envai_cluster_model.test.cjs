'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const model=require('../demos/envai/cluster-model.js');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../demos/envai/data/tools.json'),'utf8')).items;
const fields=['Biodiversity & wildlife','Land & satellites','Climate & energy','Water & oceans'];
const usable=catalog.filter(x=>['online','access','install'].includes(x.toolUse));
const approved=usable.filter(x=>x.mapVisible!==false&&model.TYPES.includes(x.aiType));
const overview=model.organise(usable,fields);
const expectedTopicCounts={
 'Biodiversity & wildlife':4,'Land & satellites':3,'Climate & energy':4,'Water & oceans':5};
assert.equal(new Set(usable.map(x=>x.id)).size,usable.length,'distinct tool IDs');
assert.equal(new Set(usable.map(x=>x.url.toLowerCase().replace(/\/$/,''))).size,usable.length,'distinct tool URLs');
assert.equal(model.PURPOSES.length,16,'16 meaningful purpose topics, no artificial AI categories');
assert.deepEqual(Object.keys(overview.counts),fields);
assert.equal(overview.items.length,16,'only sixteen purpose nodes at the approved overview');
assert.ok(overview.items.every(x=>x._group&&x._purpose),'no featured tools in overview');
assert.ok(overview.items.every(x=>!x._groupParent),'no tools shown before opening a purpose');
assert.equal(new Set(model.PURPOSES.map(p=>p.domain+'|'+p.id)).size,16,'purpose identifiers unique');

for(const domain of fields){
 const matching=approved.filter(t=>t.domain===domain);
 const groups=overview.items.filter(t=>t.domain===domain);
 assert.equal(groups.length,expectedTopicCounts[domain],'purpose groups for '+domain);
 assert.equal(overview.counts[domain].unassigned,0,'no ungrouped public tools: '+domain);
 assert.ok(matching.length>=12,'catalogue has substantive coverage: '+domain);
 const members=groups.flatMap(g=>g._members);
 assert.equal(members.length,matching.length,'every tool belongs to exactly one topic: '+domain);
 assert.deepEqual(members.slice().sort(),matching.map(t=>t.id).sort(),
  'no orphan, duplicate or featured tool: '+domain);
 for(const group of groups){
  const classified=matching.filter(t=>t.purpose===group.purpose);
  assert.deepEqual(group._members,classified.map(t=>t.id),'every member shares topic '+group.label);
  assert.ok(group.label.length>3,'human-readable topic');
  assert.ok(group.short.length<22,'short touch-friendly topic label');
  assert.ok(group.title.endsWith(' · '+classified.length),'accurate count');
 }
}
const id=(d,p)=>overview.items.find(x=>x.domain===d&&x.purpose===p);
const emissions=id('Climate & energy','emissions-energy');
const air=id('Climate & energy','air-quality');
const birds=id('Biodiversity & wildlife','birds-migration');
const marine=id('Water & oceans','marine-species');
const fishing=id('Water & oceans','fishing-vessels');
assert.ok(emissions._members.includes('trace'),'Climate TRACE is an emissions tool');
assert.ok(emissions._members.includes('carbon-mapper'),'Carbon Mapper is grouped by mission, not AI');
assert.ok(air._members.includes('openaq'),'OpenAQ is an air-quality tool');
assert.ok(air._members.includes('ecmwf-aifs-compo'),'AI forecast can share purpose with traditional air-quality portal');
assert.ok(birds._members.includes('birdnetlive')&&birds._members.includes('ebird-explore'),
 'BirdNET and eBird share Birds despite differing AI techniques');
assert.ok(marine._members.includes('fathomnet'),'Fish image classification belongs with marine life');
assert.ok(fishing._members.includes('gfw'),'Fishing-vessel tracking is not fish observation');
assert.ok(!marine._members.includes('gfw'),'avoid confusing fish with fishing');
assert.ok(!overview.items.some(x=>x.id==='trace'),'no featured Climate TRACE shortcut');

const expanded=model.organise(usable,fields,emissions.id,6);
const shown=expanded.items.filter(x=>x._groupParent===emissions.id);
assert.equal(shown.length,emissions._members.length,'small group can reveal all members');
assert.ok(shown.some(x=>x.id==='trace'));
assert.ok(new Set(shown.map(x=>x.aiType)).size>=2,
 'grouping by purpose can legitimately mix Traditional and AI-augmented tools');
assert.ok(shown.every(x=>x.purpose==='emissions-energy'));
assert.equal(expanded.groups.get(emissions.id)._members.length,emissions._members.length);

const many=Array.from({length:25},(_,i)=>({
 id:'new-emissions-'+i,title:'Synthetic emission monitor '+i,
 domain:'Climate & energy',purpose:'emissions-energy',aiType:'AI-native',
 mapVisible:true,toolUse:'online',url:'https://example.org/new-'+i
}));
const big=model.organise(usable.concat(many),fields);
assert.equal(big.items.filter(x=>x._purpose).length,16,'growth does not clutter the overview');
const larger=big.groups.get(emissions.id);
assert.equal(larger._members.length,emissions._members.length+25,'all additions indexed');
const bigExpanded=model.organise(usable.concat(many),fields,emissions.id,3);
assert.equal(bigExpanded.items.filter(x=>x._groupParent===emissions.id).length,3,
 'mobile keeps a limited visible fan-out');
assert.equal(bigExpanded.groups.get(emissions.id)._members.length,larger._members.length,
 'modal and search keep the complete group');

const unknown={id:'future-approved',title:'New environmental service',
 domain:'Climate & energy',aiType:'AI-augmented',toolUse:'online',url:'https://example.org/future'};
const unknownModel=model.organise(usable.concat([unknown]),fields);
assert.equal(unknownModel.counts['Climate & energy'].unassigned,1,'uncurated topic is surfaced');
assert.ok(unknownModel.items.some(x=>x._pending&&x._members.includes(unknown.id)));
const leads=Array.from({length:42},(_,i)=>({
 id:'lead:candidate-'+i,title:'Review tool '+i,
 domain:fields[i%4],aiType:'Unverified',mapVisible:false,toolUse:'online',
 url:'https://example.org/lead-'+i
}));
const withLeads=model.organise(usable.concat(leads),fields);
assert.equal(withLeads.items.filter(x=>x._pending).length,4,'one candidate node per field');
assert.equal(withLeads.items.filter(x=>x._purpose).length,16,'unverified leads do not alter approved topics');
console.log('PASS: all four environmental fields, 16 coherent topics, every tool grouped exactly once, mixed AI classes, bounded expansion and review');
