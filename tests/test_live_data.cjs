/* Public view shows useful website candidates, never bare GitHub repositories. */
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
 {id:'candidate:example/repository-only',title:'Repo only',domain:'Water & oceans',
  url:'https://github.com/example/repository-only',note:'Not a usable website'},
 {id:'candidate:example/whale',title:'Whale tool',domain:'Water & oceans',
  url:'https://whales.example.org/app',evidence:'https://github.com/example/whale',
  accessType:'web',siteReachable:true,note:'Live website confirmed, actual function unverified'},
 {id:'candidate:example/broken',title:'Broken tool',domain:'Water & oceans',
  url:'https://broken.example.org',accessType:'web',siteReachable:false},
 {id:'candidate:example/duplicate',title:'duplicate',domain:'Water & oceans',
  url:'https://www.hydrosheds.org/',accessType:'web',siteReachable:true}]};
const out=merge(curated,overlay);
assert.equal(out.length,3,'only useful new website candidate should be searchable');
assert.equal(curated[0].eventDate,'2026-01-05','curated input must be unchanged');
assert.equal(out[0].eventDate,'2026-11-19');
assert.equal(out[0].eventType,'Official GitHub release · v1.2.3');
assert.equal(out[2].url,'https://whales.example.org/app');
assert.equal(out[2].aiType,'Unverified');
assert.equal(out[2].mapVisible,false,'candidate never fills default constellation');
assert.match(out[2].summary,/UNVERIFIED TOOL CANDIDATE/);
console.log('PASS: repo-only leads hidden; website candidates searchable; map stays capped');
