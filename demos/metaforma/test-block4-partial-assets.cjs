#!/usr/bin/env node
'use strict';
/* Original Block IV first two master paintings and their five colour editions. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname,art=path.join(root,'art');
const masters=[
 {base:'15-neck-pull',hash:'ca90dee34ffd7aa6be4cb9ced60be8966e0cb98c',size:[1448,1086]},
 {base:'16-high-scissors',hash:'7a1da91a8690ba28d325a9ee7fe49827e201bed1',size:[1447,1087]}
];
const variants=['nocturne','venetian','botanical','chromatic'];
const palettes=['metaphysical-original',...variants];
function readPNG(name,size){
 const b=fs.readFileSync(path.join(art,name));
 assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Invalid PNG '+name);
 assert.equal(b.readUInt32BE(16),size[0],'Width changed: '+name);
 assert.equal(b.readUInt32BE(20),size[1],'Height changed: '+name);
 return b;
}
const manifest=JSON.parse(fs.readFileSync(path.join(art,'block-iv-palette-editions.json'),'utf8'));
assert.equal(manifest.variants.length,8,'Expected 8 new palette PNGs');
const records=new Set(manifest.variants.map(e=>e.form+':'+e.palette));
for(const master of masters){
 const name=master.base+'-metaphysical-original.png';
 const original=readPNG(name,master.size);
 const sha=crypto.createHash('sha1')
   .update(Buffer.concat([Buffer.from('blob '+original.length+'\0'),original]))
   .digest('hex');
 assert.equal(sha,master.hash,'Original master changed: '+name);
 for(const p of palettes){
  const basename=master.base+'-'+p;
  const png=readPNG(basename+'.png',master.size);
  const webp=fs.readFileSync(path.join(art,basename+'.webp'));
  assert.ok(webp.length>35000,'Unexpectedly small WebP: '+basename);
  assert.equal(webp.toString('ascii',0,4),'RIFF','Invalid WebP '+basename);
  assert.equal(webp.toString('ascii',8,12),'WEBP','Invalid WebP '+basename);
  if(p!=='metaphysical-original'){
   assert.ok(records.has(master.base+':'+p),'Manifest omitted '+basename);
   assert.notDeepEqual(png,original,'Unchanged palette image: '+basename);
  }
 }
}
const js=fs.readFileSync(path.join(root,'art-gallery.js'),'utf8');
const css=fs.readFileSync(path.join(root,'art-gallery.css'),'utf8');
for(const m of masters)assert.ok(js.includes("'"+m.base+"'"),'Gallery mapping missing '+m.base);
assert.ok(js.includes('artworkMarkup(w,palette'),'Gallery tiles must show actual image editions');
assert.match(css,/object-fit:contain/);
assert.doesNotMatch(css,/object-fit:cover/);
for(const n of ['17-high-bicycle','18-shoulder-bridge','19-spine-twist','20-jackknife']){
 assert.ok(fs.existsSync(path.join(art,'studies',n+'-study-crop.png')),'Missing archived cropped study: '+n);
 assert.ok(fs.existsSync(path.join(art,n+'-metaphysical-original.png')),'Full-resolution replacement master missing: '+n);
}
console.log('MetaForma Block IV 15–16 PASS: 2 untouched masters, 8 palette PNGs, 10 WebPs, archived studies and 4 replacement masters');
