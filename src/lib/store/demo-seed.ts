import { randomUUID } from 'node:crypto';
import type { ClubConfig } from '../runtime/config';
import type { Database } from './database';
import {ballotDefinitionSchema,type BallotDefinition} from '../ballots/definition';

// These people, books, opinions and events were invented for the public demo.
// They are not renamed, shifted or sampled records from an actual club.
const people = [
 ['Remy Vale','Remy','admin'], ['Juniper Ellis','Juniper','member'],
 ['Theo Wren','Theo','member'], ['Mara Quill','Mara','member'],
 ['Dev Rowan','Dev','member'], ['Nia Moss','Nia','member'],
 ['Otis Finch','Otis','member'], ['Pip North','Pip','former'],
];
const catalog = [
 ['The Lantern Atlas','C. Avery','A mapmaker follows a constellation that appears only on forgotten maps.','fantasy'],
 ['A Small History of Rain','L. Bellwood','A village records every storm and discovers a missing season.','literary-fiction'],
 ['The Clockmaker’s Orchard','I. Reed','Two siblings inherit an orchard whose clocks all tell different stories.','mystery'],
 ['Letters from the Quiet Moon','E. Sol','A lunar archivist answers letters addressed to an abandoned observatory.','science-fiction'],
 ['The Last Teacup Society','S. Alder','An unlikely committee attempts to save a neighborhood tearoom.','humor'],
 ['The Museum of Ordinary Days','V. Harbor','A curator collects small moments rather than famous objects.','literary-fiction'],
 ['A Compass for Lost Sundays','T. Lumen','A borrowed compass points toward unfinished promises.','adventure'],
 ['The Glasshouse Detective','R. Fen','A botanist finds a coded message in the labels of a winter garden.','mystery'],
 ['Notes from a Paper Ocean','A. Briar','A cartographer builds a sea from letters that never arrived.','fantasy'],
 ['The Blue Door Almanac','M. Linden','A door appears once a year, always opening onto a different town.','science-fiction'],
 ['How the Kettle Learned to Sing','O. Cove','A curious inventor follows the science hidden in everyday sounds.','nonfiction'],
];

export async function seedDemo(db: Database, config: ClubConfig): Promise<void> {
 await db.execute('BEGIN');
 try {
  const [meta]=await db.query<{mode:string;demo_seed_version:number}>('SELECT mode,demo_seed_version FROM club_metadata WHERE id=1 FOR UPDATE');
  if(meta.mode!=='demo')throw new Error('Fictional seed is only available in demo mode.');
  if(meta.demo_seed_version===1){await db.execute('COMMIT');return;}
  if(meta.demo_seed_version!==0)throw new Error('This demo uses an unsupported seed version.');
  const [existing]=await db.query<{n:number}>('SELECT count(*)::integer AS n FROM members');
  if(existing.n)throw new Error('Refusing to seed a nonempty club. Existing records were preserved.');
  await db.query('UPDATE club_metadata SET time_zone=$1,demo_date=$2 WHERE id=1',[config.timeZone,config.demoDate??'2035-04-01']);
  const memberIds:string[]=[];
  for(const [i,person] of people.entries()){
   const [member]=await db.query<{id:string}>(`INSERT INTO members(full_name,display_name,nickname,role,joined_info,left_info,bio,reminder_exempt)
    VALUES($1,$2,$2,$3,'Founding season', $4,$5,$6) RETURNING id`,[person[0],person[1],person[2],person[2]==='former'?'Moved away after the third season':null,'Fictional demo member. Enjoys a lively discussion and a surprising ending.',i===6]);
   memberIds.push(member.id);
  }
  const admin=memberIds[0], active=memberIds.slice(0,7);
  const bookIds:string[]=[];
  for(const [i,book] of catalog.entries()){
   const [row]=await db.query<{id:string}>('INSERT INTO books(title,author,description,genre,page_count) VALUES($1,$2,$3,$4,$5) RETURNING id',[book[0],book[1],book[2],book[3],208+i*16]);
   bookIds.push(row.id);
  }
  let previousMeetingId:string|null=null;
  for(let number=1;number<=7;number++){
   const indices=number<=5?[number-1,(number+4)%11,(number+6)%11]:number===6?[5,6,7]:[8,9,10];
   const dates=number<=5?[`2034-${String(number+5).padStart(2,'0')}-18`]:number===6?['2035-04-18','2035-04-25','2035-05-02']:['2035-06-06','2035-06-13'];
   const definition:BallotDefinition=ballotDefinitionSchema.parse({meetingNumber:number,previousMeetingId,dates,nominees:indices.map((index,position)=>({
    slug:`book-${index+1}`,title:catalog[index][0],author:catalog[index][1],recommendedBy:active[(number+position)%active.length],
    description:catalog[index][2],caseFor:'A distinctive premise with plenty to discuss together.',caseAgainst:'The unhurried middle may test impatient readers.',
    pages:208+index*16,audiobookLength:`${6+index%5} hours (fictional example)`,sources:[],
   }))});
   const [built]=await db.query<{result:{id:string;revision:number}}>('SELECT club_replace_draft($1,0,$2::jsonb) AS result',[admin,JSON.stringify(definition)]);
   if(number===7)continue;
   const [opened]=await db.query<{result:{revision:number}}>('SELECT club_open_ballot($1,$2,$3) AS result',[admin,built.result.id,built.result.revision]);
   const voters=number===6?active.slice(1,4):active;
   for(const [index,member] of voters.entries()){
    const ratings=Object.fromEntries(indices.map((bookIndex,position)=>[`book-${bookIndex+1}`,1+(number+index+position*2)%5]));
    const availability=Object.fromEntries(dates.map((date,position)=>[date,['yes','maybe','no'][(index+position)%3]]));
    await db.query('SELECT club_submit_survey($1,$2,$3,0,$4::jsonb,$5::jsonb,$6,$7)',[member,built.result.id,opened.result.revision,JSON.stringify(ratings),JSON.stringify(availability),index%3===0,index%2===0]);
   }
   if(number===6)continue;
   const payload={ballotId:built.result.id,revision:opened.result.revision,responsesRevision:voters.length,selectedBookId:bookIds[indices[0]],date:dates[0],hostId:active[number%active.length],beverageMemberIds:[active[(number+2)%active.length]],location:'The fictional reading room'};
   const [closed]=await db.query<{result:{meetingId:string}}>('SELECT club_close_ballot($1,$2,$3::jsonb) AS result',[admin,randomUUID(),JSON.stringify(payload)]);
   previousMeetingId=closed.result.meetingId;
   await db.query("UPDATE meetings SET notes=$1 WHERE id=$2",['The group compared favorite passages and disagreed cheerfully about the ending. This entire meeting is an invented example.',previousMeetingId]);
   for(const [index,member] of active.entries()){
    const status=index===5&&number%2===0?'did_not_read':index===6&&number%2===1?'did_not_attend':'read';
    await db.query('SELECT club_save_verdict($1,$2,$3,$4,$5,0)',[member,previousMeetingId,bookIds[indices[0]],status,status==='read'?1+(number+index)%5:null]);
   }
   await db.query('INSERT INTO meeting_bourbons(meeting_id,brought_by,bourbon_name_raw) VALUES($1,$2,$3)',[previousMeetingId,active[(number+2)%active.length],number%2?'Sparkling orchard cider (fictional)':'Winter spice soda (fictional)']);
  }
  for(const [index,member] of active.entries()){
   for(const year of [2034,2035]){
    await db.query('INSERT INTO predictions(member_id,year,prediction,result,result_notes) VALUES($1,$2,$3,$4,$5)',[member,year,index%2?'The club will choose a graphic novel this year.':'Our shortest book will spark the longest discussion.',year===2034?['Yes','No','Partial'][index%3]:null,year===2034?'An invented end-of-year assessment.':null]);
    await db.query('INSERT INTO goals(member_id,year,goal,result) VALUES($1,$2,$3,$4)',[member,year,index%2?'Read one book in translation each season.':'Try a genre outside my usual shelf.',year===2034?'Yes':null]);
   }
  }
  await db.query('UPDATE club_metadata SET demo_seed_version=1 WHERE id=1');
  await db.execute('COMMIT');
 }catch(error){await db.execute('ROLLBACK');throw error;}
}
