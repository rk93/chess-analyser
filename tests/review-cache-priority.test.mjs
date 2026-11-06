import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheGet,cacheSet} from '../js/analysis-store.js';
const native=(depth='fast',version=21)=>({version:7,verifiedReviewVersion:1,localStockfishVersion:version,reviewDepthKey:depth,evals:[12,34]});

test('a delayed legacy preview cannot downgrade a saved verified review or its depth metadata',async()=>{
  const key='priority-preview',review=native();await cacheSet('review',key,{version:7,evals:[0,0]});await cacheSet('review',key,review);
  assert.equal(await cacheSet('review',key,{version:7,evals:[0,0]}),review);assert.equal(await cacheGet('review',key),review);
  assert.equal((await cacheGet('review',key)).reviewDepthKey,'fast');
});
test('native reanalysis remains writable while an older native engine version cannot overwrite a newer one',async()=>{
  const key='priority-version';await cacheSet('review',key,native());const deeper=native('deep');await cacheSet('review',key,deeper);assert.equal(await cacheGet('review',key),deeper);
  const newer=native('fast',22);await cacheSet('review',key,newer);await cacheSet('review',key,native());assert.equal(await cacheGet('review',key),newer);
});
test('explicit cache clearing and unrelated public/position caches preserve their existing semantics',async()=>{
  const key='priority-clear';await cacheSet('review',key,native());await cacheSet('review',key,null);assert.equal(await cacheGet('review',key),null);
  const preview={version:7,evals:[0]};await cacheSet('review',key,preview);assert.equal(await cacheGet('review',key),preview);
  await cacheSet('position',key,native());await cacheSet('position',key,preview);assert.equal(await cacheGet('position',key),preview);
});
test('a concurrent preview lookup cannot replace a native review that arrives before it completes',async()=>{
  const key='priority-concurrent',review=native();const old=cacheSet('review',key,{version:7,evals:[0]});const fresh=cacheSet('review',key,review);
  await Promise.all([old,fresh]);assert.equal(await cacheGet('review',key),review);
});
