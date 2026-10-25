#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'artwork-gallery.js'),'utf8');
const intake=JSON.parse(fs.readFileSync(path.join(root,'artwork-intake.json'),'utf8'));
const block3=[
 'Gemini_Generated_Image_ie95uiie95uiie95.jpeg',
 'Gemini_Generated_Image_ie95uiie95uiie95 (1).jpeg',
 'Gemini_Generated_Image_ie95uiie95uiie95 (2).jpeg',
 'Gemini_Generated_Image_ie95uiie95uiie95 (3).jpeg',
 'Gemini_Generated_Image_ie95uiie95uiie95 (4).jpeg'
];
const knownBlock3Sha=[
 '376f47e08470ee7f0446a68110171817104c135d',
 'f6693a875ec77cf96d6ee3896a9a900aef616c34',
 'f0954b951b8072221a7e399233e3c3714da1ca3f',
 '367d563ae48a9b250cc6734f354f6dde8df22748',
 '7b6eb64aba15b9238191b976d5647ee526ed80e7'
];
assert.equal(intake.items.length,14,'Expected 14 original-artwork records');
for(let i=1;i<=14;i++){
 const id=String(i).padStart(2,'0');
 const item=intake.items[i-1];
 assert.equal(item.form,i,'Artwork order mismatch');
 assert.equal(item.path,'./art/'+encodeURIComponent(item.filename),'Incorrect image link for Form '+id);
 assert.equal(item.received,true,'Artwork not marked received for Form '+id);
 assert.equal(item.asset_in_repo,true,'Original file must be hosted for Form '+id);
 assert.equal(item.original_bytes_preserved,true,'Preserve original image bytes for Form '+id);
 const bytes=fs.readFileSync(path.join(root,'art',item.filename));
 const sha=crypto.createHash('sha1')
   .update(Buffer.from('blob '+bytes.length+String.fromCharCode(0)))
   .update(bytes).digest('hex');
 assert.equal(sha,item.git_blob_sha,'Original image bytes changed for Form '+id);
 assert.equal(item.instructor_verified,false,'Do not invent teacher certification');
 assert.equal(item.visual_approved,false,'Do not invent artistic sign-off');
 assert.ok(html.includes('data-artwork-number="'+id+'"'),'Missing artwork card '+id);
 assert.ok(html.includes('data-artwork-src="'+item.path+'"'),'Incorrect image HTML link '+id);
 if(i<=4)assert.equal(item.filename,id+'.jpeg','First four source images changed');
 if(i>=5&&i<=9)assert.equal(item.filename,id+'.png','Block II source images changed');
 if(i>=10){
  assert.equal(item.filename,block3[i-10],'Block III identity mapping changed');
  assert.equal(item.git_blob_sha,knownBlock3Sha[i-10],'Block III original identity hash changed');
  assert.equal(item.stages.length,3,'Three-stage original composition missing');
  for(const stage of item.stages)assert.ok(html.includes(stage),'Missing stage '+stage);
 }
}
assert.equal((html.match(/class="exercise"/g)||[]).length,34,'All 34 classical cards are required');
assert.equal((html.match(/class="artwork-preview"/g)||[]).length,14,'Expected 14 image slots');
assert.equal((html.match(/class="pose-stages"/g)||[]).length,5,'Expected five Block III stage sequences');
assert.equal((html.match(/<section class="chapter"/g)||[]).length,6,'All six architectural settings required');
assert.ok(html.includes('artworkLocalFiles'),'Private image preview missing');
assert.ok(js.includes('URL.createObjectURL')&&js.includes('new Image()'),'Original image loader missing');
assert.ok(html.includes('No animation'),'Static-only requirement missing');
assert.ok(!html.includes('mat-standing-spine-stretch-forward/'),'Known source error reintroduced');
assert.ok(html.includes('../shared/demo-doi.js')&&html.includes('../shared/demo-support.js'),'Shared site controls missing');
new Function(js);
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
assert.ok(sw.includes('artwork-gallery.js?v=20261025-3'),'PWA cache list stale');
new Function(sw);
console.log('MetaForma artwork gallery: PASS (14 original, byte-identical image files; 34 exercises; 6 blocks).');
