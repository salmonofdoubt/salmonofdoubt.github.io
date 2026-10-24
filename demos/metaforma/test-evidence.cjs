#!/usr/bin/env node
/* MetaForma evidence integrity gate: deliberately refuses invented exercise approvals. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const ledger=JSON.parse(fs.readFileSync(path.join(root,'evidence.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.equal(ledger.exercises.length,34,'Classical repertoire must contain 34 exercises');
const observed=new Set();
const knownNames=['Hundred','Roll Up','Roll Over','Single Leg Circles','Rolling Like a Ball','Single Leg Stretch / Pull','Double Leg Stretch / Pull','Spine Stretch Forward','Open Leg Rocker','Corkscrew','Saw','Swan Dive','Single Leg Kick','Double Leg Kick','Neck Pull','High Scissors','High Bicycle','Shoulder Bridge','Spine Twist','Jackknife','Side Kicks','Teaser','Hip Circles / Twist','Swimming','Leg Pull Front','Leg Pull Back','Kneeling Side Kicks','Side Bend','Boomerang','Seal','Crab','Rocking','Control Balance','Push-Ups'];
for(const [i,e] of ledger.exercises.entries()){
 assert.equal(e.order,i+1,'Exercise order mismatch');
 assert.equal(e.name,knownNames[i],'Classical exercise name mismatch');
 assert.ok(e.source.url.startsWith('https://onlinepilatesclasses.com/pilates-exercises/mat-exercises/'),'Human tutorial must be on approved source path');
 assert.ok(!observed.has(e.source.url),'Duplicate human tutorial');
 observed.add(e.source.url);
 assert.equal(e.source.titleChecked,true,'Tutorial title check is required');
 const id='ex-'+String(e.order).padStart(2,'0');
 assert.ok(html.includes('id="'+id+'"'),'Missing exercise card '+id);
 assert.ok(html.includes('href="'+e.source.url+'"'),'Missing or inconsistent source link '+id);
 if(e.visual.approved||e.publishOriginalPose){
  const k=e.referenceKeyframes,b=e.biomechanics,v=e.visual,t=e.instructor;
  assert.ok(k.start&&k.middle&&k.end&&k.reviewed,'Verified start/middle/end keyframes required');
  assert.ok(b.segmentReview&&b.contactsReview&&b.jointLimitsReview,'Biomechanical review incomplete');
  assert.ok(t.approved&&t.reviewer&&t.date,'Named qualified instructor review required');
  assert.ok(v.approved&&v.asset&&v.reviewer&&v.reviewDate,'Independent visual sign-off required');
 }
}
assert.equal((html.match(/class="exercise"/g)||[]).length,34,'Site card count mismatch');
assert.ok(!/<img\b[^>]*src=["'][^"']*(plate-|imagegen|rollup_|matwork)/i.test(html),'Quarantined AI exercise image detected');
assert.ok(!html.includes('mat-standing-spine-stretch-forward/'),'Known reference mis-link reintroduced');
assert.ok(html.includes('No animation'),'Static-only condition missing');
console.log('MetaForma evidence gate: PASS (34 human sources, 0 unverified exercise drawings published).');
