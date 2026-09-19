import test from 'node:test';
import assert from 'node:assert/strict';
import { embeddedDatabase, migrate } from '../src/lib/store/database';
import { seedDemo } from '../src/lib/store/demo-seed';
import { loadClubConfig } from '../src/lib/runtime/config';

test('fictional seed covers the full club and a normal restart preserves edits',async()=>{
 const db=await embeddedDatabase();
 try {
  await migrate(db);
  await assert.rejects(seedDemo(db,await loadClubConfig()),/demo/);
  await db.query("UPDATE club_metadata SET mode='demo' WHERE id=1");
  await seedDemo(db,await loadClubConfig());
  const [coverage]=await db.query<{members:number;meetings:number;history:number;ratings:number;goals:number;drinks:number}>(`SELECT
   (SELECT count(*)::integer FROM members) AS members,(SELECT count(*)::integer FROM meetings) AS meetings,
   (SELECT count(*)::integer FROM historical_votes) AS history,(SELECT count(*)::integer FROM book_ratings) AS ratings,
   (SELECT count(*)::integer FROM goals) AS goals,(SELECT count(*)::integer FROM meeting_bourbons) AS drinks`);
  assert.equal(coverage.members,8);assert.equal(coverage.meetings,5);
  assert.ok(coverage.history>=90);assert.ok(coverage.ratings>=20);assert.ok(coverage.goals>0);assert.ok(coverage.drinks>0);
  assert.deepEqual((await db.query<{status:string;meeting_number:number}>("SELECT status,meeting_number FROM ballots WHERE status<>'closed' ORDER BY meeting_number")),[{status:'open',meeting_number:6},{status:'draft',meeting_number:7}]);
  const [member]=await db.query<{id:string}>('SELECT id FROM members ORDER BY id LIMIT 1');
  await db.query("UPDATE members SET notes='My local edit' WHERE id=$1",[member.id]);
  await seedDemo(db,await loadClubConfig());
  assert.equal((await db.query<{notes:string}>('SELECT notes FROM members WHERE id=$1',[member.id]))[0].notes,'My local edit');
 } finally { await db.close(); }
});
