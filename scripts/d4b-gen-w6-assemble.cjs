'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../demos/d4b-quiz');
const {parseBank,parseCurriculum}=require('./d4b-consolidate.cjs');
const source=fs.readFileSync(path.join(dir,'questions-w6.js'),'utf8');
const start='window.D4B_W6=Object.freeze(',end=');\nwindow.D4B_CURRICULUM=Object.freeze(';
const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
if(i<0||j<0)throw Error('Week 6 source malformed');
const data=JSON.parse(source.slice(i+start.length,j));
if(data.questions.length!==7||data.questions.some(q=>q.module!=='GEN'||q.week!==6))throw Error('Unexpected Week 6 release');
const bankPath=path.join(dir,'questions.js');
let code=fs.readFileSync(bankPath,'utf8'),bank=parseBank(code),curriculum=parseCurriculum(code);
const present=data.questions.filter(q=>bank.list.some(x=>x.id===q.id));
if(present.length!==0&&present.length!==7)throw Error('Partial Week 6 release');
if(present.length===7){
 for(const q of data.questions){const p=bank.list.find(x=>x.id===q.id);if(p.stem!==q.stem||p.correct!==q.correct)throw Error('Stable ID collision '+q.id)}
 if(curriculum.GEN[5]!==data.curriculum.GEN[0])throw Error('Week 6 curriculum mismatch');
}else{
 if(curriculum.GEN.length!==5||!code.includes('"Prompt Engineering"\n  ],'))throw Error('Unexpected curriculum');
 code=code.replace('"Prompt Engineering"\n  ],','"Prompt Engineering",\n    '+JSON.stringify(data.curriculum.GEN[0])+'\n  ],');
 bank=parseBank(code);
 code=code.slice(0,bank.start)+JSON.stringify([...bank.list,...data.questions],null,2)+code.slice(bank.end);
 fs.writeFileSync(bankPath,code);
 console.log('Added '+data.questions.map(q=>q.id).join(', '));
}
const version='bank-'+crypto.createHash('sha256').update(code).digest('hex').slice(0,10);
const indexPath=path.join(dir,'index.html'),swPath=path.join(dir,'service-worker.js');
let html=fs.readFileSync(indexPath,'utf8'),sw=fs.readFileSync(swPath,'utf8');
html=html.replace(/questions[.]js[?]v=[a-zA-Z0-9-]+/g,'questions.js?v='+version).replace('Build 2026.10.12.1','Build 2026.10.13.1');
sw=sw.replace(/questions[.]js[?]v=[a-zA-Z0-9-]+/g,'questions.js?v='+version).replace(/(const CACHE_NAME = ')[^']+(')/,'$1salmon-d4b-evidence-quiz-'+version+'$2');
if(!html.includes('questions.js?v='+version)||!sw.includes('questions.js?v='+version))throw Error('Cache sync failed');
fs.writeFileSync(indexPath,html);fs.writeFileSync(swPath,sw);
console.log('Bank version '+version);
