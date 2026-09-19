import test from 'node:test';import assert from 'node:assert/strict';
import {train,passes,prepareAnalysis,uniqueObservations,type Observation} from '../src/lib/predict/model';
const row=(memberId:string,genre:string,submitterId:string,rating:number,i:number,meeting=1):Observation=>({ballotId:'ballot-'+meeting,meeting,memberId,genre,submitterId,rating,bookId:'book-'+i});
const golden=[row('A','G','A',5,1),row('A','H','B',3,2),row('B','G','A',1,1),row('B','H','B',3,2)];
test('additive model preserves member, genre, recommender and pooled self effects',()=>{
 assert.equal(passes.length,6);const model=train(golden,passes[3].weights);
 assert.equal(model.globalMean,3);assert.ok(Math.abs(model.predict('A','G','A')-141/35)<1e-12);
 assert.ok(Math.abs(model.predict('A','H','B')-221/70)<1e-12);
 assert.equal(model.predict('C','G','A'),3);assert.equal(model.predict('C','G','C'),3.4);
 assert.equal(train([],passes[0].weights).predict('C',null,null),3);
});
test('ballot/member/book identity deduplicates exact observations and rejects conflicts',()=>{
 assert.equal(uniqueObservations([...golden,...golden]).length,4);
 assert.equal(uniqueObservations([...golden,...golden.map(r=>({...r,ballotId:'another',meeting:2}))]).length,8);
 assert.throws(()=>uniqueObservations([...golden,{...golden[0],rating:1}]),/conflicting/i);
});
test('target and later outcomes cannot affect model selection, scores or predictions',()=>{
 const history=Array.from({length:8},(_,i)=>golden.map(r=>({...r,ballotId:'b'+i,meeting:i+1,rating:1+(r.rating+i)%5}))).flat();
 const a=prepareAnalysis(history,6),b=prepareAnalysis(history.map(r=>r.meeting>=6?{...r,rating:5}:r),6);
 assert.deepEqual(a,b);
 const finalBallot=a.evaluationBallots[0];
 const changed=prepareAnalysis(history.map(r=>r.ballotId===finalBallot?{...r,rating:1}:r),6);
 assert.deepEqual(a.selected,changed.selected);assert.notDeepEqual(a.evaluation,changed.evaluation);
 assert.equal(prepareAnalysis(golden,2).evaluation,null);
 assert.equal(prepareAnalysis([],1).evaluation,null);
});
