'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../demos/envai/cluster-model.js');
const catalogue=JSON.parse(fs.readFileSync(
 path.join(__dirname,'../demos/envai/data/tools.json'),'utf8')).items;
const fields=['Biodiversity & wildlife','Land & satellites','Climate & energy','Water & oceans'];
const usable=catalogue.filter(x=>['online','access','install'].includes(x.toolUse));
const approved=usable.filter(x=>x.mapVisible!==false&&model.TYPES.includes(x.aiType));
const overview=model.organise(usable,fields);

assert.equal(new Set(usable.map(x=>x.id)).size,usable.length,'unique tool IDs');
assert.equal(new Set(usable.map(x=>x.url.toLowerCase().replace(/\/$/,''))).size,usable.length,
 'unique tool websites');
assert.deepEqual(Object.keys(overview.counts),fields,'exactly four fields');
assert.ok(overview.items.every(x=>x._group),
 'overview must contain only category groups, never featured individual tools');
assert.ok(overview.items.every(x=>!x._groupParent),'no expanded members on overview');

for(const domain of fields){
 const expected=approved.filter(x=>x.domain===domain);
 const groups=overview.items.filter(x=>x.domain===domain);
 assert.ok(expected.length>=12,'public catalogue coverage: '+domain);
 assert.equal(groups.filter(x=>!x._pending).length,3,
  'every field exposes the same three AI classifications: '+domain);
 assert.ok(groups.length<=4,'at most three AI categories plus review node: '+domain);
 const ids=groups.filter(x=>!x._pending).flatMap(g=>g._members);
 assert.equal(ids.length,expected.length,'every approved tool is accounted for: '+domain);
 assert.deepEqual(ids.slice().sort(),expected.map(t=>t.id).sort(),
  'no duplicated, featured or missing tool: '+domain);
 for(const g of groups.filter(x=>!x._pending)){
  const belonging=expected.filter(t=>t.aiType===g.aiType);
  assert.deepEqual(g._members,belonging.map(t=>t.id),
   'AI type membership is exhaustive and follows source catalogue: '+g.title);
  assert.ok(g.title.endsWith(' · '+belonging.length),'category displays total count');
 }
}
const climate=overview.items.filter(x=>x.domain==='Climate & energy');
const augmented=climate.find(x=>x.aiType==='AI-augmented');
const trace=approved.find(x=>x.title==='Climate TRACE');
assert.ok(trace,'Climate TRACE remains indexed');
assert.ok(augmented._members.includes(trace.id),
 'Climate TRACE is inside AI-augmented group, not a featured sibling');
assert.ok(!overview.items.some(x=>x.id===trace.id),
 'Climate TRACE is never a top-level item');

const expanded=model.organise(usable,fields,augmented.id,8);
const shown=expanded.items.filter(x=>x._groupParent===augmented.id);
assert.ok(shown.some(x=>x.id===trace.id),'select category to reveal Climate TRACE');
assert.equal(shown.length,augmented._members.length,'entire small category can expand');
assert.ok(shown.every(x=>x.aiType===augmented.aiType),
 'expanded tools cannot cross AI classifications');
assert.deepEqual(expanded.groups.get(augmented.id)._members,augmented._members,
 'full list stays intact');

const many=Array.from({length:25},(_,i)=>({
 id:'synthetic-native-'+i,title:'Native '+i,domain:'Climate & energy',
 aiType:'AI-native',mapVisible:true,toolUse:'online',
 url:'https://example.org/native-'+i
}));
const big=model.organise(usable.concat(many),fields);
const bigNative=big.items.find(x=>x.domain==='Climate & energy'&&x.aiType==='AI-native');
assert.equal(bigNative._members.length,augmented._members.length+many.length-1,
 'group counts adjust to growing inventories');
const bigExpanded=model.organise(usable.concat(many),fields,bigNative.id,4);
assert.equal(bigExpanded.items.filter(x=>x._groupParent===bigNative.id).length,4,
 'mobile fan-out is capped, full list retained');
assert.equal(bigExpanded.groups.get(bigNative.id)._members.length,bigNative._members.length);

const small=[{id:'unique-augmented',title:'Only one',domain:fields[0],
 aiType:'AI-augmented',mapVisible:true,toolUse:'online',url:'https://example.org/one'}];
const one=model.organise(small,fields);
assert.equal(one.items.length,1,'single-tool AI category is still a category node');
assert.equal(one.items[0]._members[0],'unique-augmented');
assert.equal(one.items[0]._group,true);

const leads=Array.from({length:42},(_,i)=>({
 id:'lead:candidate-'+i,title:'Review tool '+i,
 domain:fields[i%4],aiType:'Unverified',mapVisible:false,toolUse:'online',
 url:'https://example.org/lead-'+i
}));
const withLeads=model.organise(usable.concat(leads),fields);
assert.equal(withLeads.items.filter(x=>x._pending).length,4,
 'one separate review node per field');
assert.ok(withLeads.items.filter(x=>x._pending).every(x=>x.aiType==='Unverified'),
 'never invent AI classifications');
assert.equal(withLeads.items.filter(x=>!x._pending).length,12,
 'pending discoveries do not affect the twelve approved AI-category nodes');
console.log('PASS: 4 environmental hubs, 3 AI groups each, every tool nested once; Climate TRACE included; expansion, growth, mobile and review tests');
