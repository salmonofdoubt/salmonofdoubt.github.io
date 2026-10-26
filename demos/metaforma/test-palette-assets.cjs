#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname,dir=path.join(root,'art');
const masters=[
 ['01-the-hundred','6c109ef364cbd4a23573baa1662a2de755ae792d'],
 ['02-roll-up','8cbf03a632aa5b3c167b6491e1ce1b74170df938'],
 ['03-roll-over','a5345ec3096d4299a059f7f4376820cf584e2243'],
 ['04-single-leg-circles','d8b69b67750d6019f54c1efb907b30226c7c4f16']
];
const palettes=['metaphysical-original','nocturne','venetian','botanical','chromatic'];
function readPNG(name){
 const b=fs.readFileSync(path.join(dir,name));
 assert.equal(b.slice(0,8).toString('hex'),'89504e470d0a1a0a','Bad PNG '+name);
 assert.equal(b.readUInt32BE(16),1448,'Width changed '+name);
 assert.equal(b.readUInt32BE(20),1086,'Height changed '+name);
 return b;
}
for(const [base,expectedHash] of masters){
 const original=readPNG(base+'-metaphysical-original.png');
 const blob=crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+original.length+'\0'),original])).digest('hex');
 assert.equal(blob,expectedHash,'Approved original file modified: '+base);
 for(const pal of palettes){
  const png=base+'-'+pal+'.png',webp=base+'-'+pal+'.webp';
  readPNG(png);
  const w=fs.readFileSync(path.join(dir,webp));
  assert.ok(w.length>35000,'WebP suspiciously small: '+webp);
  assert.equal(w.toString('ascii',0,4),'RIFF','Invalid WebP '+webp);
  assert.equal(w.toString('ascii',8,12),'WEBP','Invalid WebP '+webp);
 }
}
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'block-i-palette-editions.json'),'utf8'));
assert.equal(manifest.variants.length,16,'Expected 16 additional palette editions');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'art-gallery.js'),'utf8');
const css=fs.readFileSync(path.join(root,'art-gallery.css'),'utf8');
assert.match(js,/function pngFilename/);
assert.match(js,/function webFilename/);
assert.match(js,/function artworkMarkup/);
assert.match(js,/artworkMarkup\(w,palette/,'Artwork tiles must render image assets');
assert.match(css,/object-fit:contain/,'Never crop/stretch painted art');
assert.doesNotMatch(css,/object-fit:cover/,'Do not crop painted art');
assert.match(html,/id="viewerSmall"/);
console.log('MetaForma Block I palette assets: PASS (4 untouched PNG masters, 16 graded PNGs, 20 WebPs, consistent 4:3 dimensions).');
