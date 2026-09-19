import {NextResponse} from 'next/server';
import {apiActor,apiFailure,readJson} from '@/lib/api';
import {getRuntime} from '@/lib/runtime/context';
import {nominationSubmissionSchema} from '@/lib/nominations';
export async function POST(request:Request){
 try{
  const actor=await apiActor(request),input=nominationSubmissionSchema.parse(await readJson(request));
  const [row]=await(await getRuntime()).db.query<{result:unknown}>('SELECT club_nominate($1,$2::jsonb) AS result',[actor.memberId,JSON.stringify(input)]);
  return NextResponse.json(row.result);
 }catch(error){return apiFailure(error);}
}
