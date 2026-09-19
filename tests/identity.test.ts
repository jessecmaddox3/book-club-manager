import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { embeddedDatabase,migrate } from '../src/lib/store/database';
import { resolveActor,assertActorBinding } from '../src/lib/auth/identity';

test('a form from a different or missing reader context cannot write under the current session',()=>{
 const actor={memberId:'00000000-0000-4000-8000-000000000001',displayName:'Reader',fullName:'Invented Reader',role:'member' as const};
 assertActorBinding(actor,actor.memberId);
 assert.throws(()=>assertActorBinding(actor,null),/stale_identity/);
 assert.throws(()=>assertActorBinding(actor,'00000000-0000-4000-8000-000000000002'),/stale_identity/);
});

test('verified subject mapping uses current membership and ignores supplied roles and names',async()=>{
 const db=await embeddedDatabase();
 try{
  await migrate(db);const subject=randomUUID();
  const [m]=await db.query<{id:string}>("INSERT INTO members(full_name,display_name,role,auth_subject) VALUES('Example Member','Example','admin',$1) RETURNING id",[subject]);
  assert.equal((await resolveActor(db,{mode:'production',subject}))?.role,'admin');
  assert.equal(await resolveActor(db,{mode:'production',subject:randomUUID()}),null);
  assert.equal(await resolveActor(db,{mode:'production',subject:'%'}),null);
  await db.query("UPDATE members SET role='member' WHERE id=$1",[m.id]);
  assert.equal((await resolveActor(db,{mode:'production',subject}))?.role,'member');
  await db.query("UPDATE members SET role='former' WHERE id=$1",[m.id]);
  assert.equal(await resolveActor(db,{mode:'production',subject}),null);
 }finally{await db.close();}
});

test('demo cookies are bound to the exact local instance and reset generation; production never accepts them',async()=>{
 const db=await embeddedDatabase();
 try{
  await migrate(db);
  const [m]=await db.query<{id:string}>("INSERT INTO members(full_name,display_name,role) VALUES('Invented Reader','Invented','admin') RETURNING id");
  const [meta]=await db.query<{instance_id:string;generation:string}>('SELECT instance_id,generation FROM club_metadata');
  const identity={mode:'demo' as const,memberId:m.id,instanceId:meta.instance_id,generation:meta.generation};
  assert.equal(await resolveActor(db,identity),null);
  await db.query("UPDATE club_metadata SET mode='demo'");
  assert.equal((await resolveActor(db,identity))?.memberId,m.id);
  assert.equal(await resolveActor(db,{...identity,instanceId:randomUUID()}),null);
  await db.query('UPDATE club_metadata SET generation=gen_random_uuid()');
  assert.equal(await resolveActor(db,identity),null);
  assert.equal(await resolveActor(db,{mode:'production',subject:randomUUID()}),null);
 }finally{await db.close();}
});
