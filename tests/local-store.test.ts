import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp,readFile,writeFile,rm,mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { openDemoStore } from "../src/lib/store/local";

test("local edits and instance secrets survive closing and reopening, and a second owner is refused",async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'bookclub-local-'));
 try {
  const a=await openDemoStore(folder);let secret:string;
  try {
   secret=a.sessionSecret;
   await a.db.query("INSERT INTO members(full_name,display_name) VALUES('Invented Keeper','Keeper')");
   await assert.rejects(()=>openDemoStore(folder),/already open/);
   execFileSync(process.execPath,["--import","tsx","-e",`const {openDemoStore}=require('./src/lib/store/local.ts');openDemoStore(process.env.BOOKCLUB_LOCK_PROBE_FOLDER).then(async s=>{await s.close();process.exit(2)},e=>{if(!e.message.includes('already open')){console.error(e.message);process.exit(1)}})`],{env:{...process.env,BOOKCLUB_LOCK_PROBE_FOLDER:folder},stdio:"pipe"});
  } finally {await a.close();}
  const b=await openDemoStore(folder);
  try {assert.equal(b.sessionSecret,secret!);assert.equal((await b.db.query('SELECT display_name FROM members'))[0].display_name,'Keeper');}
  finally {await b.close();}
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('a ready demo with a missing or empty replacement database fails without reseeding',async()=>{
 for(const emptyReplacement of [false,true]){
  const folder=await mkdtemp(path.join(tmpdir(),'bookclub-missing-'));
  try{
   const store=await openDemoStore(folder);
   await store.db.query("INSERT INTO members(full_name,display_name) VALUES('Invented Keeper','Keeper')");
   await store.close();
   const marker=await readFile(path.join(folder,'instance.json'),'utf8');
   await rm(path.join(folder,'database'),{recursive:true,force:true});
   if(emptyReplacement)await mkdir(path.join(folder,'database'));
   await assert.rejects(openDemoStore(folder),/missing|incomplete|Restore/);
   assert.equal(await readFile(path.join(folder,'instance.json'),'utf8'),marker);
  }finally{await rm(folder,{recursive:true,force:true});}
 }
});

test("unrecognized and corrupt directories are preserved rather than reseeded",async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'bookclub-unrelated-'));
 try {
  await writeFile(path.join(folder,'keep.txt'),'Do not change this');
  await assert.rejects(()=>openDemoStore(folder),/Unrecognized/);
  assert.equal(await readFile(path.join(folder,'keep.txt'),'utf8'),'Do not change this');
  await writeFile(path.join(folder,'instance.json'),'{"kind":"something-else"}');
  await assert.rejects(()=>openDemoStore(folder),/corrupt|unsupported/);
  assert.equal(await readFile(path.join(folder,'keep.txt'),'utf8'),'Do not change this');
 }finally{await rm(folder,{recursive:true,force:true});}
});
