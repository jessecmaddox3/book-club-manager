import test from 'node:test';import assert from 'node:assert/strict';
import {embeddedDatabase,migrate} from '../src/lib/store/database';
import {seedDemo} from '../src/lib/store/demo-seed';
import {loadClubConfig} from '../src/lib/runtime/config';
import {BallotRepository} from '../src/lib/store/ballots';
import type {Actor} from '../src/lib/auth/identity';
import type {Database} from '../src/lib/store/database';

test('reopening between the header read and results read cannot expose new votes to a nonvoter',async()=>{
 const db=await embeddedDatabase();try{
  await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,await loadClubConfig());
  const [member]=await db.query<{id:string;display_name:string;full_name:string}>("SELECT id,display_name,full_name FROM members WHERE display_name='Dev'");
  const [ballot]=await db.query<{id:string}>("UPDATE ballots SET status='closed' WHERE status='open' RETURNING id");
  let reopened=false;
  const interleaved:Database={...db,async query<T>(sql:string,values?:unknown[]):Promise<T[]>{
   const rows=await db.query<T>(sql,values);
   if(!reopened&&sql.startsWith('SELECT revision,ratings,date_preferences')){
    reopened=true;
    await db.query("UPDATE ballots SET status='open',revision=revision+1 WHERE id=$1",[ballot.id]);
    await db.query("UPDATE survey_responses SET ratings=jsonb_build_object('copper-garden',5) WHERE ballot_id=$1",[ballot.id]);
   }
   return rows;
  }};
  const repo=new BallotRepository(interleaved,{memberId:member.id,displayName:member.display_name,fullName:member.full_name,role:'member'});
  assert.deepEqual(await repo.results(),{kind:'vote_required'});assert.equal(reopened,true);
 }finally{await db.close();}
});

test('open ballot wins over a newer draft and member payloads never carry attribution or other votes',async()=>{
 const db=await embeddedDatabase();try{
  await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,await loadClubConfig());
  const members=await db.query<{id:string;role:'admin'|'member';display_name:string;full_name:string}>("SELECT id,role,display_name,full_name FROM members WHERE role<>'former'");
  const actor=(m:typeof members[number]):Actor=>({memberId:m.id,role:m.role,displayName:m.display_name,fullName:m.full_name});
  const admin=members.find(m=>m.role==='admin')!;
  const [respondent]=await db.query<{member_id:string}>('SELECT member_id FROM survey_responses WHERE ballot_id IN(SELECT id FROM ballots WHERE status=\'open\') LIMIT 1');
  const voter=members.find(m=>m.id===respondent.member_id)!;
  const nonvoter=members.find(m=>m.role==='member'&&m.id!==voter.id&&!['Juniper','Theo','Mara'].includes(m.display_name))!;
  const repo=new BallotRepository(db,actor(nonvoter));
  const ballot=await repo.current();assert.equal(ballot?.meetingNumber,6);assert.equal(ballot?.status,'open');
  assert.ok(ballot?.previousBook?.meetingId);assert.equal(ballot?.books.length,3);
  assert.doesNotMatch(JSON.stringify(ballot),/recommendedBy|recommended_by|recommender|auth_subject|email/);
  assert.deepEqual(await repo.results(),{kind:'vote_required'});
  const result=await new BallotRepository(db,actor(voter)).results();assert.equal(result.kind,'visible');
  assert.doesNotMatch(JSON.stringify(result),/memberId|member_id|ratings|date_preferences/);
  const adminView=await new BallotRepository(db,actor(admin)).admin();assert.ok(adminView);assert.equal(adminView.memberResponses.length,3);
  assert.equal(adminView.previousRatings.length,6);assert.ok(adminView.reminderRecipients.length<adminView.nonVoters.length);
  await assert.rejects(repo.admin(),/not_authorized/);
  await db.query("UPDATE members SET role='member' WHERE id=$1",[admin.id]);
  assert.deepEqual(await new BallotRepository(db,actor(admin)).results(),{kind:'vote_required'});
 }finally{await db.close();}
});

test('admin draft replacement during loading retries to return coherent books, dates and revision',async()=>{
 const db=await embeddedDatabase();try{
  await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,await loadClubConfig());
  const [member]=await db.query<{id:string;display_name:string;full_name:string}>("SELECT id,display_name,full_name FROM members WHERE role='admin'");
  const [draft]=await db.query<{id:string;revision:number;meeting_number:number}>("SELECT id,revision,meeting_number FROM ballots WHERE status='draft'");
  let replaced=false;
  const interleaved:Database={...db,async query<T>(sql:string,values?:unknown[]):Promise<T[]>{
   const rows=await db.query<T>(sql,values);
   if(!replaced&&sql.startsWith('SELECT n.slug AS id')){
    replaced=true;
    const definition={meetingNumber:draft.meeting_number,dates:['2035-07-19'],nominees:['paper-map','wooden-moon'].map((slug,i)=>({slug,title:'Replacement Fiction '+i,author:'Imaginary Writer '+i,recommendedBy:member.id,description:'An invented replacement.',caseFor:'A short book.',caseAgainst:'A slow middle.'}))};
    await db.query('SELECT club_replace_draft($1,$2,$3::jsonb)',[member.id,draft.revision,JSON.stringify(definition)]);
   }
   return rows;
  }};
  const repo=new BallotRepository(interleaved,{memberId:member.id,displayName:member.display_name,fullName:member.full_name,role:'admin'});
  const result=await repo.admin(draft.id);assert.ok(result);assert.equal(replaced,true);
  assert.equal(result.ballot.revision,draft.revision+1);assert.equal(result.ballot.books.length,2);
  assert.equal(result.ballot.books[0].title,'Replacement Fiction 0');assert.deepEqual(result.ballot.dateOptions.map(d=>d.id),['2035-07-19']);
 }finally{await db.close();}
});
