import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { isCalendarDate } from "../ballots/dates";

export const clubConfigSchema=z.object({
 name:z.string().trim().min(1).max(80),tagline:z.string().trim().min(1).max(160),
 foundedYear:z.number().int().min(1).max(9999),
 timeZone:z.string().refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}},'Choose an IANA time zone.'),
 beverageLabel:z.string().trim().min(1).max(50),meetingTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
 meetingMinutes:z.number().int().min(15).max(1440),
 demoDate:z.string().refine(isCalendarDate).optional(),
});
export type ClubConfig=z.infer<typeof clubConfigSchema>;
export type RuntimeConfig={mode:'demo'|'production';root:string;dataDirectory:string;origin:string;databaseUrl?:string;authUrl?:string;authKey?:string;sessionSecret?:string;aiEnabled:boolean};
export function runtimeConfig(env:Record<string,string|undefined>=process.env,root=process.cwd()):RuntimeConfig{
 const mode=env.BOOKCLUB_MODE??'demo';
 if(mode!=='demo'&&mode!=='production')throw new Error('BOOKCLUB_MODE must be demo or production.');
 const port=Number(env.PORT??'5055');
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT must be a whole number from 1024 to 65535.');
 const origin=new URL(env.BOOKCLUB_ORIGIN??`http://127.0.0.1:${port}`);
 if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('BOOKCLUB_ORIGIN must be only an HTTP(S) origin.');
 const local=['127.0.0.1','localhost','[::1]'].includes(origin.hostname);
 if(!['http:','https:'].includes(origin.protocol))throw new Error('BOOKCLUB_ORIGIN must use HTTP or HTTPS.');
 if(mode==='demo'){
  if(!local||env.VERCEL||env.AWS_LAMBDA_FUNCTION_NAME)throw new Error('The account-free demo must run on your own computer at a loopback address. Configure production identities for a hosted club.');
  return {mode,root,dataDirectory:path.resolve(/* turbopackIgnore: true */ env.BOOKCLUB_DATA_DIR??path.join(root,'.local/demo')),origin:origin.origin,aiEnabled:false};
 }
 if(!local&&origin.protocol!=='https:')throw new Error('A hosted club needs HTTPS.');
 const required=['DATABASE_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SESSION_SECRET'] as const;
 for(const name of required)if(!env[name])throw new Error('Production setup is missing '+name+'. See the installation guide.');
 if(env.SESSION_SECRET!.length<32)throw new Error('SESSION_SECRET must contain at least 32 characters.');
 const auth=new URL(env.SUPABASE_URL!);
 if(!['http:','https:'].includes(auth.protocol))throw new Error('The identity service must use HTTP or HTTPS.');
 if(auth.username||auth.password||auth.search||auth.hash)throw new Error('The identity service URL cannot contain credentials, a query or a fragment.');
 if(auth.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(auth.hostname))throw new Error('The hosted identity service must use HTTPS.');
 const database=new URL(env.DATABASE_URL!);
 if(!['postgres:','postgresql:'].includes(database.protocol))throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
 if(!database.hostname)throw new Error('DATABASE_URL needs an explicit hostname. Inherited PGHOST is not used for hosted configuration.');
 return {mode,root,dataDirectory:'',origin:origin.origin,databaseUrl:env.DATABASE_URL,authUrl:env.SUPABASE_URL,authKey:env.SUPABASE_PUBLISHABLE_KEY,sessionSecret:env.SESSION_SECRET,aiEnabled:env.BOOKCLUB_ENABLE_AI==='yes'};
}
export async function loadClubConfig(file=process.env.BOOKCLUB_CONFIG??path.resolve('club.config.json')):Promise<ClubConfig>{
 return clubConfigSchema.parse(JSON.parse(await readFile(file,'utf8')));
}

export function safeRedirect(value:unknown):string{
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(value))return '/';
 try{
  let decoded=value;
  for(let i=0;i<3;i++){
   const next=decodeURIComponent(decoded);
   if(next===decoded)break;
   decoded=next;
  }
  if(!decoded.startsWith('/')||decoded.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(decoded))return '/';
  const url=new URL(value,'https://club.invalid');
  return url.origin==='https://club.invalid'?url.pathname+url.search+url.hash:'/';
 }catch{return '/';}
}

export function requireConfiguredHost(request:Request,config:RuntimeConfig):void{
 const expected=new URL(config.origin),host=request.headers.get('host');
 if(!host||/[\s,\\/]/.test(host))throw new Error('Unexpected host. Open the club at its configured address.');
 const supplied=new URL(expected.protocol+'//'+host);
 if(supplied.username||supplied.password||supplied.host!==expected.host||supplied.pathname!=='/'||supplied.search||supplied.hash)throw new Error('Unexpected host. Open the club at its configured address.');
}
export function requireSameOrigin(request:Request,config:RuntimeConfig):void{
 requireConfiguredHost(request,config);
 const expected=new URL(config.origin);
 const origin=request.headers.get('origin');
 if(origin!==expected.origin)throw new Error('This change must come from your club page.');
 const site=request.headers.get('sec-fetch-site');
 if(site&&site!=='same-origin'&&site!=='none')throw new Error('Cross-site requests are not allowed.');
}
