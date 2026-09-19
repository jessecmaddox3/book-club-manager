import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {getDemoSession,getAuthClient,getUser} from '@/lib/session';
import {runtimeConfig,requireSameOrigin} from '@/lib/runtime/config';
import {ApiError,apiFailure} from '@/lib/api';
import {assertActorBinding} from '@/lib/auth/identity';
import {authCookieName} from '@/lib/auth/supabase';
export async function POST(request:Request){
 try{
  const config=runtimeConfig();try{requireSameOrigin(request,config);}catch{throw new ApiError('Sign out from your club page.',403);}
  // Revoked membership and database outages must not trap a browser session.
  // When identity is available, an old tab still cannot sign out a new reader.
  const actor=await getUser().catch(()=>null);
  if(actor)assertActorBinding(actor,request.headers.get('x-bookclub-actor'));
  if(config.mode==='demo')(await getDemoSession()).destroy();
  else {
   try{await(await getAuthClient(true)).auth.signOut({scope:'local'});}
   catch{/* Local browser cleanup still succeeds when the provider is unavailable. */}
   finally{
    const jar=await cookies();
    for(const cookie of jar.getAll())if(cookie.name===authCookieName||cookie.name.startsWith(authCookieName+'.'))jar.delete(cookie.name);
   }
  }
  return NextResponse.json({success:true});
 }catch(error){return apiFailure(error);}
}
