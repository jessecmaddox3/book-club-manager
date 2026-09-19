import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { embeddedDatabase, migrate, type Database } from "../src/lib/store/database";
import {calendarFile} from '../src/lib/operations/calendar';
const admin='10000000-0000-4000-8000-000000000001', reader='10000000-0000-4000-8000-000000000002';
const def=(number=7)=>({meetingNumber:number,dates:['2035-05-08','2035-05-09'],nominees:[
 {slug:'paper-island',title:'Paper Island',author:'Invented Author One',recommendedBy:admin,description:'A fictional mapmaker story.',caseFor:'A small cast.',caseAgainst:'A slow start.',pages:180},
 {slug:'clock-orchard',title:'Clock Orchard',author:'Invented Author Two',recommendedBy:reader,description:'An invented clock garden.',caseFor:'An unusual setting.',caseAgainst:'A long middle.',pages:220},
]});
type Result={id:string;revision:number;status:string;meetingId?:string};
async function command(db:Database,name:string,values:unknown[]):Promise<Result>{
 assert.match(name,/^club_[a-z_]+$/);
 const row=await db.query<{result:Result}>(`SELECT ${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) AS result`,values.map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v));return row[0].result;
}
async function fixture(run:(db:Database)=>Promise<void>){
 const db=await embeddedDatabase();try{
  await migrate(db);await db.execute("UPDATE club_metadata SET mode='demo',demo_date='2035-04-01';");
  await db.query("INSERT INTO members(id,full_name,display_name,role) VALUES($1,'Fictional Organizer','Organizer','admin'),($2,'Fictional Reader','Reader','member')",[admin,reader]);await run(db);
 }finally{await db.close();}
}
async function open(db:Database,number=7){const draft=await command(db,'club_replace_draft',[admin,0,def(number)]);return command(db,'club_open_ballot',[admin,draft.id,draft.revision]);}
async function vote(db:Database,b:Result,revision=0,verdict:unknown=null){return command(db,'club_submit_survey',[reader,b.id,b.revision,revision,{'paper-island':4,'clock-orchard':2},{'2035-05-08':'yes'},true,false,verdict]);}
async function closePayload(db:Database,b:Result){const [r]=await db.query<{responses_revision:number}>('SELECT responses_revision FROM ballots WHERE id=$1',[b.id]);const [book]=await db.query<{book_id:string}>("SELECT book_id FROM ballot_nominees WHERE ballot_id=$1 AND slug='paper-island'",[b.id]);return {ballotId:b.id,revision:b.revision,responsesRevision:r.responses_revision,selectedBookId:book.book_id,date:'2035-05-08',hostId:reader,location:'Invented reading room',beverageMemberIds:[reader]};}

test('draft replacement removes old children atomically and leaves shared books intact',()=>fixture(async db=>{
 const d=def();d.nominees.push({...d.nominees[0],slug:'third-book',title:'The Third Fiction',author:'A Third Invented Author'});
 let b=await command(db,'club_replace_draft',[admin,0,d]);
 const changed=def();changed.dates=['2035-05-09'];b=await command(db,'club_replace_draft',[admin,b.revision,changed]);
 assert.equal((await db.query('SELECT * FROM ballot_nominees WHERE ballot_id=$1',[b.id])).length,2);
 assert.equal((await db.query('SELECT * FROM ballot_dates WHERE ballot_id=$1',[b.id])).length,1);
 assert.equal((await db.query('SELECT * FROM books')).length,3);
 assert.equal((await db.query("SELECT * FROM book_nominations WHERE status='suggested'")).length,1);
 const broken=def();broken.nominees[1].recommendedBy='No such fictional member';
 await assert.rejects(()=>command(db,'club_replace_draft',[admin,b.revision,broken]),/recommender/);
 assert.equal((await db.query('SELECT revision FROM ballots WHERE id=$1',[b.id]))[0].revision,b.revision);
 assert.equal((await db.query('SELECT * FROM ballot_dates WHERE ballot_id=$1',[b.id])).length,1);
}));
test('accepted votes finalize exactly once, closed ballots cannot use open, retries are bound to payload',()=>fixture(async db=>{
 const b=await open(db);await vote(db,b);const payload=await closePayload(db,b);const op=randomUUID();const result=await command(db,'club_close_ballot',[admin,op,payload]);
 assert.equal((await db.query('SELECT * FROM historical_votes WHERE ballot_id=$1',[b.id])).length,2);
 assert.equal((await db.query('SELECT * FROM historical_ballots WHERE ballot_id=$1',[b.id])).length,2);
 assert.deepEqual(await command(db,'club_close_ballot',[admin,op,payload]),result);
 await assert.rejects(()=>command(db,'club_close_ballot',[admin,op,{...payload,location:'A changed room'}]),/operation_id_reused/);
 await assert.rejects(()=>command(db,'club_close_ballot',[admin,op,null]),/operation_id_reused/);
 await assert.rejects(()=>command(db,'club_open_ballot',[admin,b.id,result.revision]),/draft_required/);
 await assert.rejects(()=>vote(db,b,1),/closed/);
}));
test('draft preparation does not displace an open ballot and stale close previews cannot discard later votes',()=>fixture(async db=>{
 const b=await open(db);await command(db,'club_replace_draft',[admin,0,def(8)]);
 const payload=await closePayload(db,b);await vote(db,b);
 await assert.rejects(()=>command(db,'club_close_ballot',[admin,randomUUID(),payload]),/stale_close_preview/);
 assert.equal((await db.query('SELECT status FROM ballots WHERE id=$1',[b.id]))[0].status,'open');
 await command(db,'club_close_ballot',[admin,randomUUID(),await closePayload(db,b)]);
 assert.equal((await db.query('SELECT * FROM historical_votes WHERE ballot_id=$1',[b.id])).length,2);
}));
test('stale response tabs and stale reopened ballots cannot overwrite a later answer',()=>fixture(async db=>{
 const b=await open(db);await vote(db,b);
 await assert.rejects(()=>vote(db,b),/stale_response/);
 const result=await command(db,'club_close_ballot',[admin,randomUUID(),await closePayload(db,b)]);
 const reopened=await command(db,'club_reopen_ballot',[admin,b.id,result.revision]);
 assert.equal((await db.query('SELECT * FROM historical_votes WHERE ballot_id=$1',[b.id])).length,0);
 assert.equal((await db.query('SELECT state FROM meetings WHERE id=$1',[result.meetingId]))[0].state,'tentative');
 await assert.rejects(()=>vote(db,b,1),/stale_ballot/);
 await vote(db,reopened,1);
 const again=await command(db,'club_close_ballot',[admin,randomUUID(),await closePayload(db,reopened)]);
 assert.equal(again.meetingId,result.meetingId);
 assert.equal((await db.query('SELECT * FROM historical_votes WHERE ballot_id=$1',[b.id])).length,2);
}));
test('re-finalizing a changed meeting advances the calendar sequence while preserving its UID',()=>fixture(async db=>{
 const b=await open(db),done=await command(db,'club_close_ballot',[admin,randomUUID(),await closePayload(db,b)]);
 const event=async()=>{const [m]=await db.query<{id:string;revision:number;date:string}>('SELECT id,revision,date::text FROM meetings WHERE id=$1',[done.meetingId]);return calendarFile({instanceId:admin,meetingId:m.id,revision:m.revision,date:m.date,title:'Invented Club',description:'A test meeting',location:'Invented Room',time:'19:30',timeZone:'America/Chicago',minutes:120,url:'https://club.example/meetings/7'});};
 const first=await event(),reopened=await command(db,'club_reopen_ballot',[admin,b.id,done.revision]),plan={...await closePayload(db,reopened),date:'2035-05-09'};
 await command(db,'club_close_ballot',[admin,randomUUID(),plan]);const second=await event();
 const unfold=(value:string)=>value.replace(/\r\n /g,'');
 assert.equal(unfold(first).match(/UID:.+/)?.[0],unfold(second).match(/UID:.+/)?.[0]);
 assert.notEqual(first.match(/DTSTART:.+/)?.[0],second.match(/DTSTART:.+/)?.[0]);
 assert.ok(Number(second.match(/SEQUENCE:(\d+)/)?.[1])>Number(first.match(/SEQUENCE:(\d+)/)?.[1]));
}));
test('canonical verdicts update through survey and stale verdicts roll back the entire response',()=>fixture(async db=>{
 const old=await open(db);const done=await command(db,'club_close_ballot',[admin,randomUUID(),await closePayload(db,old)]);
 const [meeting]=await db.query<{book_id:string}>('SELECT book_id FROM meetings WHERE id=$1',[done.meetingId]);
 const d={...def(8),previousMeetingId:done.meetingId};let current=await command(db,'club_replace_draft',[admin,0,d]);current=await command(db,'club_open_ballot',[admin,current.id,current.revision]);
 const verdict={meetingId:done.meetingId,bookId:meeting.book_id,status:'read',rating:5,revision:0};
 await vote(db,current,0,verdict);
 assert.equal((await db.query('SELECT rating FROM book_ratings WHERE meeting_id=$1',[done.meetingId]))[0].rating,5);
 await command(db,'club_save_verdict',[reader,done.meetingId,meeting.book_id,'did_not_read',null,1]);
 await assert.rejects(()=>vote(db,current,1,{...verdict,revision:1,rating:3}),/stale_verdict/);
 assert.equal((await db.query('SELECT revision FROM survey_responses WHERE ballot_id=$1',[current.id]))[0].revision,1);
 await vote(db,current,1); // omitted verdict does not replace the later backlog edit
 assert.equal((await db.query('SELECT status FROM book_ratings WHERE meeting_id=$1',[done.meetingId]))[0].status,'did_not_read');
 await command(db,'club_save_verdict',[reader,done.meetingId,meeting.book_id,'clear',null,2]);
 await assert.rejects(()=>command(db,'club_save_verdict',[reader,done.meetingId,meeting.book_id,'read',2,0]),/stale_verdict/);
}));
test('authorization uses current roles, and final reading verdicts prevent reopening',()=>fixture(async db=>{
 await assert.rejects(()=>command(db,'club_replace_draft',[reader,0,def()]),/not_authorized/);
 const b=await open(db);const done=await command(db,'club_close_ballot',[admin,randomUUID(),await closePayload(db,b)]);
 const [meeting]=await db.query<{book_id:string}>('SELECT book_id FROM meetings WHERE id=$1',[done.meetingId]);
 await command(db,'club_save_verdict',[reader,done.meetingId,meeting.book_id,'read',4,0]);
 await assert.rejects(()=>command(db,'club_reopen_ballot',[admin,b.id,done.revision]),/meeting_has_verdicts/);
 await db.query("UPDATE members SET role='former' WHERE id=$1",[reader]);
 await assert.rejects(()=>command(db,'club_save_verdict',[reader,done.meetingId,meeting.book_id,'read',3,1]),/not_authorized/);
 await db.query("UPDATE members SET role='member' WHERE id=$1",[admin]);
 await assert.rejects(()=>command(db,'club_replace_draft',[admin,0,def(9)]),/not_authorized/);
}));

test('closing cannot replace an unrelated held meeting even when it has no verdicts',()=>fixture(async db=>{
 const b=await open(db);
 await db.query("INSERT INTO meetings(number,date,state,location,notes) VALUES(7,'2034-01-01','held','Earlier invented room','Keep this record')");
 const before=await db.query('SELECT * FROM meetings WHERE number=7');
 const payload=await closePayload(db,b);
 await assert.rejects(()=>command(db,'club_close_ballot',[admin,randomUUID(),payload]),/meeting_number_already_used/);
 assert.deepEqual(await db.query('SELECT * FROM meetings WHERE number=7'),before);
 assert.equal((await db.query('SELECT status FROM ballots WHERE id=$1',[b.id]))[0].status,'open');
}));
