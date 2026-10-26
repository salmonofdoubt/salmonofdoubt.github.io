#!/usr/bin/env node
'use strict';
/* Legacy records are maintained as an unpublished archive, not as art-gallery content. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=__dirname,ledger=JSON.parse(fs.readFileSync(path.join(dir,'evidence.json'),'utf8'));
assert.equal(ledger.exercises.length,34,'Historical ledger size changed');
for(const [i,item] of ledger.exercises.entries()){
 assert.equal(item.order,i+1,'Historical ordering altered');
 assert.ok(item.source?.url?.startsWith('https://'),'Historical source URL missing');
}
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
assert.doesNotMatch(html,/onlinepilatesclasses\.com|class="exercise"|id="ex-\d+"/,'Legacy instructional material must not be published');
console.log('MetaForma archived research: PASS (34 historical entries retained, none presented as instruction).');
