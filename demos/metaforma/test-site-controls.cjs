#!/usr/bin/env node
/* MetaForma: protect six-block classification, install shell and shared controls. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=__dirname;
const root=path.join(dir,'..','..');
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const html=read('index.html');
const js=read('pwa.js');
const sw=read('service-worker.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
const demos=JSON.parse(fs.readFileSync(path.join(root,'demos','data','demos.json'),'utf8'));
const groups=[
 [1,4,'Foundation & Warm-Up'],
 [5,9,'Rolling & Core Series'],
 [10,14,'Rotations & Inversions'],
 [15,20,'Torso & Leg Integration'],
 [21,26,'Lateral & Peak Balance'],
 [27,34,'Dynamic Flow & Culmination']
];
for(const [start,end,name] of groups) {
 assert.ok(html.includes('data-chapter="'+start+'"'),'Missing section '+start);
 assert.ok(html.includes('data-filter="'+start+'"'),'Missing filter '+start);
 assert.ok(html.includes(name),'Missing grouping label '+name);
 for(let i=start;i<=end;i++){
  const no=String(i).padStart(2,'0');
  assert.ok(html.includes('id="ex-'+no+'" data-section="'+start+'"'),'Exercise '+no+' grouped incorrectly');
 }
}
assert.equal((html.match(/class="exercise"/g)||[]).length,34);
assert.equal((html.match(/<section class="chapter"/g)||[]).length,6);
assert.ok(html.includes('../shared/demo-doi.js'),'Shared DOI widget missing');
assert.ok(html.includes('../shared/demo-support.js'),'Shared support widget missing');
assert.ok(html.includes('../shared/demo-doi.css'),'Shared DOI styling missing');
assert.ok(html.includes('../shared/demo-support.css'),'Shared support styling missing');
assert.ok(html.includes('id="installApp"'),'Install button must be in static HTML');
assert.ok(html.includes('id="installDialog"'),'Install fallback must be provided');
assert.ok(html.includes('rel="manifest"'),'Install manifest link missing');
assert.ok(html.includes('href="./icon.svg"'),'App icon link missing');
assert.ok(html.includes('./pwa.js?v=20261024-1'),'PWA controller script not linked');
assert.ok(fs.existsSync(path.join(dir,'icon.svg')),'Icon missing');
assert.ok(fs.existsSync(path.join(dir,'service-worker.js')),'Service worker missing');
assert.ok(fs.existsSync(path.join(root,'demos','shared','demo-doi.js')),'Shared DOI script missing');
assert.ok(fs.existsSync(path.join(root,'demos','shared','demo-support.js')),'Shared support script missing');
assert.ok(manifest.start_url==='./' && manifest.scope==='./' && manifest.display==='standalone','Incorrect install scope');
assert.ok(Array.isArray(manifest.icons)&&manifest.icons.some(icon=>icon.src==='./icon.svg'),'Manifest icon missing');
new Function(js);
new Function(sw);
assert.ok(sw.includes("'/demos/metaforma/'"),'Offline service worker must be scoped to MetaForma');
assert.ok(sw.includes("key.startsWith(PREFIX)"),'Offline cache cleanup must be scoped');
const entries=demos.filter(x=>x.path==='metaforma/');
assert.equal(entries.length,1,'MetaForma demo metadata missing/duplicated');
assert.equal(entries[0].doi,'10.5281/zenodo.0000000','Do not invent a Zenodo DOI');
console.log('MetaForma site controls: PASS (6 blocks, 34 exercises, shared support & DOI, scoped PWA shell).');
