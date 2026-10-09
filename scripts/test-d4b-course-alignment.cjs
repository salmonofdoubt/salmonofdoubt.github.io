'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parseBank,parseCurriculum}=require('./d4b-consolidate.cjs');
const text=fs.readFileSync(path.resolve(__dirname,'../demos/d4b-quiz/questions.js'),'utf8');
const questions=parseBank(text).list,curriculum=parseCurriculum(text);
const reviewed=questions.filter(q=>q.course_alignment),statuses={supported:0,qualified:0};
for(const q of reviewed){
 const c=q.course_alignment;
 assert.ok(['supported','qualified'].includes(c.status),q.id+': unsupported course-review status');
 assert.equal(c.module,q.module,q.id+': module mismatch');
 assert.equal(c.week,q.week,q.id+': week mismatch');
 assert.ok(c.week>0&&c.week<=(curriculum[c.module]||[]).length,q.id+': week missing from curriculum');
 assert.equal(c.booklet_locator,q.source,q.id+': booklet locator mismatch');
 assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.reviewed_at),q.id+': no review date');
 assert.equal(c.original_moodle_key_checked,false,q.id+': never claim Moodle confirmation without a graded attempt');
 assert.equal(c.original_lecture_slides_directly_checked,false,q.id+': no unsupported slide-access claim');
 assert.equal(q.origin,'booklet-derived',q.id+': no original Moodle text belongs in public questions.js');
 statuses[c.status]++;
}
assert.ok(reviewed.length>=1,'Expected reviewed module questions');
for(const id of ['d4b-063','d4b-076']){
 const q=questions.find(x=>x.id===id);
 assert.ok(q&&q.course_alignment?.status==='qualified',id+': course-specific definition caveat missing');
 assert.ok(q.course_alignment.note.length>=80,id+': explain the academic qualification');
}
assert.ok(questions.filter(q=>q.verification==='verified').every(q=>q.evidence?.url),'All independently verified items need evidence URLs');
const html=fs.readFileSync(path.resolve(__dirname,'../demos/d4b-quiz/index.html'),'utf8');
const worker=fs.readFileSync(path.resolve(__dirname,'../demos/d4b-quiz/service-worker.js'),'utf8');
for(const name of ['questions.js','quiz.js','refresh.js']){
 const a=html.match(new RegExp(name.replace('.','\\.')+'\\?v=([^"]+)'))?.[1];
 assert.ok(a,name+' asset not linked');
 assert.ok(worker.includes(name+'?v='+a),name+' service worker and HTML cache versions must agree');
}
console.log('PASS: '+reviewed.length+' module-booklet answers reviewed ('+statuses.supported+' supported, '+statuses.qualified+' qualified); independent and official Moodle evidence statuses remain separate; PWA links align.');
