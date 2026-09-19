import {parseArgs} from 'node:util';
import {writeFile} from 'node:fs/promises';
import {withOwner} from '../src/lib/runtime/owner';
import {draftKinds,operationDraft,type DraftKind} from '../src/lib/operations/drafts';
async function main(){
 const {positionals,values}=parseArgs({allowPositionals:true,options:{meeting:{type:'string'},output:{type:'string'},calendar:{type:'string'}}});
 const kind=positionals[0];
 if(positionals.length!==1||!draftKinds.includes(kind as DraftKind)||!values.output)throw new Error('Use drafts nominations|shortlist|vote|reminder|results|week-of --output private/draft.json [--meeting 6] [--calendar private/meeting.ics]. This creates drafts only.');
 if(values.calendar&&!['results','week-of'].includes(kind))throw new Error('Calendar export is available for finalized results or week-of reminders.');
 const output=values.output;
 await withOwner(async(runtime,actor)=>{
  const draft=await operationDraft({db:runtime.db,actor,club:runtime.club,origin:runtime.config.origin},kind as DraftKind,values.meeting?Number(values.meeting):undefined);
  await writeFile(output,JSON.stringify(draft,null,2)+'\n',{flag:'wx',mode:0o600});
  if(values.calendar){if(!draft.calendar)throw new Error('No calendar event was prepared.');await writeFile(values.calendar,draft.calendar,{flag:'wx',mode:0o600});}
  console.log(`Saved a private ${kind} draft for ${draft.recipients.length} recipients. Nothing was sent. Review the draft and recipients before using it.`);
 });
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Could not prepare the draft.');process.exitCode=1;});
