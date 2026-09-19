import type {Actor} from '../auth/identity';
import type {Database} from './database';
import {getShell} from './shell';

export type BookView={id:string;title:string;author:string;goodreads_rating:number|null;cover_image_url:string|null;page_count:number|null;description:string|null;genre:string|null};
export type MeetingView={id:string;number:number;book_id:string|null;ballot_id:string|null;date:string|null;date_end:string|null;date_estimate:string|null;host_id:string|null;location:string|null;format:string|null;notes:string|null;state:'held'|'scheduled'|'tentative';revision:number;book:BookView|null;host:{id:string;display_name:string}|null};
export type VerdictView={member_id:string;rating:number|null;status:'read'|'did_not_read'|'did_not_attend'|'unrated';revision:number;member:{display_name:string}|null};
export type BacklogRow=MeetingView&{verdict:{status:VerdictView['status'];rating:number|null;revision:number};answered:boolean};
export type MemberView={id:string;full_name:string;display_name:string;role:'admin'|'member'|'former';joined_info:string|null;left_info:string|null;bio:string|null;notes:string|null;hosted_count:number;nomination_count:number};
export type AnnualBase={id:string;member_id:string;year:number;result:'Yes'|'No'|'Partial'|null;result_notes:string|null;member:{display_name:string}|null};
export type PredictionView=AnnualBase&{prediction:string};
export type GoalView=AnnualBase&{goal:string};
export type NominationView={id:string;meeting_number:number;book_id:string;book_title:string;book_author:string;notes:string|null;outcome:'Selected'|'Not selected'};
export type HistoricalBallotView={id:string;book_id:string;meeting_number:number;book_title:string;goodreads_rating:number|null;average_rating:number|null;was_selected:boolean;num_voters:number};
export type AdminMemberView={id:string;full_name:string;display_name:string;email:string|null;role:MemberView['role'];joined_info:string|null;reminder_exempt:boolean;revision:number};

const bookObject=`CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('id',b.id,'title',b.title,'author',b.author,'goodreads_rating',b.goodreads_rating,'cover_image_url',b.cover_image_url,'page_count',b.page_count,'description',b.description,'genre',b.genre) END`;
const meetingSelect=`SELECT m.id,m.number,m.book_id,m.ballot_id,m.date::text,m.date_end::text,m.date_estimate,m.host_id,m.location,m.format,m.notes,m.state,m.revision,
 ${bookObject} AS book,CASE WHEN h.id IS NULL THEN NULL ELSE jsonb_build_object('id',h.id,'display_name',h.display_name) END AS host
 FROM meetings m LEFT JOIN books b ON b.id=m.book_id LEFT JOIN members h ON h.id=m.host_id`;
const finalized=`JOIN ballots ballot ON ballot.id=n.ballot_id AND ballot.status='closed' JOIN meetings meeting ON meeting.ballot_id=ballot.id AND meeting.state<>'tentative'`;
const memberSelect=`SELECT m.id,m.full_name,m.display_name,m.role,m.joined_info,m.left_info,m.bio,m.notes,
 (SELECT count(*)::integer FROM meetings x WHERE x.host_id=m.id AND x.state<>'tentative') AS hosted_count,
 (SELECT count(*)::integer FROM book_nominations n ${finalized} WHERE n.member_id=m.id) AS nomination_count FROM members m`;
const held=`(m.state='held' OR (m.state='scheduled' AND m.date<club_today()))`;
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export class ReadRepository{
 constructor(private db:Database,private actor:Actor){}
 private async authorize(admin=false){await this.db.query('SELECT club_actor($1,$2)',[this.actor.memberId,admin]);}
 async myPendingNominations(){
  await this.authorize();
  return this.db.query<{id:string;title:string;author:string;notes:string|null;status:'suggested'|'on_ballot';meetingNumber:number|null}>(`SELECT n.id,b.title,b.author,n.notes,n.status,n.meeting_number AS "meetingNumber"
   FROM book_nominations n JOIN books b ON b.id=n.book_id LEFT JOIN ballots ballot ON ballot.id=n.ballot_id
   WHERE n.member_id=$1 AND n.status IN('suggested','on_ballot') AND (n.ballot_id IS NULL OR ballot.status<>'closed')
   ORDER BY n.created_at DESC,n.id`,[this.actor.memberId]);
 }
 async meetings():Promise<MeetingView[]>{await this.authorize();return this.db.query(meetingSelect+" WHERE m.state<>'tentative' ORDER BY m.number DESC");}
 async backlog():Promise<BacklogRow[]>{
  await this.authorize();
  const meetings=await this.db.query<MeetingView>(meetingSelect+" WHERE m.state<>'tentative' AND m.book_id IS NOT NULL ORDER BY m.number DESC");
  const verdicts=await this.db.query<{meeting_id:string;rating:number|null;status:VerdictView['status'];revision:number}>('SELECT meeting_id,rating,status,revision FROM book_ratings WHERE member_id=$1',[this.actor.memberId]);
  const byMeeting=new Map(verdicts.map(v=>[v.meeting_id,v]));
  return meetings.map(m=>{const v=byMeeting.get(m.id),verdict={rating:v?.rating??null,status:v?.status??'unrated' as const,revision:v?.revision??0};return {...m,verdict,answered:verdict.status!=='unrated'};});
 }
 async home(){
  const meetings=await this.backlog(),shell=await getShell(this.db,this.actor);
  const [{today}]=await this.db.query<{today:string}>('SELECT club_today()::text AS today');
  return {...shell,meetings,latest:meetings[0]??null,upcoming:meetings.filter(m=>m.date&&m.date>=today).sort((a,b)=>a.date!.localeCompare(b.date!)||a.number-b.number)[0]??null,unrated:meetings.filter(m=>!m.answered)};
 }
 async meetingDetail(number:number){
  await this.authorize();if(!Number.isInteger(number)||number<1)return null;
  const [meeting]=await this.db.query<MeetingView>(meetingSelect+" WHERE m.number=$1 AND m.state<>'tentative'",[number]);
  if(!meeting)return null;
  const ballots=await this.db.query<HistoricalBallotView>(`SELECT h.id,h.book_id,h.meeting_number,h.book_title,h.goodreads_rating::float8,h.average_rating::float8,h.was_selected,h.num_voters
   FROM historical_ballots h JOIN ballots b ON b.id=h.ballot_id AND b.status='closed' WHERE h.ballot_id=$1 ORDER BY h.average_rating DESC NULLS LAST,h.book_id`,[meeting.ballot_id]);
  const [nomination]=await this.db.query<{display_name:string}>(`SELECT m.display_name FROM ballot_nominees n JOIN members m ON m.id=n.recommended_by JOIN ballots b ON b.id=n.ballot_id AND b.status='closed'
   WHERE n.ballot_id=$1 AND n.book_id=$2`,[meeting.ballot_id,meeting.book_id]);
  const verdicts=await this.db.query<VerdictView>(`SELECT r.member_id,r.rating,r.status,r.revision,jsonb_build_object('display_name',m.display_name) AS member FROM book_ratings r JOIN members m ON m.id=r.member_id WHERE r.meeting_id=$1 ORDER BY m.display_name,m.id`,[meeting.id]);
  const [preference]=await this.db.query<{rating:number|null}>(`SELECT h.rating::float8 FROM historical_votes h JOIN ballots b ON b.id=h.ballot_id AND b.status='closed' WHERE h.ballot_id=$1 AND h.book_id=$2 AND h.voter_id=$3`,[meeting.ballot_id,meeting.book_id,this.actor.memberId]);
  const beverageVolunteers=await this.db.query<{memberId:string;name:string}>('SELECT m.id AS "memberId",m.display_name AS name FROM meeting_bourbon_volunteers v JOIN members m ON m.id=v.member_id WHERE v.meeting_id=$1 ORDER BY m.display_name,m.id',[meeting.id]);
  const beverages=await this.db.query<{id:string;name:string|null;broughtBy:string|null;notes:string|null}>(`SELECT mb.id,coalesce(b.name,mb.bourbon_name_raw) AS name,m.display_name AS "broughtBy",b.tasting_notes AS notes FROM meeting_bourbons mb LEFT JOIN bourbons b ON b.id=mb.bourbon_id LEFT JOIN members m ON m.id=mb.brought_by WHERE mb.meeting_id=$1 ORDER BY mb.id`,[meeting.id]);
  return {meeting,ballots,submitter:nomination?.display_name??null,verdicts,myBallotVote:preference?.rating??null,beverageVolunteers,beverages};
 }
 async readBooks(){
  await this.authorize();
  const meetings=await this.db.query<MeetingView>(meetingSelect+` WHERE m.book_id IS NOT NULL AND ${held} ORDER BY m.number,m.id`);
  const byBook=new Map<string,{book:BookView;numbers:number[]}>();
  for(const m of meetings){const existing=byBook.get(m.book_id!);if(existing)existing.numbers.push(m.number);else byBook.set(m.book_id!,{book:m.book!,numbers:[m.number]});}
  return [...byBook.values()].sort((a,b)=>a.book.title.localeCompare(b.book.title)||a.book.author.localeCompare(b.book.author)||a.book.id.localeCompare(b.book.id));
 }
 async alsoRans(){
  await this.authorize();
  return this.db.query<{bookId:string;title:string;author:string;coverUrl:string|null;bestAvgRating:number|null;timesNominated:number;meetingNumbers:number[];hadRunoff:boolean;laterSelected:number|null;bestGoodreadsRating:number|null}>(`WITH history AS (
   SELECT h.*,m.notes FROM historical_ballots h JOIN ballots b ON b.id=h.ballot_id AND b.status='closed' JOIN meetings m ON m.ballot_id=b.id AND m.state<>'tentative'
  ) SELECT b.id AS "bookId",b.title,b.author,b.cover_image_url AS "coverUrl",max(h.average_rating)::float8 AS "bestAvgRating",count(DISTINCT h.ballot_id)::integer AS "timesNominated",
   array_agg(DISTINCT h.meeting_number ORDER BY h.meeting_number) AS "meetingNumbers",bool_or(coalesce(h.notes,'') ILIKE '%runoff%') AS "hadRunoff",
   (SELECT min(w.meeting_number) FROM history w WHERE w.book_id=b.id AND w.was_selected AND w.meeting_number>min(h.meeting_number)) AS "laterSelected",
   max(h.goodreads_rating)::float8 AS "bestGoodreadsRating"
  FROM history h JOIN books b ON b.id=h.book_id WHERE NOT h.was_selected GROUP BY b.id
  ORDER BY "bestAvgRating" DESC NULLS LAST,"timesNominated" DESC,b.title,b.author,b.id`);
 }
 async memberDirectory():Promise<MemberView[]>{await this.authorize();return this.db.query(memberSelect+' ORDER BY m.full_name,m.id');}
 async memberProfile(id:string){
  await this.authorize();if(!validId(id))return null;
  const [member]=await this.db.query<MemberView>(memberSelect+' WHERE m.id=$1',[id]);if(!member)return null;
  const nominations=await this.db.query<NominationView>(`SELECT n.id,n.meeting_number,n.book_id,n.book_title,n.book_author,n.notes,
   CASE WHEN h.was_selected THEN 'Selected' ELSE 'Not selected' END AS outcome FROM book_nominations n ${finalized}
   JOIN historical_ballots h ON h.ballot_id=n.ballot_id AND h.book_id=n.book_id WHERE n.member_id=$1 ORDER BY n.meeting_number DESC,n.id`,[id]);
  const predictions=await this.db.query<PredictionView>("SELECT id,member_id,year,prediction,result,result_notes FROM predictions WHERE member_id=$1 ORDER BY year DESC,created_at,id",[id]);
  const goals=await this.db.query<GoalView>("SELECT id,member_id,year,goal,result,result_notes FROM goals WHERE member_id=$1 ORDER BY year DESC,created_at,id",[id]);
  return {member,nominations,predictions,goals,hostedCount:member.hosted_count};
 }
 async annual(year?:number){
  await this.authorize();
  if(year!==undefined&&(!Number.isInteger(year)||year<1||year>9999))return {predictions:[],goals:[]} as {predictions:PredictionView[];goals:GoalView[]};
  const filter=year===undefined?'':' WHERE p.year=$1',values=year===undefined?[]:[year];
  const predictions=await this.db.query<PredictionView>(`SELECT p.id,p.member_id,p.year,p.prediction,p.result,p.result_notes,jsonb_build_object('display_name',m.display_name) AS member FROM predictions p LEFT JOIN members m ON m.id=p.member_id${filter} ORDER BY p.year DESC,p.created_at,p.id`,values);
  const goals=await this.db.query<GoalView>(`SELECT p.id,p.member_id,p.year,p.goal,p.result,p.result_notes,jsonb_build_object('display_name',m.display_name) AS member FROM goals p LEFT JOIN members m ON m.id=p.member_id${filter} ORDER BY p.year DESC,p.created_at,p.id`,values);
  return {predictions,goals};
 }
 async adminMembers():Promise<AdminMemberView[]>{await this.authorize(true);return this.db.query('SELECT id,full_name,display_name,email,role,joined_info,reminder_exempt,revision FROM members ORDER BY full_name,id');}
 async adminMeetings():Promise<MeetingView[]>{await this.authorize(true);return this.db.query(meetingSelect+' ORDER BY m.number DESC');}
 async adminSummary(){
  await this.authorize(true);
  const [counts]=await this.db.query<{memberCount:number;meetingCount:number}>(`SELECT (SELECT count(*)::integer FROM members WHERE role<>'former') AS "memberCount",(SELECT count(*)::integer FROM meetings WHERE state<>'tentative') AS "meetingCount"`);
  return {...counts,...await getShell(this.db,this.actor)};
 }
}
