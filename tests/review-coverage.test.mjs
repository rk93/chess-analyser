import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCoverage,assertEngineCoverage,VERIFIED_REVIEW_VERSION} from '../js/review-coverage.js';
const positions=[{terminal:false},{terminal:false},{terminal:true}];
function full(){return {verifiedReviewVersion:VERIFIED_REVIEW_VERSION,evals:[12,30,100000],bestMoves:['e2e4','e7e5',''],positionExact:[true,true,true],localDepths:[16,16,99]}}
test('all genuinely evaluated positions pass coverage',()=>assert.equal(reviewCoverage(full(),positions).complete,true));
test('estimated evaluation is never verified',()=>{const x=full();x.positionExact[1]=false;assert.deepEqual(reviewCoverage(x,positions).missing,[1])});
test('missing engine best move prevents completion',()=>{const x=full();x.bestMoves[1]='';assert.deepEqual(reviewCoverage(x,positions).missing,[1]);assert.throws(()=>assertEngineCoverage({evals:x.evals,bestMoves:x.bestMoves,depths:x.localDepths},positions))});
test('missing depth prevents completion',()=>{const x=full();x.localDepths[1]=0;assert.equal(reviewCoverage(x,positions).complete,false)});
test('legacy caches are not silently accepted as complete',()=>{const x=full();delete x.verifiedReviewVersion;assert.equal(reviewCoverage(x,positions).complete,false)});
test('terminal position does not require a best move',()=>assert.equal(reviewCoverage(full(),positions).complete,true));
