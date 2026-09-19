import assert from 'node:assert/strict';
import test from 'node:test';
import {embeddedDatabase,migrate,verifyMigrations} from '../src/lib/store/database';

const subject='20000000-0000-4000-8000-000000000001';
const other='20000000-0000-4000-8000-000000000002';
const setup={fullName:'Invented Organizer',displayName:'Organizer',authSubject:subject,timeZone:'America/Chicago'};

test('production initialization creates one explicitly linked organizer and never reseeds an existing club',async()=>{
 const db=await embeddedDatabase();
 try{
  await migrate(db);
  const [result]=await db.query<{result:{memberId:string;instanceId:string}}>('SELECT club_initialize_production($1::jsonb) AS result',[JSON.stringify(setup)]);
  const [member]=await db.query('SELECT auth_subject,role FROM members WHERE id=$1',[result.result.memberId]);
  assert.deepEqual(member,{auth_subject:subject,role:'admin'});
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM books'))[0].n,0);
  assert.equal((await db.query('SELECT production_initialized FROM club_metadata'))[0].production_initialized,true);
  await assert.rejects(db.query('SELECT club_initialize_production($1::jsonb)',[JSON.stringify({...setup,authSubject:other})]),/already_initialized/);
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM members'))[0].n,1);
 }finally{await db.close();}
});

test('identity linking uses current organizer permission and exact member revision, never names or emails',async()=>{
 const db=await embeddedDatabase();
 try{
  await migrate(db);
  const [{result}]=await db.query<{result:{memberId:string}}>('SELECT club_initialize_production($1::jsonb) AS result',[JSON.stringify(setup)]);
  const [reader]=await db.query<{id:string}>("INSERT INTO members(full_name,display_name) VALUES('Invented Organizer','Organizer') RETURNING id");
  const link=(actor:string,id:string,revision:number,previous:string|null,next:string|null)=>db.query('SELECT club_link_identity($1,$2,$3,$4,$5)',[actor,id,revision,previous,next]);
  await assert.rejects(link(reader.id,reader.id,1,null,other),/not_authorized/);
  await link(result.memberId,reader.id,1,null,other);
  await assert.rejects(link(result.memberId,reader.id,1,null,subject),/stale_member/);
  await assert.rejects(link(result.memberId,result.memberId,1,subject,null),/last_linked_admin/);
  await assert.rejects(link(result.memberId,reader.id,2,other,subject),/unique/);
  await link(result.memberId,reader.id,2,other,null);
  assert.equal((await db.query('SELECT auth_subject FROM members WHERE id=$1',[reader.id]))[0].auth_subject,null);
 }finally{await db.close();}
});

test('server schema verification is read-only and rejects missing or modified migrations',async()=>{
 const db=await embeddedDatabase();
 try{
  await migrate(db);await verifyMigrations(db);
  await db.query("UPDATE schema_migrations SET sha256='changed' WHERE name='0001_baseline.sql'");
  await assert.rejects(verifyMigrations(db),/ledger/);
  assert.equal((await db.query("SELECT sha256 FROM schema_migrations WHERE name='0001_baseline.sql'"))[0].sha256,'changed');
  await db.query("DELETE FROM schema_migrations WHERE name='0006_production_setup.sql'");
  await assert.rejects(verifyMigrations(db),/compatible/);
 }finally{await db.close();}
});

test('production initialization refuses demo and populated but unfinished databases without deleting rows',async()=>{
 for(const mode of ['demo','production']){
  const db=await embeddedDatabase();
  try{
   await migrate(db);await db.query('UPDATE club_metadata SET mode=$1',[mode]);
   await db.query("INSERT INTO books(title,author) VALUES('Keep This Book','Invented Author')");
   await assert.rejects(db.query('SELECT club_initialize_production($1::jsonb)',[JSON.stringify(setup)]),/not_empty|production_required/);
   assert.equal((await db.query('SELECT title FROM books'))[0].title,'Keep This Book');
   assert.equal((await db.query('SELECT count(*)::integer AS n FROM members'))[0].n,0);
  }finally{await db.close();}
 }
});
