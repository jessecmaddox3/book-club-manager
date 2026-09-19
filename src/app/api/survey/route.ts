import {NextResponse} from 'next/server';
import {apiActor,apiFailure,readJson,ApiError} from '@/lib/api';
import {getRuntime} from '@/lib/runtime/context';
import {getActiveBallot,toActiveBallot} from '@/lib/ballots';
import {validateSurveySubmission} from '@/lib/survey';
export async function POST(request:Request){
 try{
  const actor=await apiActor(request),body=await readJson(request),ballot=await getActiveBallot();
  if(!ballot)throw new ApiError('No ballot is open.',409);
  const validated=validateSurveySubmission(body,toActiveBallot(ballot));
  if(!validated.ok)throw new ApiError(validated.error,validated.status);
  const input=validated.data;
  const [row]=await(await getRuntime()).db.query<{result:{revision:number;verdict:unknown}}>('SELECT club_submit_survey($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9::jsonb) AS result',[
   actor.memberId,input.ballotId,input.ballotRevision,input.responseRevision,JSON.stringify(input.ratings),JSON.stringify(input.datePreferences),input.willingToHost,input.willingToBringBourbon,input.verdictChange?JSON.stringify(input.verdictChange):null,
  ]);
  return NextResponse.json(row.result);
 }catch(error){return apiFailure(error);}
}
