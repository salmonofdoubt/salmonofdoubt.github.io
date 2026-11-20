'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../demos/envai/cluster-model.js');
const catalogue=JSON.parse(fs.readFileSync(path.join(__dirname,'../demos/envai/data/tools.json'),'utf8')).items;
const fields=['Biodiversity & wildlife','Land & satellites','Climate & energy','Water & oceans'];
const usable=catalogue.filter(x=>['online','access','install'].includes(x.toolUse));
const approved=usable.filter(x=>x.mapVisible!==false);
const grouped=model.organise(usable,fields);
assert.equal(new Set(usable.map(x=>x.id)).size,usable.length,'unique ID');
assert.equal(new Set(usable.map(x=>x.url.toLowerCase().replace(/\/$/,''))).size,usable.length,'unique tool URLs');
assert.equal(fields.length,Object.keys(grouped.counts).length);
assert.ok(grouped.items.length<approved.length,'group dense catalogue instead of cluttering');
assert.ok(grouped.items.every(x=>x._group||usable.some(y=>y.id===x.id)));
assert.ok([...grouped.groups.values()].every(x=>x._members.length>=1));
assert.deepEqual(new Set(grouped.items.filter(x=>x._group&&!x._pending).map(x=>x.aiType)),
  new Set(['Traditional digital','AI-augmented','AI-native']));
for(const domain of fields){
 const tools=usable.filter(x=>x.domain===domain&&x.mapVisible!==false);
 assert.ok(tools.length>=12,'at least 12 usable in '+domain);
 const shown=grouped.items.filter(x=>x.domain===domain);
 assert.ok(shown.length<=9,'clean overview in '+domain);
 const groupedMembers=[...grouped.groups.values()].filter(x=>x.domain===domain).flatMap(x=>x._members);
 const featured=shown.filter(x=>!x._group).map(x=>x.id);
 assert.deepEqual([...new Set([...featured,...groupedMembers])].sort(),tools.map(x=>x.id).sort(),
  'all entries discoverable, no hidden records in '+domain);
}
const aGroup=[...grouped.groups.values()].find(x=>x._members.length>=3);
const expanded=model.organise(usable,fields,aGroup.id);
assert.ok(expanded.items.some(x=>x._groupParent===aGroup.id),'expands members');
assert.ok(expanded.items.filter(x=>x._groupParent===aGroup.id).length<=8,'mobile limit');
assert.equal(expanded.groups.get(aGroup.id)._members.length,aGroup._members.length,'full list retained');
const newLeads=Array.from({length:42},(_,i)=>({id:'lead:candidate-'+i,title:'Review tool '+i,
  domain:fields[i%4],aiType:'Unverified',mapVisible:false,toolUse:'online',
  url:'https://example.org/app-'+i}));
const withLeads=model.organise(usable.concat(newLeads),fields);
assert.equal([...withLeads.groups.values()].filter(x=>x._pending).length,4,'candidate groups per field');
assert.ok(withLeads.items.filter(x=>x._pending).every(x=>x.aiType==='Unverified'),'never invent AI class');
const pending=withLeads.items.find(x=>x._pending);
const pendingExpanded=model.organise(usable.concat(newLeads),fields,pending.id);
assert.ok(pendingExpanded.items.filter(x=>x._groupParent===pending.id).length<=8,'pending group remains compact');
console.log('PASS: four clusters, AI categories, clean overview, complete membership, searchable review nodes');
