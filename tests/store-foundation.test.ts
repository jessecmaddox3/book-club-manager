import assert from "node:assert/strict";
import test from "node:test";
import { embeddedDatabase, migrate } from "../src/lib/store/database";

test("the fresh shared schema preserves tables and refuses unrelated databases", async () => {
 const db=await embeddedDatabase();
 try {
  await migrate(db);await migrate(db);
  const rows=await db.query<{name:string}>("SELECT tablename AS name FROM pg_tables WHERE schemaname='public'");
  for(const name of ['members','ballots','ballot_nominees','book_ratings','historical_votes','predictions','goals','model_runs']) assert.ok(rows.some(r=>r.name===name),name);
 } finally {await db.close();}
 const unrelated=await embeddedDatabase();
 try {
  await unrelated.execute("CREATE TABLE unrelated(note TEXT); INSERT INTO unrelated VALUES('Preserve this');");
  await assert.rejects(()=>migrate(unrelated),/nonempty/);
  assert.equal((await unrelated.query('SELECT note FROM unrelated'))[0].note,'Preserve this');
 } finally {await unrelated.close();}
});
