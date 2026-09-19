import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {loadEnvConfig} from '@next/env';
import {z} from 'zod';
import {runtimeConfig,loadClubConfig} from '../src/lib/runtime/config';
import {postgresDatabase,migrate,verifyMigrations} from '../src/lib/store/database';

const organizerSchema=z.object({fullName:z.string().trim().min(1).max(200),displayName:z.string().trim().min(1).max(100),authSubject:z.uuid(),email:z.email().max(254).optional()}).strict();
const linkSchema=z.object({memberId:z.uuid(),expectedRevision:z.number().int().positive(),expectedAuthSubject:z.uuid().nullable(),authSubject:z.uuid().nullable()}).strict();

async function main(){
 loadEnvConfig(process.cwd());
 const {values,positionals}=parseArgs({allowPositionals:true,options:{yes:{type:'boolean'},organizer:{type:'string'},plan:{type:'string'}}});
 const operation=positionals[0];
 if(positionals.length!==1||!['init','migrate','link-member','members','status'].includes(operation))throw new Error('Use setup init --organizer private/organizer.json, setup migrate, setup status, setup members, or setup link-member --plan private/link.json. Changes require --yes.');
 const config=runtimeConfig();if(config.mode!=='production')throw new Error('Set BOOKCLUB_MODE=production. Setup never converts a demo database into a hosted club.');
 const club=await loadClubConfig();
 const input=operation==='init'?{...organizerSchema.parse(JSON.parse(await readFile(values.organizer??'','utf8'))),timeZone:club.timeZone}
  :operation==='link-member'?linkSchema.parse(JSON.parse(await readFile(values.plan??'','utf8'))):null;
 const target=new URL(config.databaseUrl!);
 if(!['members','status'].includes(operation)&&!values.yes){
  console.log(JSON.stringify({dryRun:true,operation,database:{host:target.hostname,port:target.port||'5432',name:decodeURIComponent(target.pathname.slice(1))},clubOrigin:config.origin,identityService:config.authUrl,input},null,2));
  console.log('No changes made. Check the exact Auth user UUID in your identity dashboard, then repeat with --yes.');return;
 }
 const db=await postgresDatabase(config.databaseUrl!);let locked=false;
 try{
  if(operation==='init'||operation==='migrate'){
   const [lock]=await db.query<{locked:boolean}>("SELECT pg_try_advisory_lock(hashtextextended('book-club-manager-setup',0)) AS locked");
   if(!lock.locked)throw new Error('Another setup command owns this database. Try again after it finishes.');locked=true;
   await migrate(db);
   if(operation==='init')console.log(JSON.stringify((await db.query('SELECT club_initialize_production($1::jsonb) AS result',[JSON.stringify(input)]))[0].result,null,2));
   else console.log('Database migrations verified and applied. Existing club records were retained.');
  }else{
   await verifyMigrations(db);
   if(operation==='status'){
    console.log(JSON.stringify({metadata:(await db.query('SELECT instance_id,mode,time_zone,production_initialized FROM club_metadata WHERE id=1'))[0],organizers:await db.query("SELECT id,display_name,auth_subject IS NOT NULL AS linked FROM members WHERE role='admin' ORDER BY id")},null,2));return;
   }
   const [metadata]=await db.query<{mode:string;production_initialized:boolean}>('SELECT mode,production_initialized FROM club_metadata WHERE id=1');
   if(metadata.mode!=='production'||!metadata.production_initialized)throw new Error('Initialize the production club first.');
   const owner=z.uuid().parse(process.env.BOOKCLUB_OWNER_MEMBER_ID);
   const [member]=await db.query("SELECT id FROM members WHERE id=$1 AND role='admin' AND auth_subject IS NOT NULL",[owner]);
   if(!member)throw new Error('BOOKCLUB_OWNER_MEMBER_ID must identify a linked active organizer.');
   if(operation==='members')console.log(JSON.stringify(await db.query('SELECT id,display_name,full_name,role,revision,auth_subject FROM members ORDER BY display_name,id'),null,2));
   else{
    const plan=linkSchema.parse(input);
    console.log(JSON.stringify((await db.query('SELECT club_link_identity($1,$2,$3,$4,$5) AS result',[owner,plan.memberId,plan.expectedRevision,plan.expectedAuthSubject,plan.authSubject]))[0].result,null,2));
   }
  }
 }finally{
  try{if(locked)await db.query("SELECT pg_advisory_unlock(hashtextextended('book-club-manager-setup',0))");}finally{await db.close();}
 }
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Setup failed.');process.exitCode=1;});
