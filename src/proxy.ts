import {NextResponse,type NextRequest} from 'next/server';
import {runtimeConfig,requireSameOrigin,requireConfiguredHost} from './lib/runtime/config';
import {authClient,authCookieName} from './lib/auth/supabase';
import {invalidAuthCookies} from './lib/auth/cookies';

export async function proxy(request:NextRequest){
 const config=runtimeConfig();
 try{requireConfiguredHost(request,config);}catch{return new NextResponse('Open the club at its configured address.',{status:400});}
 if(!['GET','HEAD','OPTIONS'].includes(request.method)){
  try{requireSameOrigin(request,config);}catch{return new NextResponse('This change must come from your club page.',{status:403});}
 }
 const invalid=config.mode==='production'?invalidAuthCookies(request.cookies.getAll()):[];
 for(const name of invalid)request.cookies.delete(name);
 let response=NextResponse.next({request});
 for(const name of invalid)response.cookies.delete(name);
 response.headers.set('Cache-Control','private, no-store');
 if(config.mode==='production'&&request.cookies.getAll().some(({name})=>name===authCookieName||name.startsWith(authCookieName+'.'))){
  const auth=authClient(config,{
   getAll:()=>request.cookies.getAll(),
   setAll:(values)=>{
    for(const {name,value} of values)request.cookies.set(name,value);
    response=NextResponse.next({request});
    for(const {name,value,options} of values)response.cookies.set(name,value,options);
    response.headers.set('Cache-Control','private, no-store');
   },
  });
  // Refresh before render. Protected loaders still check the Auth user and
  // current membership; this proxy is not the authorization boundary.
  await auth.auth.getClaims();
 }
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|fonts/|covers/).*)']};
