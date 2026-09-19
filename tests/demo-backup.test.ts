import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';
import {openDemoStore} from '../src/lib/store/local';
import {loadClubConfig} from '../src/lib/runtime/config';
import {seedDemo} from '../src/lib/store/demo-seed';
import {backupDemo,restoreDemo} from '../src/lib/store/backup';
import {embeddedDatabase} from '../src/lib/store/database';

test('a private demo backup restores edits to a new folder, preserves the source and rotates session identity',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'club-backup-'));const source=path.join(root,'source'),destination=path.join(root,'restored'),file=path.join(root,'private-backup.json');
 try{
  const club=await loadClubConfig(),original=await openDemoStore(source);let oldSecret:string,oldInstance:string;
  try{await seedDemo(original.db,club);await original.db.query("UPDATE books SET title='My Invented Edited Title' WHERE title=(SELECT title FROM books ORDER BY id LIMIT 1)");oldSecret=original.sessionSecret;oldInstance=original.instanceId;}
  finally{await original.close();}
  await backupDemo(source,file,club);
  assert.ok(!(await readFile(file,'utf8')).includes(oldSecret!));
  await assert.rejects(backupDemo(source,file,club),/EEXIST/);
  await restoreDemo(file,destination);
  const restored=await openDemoStore(destination);
  try{
   assert.notEqual(restored.sessionSecret,oldSecret!);assert.notEqual(restored.instanceId,oldInstance!);
   assert.equal((await restored.db.query("SELECT count(*)::integer AS n FROM books WHERE title='My Invented Edited Title'"))[0].n,1);
   assert.equal((await restored.db.query('SELECT count(*)::integer AS n FROM members'))[0].n,8);
  }finally{await restored.close();}
  await assert.rejects(restoreDemo(file,source),/EEXIST/);
  const sourceAgain=await openDemoStore(source);try{assert.equal(sourceAgain.sessionSecret,oldSecret!);assert.equal(sourceAgain.instanceId,oldInstance!);}finally{await sourceAgain.close();}
 }finally{await rm(root,{recursive:true,force:true});}
});

test('backing up an older schema does not migrate it, including when the output already exists',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'club-backup-old-')),source=path.join(root,'source');
 try{
  const club=await loadClubConfig(),local=await openDemoStore(source);try{await seedDemo(local.db,club);}finally{await local.close();}
  const old=await embeddedDatabase(path.join(source,'database'));
  try{await old.execute("DELETE FROM schema_migrations WHERE name='0006_production_setup.sql';DROP FUNCTION club_initialize_production(jsonb);DROP FUNCTION club_link_identity(uuid,uuid,integer,uuid,uuid);ALTER TABLE club_metadata DROP COLUMN production_initialized;");}finally{await old.close();}
  const existing=path.join(root,'existing.json');await writeFile(existing,'Keep this file');
  await assert.rejects(backupDemo(source,existing,club),/EEXIST/);
  assert.equal(await readFile(existing,'utf8'),'Keep this file');
  await backupDemo(source,path.join(root,'old-backup.json'),club);
  const unchanged=await embeddedDatabase(path.join(source,'database'));
  try{assert.equal((await unchanged.query("SELECT count(*)::integer AS n FROM schema_migrations WHERE name='0006_production_setup.sql'"))[0].n,0);assert.equal((await unchanged.query("SELECT count(*)::integer AS n FROM information_schema.columns WHERE table_name='club_metadata' AND column_name='production_initialized'"))[0].n,0);}finally{await unchanged.close();}
 }finally{await rm(root,{recursive:true,force:true});}
});

test('corrupt backups and nonempty restore destinations are rejected without touching existing files',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'club-backup-bad-'));
 try{
  const file=path.join(root,'bad.json'),dest=path.join(root,'keep');await mkdir(dest);await writeFile(path.join(dest,'keep.txt'),'Preserve this');await writeFile(file,'{}');
  await assert.rejects(restoreDemo(file,dest));
  assert.equal(await readFile(path.join(dest,'keep.txt'),'utf8'),'Preserve this');
  await assert.rejects(backupDemo(path.join(root,'missing'),path.join(root,'backup.json'),await loadClubConfig()),/ENOENT/);
 }finally{await rm(root,{recursive:true,force:true});}
});
