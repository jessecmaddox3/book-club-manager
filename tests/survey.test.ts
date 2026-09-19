import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSurveySubmission as validate,type ActiveBallot} from '../src/lib/survey';
const ballot:ActiveBallot={id:'00000000-0000-4000-8000-000000000001',surveyId:'meeting-9',revision:2,status:'open',bookIds:['lantern','orchard'],dateIds:['2035-05-01','2035-05-02']};
const valid=()=>({ballotId:ballot.id,ballotRevision:2,responseRevision:0,surveyId:ballot.surveyId,ratings:{lantern:4,orchard:2},datePreferences:{'2035-05-01':'yes'}});
test('valid votes preserve optional dates, omitted verdict and response revision',()=>{
 const r=validate(valid(),ballot);assert.ok(r.ok);assert.equal(r.data.verdictChange,undefined);assert.deepEqual(r.data.datePreferences,{'2035-05-01':'yes'});assert.equal(r.data.responseRevision,0);
});
for(const [label,patch] of Object.entries({missingBook:{ratings:{lantern:4}},extraBook:{ratings:{lantern:4,orchard:2,extra:3}},fraction:{ratings:{lantern:1.5,orchard:2}},string:{ratings:{lantern:'4',orchard:2}},zero:{ratings:{lantern:0,orchard:2}},tooHigh:{ratings:{lantern:6,orchard:2}},unknownDate:{datePreferences:{'2035-05-03':'yes'}},unknownAnswer:{datePreferences:{'2035-05-01':'sometimes'}},negativeRevision:{responseRevision:-1},invalidHost:{willingToHost:'yes'}}))test('rejects '+label,()=>assert.equal(validate({...valid(),...patch},ballot).ok,false));
test('closed, draft, other ballot and stale ballot generation cannot accept votes',()=>{
 for(const status of ['closed','draft'] as const)assert.equal(validate(valid(),{...ballot,status}).ok,false);
 for(const patch of [{surveyId:'meeting-8'},{ballotRevision:1},{ballotId:'00000000-0000-4000-8000-000000000002'}]){const r=validate({...valid(),...patch},ballot);assert.ok(!r.ok);assert.equal(r.status,409);}
});
test('a canonical verdict is explicit and revision-bound, including clear and skipped answers',()=>{
 const base={meetingId:'00000000-0000-4000-8000-000000000003',bookId:'00000000-0000-4000-8000-000000000004',revision:4};
 for(const status of ['clear','did_not_read','did_not_attend'])assert.equal(validate({...valid(),verdictChange:{...base,status,rating:null}},ballot).ok,true);
 assert.equal(validate({...valid(),verdictChange:{...base,status:'read',rating:5}},ballot).ok,true);
 assert.equal(validate({...valid(),verdictChange:{status:'read',rating:5}},ballot).ok,false);
});
