'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const home=path.resolve(__dirname,'..');
const workflow=fs.readFileSync(path.join(home,'.github/workflows/d4b-refresh.yml'),'utf8');
const html=fs.readFileSync(path.join(home,'demos/d4b-quiz/index.html'),'utf8');
const sw=fs.readFileSync(path.join(home,'demos/d4b-quiz/service-worker.js'),'utf8');
const client=fs.readFileSync(path.join(home,'demos/d4b-quiz/refresh.js'),'utf8');

assert.match(workflow,/^  schedule:\s*$/m,'Daily source check must be scheduled');
assert.match(workflow,/cron:\s*'23 6 \* \* \*'/,'Unexpected schedule');
assert.match(workflow,/^  push:\s*$/m,'Changes to reviewed quiz material should trigger audit');
assert.match(workflow,/branches: \[master\]/,'Only production should trigger production refresh');
assert.match(workflow,/github\.event_name != 'pull_request'/,'PRs may not publish a consolidation');
assert.doesNotMatch(workflow,/^\s+- 'demos\/d4b-quiz\/consolidation\.json'\s*$/m,'Generated reports must not trigger themselves');
assert.match(client,/raw\.githubusercontent\.com\/salmonofdoubt\/salmonofdoubt\.github\.io\/master\/demos\/d4b-quiz\/consolidation\.json/,
 'Read the current GitHub consolidation report rather than only an old Pages copy');
assert.match(client,/\.\/consolidation\.json/,'Offline/availability fallback must exist');
assert.match(client,/runs\?branch=master/,'Show production workflow runs');
assert.doesNotMatch(client,/runs\?event=workflow_dispatch/,'Manual-only filter must not return');
assert.match(html,/GitHub checks public sources and staged questions automatically/,'Describe public source and staged question checks');
assert.match(html,/does not read changes in your private Google Drive/,'Avoid claiming that GitHub Actions can ingest private Drive material');
assert.doesNotMatch(html,/<strong>Run workflow<\/strong>/,'Do not require the user to click Run workflow');

function assetVersion(contents,asset){
 const escaped=asset.replaceAll('.','\\.');
 const matches=[...contents.matchAll(new RegExp(escaped+'\\?v=([^"\\x27\\s]+)','g'))];
 assert.equal(matches.length,1,'Exactly one cache-busted reference required for '+asset);
 const version=matches[0][1];
 assert.match(version,/^[a-zA-Z0-9-]+$/,'Invalid cache-busted version for '+asset);
 return version;
}
function verifyCache(index,worker){
 // Every cached first-party asset has to match what the HTML actually loads.
 for(const asset of ['styles.css','app.js','site-config.js','quiz.css','questions.js','quiz.js','refresh.js']){
  assert.equal(assetVersion(index,asset),assetVersion(worker,asset),
   asset+' URL must match between HTML and service worker');
 }
 const cache=worker.match(/^const CACHE_NAME = '([^']+)';$/m)?.[1];
 assert.ok(cache,'Missing PWA cache name');
 assert.match(cache,/^salmon-d4b-evidence-quiz-[a-z0-9-]+$/,
  'Cache must be versioned and scoped to this PWA');
 const bank=assetVersion(index,'questions.js');
 // The ingestion pipeline currently makes the bank fingerprint the cache
 // identity. Other cache names from reviewed UI-only releases remain valid.
 if(cache.startsWith('salmon-d4b-evidence-quiz-bank-')){
  assert.equal(cache,'salmon-d4b-evidence-quiz-'+bank,
   'A bank-named cache must correspond to the actual linked question bank');
 }
 return cache;
}
const installedCache=verifyCache(html,sw);

// Regression case: a future bank rebuild may alter BOTH the bank asset
// version and the PWA cache identity without editing this test.
const currentBankVersion=assetVersion(html,'questions.js');
const nextBankVersion='bank-abcdef0123';
const testHtml=html.replace('questions.js?v='+currentBankVersion,'questions.js?v='+nextBankVersion);
const testWorker=sw
 .replace('questions.js?v='+currentBankVersion,'questions.js?v='+nextBankVersion)
 .replace(/^const CACHE_NAME = '[^']+';/m,
  "const CACHE_NAME = 'salmon-d4b-evidence-quiz-"+nextBankVersion+"';");
assert.notEqual(verifyCache(testHtml,testWorker),installedCache,
 'A changed bank must cause a changed PWA cache identity');

const staleWorker=sw.replace('questions.js?v='+currentBankVersion,'questions.js?v=bank-stale12345');
assert.throws(()=>verifyCache(html,staleWorker),/questions\.js URL must match/);
const staleCache=sw.replace(/^const CACHE_NAME = '[^']+';/m,
 "const CACHE_NAME = 'salmon-d4b-evidence-quiz-bank-stale12345';");
assert.throws(()=>verifyCache(html,staleCache),/bank-named cache must correspond/);

new Function(client);
console.log('PASS: automatic triggers, source metadata, matching PWA URLs, dynamic cache identity and stale-cache regression cases.');
