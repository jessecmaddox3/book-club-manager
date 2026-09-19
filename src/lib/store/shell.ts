import type {Actor} from '../auth/identity';
import type {Database} from './database';

export async function getShell(db:Database,actor:Actor){
 await db.query('SELECT club_actor($1)',[actor.memberId]);
 const rows=await db.query<{id:string;meeting_number:number;has_voted:boolean}>(`SELECT b.id,b.meeting_number,
  EXISTS(SELECT 1 FROM survey_responses r WHERE r.ballot_id=b.id AND r.member_id=$1) AS has_voted
  FROM ballots b WHERE b.status='open'`,[actor.memberId]);
 return {openBallot:rows[0]?{id:rows[0].id,meetingNumber:rows[0].meeting_number}:null,hasVoted:rows[0]?.has_voted??false};
}
