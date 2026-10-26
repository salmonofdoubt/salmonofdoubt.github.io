#!/usr/bin/env node
'use strict';
/* Full MetaForma collection verification, original bytes, image geometry and real gallery links. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname, art=path.join(root,'art');
const masters=[["17-high-bicycle","8608eeb84c7d6d5ccd8d3052bc4f3523fd98376e"],["18-shoulder-bridge","346e90abefffbf17b5289e1f19de64290972449f"],["19-spine-twist","00c23d53d1282214d5dc9d77dd15f5327500394d"],["20-jackknife","8b34e7f66dd6de8ca6c475b44d7d063fd1500fbc"],["21-side-kicks","40c3257bb0eb9285233a0943089717f9a83c2df5"],["22-teaser","989060e25d86b10c7ec3b146a51e8e05ae5c53da"],["23-hip-circles-twist","a7e1f21d8b97feb95b788f023cabb3250e804e8f"],["24-swimming","92302e87db3059b5a362d4bbdd260ca95b95cca8"],["25-leg-pull-front","6030a313c56afd2bc985ab0f48176d638bdb90b0"],["26-leg-pull-back","590d992e53bde640ee6ada3e2699189c640c6f50"],["27-kneeling-side-kicks","f1474139a3f9b3bc8b21455593eaeee040b8e05a"],["28-side-bend","1d6b2ea65f6f9ea89641c1915256f5647f471a69"],["29-boomerang","c7844e09f6954bd54eac6989a871e443031a9571"],["30-seal","7eeb41eb423b13a55545d2d9a9dd3408949248a8"],["31-crab","5bc3e3719f9c61bc151e3f2cc531108eabf49deb"],["32-rocking","ceaa46ab00adeba9bda175d06d3df549ded9c222"],["33-control-balance","c889b49a45f552908abed1391a1ec27235da188f"],["34-push-up","1ae01a2a8cb12734644e890443825f3f60067442"]];
const variants=['nocturne','venetian','botanical','chromatic'];
function readPNG(filename){
 const b=fs.readFileSync(path.join(art,filename));
 assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Not PNG: '+filename);
 const dimensions=[b.readUInt32BE(16),b.readUInt32BE(20)];
 assert.ok(dimensions[0]>=1400 && dimensions[1]>=1000,'Unexpectedly small master: '+filename);
 assert.ok(Math.abs(dimensions[0]/dimensions[1]-4/3)<0.02,'Incorrect aspect: '+filename);
 return {bytes:b,dimensions};
}
const manifests=[
 ['block-iv-remaining-palette-editions.json',4],
 ['block-v-palette-editions.json',6],
 ['block-vi-palette-editions.json',8]
];
const records=new Map();
for(const [file,count] of manifests){
 const m=JSON.parse(fs.readFileSync(path.join(art,file),'utf8'));
 assert.equal(m.variants.length,count*4,'Wrong variant count in '+file);
 for(const e of m.variants){
  assert.ok(!records.has(e.form+':'+e.palette),'Duplicate edition '+e.form+':'+e.palette);
  records.set(e.form+':'+e.palette,e);
 }
}
assert.equal(records.size,72,'Expected 72 additional colour editions');
for(const [base,sha] of masters){
 const master=readPNG(base+'-metaphysical-original.png');
 const actual=crypto.createHash('sha1').update(Buffer.concat([
  Buffer.from('blob '+master.bytes.length+String.fromCharCode(0)),
  master.bytes
 ])).digest('hex');
 assert.equal(actual,sha,'Approved original bytes changed: '+base);
 const all=['metaphysical-original',...variants];
 for(const palette of all){
  const name=base+'-'+palette;
  const p=readPNG(name+'.png');
  assert.deepEqual(p.dimensions,master.dimensions,'Variant changed image size: '+name);
  const w=fs.readFileSync(path.join(art,name+'.webp'));
  assert.ok(w.length>35000,'WebP appears incomplete: '+name);
  assert.equal(w.toString('ascii',0,4),'RIFF','Invalid WebP: '+name);
  assert.equal(w.toString('ascii',8,12),'WEBP','Invalid WebP: '+name);
  if(palette!=='metaphysical-original'){
   assert.ok(records.has(base+':'+palette),'Missing manifest entry: '+name);
   assert.notDeepEqual(p.bytes,master.bytes,'Edition equals original: '+name);
   assert.deepEqual(records.get(base+':'+palette).dimensions,master.dimensions,'Manifest dimensions wrong');
  }
 }
}
const js=fs.readFileSync(path.join(root,'art-gallery.js'),'utf8');
const css=fs.readFileSync(path.join(root,'art-gallery.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [base] of masters) assert.ok(js.includes("'"+base+"'"),'Gallery mapping missing: '+base);
const arr=js.match(/const PAINTED_MASTERS = \[([\s\S]*?)\];/);
assert.ok(arr,'No painted originals manifest');
assert.equal((arr[1].match(/'\d\d-[^']+'/g)||[]).length,34,'Not all 34 masters configured');
assert.match(js,/artworkMarkup\(WORKS\[21\],palette/,'Hero still renders provisional vector art');
assert.match(css,/object-fit:contain/,'Art is not displayed uncropped');
assert.doesNotMatch(css,/object-fit:cover/,'Found cropping CSS');
assert.doesNotMatch(html,/remain provisional vector studies/);
console.log('MetaForma complete collection PASS: 18 new unchanged originals, 72 graded PNGs, 90 WebPs, 34 mapped artworks, 170 selectable editions');
