import {parseArgs} from 'node:util';
import {loadEnvConfig} from '@next/env';
import {runtimeConfig,loadClubConfig} from '../src/lib/runtime/config';
import {backupDemo,restoreDemo} from '../src/lib/store/backup';
async function main(){
 loadEnvConfig(process.cwd());
 const {positionals,values}=parseArgs({allowPositionals:true,options:{file:{type:'string'},destination:{type:'string'}}});
 if(positionals.length!==1||!['backup','restore'].includes(positionals[0])||!values.file)throw new Error('Use storage backup --file private/backup.json or storage restore --file private/backup.json --destination a-new-folder. Stop the demo first.');
 const config=runtimeConfig();if(config.mode!=='demo')throw new Error('These commands handle local demo storage. Hosted PostgreSQL uses pg_dump and pg_restore; see the backup guide.');
 if(positionals[0]==='backup'){
  console.log(JSON.stringify(await backupDemo(config.dataDirectory,values.file,await loadClubConfig()),null,2));
  console.log('Private backup saved. It contains the club records you entered. Keep it outside Git and public file sharing.');
 }else{
  if(!values.destination)throw new Error('Choose a new destination folder. Existing folders are never replaced.');
  console.log(JSON.stringify(await restoreDemo(values.file,values.destination),null,2));
  console.log('Restored to a separate folder with fresh sign-in cookies. Set BOOKCLUB_DATA_DIR and BOOKCLUB_CONFIG to these paths when starting the demo. Your old folder is unchanged.');
 }
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Storage command failed.');process.exitCode=1;});
