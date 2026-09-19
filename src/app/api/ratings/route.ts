import {NextResponse} from 'next/server';
import {apiActor,apiFailure,readJson} from '@/lib/api';
import {getRuntime} from '@/lib/runtime/context';
import {ratingSubmissionSchema} from '@/lib/ratings';
export async function POST(request:Request){
 try{
  const actor=await apiActor(request),input=ratingSubmissionSchema.parse(await readJson(request));
  const [row]=await(await getRuntime()).db.query<{result:{revision:number;status:string;rating:number|null}}>('SELECT club_save_verdict($1,$2,$3,$4,$5,$6) AS result',[actor.memberId,input.meetingId,input.bookId,input.status,input.rating,input.revision]);
  return NextResponse.json(row.result);
 }catch(error){return apiFailure(error);}
}
