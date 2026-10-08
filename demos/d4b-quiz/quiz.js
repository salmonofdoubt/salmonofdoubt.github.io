(()=>{'use strict';
const builtInQuestions=window.D4B_QUESTIONS||[];
let questions=[...builtInQuestions];
const privateKey='d4b-private-moodle-quiz-v1';
const curriculum=window.D4B_CURRICULUM||{};
const key='d4b-evidence-quiz-progress-v1';
const $=id=>document.getElementById(id);
const read=()=>{try{return JSON.parse(localStorage.getItem(key))||{}}catch{return {}}};
function validOfficial(q){return q&&typeof q.id==='string'&&/^official-[a-z0-9-]{1,70}$/.test(q.id)&&['GEN','AIB','INN','DTR'].includes(q.module)&&Number.isInteger(q.week)&&q.week>0&&q.week<=(curriculum[q.module]||[]).length&&typeof q.topic==='string'&&typeof q.stem==='string'&&q.stem.length>=10&&Array.isArray(q.choices)&&q.choices.length===4&&q.choices.every(x=>typeof x==='string'&&x.trim())&&Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4&&typeof q.explanation==='string'&&q.explanation.length>=8&&typeof q.source==='string'&&q.source.length>=5&&q.origin==='official-moodle'&&['key-pending','official-key-confirmed'].includes(q.verification)}
function privateQuestions(){try{const a=JSON.parse(localStorage.getItem(privateKey)||'[]');return Array.isArray(a)?a.filter(validOfficial):[]}catch{return []}}
function refreshQuestions(){questions=[...builtInQuestions,...privateQuestions()];weeks();stats()}
let history=read(),session=[],index=0,answers=[],deadline=0,timer=null,mode='adaptive',completed=false,selected=null,checked=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function evidenceLink(q){const u=q.evidence?.url;return typeof u==='string'&&/^https:\/\//.test(u)?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">Independently checked reference</a>':''}
function save(){try{localStorage.setItem(key,JSON.stringify(history))}catch(e){console.warn('Progress cannot be stored',e)}stats()}
function stats(){let records=Object.values(history),total=records.reduce((n,x)=>n+x.attempts,0),correct=records.reduce((n,x)=>n+x.correct,0);$('attempts').textContent=total;$('accuracy').textContent=total?Math.round(correct/total*100)+'%':'—';$('due').textContent=questions.filter(q=>history[q.id]&&history[q.id].due<=Date.now()).length;$('bank').textContent=questions.length;updateAvailability()}
function weeks(){
 const m=$('module').value,chosen=$('week').value;
 const keys=m==='all'?Object.keys(curriculum):[m];
 const distinct=[...new Set(keys.flatMap(k=>(curriculum[k]||[]).map((_,i)=>i+1)))].sort((a,b)=>a-b);
 $('week').replaceChildren(new Option('All documented weeks','all'),...distinct.map(w=>{
 const filtered=questions.filter(q=>(m==='all'||q.module===m)&&q.week===w);
 return new Option('Week '+String(w).padStart(2,'0')+' · '+filtered.length+' questions',String(w));
 }));
 $('week').value=distinct.some(x=>String(x)===chosen)?chosen:'all';
 updateAvailability();
}
function pool(){return questions.filter(q=>($('module').value==='all'||q.module===$('module').value)&&($('week').value==='all'||q.week===Number($('week').value)))}
function eligible(){
 const p=pool();
 return $('mode').value==='mistakes'?p.filter(q=>history[q.id]&&history[q.id].correct<history[q.id].attempts):p;
}
function updateAvailability(){
 const n=eligible().length,requested=$('count').value==='all'?n:Number($('count').value);
 const pending=eligible().filter(q=>q.verification!=='verified').length;
 $('availability').textContent=n+' available for this selection · '+questions.length+' total · '+pending+' awaiting independent verification'+(n<requested?' · choose '+n+' or fewer questions':'');
 $('start').disabled=n===0||requested>n;
 $('start').title=n===0?'No questions available':requested>n?'Choose a smaller session size':'';
}
function shuffle(items){return items.map(q=>({q,k:Math.random()})).sort((a,b)=>a.k-b.k).map(x=>x.q)}
function select(){const now=Date.now(),p=pool();if(mode==='mistakes')return shuffle(p.filter(q=>history[q.id]&&history[q.id].correct<history[q.id].attempts));if(mode==='exam')return shuffle(p);return [...p].sort((a,b)=>{let x=history[a.id],y=history[b.id];let sx=x?(x.due<=now?-100000000:0)+x.due: -200000000;let sy=y?(y.due<=now?-100000000:0)+y.due:-200000000;return sx-sy+(Math.random()-.5)*1000})}
function updateClock(){if(!deadline)return;const ms=Math.max(0,deadline-Date.now());$('clock').textContent=Math.floor(ms/60000)+':'+String(Math.floor(ms%60000/1000)).padStart(2,'0');if(ms===0)finish()}
function start(){mode=$('mode').value;const requested=$('count').value==='all'?eligible().length:Number($('count').value);if(requested>eligible().length){updateAvailability();return}session=select().slice(0,requested);if(!session.length){$('summary').classList.remove('hidden');$('summary').textContent='No questions available for these filters. Try another module or practice mode.';return}answers=[];index=0;completed=false;$('summary').classList.add('hidden');$('session').classList.remove('hidden');deadline=mode==='exam'?Date.now()+Math.round(session.length*90*1000):0;clearInterval(timer);$('clock').textContent='';if(deadline){updateClock();timer=setInterval(updateClock,1000)}render();$('session').scrollIntoView({behavior:'smooth',block:'start'})}
function render(){selected=null;checked=false;const q=session[index];$('position').textContent='Question '+(index+1)+' of '+session.length;$('bar').style.width=(index/session.length*100)+'%';$('topic').textContent=q.module+' / WEEK '+String(q.week).padStart(2,'0')+' / '+q.topic+' / '+(q.origin==='official-moodle'?'Moodle original':'Booklet-derived')+' / '+(q.verification==='verified'?'Independently verified':q.verification==='official-key-confirmed'?'Official key recorded':'Verification pending');$('prompt').textContent=q.stem;$('feedback').classList.add('hidden');$('feedback').replaceChildren();$('next').disabled=true;$('next').textContent=mode==='exam'?(index===session.length-1?'Finish session':'Next question'):'Check answer';$('choices').replaceChildren(...q.choices.map((answer,i)=>{let b=document.createElement('button');b.type='button';b.textContent=String.fromCharCode(65+i)+'. '+answer;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>choose(i));return b}))}
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
 $('feedback').innerHTML='<strong>'+(ok?'Correct.':'Not quite.')+'</strong><p>'+esc(q.explanation)+'</p><small>Study source: '+esc(q.source)+' · '+(q.verification==='verified'?'Independently checked':'Original-source audit pending')+'</small><p>'+evidenceLink(q)+'</p>';
 $('next').textContent=index===session.length-1?'Finish session':'Next question';
}
function advance(){if(index>=session.length-1)finish();else{index++;render()}}
function next(){
 if(mode!=='exam'&&!checked){checkAnswer();return}
 if(mode==='exam'&&selected!==null){const q=session[index];answers.push({id:q.id,value:selected,ok:selected===q.correct})}
 advance();
}
function finish(){if(completed)return;completed=true;clearInterval(timer);const count=answers.length,correct=answers.filter(a=>a.ok).length;
for(const a of answers){let h=history[a.id]||{attempts:0,correct:0,streak:0,due:0};h.attempts++;h.correct+=a.ok?1:0;h.streak=a.ok?h.streak+1:0;h.due=Date.now()+(a.ok?Math.min(30,Math.pow(2,Math.min(h.streak,5)))*86400000:0);history[a.id]=h}save();
$('session').classList.add('hidden');$('summary').classList.remove('hidden');const pct=count?Math.round(correct/count*100):0;
let out='<p class="eyebrow">SESSION COMPLETE</p><h2>'+correct+' / '+count+' correct ('+pct+'%)</h2>';
if(mode==='exam')out+='<p>Timed exam simulation. Feedback was held until the end.</p>';
if(count<session.length)out+='<p>'+ (session.length-count)+' question(s) unanswered.</p>';
out+='<h3>Answer review</h3>';
out+=answers.map(a=>{const q=questions.find(x=>x.id===a.id);return '<details><summary>'+esc(q.topic)+' · '+(a.ok?'Correct':'Review')+'</summary><p>'+esc(q.stem)+'</p><p><b>Your answer:</b> '+esc(q.choices[a.value])+'</p><p><b>Best answer:</b> '+esc(q.choices[q.correct])+'</p><p>'+esc(q.explanation)+'</p><p class="fine">'+esc(q.source)+' · '+(q.verification==='verified'?'Independently checked':'Original-source audit pending')+'</p>'+evidenceLink(q)+'</details>'}).join('');
out+='<div class="actions"><button id="again" class="primary-button">Practise again</button></div>';$('summary').innerHTML=out;$('again').addEventListener('click',start);$('summary').scrollIntoView({behavior:'smooth',block:'start'});deadline=0}
$('module').addEventListener('change',weeks);$('week').addEventListener('change',updateAvailability);$('mode').addEventListener('change',updateAvailability);$('count').addEventListener('change',updateAvailability);$('start').addEventListener('click',start);$('next').addEventListener('click',next);$('stop').addEventListener('click',finish);
$('reset').addEventListener('click',()=>{if(confirm('Delete all quiz history stored in this browser?')){history={};save()}});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'d4b-evidence-quiz-v1',exported:new Date().toISOString(),history},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='d4b-quiz-progress.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('officialImport').addEventListener('change',async function(){
 const file=this.files&&this.files[0];this.value='';if(!file)return;
 try{
 if(file.size>500000)throw Error('Maximum import size 500 KB.');
 const items=JSON.parse(await file.text());
 if(!Array.isArray(items)||!items.length||items.length>300||!items.every(validOfficial))throw Error('Incorrect JSON format. Download the template and check required fields.');
 const old=privateQuestions(),ids=items.map(q=>q.id),used=new Set([...old,...builtInQuestions].map(q=>q.id));
 if(new Set(ids).size!==ids.length||ids.some(id=>used.has(id)))throw Error('Question IDs must be unique.');
 localStorage.setItem(privateKey,JSON.stringify([...old,...items]));
 $('importStatus').textContent=items.length+' official quiz questions imported locally. No questions uploaded.';
 refreshQuestions();
 }catch(e){$('importStatus').textContent='Import failed: '+e.message}
});
$('clearOfficial').addEventListener('click',()=>{if(confirm('Delete locally imported official questions?')){localStorage.removeItem(privateKey);$('importStatus').textContent='Local official quiz import cleared.';refreshQuestions()}});
$('exportOfficialTemplate').addEventListener('click',()=>{
 const sample=[{id:'official-gen-w1-example-001',module:'GEN',week:1,topic:'Replace with topic',stem:'Replace this with the complete original question wording.',choices:['Answer A','Answer B','Answer C','Answer D'],correct:0,explanation:'Explain with evidence from a course source.',source:'Moodle / Generative AI / W1 / quiz title',origin:'official-moodle',verification:'key-pending'}];
 const url=URL.createObjectURL(new Blob([JSON.stringify(sample,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='d4b-official-quiz-import-template.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
refreshQuestions();
})();