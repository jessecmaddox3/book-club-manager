import type { Database } from '../store/database';

export type Actor={memberId:string;displayName:string;fullName:string;role:'admin'|'member'};
export function assertActorBinding(actor:Actor,expected:unknown):void{
 if(expected!==actor.memberId)throw new Error('stale_identity');
}
export type VerifiedIdentity=
 | {mode:'production';subject:string}
 | {mode:'demo';memberId:string;instanceId:string;generation:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Production callers supply only a subject verified by Auth, never browser JSON
// or user-editable metadata. Every lookup reads the member's current role.
export async function resolveActor(db:Database,identity:VerifiedIdentity):Promise<Actor|null>{
 const identifier=identity.mode==='production'?identity.subject:identity.memberId;
 if(!uuid.test(identifier))return null;
 const rows=identity.mode==='production'
  ?await db.query(`SELECT m.id,m.display_name,m.full_name,m.role FROM members m,club_metadata c
     WHERE c.id=1 AND c.mode='production' AND m.auth_subject=$1 AND m.role<>'former'`,[identifier])
  :!uuid.test(identity.instanceId)||!uuid.test(identity.generation)?[]
  :await db.query(`SELECT m.id,m.display_name,m.full_name,m.role FROM members m,club_metadata c
     WHERE c.id=1 AND c.mode='demo' AND c.instance_id=$1 AND c.generation=$2 AND m.id=$3 AND m.role<>'former'`,[identity.instanceId,identity.generation,identifier]);
 const member=rows[0];
 return member?{memberId:String(member.id),displayName:String(member.display_name),fullName:String(member.full_name),role:member.role as Actor['role']}:null;
}
