import test from 'node:test';import assert from 'node:assert/strict';
import {embeddedDatabase,migrate} from '../src/lib/store/database';

test('admin commands use current roles, preserve identity and reject stale edits',async()=>{
 const db=await embeddedDatabase();try{
  await migrate(db);
  const [admin]=await db.query<{id:string}>("INSERT INTO members(full_name,display_name,role) VALUES('Invented Organizer','Organizer','admin') RETURNING id");
  const [created]=await db.query<{result:{id:string;revision:number}}>('SELECT club_create_member($1,$2::jsonb) AS result',[admin.id,JSON.stringify({fullName:'Duplicate Name',displayName:'First',role:'member'})]);
  const second=await db.query<{result:{id:string}}> ('SELECT club_create_member($1,$2::jsonb) AS result',[admin.id,JSON.stringify({fullName:'Duplicate Name',displayName:'Second',role:'member'})]);
  assert.notEqual(created.result.id,second[0].result.id);
  await assert.rejects(db.query("SELECT club_update_member($1,$1,1,'member',NULL)",[admin.id]),/cannot_demote_yourself/);
  await db.query("SELECT club_update_member($1,$2,1,'admin',TRUE)",[admin.id,created.result.id]);
  await assert.rejects(db.query("SELECT club_update_member($1,$2,1,'former',NULL)",[admin.id,created.result.id]),/stale_member/);
  await db.query("SELECT club_update_member($1,$2,2,'member',NULL)",[admin.id,created.result.id]);
  await assert.rejects(db.query('SELECT club_create_member($1,$2::jsonb)',[created.result.id,JSON.stringify({fullName:'Another',displayName:'Another',role:'member'})]),/not_authorized/);
  const [m]=await db.query<{id:string}>("INSERT INTO meetings(number,notes) VALUES(1,'Old note') RETURNING id");
  await db.query("SELECT club_update_meeting_notes($1,$2,1,'New note')",[admin.id,m.id]);
  await assert.rejects(db.query("SELECT club_update_meeting_notes($1,$2,1,'Stale note')",[admin.id,m.id]),/stale_meeting/);
  await db.query("SELECT club_update_meeting_notes($1,$2,2,'')",[admin.id,m.id]);
  assert.equal((await db.query<{notes:string|null}>('SELECT notes FROM meetings WHERE id=$1',[m.id]))[0].notes,null);
 }finally{await db.close();}
});

test('manual nominations are atomic, retain catalog metadata and deduplicate the member queue',async()=>{
 const db=await embeddedDatabase();try{
  await migrate(db);const [m]=await db.query<{id:string}>("INSERT INTO members(full_name,display_name) VALUES('Invented Reader','Reader') RETURNING id");
  const full={title:'A Fictional Volume',author:'Example Author',description:'Useful description',pageCount:240,audiobookLength:'8 hours',notes:'An idea for the group.'};
  const [first]=await db.query<{result:{nominationId:string;alreadyQueued:boolean}}>('SELECT club_nominate($1,$2::jsonb) AS result',[m.id,JSON.stringify(full)]);
  const [again]=await db.query<{result:{nominationId:string;alreadyQueued:boolean}}>('SELECT club_nominate($1,$2::jsonb) AS result',[m.id,JSON.stringify({title:full.title,author:full.author,description:'',pageCount:null})]);
  assert.equal(first.result.nominationId,again.result.nominationId);assert.equal(again.result.alreadyQueued,true);
  const [book]=await db.query<{description:string;page_count:number;audiobook_length:string}>('SELECT description,page_count,audiobook_length FROM books');assert.deepEqual(book,{description:'Useful description',page_count:240,audiobook_length:'8 hours'});
  await assert.rejects(db.query('SELECT club_nominate($1,$2::jsonb)',[m.id,JSON.stringify({...full,title:'Invalid New Book',pageCount:-5})]),/invalid/);
  assert.equal((await db.query<{n:number}>('SELECT count(*)::integer AS n FROM books'))[0].n,1);
 }finally{await db.close();}
});
