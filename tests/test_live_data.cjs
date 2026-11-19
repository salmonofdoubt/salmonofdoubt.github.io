/* No external deps: exercise browser-facing merge without a network or DOM. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../demos/envai/live-data.js'),'utf8');
const env={window:{},location:{hostname:'localhost'}, URL, AbortController, Date, setTimeout,clearTimeout,console};
vm.createContext(env);vm.runInContext(source,env);
const merge=env.window.EnvAILive.mergeCatalog;
const curated=[
 {id:'deepforest',title:'DeepForest',domain:'Land & satellites',eventDate:'2026-01-05',mapVisible:true,url:'https://github.com/weecology/DeepForest'},
 {id:'hydrosheds',title:'HydroSHEDS',domain:'Water & oceans',eventDate:null,url:'https://www.hydrosheds.org/'}
];
const overlay={releaseEvents:[{toolId:'deepforest',eventDate:'2026-11-19',eventType:'Official GitHub release',
 tag:'v1.2.3',evidence:'https://github.com/weecology/DeepForest/releases/tag/v1.2.3'}],leads:[
 {id:'candidate:example/whale',title:'Whale Monitor',domain:'Water & oceans',
  url:'https://github.com/example/whale',note:'Unverified whale monitor',tags:['whale']},
 {id:'candidate:example/duplicate',title:'duplicate',domain:'Water & oceans',
  url:'https://www.hydrosheds.org/'}]};
const out=merge(curated,overlay);
assert.equal(out.length,3,'duplicate curated link must be suppressed');
assert.equal(curated[0].eventDate,'2026-01-05','curated source must be unchanged');
assert.equal(out[0].eventDate,'2026-11-19','official release should refresh existing tool');
assert.equal(out[0].eventType,'Official GitHub release · v1.2.3');
assert.equal(out[2].aiType,'Unverified');
assert.equal(out[2].mapVisible,false,'new lead must never fill default constellation');
assert.match(out[2].summary,/UNVERIFIED/);
console.log('PASS: existing release refreshed; unverified search-only candidate; map stays capped');
