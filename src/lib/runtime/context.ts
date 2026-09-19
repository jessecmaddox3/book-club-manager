import { runtimeConfig,loadClubConfig,type RuntimeConfig,type ClubConfig } from './config';
import { postgresDatabase,verifyMigrations,type Database } from '../store/database';
import { openDemoStore } from '../store/local';
import { seedDemo } from '../store/demo-seed';

export type ClubRuntime={config:RuntimeConfig;club:ClubConfig;db:Database;sessionSecret:string;close():Promise<void>};

export async function openRuntime(config=runtimeConfig(),clubFile?:string):Promise<ClubRuntime>{
 const club=await loadClubConfig(clubFile);
 if(config.mode==='demo'){
  const local=await openDemoStore(config.dataDirectory);
  try{await seedDemo(local.db,club);}catch(error){await local.close();throw error;}
  return {config,club,db:local.db,sessionSecret:local.sessionSecret,close:()=>local.close()};
 }
 const db=await postgresDatabase(config.databaseUrl!);
 try{
  await verifyMigrations(db);
  const [metadata]=await db.query<{mode:string;time_zone:string;production_initialized:boolean}>('SELECT mode,time_zone,production_initialized FROM club_metadata WHERE id=1');
  if(metadata?.mode!=='production'||!metadata.production_initialized)throw new Error('Production identity requires an initialized production database. Run the documented database setup first.');
  if(metadata.time_zone!==club.timeZone)throw new Error('The club configuration and database time zones differ. Restore club.config.json to the database time zone shown by setup status before starting.');
 }catch(error){await db.close();throw error;}
 return {config,club,db,sessionSecret:config.sessionSecret!,close:()=>db.close()};
}

const key=Symbol.for('book-club-manager.runtime');
type GlobalRuntime=typeof globalThis&{[key]?:Promise<ClubRuntime>};
export function getRuntime():Promise<ClubRuntime>{
 const shared=globalThis as GlobalRuntime;
 if(!shared[key])shared[key]=openRuntime().catch(error=>{delete shared[key];throw error;});
 return shared[key]!;
}
export async function closeRuntime():Promise<void>{
 const shared=globalThis as GlobalRuntime,active=shared[key];
 if(!active)return;
 delete shared[key];
 await(await active).close();
}
