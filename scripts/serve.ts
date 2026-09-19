import {createServer} from 'node:http';
import {loadEnvConfig} from '@next/env';
import next from 'next';
import {runtimeConfig} from '../src/lib/runtime/config';
import {getRuntime,closeRuntime} from '../src/lib/runtime/context';

async function main(){
loadEnvConfig(process.cwd());
if(process.argv.includes('--demo'))process.env.BOOKCLUB_MODE='demo';
process.env.NEXT_TELEMETRY_DISABLED='1';
const config=runtimeConfig(),origin=new URL(config.origin);
const hostname=config.mode==='demo'?origin.hostname.replace(/^\[|\]$/g,''):process.env.BOOKCLUB_BIND_ADDRESS??'127.0.0.1';
const port=Number(process.env.PORT??'5055'),dev=process.argv.includes('--dev');
const app=next({dev,hostname,port});
await getRuntime();
await app.prepare();
const handler=app.getRequestHandler();
const server=createServer((request,response)=>{handler(request,response).catch(()=>{if(!response.headersSent)response.writeHead(500);response.end('The page could not be loaded.');});});
let stopping=false;
async function stop(){
 if(stopping)return;stopping=true;
 await new Promise<void>(resolve=>{
  server.close(()=>resolve());
  const timeout=setTimeout(()=>{server.closeAllConnections();resolve();},5000);timeout.unref();
 });
 await closeRuntime();await app.close();
}
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void stop().then(()=>process.exit(0),()=>process.exit(1));});
server.once('error',async(error)=>{console.error(error instanceof Error?error.message:'Could not open the local server.');await stop();process.exitCode=1;});
server.listen(port,hostname,()=>{
 console.log(`Book Club Manager: ${config.origin}\n${config.mode==='demo'?'Local demo. All starter records are invented.':'Hosted membership authentication enabled.'}\nPress Control+C to close safely.`);
 process.send?.({kind:'bookclub-ready',origin:config.origin});
});

}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Could not start the club.");process.exitCode=1;});
