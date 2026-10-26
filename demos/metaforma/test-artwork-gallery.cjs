#!/usr/bin/env node
'use strict';
/* Preserves historical user-uploaded artwork bytes without displaying them publicly. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,intake=JSON.parse(fs.readFileSync(path.join(root,'artwork-intake.json'),'utf8'));
assert.equal(intake.items.length,14,'Historical asset inventory changed');
for(let i=1;i<=14;i++){
 const item=intake.items[i-1];assert.equal(item.form,i,'Historical image order changed');
 const bytes=fs.readFileSync(path.join(root,'art',item.filename));
 const sha=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+String.fromCharCode(0))).update(bytes).digest('hex');
 assert.equal(sha,item.git_blob_sha,'Historical original image bytes changed: '+item.filename);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.doesNotMatch(html,/artworkLocalFiles|data-artwork-status|artwork-gallery\.js/,'Historical exercise art loader is still public');
console.log('MetaForma legacy artwork: PASS (14 original image bytes unchanged, legacy loader not public).');
