import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm,appendFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {reserveGenrePlan,readGenrePlan} from '../src/lib/predict/genre-plan';
const book={bookId:'10000000-0000-4000-8000-000000000001',title:'Fictional Book',author:'Invented Writer',genre:null};
test('paid genre destination is reserved first and completed batches survive a later failure',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'club-genre-plan-'));try{
  const file=path.join(dir,'proposal.jsonl');const journal=await reserveGenrePlan(file,[book]);
  await assert.rejects(reserveGenrePlan(file,[book]),/EEXIST/);await assert.rejects(reserveGenrePlan(path.join(dir,'missing','proposal.jsonl'),[book]),/ENOENT/);
  const updates=[{bookId:book.bookId,expectedGenre:null,genre:'mystery' as const}];await journal.checkpoint(updates);await journal.close();
  assert.deepEqual(await readGenrePlan(file),{updates,complete:false});
  await appendFile(file,'{"kind":"batch","updates":');assert.deepEqual(await readGenrePlan(file),{updates,complete:false});
  assert.match(await readFile(file,'utf8'),/Fictional Book/);
 }finally{await rm(dir,{recursive:true});}
});
