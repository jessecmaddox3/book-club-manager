import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiActor,apiFailure,readJson} from '@/lib/api';
import {getRuntime} from '@/lib/runtime/context';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),fullName:z.string().trim().min(1).max(200),displayName:z.string().trim().max(100).optional(),email:z.email().max(254).nullable().optional(),role:z.enum(['admin','member']).default('member')}),
 z.object({action:z.literal('updateRole'),memberId:z.uuid(),revision:z.number().int().positive(),role:z.enum(['admin','member','former']),reminderExempt:z.boolean().optional()}),
]);
export async function POST(request:Request){
 try{
  const actor=await apiActor(request,true),input=schema.parse(await readJson(request)),{db}=await getRuntime();
  const rows=input.action==='create'?await db.query<{result:unknown}>('SELECT club_create_member($1,$2::jsonb) AS result',[actor.memberId,JSON.stringify(input)]):await db.query<{result:unknown}>('SELECT club_update_member($1,$2,$3,$4,$5) AS result',[actor.memberId,input.memberId,input.revision,input.role,input.reminderExempt??null]);
  return NextResponse.json(rows[0].result);
 }catch(error){return apiFailure(error);}
}
