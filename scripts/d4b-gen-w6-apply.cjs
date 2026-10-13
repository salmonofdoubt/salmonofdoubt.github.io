'use strict';
// Assemble newly reviewed originals into the canonical static bank.
// Idempotent: preserve all old IDs, existing question wording and browser history.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'demos/d4b-quiz');
const {parseBank,parseCurriculum}=require('./d4b-consolidate.cjs');
const extension=fs.readFileSync(path.join(dir,'questions-w6.js'),'utf8');
const start='window.D4B_W6=Object.freeze(',end=');\nwindow.D4B_CURRICULUM=Object.freeze(';
const i=extension.indexOf(start),j=extension.indexOf(end,i+start.length);
if(i<0||j<0)throw Error('Week 6 original-question source is malformed');
const data=JSON.parse(extension.slice(i+start.length,j));
if(!Array.isArray(data.questions)||data.questions.length!==7||data.questions.some(q=>q.module!=='GEN'||q.week!==6))throw Error('Unexpected Week 6 release population');
const bankPath=path.join(dir,'questions.js');
let code=fs.readFileSync(bankPath,'utf8'),bank=parseBank(code),curriculum=parseCurriculum(code);
const oldIds=new Set(bank.list.map(q=>q.id)),incoming=data.questions.map(q=>q.id);
if(new Set(incoming).size!==7)throw Error('Duplicate Week 6 IDs');
const already=data.questions.filter(q=>oldIds.has(q.id));
if(already.length!==0&&already.length!==data.questions.length)throw Error('Partial Week 6 publication: inspect manually');
if(already.length===data.questions.length){
 for(const q of data.questions){const old=bank.list.find(x=>x.id===q.id);if(old.stem!==q.stem||old.correct!==q.correct)throw Error('Existing stable question changed: '+q.id)}
 if(curriculum.GEN[5]!==data.curriculum.GEN[0])throw Error('Published Week 6 curriculum mismatch');
}else{
 if(curriculum.GEN.length!==5||!code.includes('"Prompt Engineering"\n  ],'))throw Error('Unexpected Generative AI curriculum: do not overwrite');
 code=code.replace('"Prompt Engineering"\n  ],','"Prompt Engineering",\n    '+JSON.stringify(data.curriculum.GEN[0])+'\n  ],');
 bank=parseBank(code);
 const fresh=JSON.stringify([...bank.list,...data.questions],null,2);
 code=code.slice(0,bank.start)+fresh+code.slice(bank.end);
 fs.writeFileSync(bankPath,code);
 console.log('Assembled GEN Week 6: '+incoming.join(', '));
}
const version='bank-'+crypto.createHash('sha256').update(code).digest('hex').slice(0,10);
const htmlPath=path.join(dir,'index.html'),swPath=path.join(dir,'service-worker.js');
let html=fs.readFileSync(htmlPath,'utf8'),sw=fs.readFileSync(swPath,'utf8');
html=html.replace(/(questions\\.js\\?v=)[^"]+/g,'$1'+version).replace(/Build 2026\\.10\\.12\\.1/g,'Build 2026.10.13.1');
sw=sw.replace(/(questions\\.js\\?v=)[^']+/g,'$1'+version).replace(/(const CACHE_NAME = ')[^']+(')/,'$1salmon-d4b-evidence-quiz-'+version+'$2');
if(!html.includes('questions.js?v='+version)||!sw.includes('questions.js?v='+version))throw Error('Cache version sync failed');
fs.writeFileSync(htmlPath,html);fs.writeFileSync(swPath,sw);
console.log('Bank version '+version+'; no private material published.');
