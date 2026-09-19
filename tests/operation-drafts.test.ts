import test from 'node:test';import assert from 'node:assert/strict';
import {embeddedDatabase,migrate} from '../src/lib/store/database';import {seedDemo} from '../src/lib/store/demo-seed';
import {loadClubConfig} from '../src/lib/runtime/config';import {operationDraft} from '../src/lib/operations/drafts';
test('draft workflows preserve ballot gates, anonymous announcements and exemption-aware reminder recipients',async()=>{
 const db=await embeddedDatabase();try{
  const club=await loadClubConfig();await migrate(db);await db.query("UPDATE club_metadata SET mode='demo'");await seedDemo(db,club);
  const [admin]=await db.query<{id:string}>("SELECT id FROM members WHERE role='admin'");const actor={memberId:admin.id,displayName:'Organizer',fullName:'Invented Organizer',role:'admin' as const};
  const context={db,actor,club,origin:'http://127.0.0.1:5055'};
  const vote=await operationDraft(context,'vote',6);assert.equal(vote.draft,true);assert.match(vote.body,/\/survey/);assert.doesNotMatch(vote.body,/Suggested by|Recommended by/);
  const reminder=await operationDraft(context,'reminder',6),excluded=await db.query<{id:string}>("SELECT id FROM members WHERE reminder_exempt OR role='former' UNION SELECT member_id AS id FROM survey_responses WHERE ballot_id=(SELECT id FROM ballots WHERE meeting_number=6)");
  assert.ok(reminder.recipients.length>0);assert.ok(reminder.recipients.every(r=>!excluded.some(e=>e.id===r.memberId)));
  await assert.rejects(operationDraft(context,'vote',7),/open ballot/);await assert.rejects(operationDraft(context,'results',6),/closed ballot/);
  const results=await operationDraft(context,'results',5);assert.ok(results.calendar?.includes('BEGIN:VCALENDAR'));assert.match(results.body,/meeting 5/i);
  const shortlist=await operationDraft(context,'shortlist');assert.equal(shortlist.recipients.length,0);assert.ok(Array.isArray(shortlist.suggestions));
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM notification_deliveries'))[0].n,0);
  await db.query("UPDATE members SET role='member' WHERE id=$1",[admin.id]);await assert.rejects(operationDraft(context,'nominations'),/not_authorized/);
 }finally{await db.close();}
});
