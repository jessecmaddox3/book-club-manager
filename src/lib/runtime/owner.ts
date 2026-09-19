import {loadEnvConfig} from '@next/env';
import {openRuntime,type ClubRuntime} from './context';
import type {Actor} from '../auth/identity';

// CLI access is an installation-owner capability: access to the local database
// directory or production connection credentials. It is never a web endpoint.
export async function withOwner<T>(work:(runtime:ClubRuntime,actor:Actor)=>Promise<T>):Promise<T>{
 loadEnvConfig(process.cwd());
 const runtime=await openRuntime();
 try{
  const selected=process.env.BOOKCLUB_OWNER_MEMBER_ID;
  if(runtime.config.mode==='production'&&!selected)throw new Error('Set BOOKCLUB_OWNER_MEMBER_ID to your linked organizer UUID for owner commands.');
  if(selected&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(selected))throw new Error('BOOKCLUB_OWNER_MEMBER_ID must be an organizer UUID.');
  const [member]=await runtime.db.query<{id:string;display_name:string;full_name:string}>(`SELECT id,display_name,full_name FROM members WHERE role='admin' ${runtime.config.mode==='production'?'AND auth_subject IS NOT NULL':''} ${selected?'AND id=$1':''} ORDER BY id LIMIT 1`,selected?[selected]:[]);
  if(!member)throw new Error('No active organizer matches this owner configuration.');
  return await work(runtime,{memberId:member.id,displayName:member.display_name,fullName:member.full_name,role:'admin'});
 }finally{await runtime.close();}
}
