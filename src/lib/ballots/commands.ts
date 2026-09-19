import {randomUUID} from 'node:crypto';
import type {Actor} from '../auth/identity';
import type {Database} from '../store/database';
import {BallotRepository} from '../store/ballots';
import {ballotDefinitionSchema,type BallotDefinition} from './definition';
import {isCalendarDate} from './dates';
import {z} from 'zod';

export const closePlanSchema=z.object({version:z.literal(1),instanceId:z.uuid(),generation:z.uuid(),operationId:z.uuid(),payload:z.object({ballotId:z.uuid(),revision:z.number().int().positive(),responsesRevision:z.number().int().min(0),selectedBookId:z.uuid(),date:z.string().refine(isCalendarDate),hostId:z.uuid().nullable(),location:z.string().max(500).nullable(),beverageMemberIds:z.array(z.uuid()).max(100)})});
export type ClosePlan=z.infer<typeof closePlanSchema>;
export class BallotCommands{
 constructor(private db:Database,private actor:Actor){}
 async status(){
  await this.db.query('SELECT club_actor($1,TRUE)',[this.actor.memberId]);
  return this.db.query(`SELECT b.id,b.meeting_number,b.survey_id,b.status,b.revision,b.responses_revision,b.opened_at::text,b.closed_at::text,(SELECT count(*)::integer FROM survey_responses r WHERE r.ballot_id=b.id) AS responses FROM ballots b ORDER BY b.meeting_number DESC`);
 }
 async ballot(number:number){
  if(!Number.isInteger(number)||number<1)throw new Error('Choose a positive whole meeting number.');
  await this.db.query('SELECT club_actor($1,TRUE)',[this.actor.memberId]);
  const [b]=await this.db.query<{id:string}>('SELECT id FROM ballots WHERE meeting_number=$1',[number]);
  if(!b)throw new Error('No ballot exists for that meeting. Build a draft first.');
  return (await new BallotRepository(this.db,this.actor).admin(b.id))!;
 }
 async validateDraft(input:unknown){
  const definition=ballotDefinitionSchema.parse(input);
  await this.db.query('SELECT club_actor($1,TRUE)',[this.actor.memberId]);
  for(const n of definition.nominees)await this.db.query('SELECT club_recommender($1)',[n.recommendedBy]);
  const [prior]=await this.db.query<{revision:number;status:string}>('SELECT revision,status FROM ballots WHERE meeting_number=$1',[definition.meetingNumber]);
  if(prior&&prior.status!=='draft')throw new Error('Only a draft ballot can be replaced.');
  return {definition,revision:prior?.revision??0};
 }
 async replace(definition:BallotDefinition,revision:number){return (await this.db.query<{result:unknown}>('SELECT club_replace_draft($1,$2,$3::jsonb) AS result',[this.actor.memberId,revision,JSON.stringify(definition)]))[0].result;}
 async open(number:number){const {ballot}=await this.ballot(number);return (await this.db.query<{result:unknown}>('SELECT club_open_ballot($1,$2,$3) AS result',[this.actor.memberId,ballot.id,ballot.revision]))[0].result;}
 async reopen(number:number){const {ballot}=await this.ballot(number);return (await this.db.query<{result:unknown}>('SELECT club_reopen_ballot($1,$2,$3) AS result',[this.actor.memberId,ballot.id,ballot.revision]))[0].result;}
 private async member(value:string|null|undefined){if(!value)return null;return (await this.db.query<{id:string}>('SELECT club_recommender($1) AS id',[value]))[0].id;}
 async closePlan(number:number,choice:{book:string;date:string;host?:string;location?:string;beverages?:string[]}){
  const view=await this.ballot(number),b=view.ballot;
  if(b.status!=='open')throw new Error('Only an open ballot can be finalized.');
  const selected=b.books.find(book=>book.id===choice.book||book.bookId===choice.book);if(!selected)throw new Error('Choose a book slug or UUID on this ballot.');
  if(!b.dateOptions.some(d=>d.id===choice.date))throw new Error('Choose one of the ballot dates.');
  const hostId=await this.member(choice.host),beverageMemberIds:string[]=[];
  for(const name of choice.beverages??[]){const id=await this.member(name);if(id&&!beverageMemberIds.includes(id))beverageMemberIds.push(id);}
  const [meta]=await this.db.query<{instance_id:string;generation:string}>('SELECT instance_id,generation FROM club_metadata WHERE id=1');
  const plan:ClosePlan={version:1,instanceId:meta.instance_id,generation:meta.generation,operationId:randomUUID(),payload:{ballotId:b.id,revision:b.revision,responsesRevision:b.responsesRevision,selectedBookId:selected.bookId,date:choice.date,hostId,location:choice.location??null,beverageMemberIds}};
  return {view,plan:closePlanSchema.parse(plan)};
 }
 async applyClose(input:unknown){
  const plan=closePlanSchema.parse(input);
  const [meta]=await this.db.query<{instance_id:string;generation:string}>('SELECT instance_id,generation FROM club_metadata WHERE id=1');
  if(meta.instance_id!==plan.instanceId||meta.generation!==plan.generation)throw new Error('This close plan belongs to a different club or an earlier reset.');
  return (await this.db.query<{result:unknown}>('SELECT club_close_ballot($1,$2,$3::jsonb) AS result',[this.actor.memberId,plan.operationId,JSON.stringify(plan.payload)]))[0].result;
 }
}
