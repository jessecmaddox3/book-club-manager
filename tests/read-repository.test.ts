import test from 'node:test';
import assert from 'node:assert/strict';
import {embeddedDatabase,migrate} from '../src/lib/store/database';
import {seedDemo} from '../src/lib/store/demo-seed';
import {loadClubConfig} from '../src/lib/runtime/config';
import {ReadRepository} from '../src/lib/store/reads';
import type {Actor} from '../src/lib/auth/identity';

test('member views preserve useful history while withholding pending attribution and account fields',async()=>{
 const db=await embeddedDatabase();
 try{
  await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,await loadClubConfig());
  const [member]=await db.query<{id:string;display_name:string;full_name:string}>("SELECT id,display_name,full_name FROM members WHERE role='member' ORDER BY display_name LIMIT 1");
  const actor:Actor={memberId:member.id,displayName:member.display_name,fullName:member.full_name,role:'member'},repo=new ReadRepository(db,actor);
  await db.query("UPDATE members SET email='private-marker@example.invalid',auth_subject=gen_random_uuid() WHERE id=$1",[member.id]);
  const [pending]=await db.query<{member_id:string}>("UPDATE book_nominations SET notes='PENDING_ATTRIBUTION_MARKER' WHERE ballot_id IN(SELECT id FROM ballots WHERE status='open') RETURNING member_id");
  const directory=await repo.memberDirectory(),profile=await repo.memberProfile(pending.member_id);
  assert.equal(directory.length,8);assert.ok(profile);assert.ok(profile.nominations.length>0);
  assert.doesNotMatch(JSON.stringify([directory,profile]),/private-marker|auth_subject|PENDING_ATTRIBUTION_MARKER/);
  assert.ok(profile.nominations.every(n=>n.meeting_number<=5));
  assert.equal(await repo.memberProfile('invalid-id'),null);
  const meetings=await repo.meetings();assert.equal(meetings.length,5);
  const detail=await repo.meetingDetail(1);assert.ok(detail?.meeting.book);assert.equal(detail?.ballots.length,3);assert.equal(detail?.verdicts.length,7);
  assert.equal((await repo.readBooks()).length,5);assert.ok((await repo.alsoRans()).length>0);
  assert.equal((await repo.annual(2035)).predictions.length,7);
  await assert.rejects(repo.adminMembers(),/not_authorized/);
  await db.query("UPDATE members SET role='former' WHERE id=$1",[member.id]);
  await assert.rejects(repo.meetings(),/not_authorized/);
 }finally{await db.close();}
});

test('cleared verdicts keep their revision and return to the unanswered backlog',async()=>{
 const db=await embeddedDatabase();
 try{
  await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,await loadClubConfig());
  const [m]=await db.query<{id:string}>("SELECT id FROM members WHERE role='admin'");
  const repo=new ReadRepository(db,{memberId:m.id,displayName:'Demo',fullName:'Demo',role:'admin'});
  const original=(await repo.backlog())[0];assert.equal(original.verdict.revision,1);
  await db.query("SELECT club_save_verdict($1,$2,$3,'clear',NULL,$4)",[m.id,original.id,original.book_id,original.verdict.revision]);
  const cleared=(await repo.backlog()).find(row=>row.id===original.id)!;
  assert.equal(cleared.verdict.status,'unrated');assert.equal(cleared.verdict.revision,2);assert.equal(cleared.answered,false);
  assert.equal((await repo.home()).unrated.length,1);
 }finally{await db.close();}
});

test('each reader can recover their own pending nominations without seeing another reader’s queue',async()=>{
 const db=await embeddedDatabase();
 try{
  await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,await loadClubConfig());
  const members=await db.query<{id:string}>("SELECT id FROM members WHERE role='member' ORDER BY id LIMIT 2");
  for(let i=0;i<members.length;i++)await db.query('SELECT club_nominate($1,$2::jsonb)',[members[i].id,JSON.stringify({title:'Private Queue '+i,author:'Invented Author',notes:'Private note '+i})]);
  const repo=new ReadRepository(db,{memberId:members[0].id,displayName:'Reader',fullName:'Reader',role:'member'});
  const queue=await repo.myPendingNominations();
  assert.ok(queue.some(n=>n.title==='Private Queue 0'&&n.notes==='Private note 0'));
  assert.doesNotMatch(JSON.stringify(queue),/Private Queue 1|Private note 1|auth_subject|email/);
  assert.ok(queue.every(n=>n.status==='suggested'||n.status==='on_ballot'));
  await db.query("UPDATE members SET role='former' WHERE id=$1",[members[0].id]);
  await assert.rejects(repo.myPendingNominations(),/not_authorized/);
 }finally{await db.close();}
});
