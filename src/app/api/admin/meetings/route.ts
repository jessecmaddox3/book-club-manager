import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiActor,apiFailure,readJson} from '@/lib/api';
import {getRuntime} from '@/lib/runtime/context';
const schema=z.object({action:z.literal('recordResults'),meetingId:z.uuid(),revision:z.number().int().positive(),notes:z.string().max(20000)});
export async function POST(request:Request){
 try{
  const actor=await apiActor(request,true),input=schema.parse(await readJson(request));
  const [row]=await(await getRuntime()).db.query<{result:unknown}>('SELECT club_update_meeting_notes($1,$2,$3,$4) AS result',[actor.memberId,input.meetingId,input.revision,input.notes]);
  return NextResponse.json(row.result);
 }catch(error){return apiFailure(error);}
}
