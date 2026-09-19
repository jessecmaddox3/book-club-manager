import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {withOwner} from '../src/lib/runtime/owner';
import {BallotCommands} from '../src/lib/ballots/commands';

async function main(){
 const {positionals,values}=parseArgs({allowPositionals:true,options:{yes:{type:'boolean'},book:{type:'string'},date:{type:'string'},host:{type:'string'},location:{type:'string'},beverage:{type:'string',multiple:true},'save-plan':{type:'string'}}});
 const [command,target]=positionals;
 if(!command||command==='help'){console.log('cycle status | build <definition.json> | open <meeting> | close <meeting> --book <slug> --date YYYY-MM-DD [--host <UUID or exact name>] [--beverage <UUID or exact name>] | apply-close <plan.json> | reopen <meeting>\nMutations preview by default. Add --yes to write. Stop the local web demo before an owner command.');return;}
 if(!['status','build','open','close','apply-close','reopen'].includes(command))throw new Error('Unknown cycle command. Run cycle help.');
 await withOwner(async(runtime,actor)=>{
  const service=new BallotCommands(runtime.db,actor);
  if(command==='status'){console.log(JSON.stringify(await service.status(),null,2));return;}
  if(!target)throw new Error('A definition file, plan file or meeting number is required.');
  if(command==='build'){
   const prepared=await service.validateDraft(JSON.parse(await readFile(path.resolve(target),'utf8')));
   console.log(JSON.stringify(prepared,null,2));
   if(values.yes)console.log(JSON.stringify(await service.replace(prepared.definition,prepared.revision),null,2));
   else console.log('Dry run. Add --yes to replace this draft atomically.');return;
  }
  if(command==='apply-close'){
   const plan=JSON.parse(await readFile(path.resolve(target),'utf8'));console.log(JSON.stringify(plan,null,2));
   if(values.yes)console.log(JSON.stringify(await service.applyClose(plan),null,2));else console.log('Dry run. Add --yes to apply this exact saved plan.');return;
  }
  const number=Number(target),view=await service.ballot(number);
  if(command==='open'||command==='reopen'){
   console.log(`Meeting #${number}: ${view.ballot.status}, revision ${view.ballot.revision}.`);
   if(values.yes)console.log(JSON.stringify(await service[command](number),null,2));else console.log('Dry run. Add --yes to change its state.');return;
  }
  console.log(JSON.stringify({meeting:number,status:view.ballot.status,responses:view.totalVotes,books:view.bookAverages,dates:view.dateAvailability,hostVolunteers:view.memberResponses.filter(r=>r.willingToHost).map(r=>r.memberName),beverageVolunteers:view.memberResponses.filter(r=>r.willingToBringBourbon).map(r=>r.memberName)},null,2));
  if(!values.book||!values.date){console.log('Choose --book and --date explicitly. Ties are not resolved automatically.');return;}
  const {plan}=await service.closePlan(number,{book:values.book,date:values.date,host:values.host,location:values.location,beverages:values.beverage});
  let planFile=values['save-plan'];
  if(values.yes&&!planFile){await mkdir('.local/close-plans',{recursive:true,mode:0o700});planFile=path.join('.local/close-plans',plan.operationId+'.json');}
  if(planFile){await writeFile(path.resolve(planFile),JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o600});console.log('Saved exact close plan: '+planFile);}
  console.log(JSON.stringify(plan,null,2));
  if(values.yes)console.log(JSON.stringify(await service.applyClose(plan),null,2));else console.log('Dry run. Add --yes, or save and apply this exact plan. A new accepted vote makes an older plan stale.');
 });
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'The cycle command failed.');process.exitCode=1;});
