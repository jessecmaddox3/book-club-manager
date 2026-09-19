import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {lstat,mkdir,open,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {openDemoStore} from './local';
import {embeddedDatabase,verifyMigrations} from './database';
import {clubConfigSchema,type ClubConfig} from '../runtime/config';

const backupSchema=z.object({kind:z.literal('book-club-manager-demo-backup'),version:z.literal(1),engine:z.literal('pglite-0.5.8'),createdAt:z.string(),instanceId:z.uuid(),club:clubConfigSchema,sha256:z.string().regex(/^[a-f0-9]{64}$/),archive:z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict();
const digest=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');

export async function backupDemo(directory:string,file:string,club:ClubConfig){
 // Do not create or seed a missing folder when the user meant to back it up.
 const marker=await lstat(path.join(directory,'instance.json'));
 if(!marker.isFile()||marker.isSymbolicLink())throw new Error('Choose an existing local demo folder.');
 const handle=await open(file,'wx',0o600);
 let local:Awaited<ReturnType<typeof openDemoStore>>|undefined;
 try{
  // Backups must precede upgrades. This path locks and validates the existing
  // store but deliberately does not apply the current release's migrations.
  local=await openDemoStore(directory,{migrate:false});
  const [metadata]=await local.db.query<{mode:string;time_zone:string}>('SELECT mode,time_zone FROM club_metadata WHERE id=1');
  if(metadata.mode!=='demo'||metadata.time_zone!==club.timeZone)throw new Error('The backup configuration must match this local demo.');
  const archive=await local.db.dumpDataDirectory!();
  const backup=backupSchema.parse({kind:'book-club-manager-demo-backup',version:1,engine:'pglite-0.5.8',createdAt:new Date().toISOString(),instanceId:local.instanceId,club,sha256:digest(archive),archive:Buffer.from(archive).toString('base64')});
  await handle.writeFile(JSON.stringify(backup)+'\n');await handle.sync();
  return {file:path.resolve(file),sha256:backup.sha256};
 }finally{try{if(local)await local.close();}finally{await handle.close();}}
}

export async function restoreDemo(file:string,directory:string){
 const info=await lstat(file);
 if(!info.isFile()||info.isSymbolicLink()||info.size>256*1024*1024)throw new Error('Choose your own ordinary backup file, up to 256 MB.');
 const backup=backupSchema.parse(JSON.parse(await readFile(file,'utf8'))),archive=Buffer.from(backup.archive,'base64');
 if(digest(archive)!==backup.sha256)throw new Error('The backup checksum does not match. The destination has not been changed.');
 const root=path.resolve(directory);
 await mkdir(root,{recursive:false,mode:0o700}); // Exclusive: never replace any existing folder.
 const marker={kind:'book-club-manager-demo',storageVersion:1,state:'initializing',instanceId:randomUUID(),sessionSecret:randomBytes(48).toString('base64url')};
 const markerFile=path.join(root,'instance.json');
 await writeFile(markerFile,JSON.stringify(marker)+'\n',{flag:'wx',mode:0o600});
 const db=await embeddedDatabase(path.join(root,'database'),archive);
 try{
  await verifyMigrations(db);
  const [metadata]=await db.query<{mode:string;instance_id:string;time_zone:string}>('SELECT mode,instance_id,time_zone FROM club_metadata WHERE id=1');
  if(metadata.mode!=='demo'||metadata.instance_id!==backup.instanceId||metadata.time_zone!==backup.club.timeZone)throw new Error('This backup does not match its local demo metadata. Preserve the incomplete destination and use a matching backup.');
  await db.query('UPDATE club_metadata SET instance_id=$1,generation=$2 WHERE id=1',[marker.instanceId,randomUUID()]);
 }finally{await db.close();}
 const configFile=path.join(root,'club.config.json');await writeFile(configFile,JSON.stringify(backup.club,null,2)+'\n',{flag:'wx',mode:0o600});
 marker.state='ready';await writeFile(markerFile,JSON.stringify(marker)+'\n',{mode:0o600});
 return {directory:root,configFile};
}
