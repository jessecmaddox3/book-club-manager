import test from 'node:test';import assert from 'node:assert/strict';
import {meetingInstant,calendarFile} from '../src/lib/operations/calendar';
test('calendar dates use the configured zone and reject nonexistent or ambiguous local times',()=>{
 assert.equal(meetingInstant('2035-05-08','19:30','America/Chicago').toISOString(),'2035-05-09T00:30:00.000Z');
 assert.equal(meetingInstant('2035-01-08','19:30','America/Chicago').toISOString(),'2035-01-09T01:30:00.000Z');
 assert.throws(()=>meetingInstant('2035-03-11','02:30','America/Chicago'),/does not exist/);
 assert.throws(()=>meetingInstant('2035-11-04','01:30','America/Chicago'),/ambiguous/);
});
test('calendar files escape user text, fold UTF-8 lines, retain stable identity and do not send invitations',()=>{
 const input={instanceId:'10000000-0000-4000-8000-000000000001',meetingId:'10000000-0000-4000-8000-000000000002',revision:3,title:'A Book\nATTENDEE:injected',description:'A comma, a semicolon; and '+ 'é'.repeat(100),location:'Reading room',date:'2035-05-08',time:'19:30',timeZone:'America/Chicago',minutes:120,url:'https://club.example/meetings/6'};
 const ics=calendarFile(input,new Date('2035-04-01T12:00:00Z'));
 assert.match(ics,/DTSTART:20350509T003000Z\r\n/);assert.match(ics,/DTEND:20350509T023000Z\r\n/);
 assert.match(ics,/SUMMARY:A Book\\nATTENDEE:injected/);assert.doesNotMatch(ics,/\r\nATTENDEE:|ORGANIZER:|METHOD:REQUEST/);
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 assert.equal(ics.match(/UID:.+/)?.[0],calendarFile(input,new Date('2035-04-02T12:00:00Z')).match(/UID:.+/)?.[0]);
});
