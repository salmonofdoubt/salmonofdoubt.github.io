'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const quizDir=path.join(root,'demos/d4b-quiz');
const {parseBank,publicationLedger}=require('./d4b-consolidate.cjs');
const text=fs.readFileSync(path.join(quizDir,'questions.js'),'utf8');
const bank=parseBank(text).list,byId=new Map(bank.map(q=>[q.id,q]));
const ledger=publicationLedger();
assert.ok(ledger.recorded_releases>0,'At least one reviewed material release must be recorded');
assert.equal(ledger.recent.length,Math.min(6,ledger.recorded_releases));
const ids=new Set();
for(const release of ledger.releases){
 assert.ok(Number.isFinite(Date.parse(release.accepted_at)),release.id+': real release timestamp required');
 assert.match(release.release_url,/^https:\/\/github\.com\/salmonofdoubt\/salmonofdoubt\.github\.io\/pull\/\d+$/);
 assert.ok(release.question_count>0&&release.question_count===release.question_ids.length);
 assert.ok(release.source_name&&release.source_access&&release.material);
 for(const id of release.question_ids){
  assert.ok(byId.has(id),release.id+': question not present '+id);
  assert.equal(byId.get(id).module,release.module);
  assert.equal(byId.get(id).week,release.week);
  assert.ok(!ids.has(id),release.id+': a question cannot be double counted');
  ids.add(id);
 }
}
const w5=ledger.releases.find(x=>x.id==='d4b-source-release-20261009-innovation-w5');
assert.ok(w5,'Preserve independently verifiable 9 October W5 publication event');
assert.equal(w5.question_count,14);
assert.equal(w5.source_id,'drive');
assert.equal(w5.source_access,'reviewed-via-connected-chatgpt-not-github-actions');
assert.equal(w5.accepted_at,'2026-10-09T22:31:46Z');
for(const id of w5.question_ids){
 const q=byId.get(id);
 assert.ok(q,id+': previously published W5 question is missing');
 assert.equal(q.course_alignment?.status,'supported',id+': original course-review metadata must remain');
 assert.equal(q.course_alignment?.original_moodle_key_checked,false,id+': no unsupported official Moodle grading claim');
 if(q.verification==='verified'){
  assert.equal(q.evidence?.originalMaterialChecked,true,id+': independent promotion requires original-source review');
  assert.match(q.evidence?.url||'',/^https:\/\//,id+': source URL missing');
 } else {
  assert.equal(q.verification,'pending',id+': unexpected evidence status');
  assert.notEqual(q.evidence?.originalMaterialChecked,true,id+': pending item cannot falsely claim independently checked original source');
 }
}
const multi=ledger.groups.find(g=>g.release_url==='https://github.com/salmonofdoubt/salmonofdoubt.github.io/pull/204');
assert.ok(multi,'Full-booklet release PR #204 must remain in provenance');
assert.equal(multi.question_count,16,'Full release should total exactly 16 new original questions');
assert.equal(multi.module_weeks.length,8,'Multiweek release must preserve all eight module/week sections');
assert.deepEqual([...new Set(multi.module_weeks.map(x=>x.module))].sort(),['AIB','DTR','GEN','INN']);
assert.equal(multi.accepted_at,'2026-10-09T23:08:19Z','Recorded acceptance must match actual merge');
assert.equal(multi.source_access,'reviewed-via-connected-chatgpt-not-github-actions');
assert.ok(multi.question_ids.every(id=>byId.get(id)?.verification==='pending'),'Course-only verification cannot become independent verification');
assert.equal(ledger.latest_group.release_url,multi.release_url,'Newest accepted release must be surfaced as a group');
const html=fs.readFileSync(path.join(quizDir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(quizDir,'refresh.js'),'utf8');
const sw=fs.readFileSync(path.join(quizDir,'service-worker.js'),'utf8');
for(const id of ['lastContentTitle','lastContentDetail','lastContentLink','lastRunIngest','lastRunIngestDetail','sourceCoverage']){
 assert.match(html,new RegExp('id="'+id+'"'),id+' is missing from HTML');
 assert.ok(js.includes("'"+id+"'"),id+' is not populated by the refresh UI');
}
assert.match(js,/last_reviewed_material_release/);
assert.match(js,/last_reviewed_release_group/);
assert.match(js,/last_automation_ingested_count/);
assert.match(js,/last_automated_check_at/);
assert.match(js,/0 peer-site questions automatically imported/);
assert.match(js,/Not connected to GitHub Actions/);
assert.match(html,/does not read changes in your private Google Drive/);
const asset=html.match(/refresh\.js\?v=([^"]+)/)?.[1];
assert.ok(asset,'Refresh UI must be cache-busted');
assert.ok(sw.includes('refresh.js?v='+asset),'Service worker must cache matching refresh code');
new Function(js);
console.log('PASS: historical W5 release and 16-question full-module release, immutable module-week provenance, aggregated UI, and PWA parity.');
