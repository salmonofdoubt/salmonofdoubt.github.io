'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'demos/d4b-quiz');
const {parseBank}=require('./d4b-consolidate.cjs');
const bank=parseBank(fs.readFileSync(path.join(dir,'questions.js'),'utf8')).list;
const byId=new Map(bank.map(q=>[q.id,q]));
const review=JSON.parse(fs.readFileSync(path.join(dir,'verification-review-20261010.json'),'utf8'));
const snapshot=q=>JSON.stringify([q.stem,q.choices,q.correct,q.explanation,q.source]);
function hash(s){
 let h=2166136261;
 for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
 return 'fnv1a32:'+(h>>>0).toString(16).padStart(8,'0');
}
assert.equal(review.schema_version,1);
assert.equal(review.review_population,82);
assert.equal(review.reviewed.length,review.verified_this_review);
assert.equal(review.exceptions.length,review.left_pending);
assert.equal(review.reviewed.length+review.exceptions.length,82,'Entire originally pending population must be adjudicated');
const recorded=new Set(), urls=new Set();
for(const row of review.reviewed){
 assert.ok(!recorded.has(row.id),'Duplicate review record '+row.id);
 recorded.add(row.id);
 const q=byId.get(row.id);assert.ok(q,'Missing question '+row.id);
 assert.equal(row.module,q.module);assert.equal(row.week,q.week);
 assert.equal(q.verification,'verified',q.id+' must have an independent source');
 assert.equal(q.evidence?.originalMaterialChecked,true);
 assert.equal(q.evidence?.reviewed_at,'2026-10-10');
 assert.equal(q.evidence?.source_review_status,'independently supported');
 assert.match(q.evidence?.url||'',/^https:\/\//,q.id+' must have evidence URL');
 assert.ok((q.evidence?.locator||'').length>30,q.id+' missing precise source locator');
 urls.add(q.evidence.url);
 assert.equal(row.source_url,q.evidence.url);
 assert.equal(row.source_locator,q.evidence.locator);
 assert.equal(row.correct_index,q.correct);
 assert.equal(q.evidence.key_checked,q.correct);
 const alternatives=[0,1,2,3].filter(n=>n!==q.correct);
 assert.deepEqual(row.alternative_indices_checked,alternatives,q.id+' missed a distractor');
 assert.deepEqual(q.evidence.distractor_indices_checked,alternatives,q.id+' missed a distractor in the bank');
 assert.equal(row.question_revision_fingerprint,hash(snapshot(q)),q.id+' wording/key changed after evidence review');
 assert.equal(q.course_alignment?.original_moodle_key_checked,false,q.id+' must not claim lecturer key confirmation');
}
for(const row of review.exceptions){
 assert.ok(!recorded.has(row.id),'Duplicate review decision '+row.id);
 recorded.add(row.id);
 const q=byId.get(row.id);assert.ok(q);
 assert.equal(row.module,q.module);assert.equal(row.week,q.week);
 assert.equal(q.verification,'pending',q.id+' unsupported answer must stay pending');
 assert.equal(q.evidence?.originalMaterialChecked,false);
 assert.equal(q.evidence?.independent_review_at,'2026-10-10');
 assert.equal(q.evidence?.independent_review_result,'pending');
 assert.ok(q.evidence?.independent_review_blocker?.length>40,q.id+' blocker must explain why independent verification failed');
 assert.equal(row.blocker,q.evidence.independent_review_blocker);
 assert.equal(row.question_revision_fingerprint,hash(snapshot(q)),q.id+' wording changed since deferral');
}
assert.deepEqual([...review.exceptions.map(q=>q.id)].sort(),['d4b-063','d4b-076','d4b-115','d4b-120']);
assert.equal(recorded.size,82);
assert.ok(bank.filter(q=>q.verification==='verified').length>=review.verified_total,'Never silently unverify a reviewed question; future growth may add questions');
// The 4 historical exceptions are checked by immutable ID above; future
// additional candidates may legitimately increase the pending total.
assert.ok(bank.filter(q=>q.verification==='pending').length>=review.remaining_pending_total,'Historical exceptions must remain tracked');
assert.ok(urls.size>=30,'Avoid promoting questions using an implausibly narrow evidence base');
assert.ok(review.review_standard.includes('distractors'),'Explicit alternative assessment must be documented');
console.log('PASS: '+recorded.size+' old pending questions individually adjudicated, '+review.verified_this_review+' independently source-backed, '+review.left_pending+' disclosed exceptions, '+urls.size+' distinct primary-source links, source-linked revision fingerprints and all distractors checked.');
