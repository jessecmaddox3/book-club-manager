import type {Actor} from '../auth/identity';
import type {Database} from './database';
import type {BallotView,BallotBookView,PreviousBook,SurveyResponseView} from '../ballots/types';
import {buildWeeksFromDates,dateOptionFromIso} from '../ballots/dates';

type BallotRow={id:string;survey_id:string;meeting_number:number;status:BallotView['status'];revision:number;responses_revision:number;previous_meeting_id:string|null};
type VoteRow={member_id:string;member_name:string;ratings:Record<string,number>;date_preferences:Record<string,string>;willing_to_host:boolean;willing_to_bring_bourbon:boolean;revision:number};
type PreviousRating={name:string;rating:number;memberId:string};

export class BallotRepository{
 constructor(private db:Database,private actor:Actor){}
 private async authorize(admin=false){await this.db.query('SELECT club_actor($1,$2)',[this.actor.memberId,admin]);}
 async current(admin=false,id?:string):Promise<BallotView|null>{
  await this.authorize(admin);
  if(id&&!/^[0-9a-f-]{36}$/i.test(id))return null;
  const [b]=await this.db.query<BallotRow>(`SELECT id,survey_id,meeting_number,status,revision,responses_revision,previous_meeting_id FROM ballots
   WHERE ${id?'id=$1':admin?'TRUE':"status IN('open','closed')"} ORDER BY CASE WHEN status='open' THEN 0 ELSE 1 END,meeting_number DESC LIMIT 1`,id?[id]:[]);
  if(!b||(!admin&&b.status==='draft'))return null;
  // No attribution or source commentary is selected into the member DTO.
  const books=await this.db.query<BallotBookView>(`SELECT n.slug AS id,n.book_id AS "bookId",b.title,n.subtitle,b.author,n.cover_image AS "coverImage",n.goodreads_rating::float8 AS "goodreadsRating",n.pages,n.audiobook_length AS "audiobookLength",coalesce(n.description,'') AS description,coalesce(n.case_for,'') AS "whyLike",coalesce(n.case_against,'') AS "whyNot"
   FROM ballot_nominees n JOIN books b ON b.id=n.book_id WHERE n.ballot_id=$1 ORDER BY n.sort_order,n.slug`,[b.id]);
  const dates=await this.db.query<{date:string}>('SELECT date::text FROM ballot_dates WHERE ballot_id=$1 ORDER BY date',[b.id]);
  const weeks=buildWeeksFromDates(dates.map(d=>dateOptionFromIso(d.date)));
  const [previousBook]=await this.db.query<PreviousBook>(`SELECT m.id AS "meetingId",book.id AS "bookId",book.title,book.author,jsonb_build_object('status',coalesce(r.status,'unrated'),'rating',r.rating,'revision',coalesce(r.revision,0)) AS verdict
   FROM meetings m JOIN books book ON book.id=m.book_id LEFT JOIN book_ratings r ON r.meeting_id=m.id AND r.member_id=$2 WHERE m.id=$1 AND m.state<>'tentative'`,[b.previous_meeting_id,this.actor.memberId]);
  const [existingResponse]=await this.db.query<SurveyResponseView>(`SELECT revision,ratings,date_preferences AS "datePreferences",willing_to_host AS "willingToHost",willing_to_bring_bourbon AS "willingToBringBourbon" FROM survey_responses WHERE ballot_id=$1 AND member_id=$2`,[b.id,this.actor.memberId]);
  return {source:'db',id:b.id,surveyId:b.survey_id,meetingNumber:b.meeting_number,status:b.status,revision:b.revision,responsesRevision:b.responses_revision,books,dateOptions:weeks.flatMap(w=>w.dates),weeks,previousBook:previousBook??null,existingResponse:existingResponse??null};
 }
 private async votes(id:string):Promise<VoteRow[]>{return this.db.query(`SELECT r.member_id,m.display_name AS member_name,r.ratings,r.date_preferences,r.willing_to_host,r.willing_to_bring_bourbon,r.revision FROM survey_responses r JOIN members m ON m.id=r.member_id WHERE r.ballot_id=$1 ORDER BY m.display_name,m.id`,[id]);}
 private async previousRatings(ballot:BallotView):Promise<PreviousRating[]>{
  if(!ballot.previousBook)return [];
  return this.db.query(`SELECT m.display_name AS name,r.rating,r.member_id AS "memberId" FROM book_ratings r JOIN members m ON m.id=r.member_id WHERE r.meeting_id=$1 AND r.status='read' ORDER BY m.display_name,m.id`,[ballot.previousBook.meetingId]);
 }
 private aggregate(ballot:BallotView,votes:VoteRow[],previous:PreviousRating[]){
  const bookAverages=ballot.books.map(book=>{
   const values=votes.map(v=>v.ratings[book.id]).filter(v=>Number.isFinite(v)&&v>=1&&v<=5);
   return {id:book.id,title:book.title,averageRating:values.length?values.reduce((sum,v)=>sum+v,0)/values.length:0,voteCount:values.length,isLeader:false};
  });
  const best=Math.max(0,...bookAverages.map(b=>b.averageRating));for(const b of bookAverages)b.isLeader=b.voteCount>0&&b.averageRating===best;
  const dateAvailability=ballot.dateOptions.map(date=>{
   let yes=0,maybe=0,no=0;for(const v of votes){const preference=v.date_preferences[date.id];if(preference==='yes')yes++;else if(preference==='maybe')maybe++;else if(preference==='no')no++;}
   return {...date,yes,maybe,no,unanswered:votes.length-yes-maybe-no,score:yes*2+maybe,isBest:false};
  });
  const bestDate=Math.max(0,...dateAvailability.map(d=>d.score));for(const d of dateAvailability)d.isBest=d.score>0&&d.score===bestDate;
  return {totalVotes:votes.length,bookAverages,dateAvailability,prevAvg:previous.length?previous.reduce((sum,r)=>sum+r.rating,0)/previous.length:0,previousCount:previous.length};
 }
 async results(){
  const ballot=await this.current();if(!ballot)return {kind:'none' as const};
  // Permission and returned votes share one database snapshot. A closed header
  // read before a concurrent reopen cannot grant access to newly submitted votes.
  const [snapshot]=await this.db.query<{allowed:boolean;votes:VoteRow[];previous:PreviousRating[]}>(`WITH permission AS (
   SELECT b.id,b.previous_meeting_id,
    (b.revision=$3 AND (b.status='closed' OR m.role='admin' OR EXISTS(SELECT 1 FROM survey_responses own WHERE own.ballot_id=b.id AND own.member_id=m.id))) AS allowed
   FROM ballots b JOIN members m ON m.id=$2 AND m.role<>'former'
   WHERE b.id=$1 AND b.status IN('open','closed')
  ) SELECT p.allowed,
   CASE WHEN p.allowed THEN coalesce((SELECT jsonb_agg(jsonb_build_object('member_id',r.member_id,'ratings',r.ratings,'date_preferences',r.date_preferences)) FROM survey_responses r WHERE r.ballot_id=p.id),'[]'::jsonb) ELSE '[]'::jsonb END AS votes,
   CASE WHEN p.allowed THEN coalesce((SELECT jsonb_agg(jsonb_build_object('rating',r.rating)) FROM book_ratings r WHERE r.meeting_id=p.previous_meeting_id AND r.status='read'),'[]'::jsonb) ELSE '[]'::jsonb END AS previous
   FROM permission p`,[ballot.id,this.actor.memberId,ballot.revision]);
  if(!snapshot)return {kind:'none' as const};
  if(!snapshot.allowed)return {kind:'vote_required' as const};
  return {kind:'visible' as const,ballot:{meetingNumber:ballot.meetingNumber,weeks:ballot.weeks,previousBook:ballot.previousBook?{title:ballot.previousBook.title,author:ballot.previousBook.author}:null},...this.aggregate(ballot,snapshot.votes,snapshot.previous)};
 }
 async admin(id?:string,attempt=0):Promise<AdminBallotView|null>{
  const ballot=await this.current(true,id);if(!ballot)return null;
  const members=await this.db.query<{id:string;display_name:string;full_name:string;reminder_exempt:boolean}>("SELECT id,display_name,full_name,reminder_exempt FROM members WHERE role<>'former' ORDER BY display_name,id");
  const votes=await this.votes(ballot.id),previousRatings=await this.previousRatings(ballot),voterIds=new Set(votes.map(v=>v.member_id));
  const nonVoters=members.filter(m=>!voterIds.has(m.id));
  const memberResponses=votes.map(v=>({memberId:v.member_id,memberName:v.member_name,ratings:v.ratings,datePreferences:v.date_preferences,willingToHost:v.willing_to_host,willingToBringBourbon:v.willing_to_bring_bourbon,revision:v.revision}));
  const attribution=await this.db.query<{bookId:string;recommendedBy:string;sources:{claim:string;url:string;note?:string}[]}>(`SELECT n.book_id AS "bookId",m.display_name AS "recommendedBy",n.sources FROM ballot_nominees n LEFT JOIN members m ON m.id=n.recommended_by WHERE n.ballot_id=$1 ORDER BY n.sort_order,n.slug`,[ballot.id]);
  const [guard]=await this.db.query<{allowed:boolean;unchanged:boolean}>(`SELECT EXISTS(SELECT 1 FROM members WHERE id=$1 AND role='admin') AS allowed,
   EXISTS(SELECT 1 FROM ballots WHERE id=$2 AND revision=$3 AND responses_revision=$4 AND status=$5) AS unchanged`,[this.actor.memberId,ballot.id,ballot.revision,ballot.responsesRevision,ballot.status]);
  if(!guard.allowed)throw new Error('not_authorized');
  if(!guard.unchanged){if(attempt===0)return this.admin(id,1);throw new Error('stale_read: the ballot changed while loading; reload it.');}
  return {ballot,members,nonVoters,reminderRecipients:nonVoters.filter(m=>!m.reminder_exempt),memberResponses,previousRatings,attribution,...this.aggregate(ballot,votes,previousRatings)};
 }
}

type AdminBallotView={
 ballot:BallotView;members:{id:string;display_name:string;full_name:string;reminder_exempt:boolean}[];
 nonVoters:AdminBallotView['members'];reminderRecipients:AdminBallotView['members'];
 memberResponses:{memberId:string;memberName:string;ratings:Record<string,number>;datePreferences:Record<string,string>;willingToHost:boolean;willingToBringBourbon:boolean;revision:number}[];
 previousRatings:PreviousRating[];attribution:{bookId:string;recommendedBy:string;sources:{claim:string;url:string;note?:string}[]}[];
 totalVotes:number;bookAverages:{id:string;title:string;averageRating:number;voteCount:number;isLeader:boolean}[];
 dateAvailability:(BallotView['dateOptions'][number]&{yes:number;maybe:number;no:number;unanswered:number;score:number;isBest:boolean})[];
 prevAvg:number;previousCount:number;
};
