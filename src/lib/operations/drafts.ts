import type {Database} from '../store/database';
import type {Actor} from '../auth/identity';
import type {ClubConfig} from '../runtime/config';
import {BallotCommands} from '../ballots/commands';
import {ReadRepository} from '../store/reads';
import {calendarFile} from './calendar';
export const draftKinds=['nominations','shortlist','vote','reminder','results','week-of'] as const;
export type DraftKind=typeof draftKinds[number];
type Recipient={memberId:string;name:string;email:string|null};
type Suggestion={id:string;bookId:string;title:string;author:string;memberId:string;proposedBy:string;notes:string|null};
type Draft={draft:true;kind:DraftKind;subject:string;body:string;recipients:Recipient[];suggestions?:Suggestion[];calendar?:string;preparedAt:string;review:string};
type Context={db:Database;actor:Actor;club:ClubConfig;origin:string};

export async function operationDraft({db,actor,club,origin}:Context,kind:DraftKind,meetingNumber?:number):Promise<Draft>{
 await db.query('SELECT club_actor($1,TRUE)',[actor.memberId]);
 const recipients=await db.query<Recipient>("SELECT id AS \"memberId\",display_name AS name,email FROM members WHERE role<>'former' ORDER BY display_name,id");
 const base:Draft={draft:true,kind,subject:'',body:'',recipients,preparedAt:new Date().toISOString(),review:'Review the text, dates and recipient list before using it. Nothing has been sent or marked delivered.'};
 const welcome=`Hi everyone,\n\n`,signoff='\n\nCheers!';
 if(kind==='nominations')return {...base,subject:`${club.name}: what should we read next?`,body:welcome+`Found a book worth talking about? Add your suggestion here:\n${origin}/books/submit\n\nA sentence or two about why it would make a good discussion is welcome.`+signoff};
 if(kind==='shortlist'){
  const suggestions=await db.query<Suggestion>(`SELECT n.id,b.id AS "bookId",b.title,b.author,n.member_id AS "memberId",m.display_name AS "proposedBy",n.notes FROM book_nominations n JOIN books b ON b.id=n.book_id JOIN members m ON m.id=n.member_id WHERE n.status='suggested' AND n.ballot_id IS NULL ORDER BY n.created_at,n.id`);
  return {...base,recipients:[],suggestions,subject:`${club.name}: organizer shortlist worksheet`,body:`Private organizer worksheet. Choose the books and possible dates deliberately. Use member UUIDs from these suggestions in recommendedBy, verify book descriptions and length, and save a ballot definition.\n\n${suggestions.map(s=>`${s.title} by ${s.author}\nSuggested by ${s.proposedBy} (${s.memberId})${s.notes?'\n'+s.notes:''}`).join('\n\n')||'No queued suggestions yet.'}\n\nPreview with: npm run cycle -- build private/ballot.json\nApply only after review by adding --yes.`};
 }
 if(!Number.isInteger(meetingNumber)||meetingNumber!<1)throw new Error('Choose an explicit positive meeting number.');
 const view=await new BallotCommands(db,actor).ballot(meetingNumber!);
 if(kind==='vote'||kind==='reminder'){
  if(view.ballot.status!=='open')throw new Error('Voting announcements and reminders require an open ballot.');
  if(kind==='reminder'){
   const ids=new Set(view.reminderRecipients.map(m=>m.id));
   return {...base,recipients:recipients.filter(r=>ids.has(r.memberId)),subject:`${club.name}: a quick ballot reminder`,body:welcome+`A quick reminder to choose your books and dates for meeting ${meetingNumber}:\n${origin}/survey\n\nThanks for helping us get the next one on the calendar.`+signoff};
  }
  return {...base,subject:`${club.name}: the next ballot is open`,body:welcome+`The ballot for meeting ${meetingNumber} is ready:\n${origin}/survey\n\n${view.ballot.books.map(b=>`• ${b.title} by ${b.author}`).join('\n')}\n\nRate every book from 1 to 5, mark which dates work, and let us know if you can host or bring ${club.beverageLabel}.`+signoff};
 }
 if(view.ballot.status!=='closed')throw new Error('Results and meeting reminders require a closed ballot. Finalize the book and date first.');
 const detail=await new ReadRepository(db,actor).meetingDetail(meetingNumber!);
 if(!detail?.meeting.book||!detail.meeting.date)throw new Error('A finalized book and date are required.');
 const m=detail.meeting;
 if(kind==='week-of'){
  const [{today}]=await db.query<{today:string}>('SELECT club_today()::text AS today');
  if(m.state==='held'||m.date!<today)throw new Error('A week-of reminder needs an upcoming meeting.');
 }
 const link=`${origin}/meetings/${meetingNumber}`;
 const details=[`Meeting ${meetingNumber}: ${m.book!.title} by ${m.book!.author}`,`Date: ${m.date} at ${club.meetingTime} (${club.timeZone})`,`Host: ${m.host?.display_name??'Still to be arranged'}`,`Location: ${m.location??'Still to be arranged'}`,
  `${club.beverageLabel}: ${detail.beverageVolunteers.map(v=>v.name).join(', ')||'Still to be arranged'}`].join('\n');
 const [{instance_id}]=await db.query<{instance_id:string}>('SELECT instance_id FROM club_metadata WHERE id=1');
 const calendar=calendarFile({instanceId:instance_id,meetingId:m.id,revision:m.revision,title:`${club.name}: ${m.book!.title}`,description:details+'\n'+link,location:m.location??'',date:m.date!,time:club.meetingTime,timeZone:club.timeZone,minutes:club.meetingMinutes,url:link});
 return {...base,subject:`${club.name}: ${kind==='week-of'?'see you soon for':'next up,'} ${m.book!.title}`,body:welcome+details+`\n\nMeeting details:\n${link}`+signoff,calendar};
}
