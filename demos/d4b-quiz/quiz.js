(()=>{'use strict';
const questions=window.D4B_QUESTIONS||[];
const curriculum=window.D4B_CURRICULUM||{};
const key='d4b-evidence-quiz-progress-v1';
const $=id=>document.getElementById(id);
const read=()=>{try{return JSON.parse(localStorage.getItem(key))||{}}catch{return {}}};
let history=read(),session=[],index=0,answers=[],deadline=0,timer=null,mode='adaptive',completed=false,selected=null,checked=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
 $('availability').textContent=n+' available for this selection · '+questions.length+' in the complete bank'+(n<requested?' · choose '+n+' or fewer questions':'');
 $('start').disabled=n===0||requested>n;
 $('start').title=n===0?'No questions available':requested>n?'Choose a smaller session size':'';
}
function shuffle(items){return items.map(q=>({q,k:Math.random()})).sort((a,b)=>a.k-b.k).map(x=>x.q)}
function select(){const now=Date.now(),p=pool();if(mode==='mistakes')return shuffle(p.filter(q=>history[q.id]&&history[q.id].correct<history[q.id].attempts));if(mode==='exam')return shuffle(p);return [...p].sort((a,b)=>{let x=history[a.id],y=history[b.id];let sx=x?(x.due<=now?-100000000:0)+x.due: -200000000;let sy=y?(y.due<=now?-100000000:0)+y.due:-200000000;return sx-sy+(Math.random()-.5)*1000})}
function updateClock(){if(!deadline)return;const ms=Math.max(0,deadline-Date.now());$('clock').textContent=Math.floor(ms/60000)+':'+String(Math.floor(ms%60000/1000)).padStart(2,'0');if(ms===0)finish()}
function start(){mode=$('mode').value;const requested=$('count').value==='all'?eligible().length:Number($('count').value);if(requested>eligible().length){updateAvailability();return}session=select().slice(0,requested);if(!session.length){$('summary').classList.remove('hidden');$('summary').textContent='No questions available for these filters. Try another module or practice mode.';return}answers=[];index=0;completed=false;$('summary').classList.add('hidden');$('session').classList.remove('hidden');deadline=mode==='exam'?Date.now()+Math.round(session.length*90*1000):0;clearInterval(timer);$('clock').textContent='';if(deadline){updateClock();timer=setInterval(updateClock,1000)}render();$('session').scrollIntoView({behavior:'smooth',block:'start'})}
function render(){selected=null;checked=false;const q=session[index];$('position').textContent='Question '+(index+1)+' of '+session.length;$('bar').style.width=(index/session.length*100)+'%';$('topic').textContent=q.module+' / WEEK '+String(q.week).padStart(2,'0')+' / '+q.topic;$('prompt').textContent=q.stem;$('feedback').classList.add('hidden');$('feedback').replaceChildren();$('next').disabled=true;$('next').textContent=mode==='exam'?(index===session.length-1?'Finish session':'Next question'):'Check answer';$('choices').replaceChildren(...q.choices.map((answer,i)=>{let b=document.createElement('button');b.type='button';b.textContent=String.fromCharCode(65+i)+'. '+answer;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>choose(i));return b}))}
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
 $('feedback').innerHTML='<strong>'+(ok?'Correct.':'Not quite.')+'</strong><p>'+esc(q.explanation)+'</p><small>Study source: '+esc(q.source)+'</small>';
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
out+=answers.map(a=>{const q=questions.find(x=>x.id===a.id);return '<details><summary>'+esc(q.topic)+' · '+(a.ok?'Correct':'Review')+'</summary><p>'+esc(q.stem)+'</p><p><b>Your answer:</b> '+esc(q.choices[a.value])+'</p><p><b>Best answer:</b> '+esc(q.choices[q.correct])+'</p><p>'+esc(q.explanation)+'</p><p class="fine">'+esc(q.source)+'</p></details>'}).join('');
out+='<div class="actions"><button id="again" class="primary-button">Practise again</button></div>';$('summary').innerHTML=out;$('again').addEventListener('click',start);$('summary').scrollIntoView({behavior:'smooth',block:'start'});deadline=0}
$('module').addEventListener('change',weeks);$('week').addEventListener('change',updateAvailability);$('mode').addEventListener('change',updateAvailability);$('count').addEventListener('change',updateAvailability);$('start').addEventListener('click',start);$('next').addEventListener('click',next);$('stop').addEventListener('click',finish);
$('reset').addEventListener('click',()=>{if(confirm('Delete all quiz history stored in this browser?')){history={};save()}});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'d4b-evidence-quiz-v1',exported:new Date().toISOString(),history},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='d4b-quiz-progress.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
weeks();stats();
})();