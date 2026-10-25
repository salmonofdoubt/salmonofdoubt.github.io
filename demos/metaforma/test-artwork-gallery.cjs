#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = __dirname;
const html = fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js = fs.readFileSync(path.join(dir,'artwork-gallery.js'),'utf8');
const intake = JSON.parse(fs.readFileSync(path.join(dir,'artwork-intake.json'),'utf8'));
assert.equal(intake.items.length,14,'Intake must contain 14 artwork entries: 9 installed + 5 pending');
for(let i=1;i<=14;i++){
  const id=String(i).padStart(2,'0');
  const item=intake.items[i-1];
  assert.equal(item.form,i);
  assert.equal(item.path,'./art/'+id+(i<=4?'.jpeg':'.png'),'Wrong or unknown filename mapping');
  if(i<=9) {
  assert.equal(item.received,true);

  assert.equal(item.asset_in_repo,true,'Original binary image must be present in repository');
  assert.equal(item.original_bytes_preserved,true,'Do not re-encode original image');
  const bytes=fs.readFileSync(path.join(dir,'art',item.filename));
  const actualSha=crypto.createHash('sha1')
    .update(Buffer.from('blob '+bytes.length+String.fromCharCode(0)))
    .update(bytes)
    .digest('hex');
  assert.equal(actualSha,item.git_blob_sha,'Original illustration bytes changed: '+id);
  } else {
    assert.equal(item.received,false,'No Block III original files received yet');
    assert.equal(item.asset_in_repo,false,'Do not claim Block III images uploaded');
    assert.equal(item.instructor_verified,false,'Unverified Block III art cannot be certified');
    assert.equal(item.stages.length,3,'Each Block III form must have 3 defined composition stages');
    for(const stage of item.stages) assert.ok(html.includes(stage),'Missing Block III pose stage '+stage);
  }
  assert.equal(item.instructor_verified,false,'Cannot invent Pilates teacher approval');
  assert.ok(html.includes('data-artwork-number="'+id+'"'),'Missing intake card '+id);
  assert.ok(html.includes('data-artwork-src="'+item.path+'"'),'Missing artist image link '+id);
}
assert.equal((html.match(/class="exercise"/g)||[]).length,34,'Original 34-card library lost');
assert.ok(html.includes('data-chapter="1"')&&html.includes('data-chapter="5"'),'First two blocks missing');
assert.equal((html.match(/class="artwork-preview"/g)||[]).length,14,'Incorrect staged figure count');
assert.ok(html.includes('artworkLocalFiles'),'Artist local preview missing');
assert.ok(js.includes('URL.createObjectURL')&&js.includes('new Image()'),'No safe image fallback');
assert.ok(js.includes('!/^image\\/'),'Only images must be previewed');
assert.ok(html.includes('No animation'),'Animation prohibition must remain');
assert.ok(!html.includes('mat-standing-spine-stretch-forward/'),'Do not revive wrong exercise source');
assert.ok(html.includes('../shared/demo-doi.js')&&html.includes('../shared/demo-support.js'),'Shared controls lost');
new Function(js);
const sw=fs.readFileSync(path.join(dir,'service-worker.js'),'utf8');
assert.ok(sw.includes('artwork-gallery.js?v=20261025-3'),'Worker cache has stale asset list');
new Function(sw);
console.log('MetaForma artwork gallery: PASS (9 byte-identical originals, 5 Block III reserved, 34 exercise cards).');
