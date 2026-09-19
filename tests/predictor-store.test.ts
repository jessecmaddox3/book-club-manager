import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {embeddedDatabase,migrate} from '../src/lib/store/database';
import {seedDemo} from '../src/lib/store/demo-seed';import {loadClubConfig} from '../src/lib/runtime/config';
import {previewPredictions,savePredictions} from '../src/lib/predict/service';

test('prediction snapshots exclude open and post-read opinions; runs are complete, atomic and retryable',async()=>{
 const db=await embeddedDatabase();try{
  await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,await loadClubConfig());
  const [admin]=await db.query<{id:string}>("SELECT id FROM members WHERE role='admin'");const actor={memberId:admin.id,displayName:'Organizer',fullName:'Invented Organizer',role:'admin' as const};
  const first=await previewPredictions(db,actor,6);assert.equal(first.request.snapshot.history.length,105);assert.equal(first.request.predictions.length,21);
  await db.query("UPDATE survey_responses SET ratings='{}' WHERE ballot_id IN(SELECT id FROM ballots WHERE status='open')");
  await db.query("UPDATE book_ratings SET rating=1 WHERE status='read'");
  assert.deepEqual((await previewPredictions(db,actor,6)).request,first.request);
  const saved=await savePredictions(db,actor,first);assert.equal(saved.replayed,false);assert.equal((await savePredictions(db,actor,first)).runId,saved.runId);
  assert.equal((await db.query('SELECT * FROM model_runs')).length,1);assert.equal((await db.query('SELECT * FROM rating_predictions WHERE actual IS NULL')).length,21);
  const changed=structuredClone(first);changed.request.predictions[0].predicted=1;
  await assert.rejects(savePredictions(db,actor,changed),/operation_id_reused/);
  const invalid=structuredClone(first);invalid.operationId=randomUUID();invalid.request.predictions[1]={...invalid.request.predictions[0]};
  await assert.rejects(savePredictions(db,actor,invalid),/model_prediction_identity/);
  assert.equal((await db.query('SELECT * FROM model_runs')).length,1);
  const delayed=await previewPredictions(db,actor,6),book=delayed.request.snapshot.nominees[0];
  await db.query('SELECT club_set_genres($1,$2::jsonb)',[actor.memberId,JSON.stringify([{bookId:book.bookId,expectedGenre:book.genre,genre:'poetry'}])]);
  await assert.rejects(savePredictions(db,actor,delayed),/stale_prediction_input/);
  await assert.rejects(db.query('SELECT club_set_genres($1,$2::jsonb)',[actor.memberId,JSON.stringify([{bookId:book.bookId,expectedGenre:book.genre,genre:'mystery'}])]),/stale_genre/);
  const next=await previewPredictions(db,actor,6);await savePredictions(db,actor,next);assert.equal((await db.query('SELECT * FROM model_runs')).length,2);
  await db.query("UPDATE members SET role='member' WHERE id=$1",[actor.memberId]);await assert.rejects(savePredictions(db,actor,next),/not_authorized/);
 }finally{await db.close();}
});

test('same-name audience members stay distinct, former histories stay included and duplicate titles keep book IDs',async()=>{
 const db=await embeddedDatabase();try{
  await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,await loadClubConfig());
  const [admin]=await db.query<{id:string}>("SELECT id FROM members WHERE role='admin'");const actor={memberId:admin.id,displayName:'Organizer',fullName:'Invented Organizer',role:'admin' as const};
  await db.query("UPDATE members SET role='former' WHERE display_name='Juniper'");
  await db.query("INSERT INTO members(full_name,display_name,role) VALUES('Same Name','Same','member'),('Same Name','Same','member')");
  const plan=await previewPredictions(db,actor,6);assert.equal(plan.request.snapshot.history.length,105);assert.equal(plan.request.snapshot.audience.length,8);assert.equal(plan.request.predictions.length,24);
  assert.equal(new Set(plan.request.predictions.map(p=>p.memberId+':'+p.bookId)).size,24);
  assert.equal(plan.request.snapshot.audience.filter(p=>p.name==='Same Name').length,2);
 }finally{await db.close();}
});
