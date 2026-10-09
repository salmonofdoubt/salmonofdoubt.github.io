'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {parseBank,parseCurriculum}=require('./d4b-consolidate.cjs');
const code=fs.readFileSync(path.join(root,'demos/d4b-quiz/questions.js'),'utf8');
const bank=parseBank(code).list;
const weeks=parseCurriculum(code);
const staged=JSON.parse(fs.readFileSync(path.join(root,'demos/d4b-quiz/candidates.json'),'utf8')).items;
const allIds=new Set(),stems=new Set();
for(const q of bank){
 assert.ok(!allIds.has(q.id),'Duplicate ID '+q.id);
 assert.ok(!stems.has(q.stem.toLowerCase().trim()),'Duplicate stem '+q.id);
 allIds.add(q.id);stems.add(q.stem.toLowerCase().trim());
 assert.ok(weeks[q.module]?.[q.week-1],q.id+': invalid module/week');
 assert.ok(Array.isArray(q.choices)&&q.choices.length===4&&q.choices.every(x=>typeof x==='string'&&x.trim()),q.id+': invalid distractors');
 assert.ok(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4,q.id+': invalid answer');
}
assert.match(weeks.INN[4]||'',/Behaviour Change.*Adjacent Possible.*Creative Thinking/,
 'Innovation Week 05 must be in the curriculum');
const w5=bank.filter(q=>q.module==='INN'&&q.week===5);
assert.ok(w5.length>=12,'Innovation Week 05 needs substantive original practice coverage');
for(const q of w5){
 assert.equal(q.origin,'booklet-derived',q.id+': never copy private Moodle originals into the public site');
 assert.equal(q.verification,'pending',q.id+': course alignment is not independent evidence verification');
 assert.equal(q.course_alignment?.status,'supported',q.id+': course alignment not recorded');
 assert.equal(q.course_alignment?.week,5,q.id+': alignment week mismatch');
 assert.equal(q.course_alignment?.original_moodle_key_checked,false,q.id+': invented lecturer key');
 assert.equal(q.course_alignment?.original_lecture_slides_directly_checked,false,q.id+': original slides not directly accessed');
 assert.ok(q.source.includes('Week 05'),q.id+': source locator missing');
}
const stagedIds=new Set(staged.map(q=>q.id));
assert.equal(stagedIds.size,staged.length,'Duplicate candidate identifiers');
assert.ok(staged.every(q=>allIds.has(q.id)),'Staged question missing from release bank');
assert.ok(w5.every(q=>stagedIds.has(q.id)),'Week 05 candidate missing from reviewed public release');
for(const [module,titles] of Object.entries(weeks)){
 for(let i=0;i<titles.length;i++){
  assert.ok(bank.some(q=>q.module===module&&q.week===i+1),module+' W'+(i+1)+' has no study questions');
 }
}
const workflow=fs.readFileSync(path.join(root,'.github/workflows/d4b-refresh.yml'),'utf8');
assert.match(workflow,/already_present,items\.length/,'Idempotency must derive from the current candidate set');
console.log('PASS: '+bank.length+' unique questions; INN W5 has '+w5.length+' original questions; all '+Object.values(weeks).flat().length+' curriculum weeks covered; '+staged.length+' staged records reconciled.');
