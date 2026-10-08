'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../demos/d4b-quiz/quiz.js'),'utf8');

function harness(){
 const elements=new Map(),storage=new Map();
 const create=id=>{
  const el={id,value:'all',textContent:'',files:[],handlers:{},style:{},title:'',
   disabled:false,children:[],
   classList:{add(){},remove(){},toggle(){}},
   addEventListener(event,fn){this.handlers[event]=fn;},
   replaceChildren(...children){this.children=children;},
   setAttribute(){},scrollIntoView(){},
  };
  if(id==='count')el.value='all';
  return el;
 };
 const $=id=>{if(!elements.has(id))elements.set(id,create(id));return elements.get(id)};
 const storageAPI={
  getItem:key=>storage.has(key)?storage.get(key):null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
 };
 const environment={
  window:{D4B_QUESTIONS:[],D4B_CURRICULUM:{GEN:['Introduction'],AIB:['One','Two','Three','Four','Five'],INN:['One'],DTR:['One']}},
  document:{getElementById:$},
  localStorage:storageAPI,
  Option:function(label,value){return {label,value}},
  console,Date,Math,JSON,Set,Map,Number,String,Array,
  confirm:()=>true
 };
 vm.runInNewContext(source,environment,{filename:'quiz.js'});
 return {el:$,storage,async load(name,payload,type='application/json'){
  const data=typeof payload==='string'?payload:JSON.stringify(payload);
  const input=$('officialImport');
  input.files=[{name,size:Buffer.byteLength(data),type,text:async()=>data}];
  await input.handlers.change.call(input);
  return $('importStatus').textContent;
 }};
}
const item={
 id:'official-aib-w5-example-001',module:'AIB',week:5,topic:'Oversight',
 stem:'What is one responsibility of effective AI oversight?',
 choices:['Review and intervene','Ignore decisions','Disable audits','Discard evidence'],
 correct:0,explanation:'An effective reviewer can examine and intervene.',
 source:'AIB course quiz W5',origin:'official-moodle',verification:'key-pending'
};
(async()=>{
 const t=harness();
 assert.match(await t.load('quiz_recovery_inventory.json',{records:[{week:5}]}),/recovery inventory/);
 assert.equal(t.storage.size,0,'inventory must not write private data');
 assert.match(await t.load('D4B_Private_Quiz_Recovery.zip','not json','application/zip'),/ZIP archive/);
 assert.match(await t.load('wrong_file.txt','not json','text/plain'),/Please select/);
 assert.match(await t.load('malformed.json','not-json'),/not valid JSON/);
 assert.match(await t.load('bad_question.json',[{...item,choices:['A','B','C']}]),/four nonempty/);
 assert.equal(t.storage.size,0,'invalid imports must not alter storage');
 assert.match(await t.load('moodle_exact_import.json',[item]),/1 question\(s\) imported/);
 let actual=JSON.parse(t.storage.get('d4b-private-moodle-quiz-v1'));
 assert.equal(actual.length,1);
 assert.match(await t.load('moodle_exact_import.json',[item]),/1 already present/);
 actual=JSON.parse(t.storage.get('d4b-private-moodle-quiz-v1'));
 assert.equal(actual.length,1,'repeat import must be idempotent');
 assert.match(await t.load('moodle_exact_import.json',[{...item,stem:'A different question with the same ID'}]),/different content/);
 actual=JSON.parse(t.storage.get('d4b-private-moodle-quiz-v1'));
 assert.equal(actual.length,1,'conflicting import must not overwrite old data');
 const second={...item,id:'official-aib-w5-example-002',stem:'What else is needed for human oversight?'};
 assert.match(await t.load('envelope.json',{questions:[second]}),/1 question\(s\) imported/);
 actual=JSON.parse(t.storage.get('d4b-private-moodle-quiz-v1'));
 assert.equal(actual.length,2,'envelope input must be supported');
 assert.match(t.el('importStatus').textContent,/2 private question\(s\)/);
 console.log('PASS: recovery inventory, ZIP, invalid JSON, malformed options, valid import, repeat import, ID conflict, JSON envelope, data preservation.');
})().catch(e=>{console.error(e);process.exitCode=1});
