#!/usr/bin/env node
'use strict';
/* Block IIII: five approved originals, 20 colour editions, 25 gallery derivatives. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname,art=path.join(root,'art');
const masters=[
  ['10-corkscrew','e27d4cdd63d34947f667bffd05354b3ebff18070'],
  ['11-saw','6d430dae10edf2eae4e8c132f2e63bb37119edb6'],
  ['12-swan-dive','94093925e10f1b5c688de557a58048db4ffdb582'],
  ['13-single-leg-kick','a39ebae0a10a3c32b2f9b6eef08ab8c6279396af'],
  ['14-double-leg-kick','3d295e27f824c9c2c9c8b0baed22d713e98ad301']
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
const entries=JSON.parse(fs.readFileSync(path.join(art,'block-iii-palette-editions.json'),'utf8'));
assert.equal(entries.variants.length,20,'Exactly 20 graded Block III PNGs required');
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
console.log('MetaForma Block III PASS: 5 immutable originals, 20 colour PNGs, 25 WebPs, 4:3 image geometry and live gallery mappings');
