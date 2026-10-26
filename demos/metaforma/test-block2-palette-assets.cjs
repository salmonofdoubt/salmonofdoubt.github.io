#!/usr/bin/env node
'use strict';
/* Block II: five approved originals, 20 colour editions, 25 gallery derivatives. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname,art=path.join(root,'art');
const masters=[
  ['05-rolling-like-a-ball','d3016abd68b5c80c9e371ef08aa4f22de2be7f8d'],
  ['06-single-leg-stretch','0bccbee806a97ae5dfdef5fe7e6e3841437a1c85'],
  ['07-double-leg-stretch','6299a8e35d7a72e7e2b270346e090f02ed62a4b2'],
  ['08-spine-stretch-forward','eca540bae5131883436898e194804b08703a3c93'],
  ['09-open-leg-rocker','8191eb0a9c524f79cd12208c1a3f3b42b522381a']
];
const variants=['nocturne','venetian','botanical','chromatic'];
const palettes=['metaphysical-original',...variants];
function readPNG(name){
 const b=fs.readFileSync(path.join(art,name));
 assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Invalid PNG '+name);
 assert.equal(b.readUInt32BE(16),1448,'Unexpected width '+name);
 assert.equal(b.readUInt32BE(20),1086,'Unexpected height '+name);
 return b;
}
const entries=JSON.parse(fs.readFileSync(path.join(art,'block-ii-palette-editions.json'),'utf8'));
assert.equal(entries.variants.length,20,'Exactly 20 graded Block II PNGs required');
const records=new Set(entries.variants.map(e=>e.form+':'+e.palette));
assert.equal(records.size,20,'Variant manifest contains duplicates');
for(const [base,expectedBlob] of masters){
 const masterName=base+'-metaphysical-original.png';
 const original=readPNG(masterName);
 const actualBlob=crypto.createHash('sha1')
   .update(Buffer.concat([Buffer.from('blob '+original.length+'\0'),original]))
   .digest('hex');
 assert.equal(actualBlob,expectedBlob,'Approved original bytes changed: '+masterName);
 for(const p of palettes){
   const name=base+'-'+p;
   const png=readPNG(name+'.png');
   const webp=fs.readFileSync(path.join(art,name+'.webp'));
   assert.ok(webp.length>35000,'Suspiciously small WebP '+name);
   assert.equal(webp.toString('ascii',0,4),'RIFF','Invalid WebP '+name);
   assert.equal(webp.toString('ascii',8,12),'WEBP','Invalid WebP '+name);
   if(p!=='metaphysical-original'){
     assert.ok(records.has(base+':'+p),'Palette omitted from manifest: '+name);
     assert.notDeepEqual(png,original,'Palette file accidentally identical to original: '+name);
   }
 }
}
const js=fs.readFileSync(path.join(root,'art-gallery.js'),'utf8');
const css=fs.readFileSync(path.join(root,'art-gallery.css'),'utf8');
for(const [base] of masters)assert.ok(js.includes("'"+base+"'"),'Painted gallery mapping missing '+base);
assert.ok(js.includes('PAINTED_MASTERS.length'),'Gallery does not include new masters');
assert.match(js,/artworkMarkup\(w,palette/,'Artwork tiles not using real images');
assert.match(css,/object-fit:contain/,'Paintings must keep native aspect ratio');
assert.doesNotMatch(css,/object-fit:cover/,'Paintings must not be cropped');
console.log('MetaForma Block II PASS: 5 immutable originals, 20 colour PNGs, 25 WebPs, 4:3 image geometry and live gallery mappings');
