(()=>{'use strict';
const builtInQuestions=[...(window.D4B_QUESTIONS||[]),...(window.D4B_MOCK_QUESTIONS||[])];
const conceptGroups=window.D4B_CONCEPT_GROUPS||{};
const stemKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function uniqueByConcept(items){
 if($('source').value!=='cram')return items;
 const picked=new Map();
 for(const q of items){
  const group=conceptGroups[q.id]||q.module+'|stem:'+stemKey(q.stem);
  const previous=picked.get(group);
  // Keep the most course-evidenced wording without deleting other practice variants.
  if(!previous||sourcePriority(q)<sourcePriority(previous))picked.set(group,q);
 }
 return [...picked.values()];
}
let questions=[...builtInQuestions];
const privateKey='d4b-private-moodle-quiz-v1';
const curriculum=window.D4B_CURRICULUM||{};
const key='d4b-evidence-quiz-progress-v1';
const $=id=>document.getElementById(id);
const read=()=>{try{return JSON.parse(localStorage.getItem(key))||{}}catch{return {}}};
function officialValidationError(q,index){
 const name='Item '+(index+1)+(q&&q.id?' ('+q.id+')':'');
 if(!q||typeof q!=='object'||Array.isArray(q))return name+': expected a question object.';
 if(typeof q.id!=='string'||!/^official-[a-z0-9-]{1,70}$/.test(q.id))return name+': id must start with official- and contain lowercase letters, digits or hyphens.';
 if(!['GEN','AIB','INN','DTR'].includes(q.module))return name+': unrecognised module (GEN, AIB, INN or DTR).';
 if(!Number.isInteger(q.week)||q.week<1||q.week>(curriculum[q.module]||[]).length)return name+': week must be a documented week in that module.';
 if(typeof q.topic!=='string'||!q.topic.trim())return name+': missing topic.';
 if(typeof q.stem!=='string'||q.stem.trim().length<10)return name+': question text is missing or too short.';
 if(!Array.isArray(q.choices)||q.choices.length!==4||q.choices.some(x=>typeof x!=='string'||!x.trim()))return name+': exactly four nonempty answer choices are required.';
 if(!Number.isInteger(q.correct)||q.correct<0||q.correct>3)return name+': correct must be a numeric index from 0 to 3 (A=0, B=1, C=2, D=3).';
 if(typeof q.explanation!=='string'||q.explanation.trim().length<8)return name+': explanation is missing or too short.';
 if(typeof q.source!=='string'||q.source.trim().length<5)return name+': Moodle source is missing.';
 if(q.origin!=='official-moodle')return name+': origin must be official-moodle.';
 if(!['key-pending','official-key-confirmed'].includes(q.verification))return name+': verification must be key-pending or official-key-confirmed.';
 return '';
}
function validOfficial(q){return !officialValidationError(q,0)}
function privateQuestions(){try{const a=JSON.parse(localStorage.getItem(privateKey)||'[]');return Array.isArray(a)?a.filter(validOfficial):[]}catch{return []}}
function refreshQuestions(){questions=[...builtInQuestions,...privateQuestions()];weeks();stats()}
let history=read(),session=[],index=0,answers=[],deadline=0,timer=null,mode='adaptive',completed=false,selected=null,checked=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function evidenceLink(q){const u=q.evidence?.url;return typeof u==='string'&&/^https:\/\//.test(u)?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">Independently checked reference</a>':''}
function courseEvidence(q){const c=q.course_alignment;if(!c)return '';const label=c.status==='qualified'?'Course rule checked — qualification applies':'Answer checked against module booklet';return '<p class="fine"><strong>'+esc(label)+'</strong> · '+esc(c.booklet_locator||'')+'</p>'+(c.status==='qualified'?'<p class="fine">'+esc(c.note||'')+'</p>':'')}
function save(){try{localStorage.setItem(key,JSON.stringify(history))}catch(e){console.warn('Progress cannot be stored',e)}stats()}
function dueQuestions(){
 const now=Date.now();
 return questions.filter(q=>q.verification!=='flagged'&&history[q.id]&&history[q.id].attempts>0&&Number.isFinite(history[q.id].due)&&history[q.id].due<=now);
}
function stats(){
 const records=Object.values(history),total=records.reduce((n,x)=>n+x.attempts,0),correct=records.reduce((n,x)=>n+x.correct,0),due=dueQuestions().length;
 $('attempts').textContent=total;
 $('accuracy').textContent=total?Math.round(correct/total*100)+'%':'—';
 $('due').textContent=due;
 $('reviewDue').disabled=due===0;
 $('reviewDue').setAttribute('aria-label',due?('Retry '+due+' question'+(due===1?'':'s')+' due for review'):'No questions currently due for review');
 $('dueAction').textContent=due?'Tap to retry':'All caught up';
 $('bank').textContent=questions.length;
 $('bankScope').textContent=builtInQuestions.length+' built into the website (all devices) · '+privateQuestions().length+' optional Moodle originals stored only in this browser.';
 updateAvailability();
}
function isOfficial(q){return q.origin==='official-moodle'}
function isMock(q){return q.origin==='independent-mock'}
function sourceMatches(q){
 const source=$('source').value;
 if(source==='official-only')return isOfficial(q);
 if(source==='booklet-only')return !isOfficial(q)&&!isMock(q);
 if(source==='cram'||source==='full')return true;
 if(/^mock-[ABC]$/.test(source))return isMock(q)&&q.mockExam===source.slice(-1);
 return true;
}
function sourcePriority(q){if(q.verification==='official-key-confirmed')return 0;if(isOfficial(q))return 1;if(isMock(q))return 4;return q.verification==='verified'?2:3}
function evidenceStatus(q){return isMock(q)?'Supplied mock answer key; unofficial and not independently verified':q.verification==='verified'?'Independently checked':q.verification==='official-key-confirmed'?'Official Moodle key confirmed':isOfficial(q)?'Original Moodle key pending':'Independent verification pending'}
function syncModuleFocus(){
 const context={
  GEN:{eyebrow:'GENERATIVE AI EXAM · 30 NOVEMBER 2026',title:'Generative AI exam focus',desc:'Generative AI Weeks 1–9 only. All eligible reduced-repeat questions are available by default, untimed. Original Moodle questions remain the strongest exam evidence.'},
  AIB:{eyebrow:'AI FOR BUSINESS · MODULE PRACTICE',title:'AI for Business',desc:'Practise machine learning, neural networks, automated planning and responsible AI using this module’s question bank. All eligible questions are available, untimed by default.'},
  INN:{eyebrow:'INNOVATION · MODULE PRACTICE',title:'Innovation',desc:'Practise innovation, communication, AI-related training and Week 10 leadership. All published practice questions are built into the app.'},
  DTR:{eyebrow:'DIGITAL TRANSFORMATION · MODULE PRACTICE',title:'Digital Transformation',desc:'Practise human-centred transformation, digital societies, platforms and digital literacies. All eligible questions are available, untimed by default.'},
  all:{eyebrow:'DIGITAL4BUSINESS · ALL MODULES',title:'All four modules',desc:'Practise across all four Digital4Business modules, with similar questions reduced and no time limit unless you choose one.'}
 };
 const selected=$('module').value;
 const focus=context[selected]||context.all;
 $('moduleFocusEyebrow').textContent=focus.eyebrow;
 $('examFocusTitle').textContent=focus.title;
 $('moduleFocusDescription').textContent=focus.desc;
 const genaiOnly=selected==='GEN';
 if($('mockWritten'))$('mockWritten').hidden=!(genaiOnly&&$('source').value==='mock-C');
 // GenAI-specific mock filters must never silently produce an empty non-GenAI pool.
 for(const option of $('source').options){
  if(/^mock-[ABC]$/.test(option.value)){
   option.disabled=!genaiOnly;
   option.hidden=!genaiOnly;
  }
 }
 if(!genaiOnly&&/^mock-[ABC]$/.test($('source').value))$('source').value='cram';
 if($('mockWritten'))$('mockWritten').hidden=!(genaiOnly&&$('source').value==='mock-C');
}
function weeks(){
 syncModuleFocus();
 const m=$('module').value,chosen=$('week').value;
 const keys=m==='all'?Object.keys(curriculum):[m];
 const distinct=[...new Set(keys.flatMap(k=>(curriculum[k]||[]).map((_,i)=>i+1)))].sort((a,b)=>a-b);
 $('week').replaceChildren(new Option('All documented weeks','all'),...distinct.map(w=>{
 const filtered=questions.filter(q=>(m==='all'||q.module===m)&&q.week===w&&sourceMatches(q));
 return new Option('Week '+String(w).padStart(2,'0')+' · '+filtered.length+' questions',String(w));
 }));
 $('week').value=distinct.some(x=>String(x)===chosen)?chosen:'all';
 updateAvailability();
}
function pool(){return questions.filter(q=>q.verification!=='flagged'&&sourceMatches(q)&&($('module').value==='all'||q.module===$('module').value)&&($('week').value==='all'||q.week===Number($('week').value)))}
function eligible(){
 const p=pool();
 return uniqueByConcept($('mode').value==='mistakes'?p.filter(q=>dueQuestions().some(d=>d.id===q.id)):p);
}
function updateAvailability(){
 const items=eligible(),n=items.length,requested=$('count').value==='all'?n:Number($('count').value);
 const chosen=Math.min(n,requested);
 const isCram=$('source').value==='cram';
 let status=n+' question'+(n===1?'':'s')+' available'+(isCram?' after reducing repeated concepts':'')+' · '+($('timing').value==='recommended'?'timed':'untimed');
 if($('source').value==='official-only'&&!n)status='No private Moodle originals stored here. Use Best mix to see the built-in questions.';
 if(n>0&&requested>n)status+=' · showing '+n;
 $('availability').textContent=status;
 $('start').disabled=n===0;
 $('start').textContent=/^mock-[ABC]$/.test($('source').value)?'Start Mock '+$('source').value.slice(-1)+' · '+chosen+' Q':$('mode').value==='exam'?'Start exam practice · '+chosen+' Q':$('mode').value==='mistakes'?'Review '+chosen+' mistakes':'Start learning · '+chosen+' Q';
 $('start').title=n===0?'No questions match your choice':'Start '+chosen+' questions';
}
function shuffle(items){return items.map(q=>({q,k:Math.random()})).sort((a,b)=>a.k-b.k).map(x=>x.q)}
function reviewOrder(items){const now=Date.now();return items.map(q=>({q,tie:Math.random()})).sort((a,b)=>{const x=history[a.q.id],y=history[b.q.id];const sx=x?(x.due<=now?-100000000:0)+x.due:-200000000;const sy=y?(y.due<=now?-100000000:0)+y.due:-200000000;const priority=0;return priority||sx-sy||a.tie-b.tie}).map(x=>x.q)}
function select(){
 const p=pool();
 if(mode==='exam'&&/^mock-[ABC]$/.test($('source').value))return [...p].sort((a,b)=>a.mockNumber-b.mockNumber);
 const available=mode==='mistakes'?p.filter(q=>dueQuestions().some(d=>d.id===q.id)):p;
 const varied=uniqueByConcept(available);
 return mode==='exam'?shuffle(varied):reviewOrder(varied);
}
function updateClock(){if(!deadline)return;const ms=Math.max(0,deadline-Date.now());$('clock').textContent=Math.floor(ms/60000)+':'+String(Math.floor(ms%60000/1000)).padStart(2,'0');if(ms===0)finish()}
function beginSession(useTimer){
 answers=[];index=0;completed=false;
 $('summary').classList.add('hidden');
 $('session').classList.remove('hidden');
 document.body.classList.add('quiz-active');
 const mockTimes={'mock-A':35,'mock-B':40,'mock-C':45};
 const exactMockTime=mode==='exam'&&session.length===33?mockTimes[$('source').value]:0;
 deadline=useTimer&&$('timing').value==='recommended'?Date.now()+(exactMockTime?exactMockTime*60000:Math.round(session.length*90*1000)):0;
 clearInterval(timer);
 $('clock').textContent='';
 if(deadline){updateClock();timer=setInterval(updateClock,1000)}
 render();
 $('session').scrollIntoView({behavior:'auto',block:'start'});
}
function start(){
 mode=$('mode').value;
 const requested=$('count').value==='all'?eligible().length:Math.min(eligible().length,Number($('count').value));
 session=select().slice(0,requested);
 if(!session.length){
  $('summary').classList.remove('hidden');
  $('summary').textContent='No questions available for these filters. Try another module or practice mode.';
  return;
 }
 beginSession(true);
}
function startDueReview(){
 const pending=dueQuestions();
 if(!pending.length){stats();return}
 mode='adaptive';
 session=reviewOrder(pending);
 beginSession(false);
}
function render(){selected=null;checked=false;const q=session[index];$('position').textContent='Question '+(index+1)+' of '+session.length;$('bar').style.width=(index/session.length*100)+'%';$('topic').textContent=q.module+' · WEEK '+String(q.week).padStart(2,'0')+' · '+(isMock(q)?'Mock '+q.mockExam+' / Q'+q.mockNumber:q.origin==='official-moodle'?'Private Moodle original':q.topic);$('prompt').textContent=q.stem;$('feedback').classList.add('hidden');$('feedback').replaceChildren();$('session').classList.remove('has-feedback');$('next').disabled=true;$('next').textContent='Next question';$('choices').replaceChildren(...q.choices.map((answer,i)=>{let b=document.createElement('button');b.type='button';b.textContent=String.fromCharCode(65+i)+'. '+answer;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>choose(i));return b}))}
function choose(value){
 if(checked || completed)return;
 selected=value;
 const buttons=[...$('choices').children];
 buttons.forEach((b,i)=>{
  const active=i===value;
  b.classList.toggle('selected',active);
  b.setAttribute('aria-pressed',String(active));
 });
 $('next').disabled=false;
 if(mode!=='exam')checkAnswer();
}
function checkAnswer(){
 if(selected===null || checked)return;
 const q=session[index],ok=selected===q.correct;
 answers.push({id:q.id,value:selected,ok});
 checked=true;
 [...$('choices').children].forEach((b,i)=>{
  b.disabled=true;
  b.classList.remove('selected');
  b.setAttribute('aria-pressed',String(i===selected));
  if(i===q.correct)b.classList.add('correct');
  else if(i===selected)b.classList.add('wrong');
 });
 $('feedback').classList.remove('hidden');
 $('feedback').innerHTML='<div class="feedback-head"><strong>'+(ok?'✓ Correct':'Not quite')+'</strong><span>Best answer: <b>'+String.fromCharCode(65+q.correct)+'</b> · '+esc(q.choices[q.correct])+'</span></div><p class="feedback-explanation">'+esc(q.explanation)+'</p><details class="feedback-source"><summary>Source and evidence</summary><p>'+esc(q.source)+' · '+esc(evidenceStatus(q))+'</p>'+courseEvidence(q)+evidenceLink(q)+'</details>';
 $('session').classList.add('has-feedback');
 $('next').textContent=index===session.length-1?'Finish session':'Next question';
}
function advance(){if(index>=session.length-1)finish();else{index++;render();$('session').scrollIntoView({behavior:'auto',block:'start'})}}
function next(){
 if(mode!=='exam'&&!checked){checkAnswer();return}
 if(mode==='exam'&&selected!==null){const q=session[index];answers.push({id:q.id,value:selected,ok:selected===q.correct})}
 advance();
}
function finish(){if(completed)return;completed=true;clearInterval(timer);document.body.classList.remove('quiz-active');const count=answers.length,correct=answers.filter(a=>a.ok).length;
for(const a of answers){let h=history[a.id]||{attempts:0,correct:0,streak:0,due:0};h.attempts++;h.correct+=a.ok?1:0;h.streak=a.ok?h.streak+1:0;h.due=Date.now()+(a.ok?Math.min(30,Math.pow(2,Math.min(h.streak,5)))*86400000:0);history[a.id]=h}save();
$('session').classList.add('hidden');$('summary').classList.remove('hidden');const pct=count?Math.round(correct/count*100):0;
let out='<p class="eyebrow">SESSION COMPLETE</p><h2>'+correct+' / '+count+' correct ('+pct+'%)</h2>';
if(mode==='exam')out+='<p>Exam simulation: feedback was held until the end.'+(deadline?' Recommended timing enabled.':' Untimed.')+'</p>';
if(count<session.length)out+='<p>'+ (session.length-count)+' question(s) unanswered.</p>';
out+='<h3>Answer review</h3>';
out+=answers.map(a=>{const q=questions.find(x=>x.id===a.id);return '<details><summary>'+esc(q.topic)+' · '+(a.ok?'Correct':'Review')+'</summary><p>'+esc(q.stem)+'</p><p><b>Your answer:</b> '+esc(q.choices[a.value])+'</p><p><b>Best answer:</b> '+esc(q.choices[q.correct])+'</p><p>'+esc(q.explanation)+'</p><p class="fine">'+esc(q.source)+' · '+(evidenceStatus(q))+'</p>'+courseEvidence(q)+evidenceLink(q)+'</details>'}).join('');
const remaining=dueQuestions().length;
out+='<div class="actions"><button id="again" class="primary-button">Practise again</button>'+(remaining?'<button id="retryDue" class="quiet-button" type="button">Retry '+remaining+' question'+(remaining===1?'':'s')+' to revisit</button>':'')+'</div>';
$('summary').innerHTML=out;
$('again').addEventListener('click',start);
if(remaining)$('retryDue').addEventListener('click',startDueReview);
$('summary').scrollIntoView({behavior:'smooth',block:'start'});
deadline=0}
const mockWritten=window.D4B_MOCK_WRITTEN;
if(mockWritten&&$('mockWrittenPrompt')&&$('mockWrittenAnswer')){
 $('mockWrittenPrompt').textContent=mockWritten.prompt;
 $('mockWrittenAnswer').textContent=mockWritten.answer;
}
$('module').addEventListener('change',weeks);$('source').addEventListener('change',()=>{if(/^mock-[ABC]$/.test($('source').value)){$('module').value='GEN';$('mode').value='exam';$('count').value='all';$('week').value='all';}weeks();});$('week').addEventListener('change',updateAvailability);$('mode').addEventListener('change',updateAvailability);$('timing').addEventListener('change',updateAvailability);$('count').addEventListener('change',updateAvailability);$('start').addEventListener('click',start);$('reviewDue').addEventListener('click',startDueReview);$('next').addEventListener('click',next);$('stop').addEventListener('click',finish);
$('reset').addEventListener('click',()=>{if(confirm('Delete all quiz history stored in this browser?')){history={};save()}});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'d4b-evidence-quiz-v1',exported:new Date().toISOString(),history},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='d4b-quiz-progress.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('officialImport').addEventListener('change',async function(){
 const file=this.files&&this.files[0];
 if(!file)return;
 const filename=file.name;
 const status=$('importStatus');
 status.textContent='Reading '+filename+'…';
 try{
  if(/\.zip$/i.test(filename)||file.type==='application/zip')throw Error('This is the ZIP archive. Unzip it and choose moodle_exact_import.json, not the inventory file.');
  if(!/\.json$/i.test(filename))throw Error('Please select the Moodle questions .json file, not a ZIP or another file type.');
  if(file.size>500000)throw Error('Maximum JSON import size is 500 KB.');
  let payload;
  try{payload=JSON.parse(await file.text())}catch{throw Error('This is not valid JSON. Choose moodle_exact_import.json from the recovery ZIP.')}
  if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&Array.isArray(payload.records)){
   throw Error('This is the quiz recovery inventory, not the questions. Choose moodle_exact_import.json instead.');
  }
  const items=Array.isArray(payload)?payload:payload&&Array.isArray(payload.questions)?payload.questions:payload&&Array.isArray(payload.items)?payload.items:null;
  if(!items)throw Error('Expected an array of Moodle questions, or an object with a questions/items array.');
  if(items.length===0||items.length>300)throw Error('The file must contain between 1 and 300 questions.');
  for(let i=0;i<items.length;i++){
   const issue=officialValidationError(items[i],i);
   if(issue)throw Error(issue);
  }
  const ids=items.map(q=>q.id);
  if(new Set(ids).size!==ids.length)throw Error('The import file repeats a question ID.');
  const previous=privateQuestions();
  const known=new Map([...builtInQuestions,...previous].map(q=>[q.id,q]));
  const additions=[];let unchanged=0;
  for(const q of items){
   const existing=known.get(q.id);
   if(existing){
    if(JSON.stringify(existing)!==JSON.stringify(q)){
     throw Error('Question '+q.id+' already exists with different content. No changes were made.');
    }
    unchanged++;
   }else{
    additions.push(q);
   }
  }
  if(additions.length){
   try{localStorage.setItem(privateKey,JSON.stringify([...previous,...additions]));}
   catch{throw Error('The browser could not save the imported questions. Check storage permissions or free some space.')}
  }
  refreshQuestions();
  status.textContent=filename+': '+additions.length+' question(s) imported, '+unchanged+' already present. '+privateQuestions().length+' private question(s) on this device. No upload occurred.';
 }catch(e){
  status.textContent=filename+': import rejected. '+e.message+' No existing private questions were changed.';
 }finally{
  this.value='';
 }
});
$('clearOfficial').addEventListener('click',()=>{if(confirm('Delete locally imported official questions?')){localStorage.removeItem(privateKey);$('importStatus').textContent='Local official quiz import cleared.';refreshQuestions()}});
$('exportOfficialTemplate').addEventListener('click',()=>{
 const sample=[{id:'official-gen-w1-example-001',module:'GEN',week:1,topic:'Replace with topic',stem:'Replace this with the complete original question wording.',choices:['Answer A','Answer B','Answer C','Answer D'],correct:0,explanation:'Explain with evidence from a course source.',source:'Moodle / Generative AI / W1 / quiz title',origin:'official-moodle',verification:'key-pending'}];
 const url=URL.createObjectURL(new Blob([JSON.stringify(sample,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='d4b-official-quiz-import-template.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
refreshQuestions();
$('importStatus').textContent=privateQuestions().length+' Moodle question(s) stored privately on this device. Choose a JSON file to add more.';
})();