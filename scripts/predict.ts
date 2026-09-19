import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {withOwner} from '../src/lib/runtime/owner';
import {previewPredictions,savePredictions} from '../src/lib/predict/service';

async function main(){
 const {values}=parseArgs({options:{target:{type:'string'},persist:{type:'boolean'},'save-plan':{type:'string'},'apply-plan':{type:'string'},help:{type:'boolean'}}});
 if(values.help||(!values.target&&!values['apply-plan'])){console.log('predict --target <meeting> [--save-plan <private.json>] [--persist]\npredict --apply-plan <private.json> [--persist]\nPredicts ballot preferences, not how much someone liked a book after reading. Local, no AI calls. Stop the local demo before owner commands.');return;}
 await withOwner(async(runtime,actor)=>{
  const plan=values['apply-plan']?JSON.parse(await readFile(path.resolve(values['apply-plan']),'utf8')):await previewPredictions(runtime.db,actor,Number(values.target));
  if(!values['apply-plan']){
   console.log(JSON.stringify({target:plan.request.snapshot.target,evaluation:plan.request.evaluation,configuration:plan.request.configuration,predictions:plan.request.predictions},null,2));
   let file=values['save-plan'];if(values.persist&&!file){await mkdir('.local/prediction-plans',{recursive:true,mode:0o700});file=path.join('.local/prediction-plans',plan.operationId+'.json');}
   if(file){await writeFile(path.resolve(file),JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Saved private exact-input plan: '+file);}
  }
  if(values.persist)console.log(JSON.stringify(await savePredictions(runtime.db,actor,plan),null,2));
  else console.log('Dry run. Use --persist to append this complete run. Small-club estimates are exploratory; evaluation is not a promise of accuracy.');
 });
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Prediction failed.');process.exitCode=1;});
