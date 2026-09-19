import {getIronSession} from 'iron-session';
import {cookies} from 'next/headers';
import {cache} from 'react';
import {redirect} from 'next/navigation';
import {runtimeConfig} from './runtime/config';
import {getRuntime} from './runtime/context';
import {authClient} from './auth/supabase';
import {resolveActor,type Actor} from './auth/identity';

export type SessionData=Actor;
export type DemoSession={memberId?:string;instanceId?:string;generation?:string};
export async function getDemoSession(){
 const runtime=await getRuntime();
 if(runtime.config.mode!=='demo')throw new Error('Demo identities are unavailable in production.');
 return getIronSession<DemoSession>(await cookies(),{
  password:runtime.sessionSecret,cookieName:'book-club-demo',
  cookieOptions:{httpOnly:true,sameSite:'strict',secure:new URL(runtime.config.origin).protocol==='https:',path:'/',maxAge:60*60*24*7},
 });
}

// Server components cannot write cookies; the proxy refreshes them before render.
// Route handlers use the writable adapter for sign-in and sign-out.
export async function getAuthClient(writable=false){
 const config=runtimeConfig(),jar=await cookies();
 return authClient(config,{getAll:()=>jar.getAll(),setAll:(values)=>{
  // The proxy already refreshes the request and response cookies. Server
  // components cannot write them; route handlers explicitly opt into writes.
  if(writable)for(const {name,value,options} of values)jar.set(name,value,options);
 }});
}

export const getUser=cache(async():Promise<Actor|null>=>{
 const config=runtimeConfig();
 if(config.mode==='demo'){
  const session=await getDemoSession();
  if(!session.memberId||!session.instanceId||!session.generation)return null;
  return resolveActor((await getRuntime()).db,{mode:'demo',memberId:session.memberId,instanceId:session.instanceId,generation:session.generation});
 }
 const {data,error}=await(await getAuthClient()).auth.getUser();
 if(error||!data.user)return null;
 return resolveActor((await getRuntime()).db,{mode:'production',subject:data.user.id});
});
export async function requireUser():Promise<Actor>{
 const user=await getUser();if(!user)redirect('/login');return user;
}
