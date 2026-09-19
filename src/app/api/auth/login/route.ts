import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getDemoSession,getAuthClient} from '@/lib/session';
import {getRuntime} from '@/lib/runtime/context';
import {runtimeConfig,requireSameOrigin} from '@/lib/runtime/config';
import {resolveActor} from '@/lib/auth/identity';
import {readJson,apiFailure,ApiError} from '@/lib/api';
export async function POST(request:Request){
 try{
  const config=runtimeConfig();
  try{requireSameOrigin(request,config);}catch{throw new ApiError('Sign in from your club page.',403);}
  const body=await readJson(request);
  if(config.mode==='demo'){
   const {memberId}=z.object({memberId:z.uuid()}).strict().parse(body),runtime=await getRuntime();
   const [metadata]=await runtime.db.query<{instance_id:string;generation:string}>('SELECT instance_id,generation FROM club_metadata WHERE id=1');
   const actor=await resolveActor(runtime.db,{mode:'demo',memberId,instanceId:metadata.instance_id,generation:metadata.generation});
   if(!actor)throw new ApiError('Choose an active demo reader.',401);
   const session=await getDemoSession();session.memberId=actor.memberId;session.instanceId=metadata.instance_id;session.generation=metadata.generation;await session.save();
   return NextResponse.json({success:true});
  }
  const {email,password}=z.object({email:z.email().max(254),password:z.string().min(1).max(1024)}).strict().parse(body);
  const auth=await getAuthClient(true),{data,error}=await auth.auth.signInWithPassword({email,password});
  if(error||!data.user)throw new ApiError('That email and password did not sign in. Try again or contact your organizer.',401);
  const actor=await resolveActor((await getRuntime()).db,{mode:'production',subject:data.user.id});
  if(!actor){await auth.auth.signOut({scope:'local'});throw new ApiError('Your account is not linked to an active club membership. Contact your organizer.',403);}
  return NextResponse.json({success:true});
 }catch(error){return apiFailure(error);}
}
