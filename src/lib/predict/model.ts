export type Observation={ballotId:string;meeting:number;memberId:string;bookId:string;genre:string|null;submitterId:string|null;rating:number};
export type Weights={kMember:number;kGenre:number;kSub:number;useGenre:boolean;useSub:boolean};
export const passes:{name:string;weights:Weights}[]=[
 {name:'member only',weights:{kMember:5,kGenre:5,kSub:3,useGenre:false,useSub:false}},
 {name:'member + genre',weights:{kMember:5,kGenre:4,kSub:3,useGenre:true,useSub:false}},
 {name:'member + recommender',weights:{kMember:5,kGenre:4,kSub:3,useGenre:false,useSub:true}},
 {name:'member + genre + recommender',weights:{kMember:5,kGenre:4,kSub:3,useGenre:true,useSub:true}},
 {name:'all, lighter shrinkage',weights:{kMember:3,kGenre:2,kSub:2,useGenre:true,useSub:true}},
 {name:'all, heavier shrinkage',weights:{kMember:8,kGenre:8,kSub:6,useGenre:true,useSub:true}},
];
const key=(...parts:string[])=>JSON.stringify(parts);
export function uniqueObservations(rows:Observation[]):Observation[]{
 const seen=new Map<string,Observation>();
 for(const row of rows){
  if(!Number.isFinite(row.rating)||row.rating<1||row.rating>5||!Number.isInteger(row.meeting)||row.meeting<1)throw new Error('Invalid preference observation.');
  const id=key(row.ballotId,row.memberId,row.bookId),old=seen.get(id);
  if(old&&(old.rating!==row.rating||old.meeting!==row.meeting||old.genre!==row.genre||old.submitterId!==row.submitterId))throw new Error('Conflicting duplicate preference observation.');
  seen.set(id,row);
 }
 return [...seen.values()].sort((a,b)=>a.meeting-b.meeting||a.ballotId.localeCompare(b.ballotId)||a.memberId.localeCompare(b.memberId)||a.bookId.localeCompare(b.bookId));
}
export function train(rows:Observation[],w:Weights){
 const globalMean=rows.length?rows.reduce((sum,r)=>sum+r.rating,0)/rows.length:3;
 const members=new Map<string,{sum:number;n:number}>(),genres=new Map<string,{sum:number;n:number}>(),submitters=new Map<string,{sum:number;n:number}>();
 const add=(map:Map<string,{sum:number;n:number}>,id:string,value:number)=>{const x=map.get(id)??{sum:0,n:0};x.sum+=value;x.n++;map.set(id,x);};
 const bias=(map:Map<string,{sum:number;n:number}>,id:string,k:number)=>{const x=map.get(id);return x?x.sum/(x.n+k):0;};
 for(const r of rows)add(members,r.memberId,r.rating-globalMean);
 let selfSum=0,selfN=0;
 for(const r of rows){
  const residual=r.rating-globalMean-bias(members,r.memberId,w.kMember);
  if(r.genre)add(genres,key(r.memberId,r.genre),residual);
  if(r.submitterId===r.memberId){selfSum+=residual;selfN++;}
  else if(r.submitterId)add(submitters,key(r.memberId,r.submitterId),residual);
 }
 return {globalMean,predict(memberId:string,genre:string|null,submitterId:string|null){
  let value=globalMean+bias(members,memberId,w.kMember);
  if(w.useGenre&&genre)value+=bias(genres,key(memberId,genre),w.kGenre);
  if(w.useSub&&submitterId)value+=submitterId===memberId?selfSum/(selfN+w.kSub):bias(submitters,key(memberId,submitterId),w.kSub);
  return Math.max(1,Math.min(5,value));
 }};
}
type Point={predicted:number;actual:number};
export function metrics(points:Point[]){
 if(!points.length)return null;
 const n=points.length,errors=points.map(p=>Math.abs(p.predicted-p.actual));
 const meanP=points.reduce((s,p)=>s+p.predicted,0)/n,meanA=points.reduce((s,p)=>s+p.actual,0)/n;
 let cov=0,vp=0,va=0;for(const p of points){cov+=(p.predicted-meanP)*(p.actual-meanA);vp+=(p.predicted-meanP)**2;va+=(p.actual-meanA)**2;}
 return {n,mae:errors.reduce((s,e)=>s+e,0)/n,withinOne:errors.filter(e=>e<=1).length/n,correlation:n>1&&vp>0&&va>0?cov/Math.sqrt(vp*va):null};
}
function evaluate(rows:Observation[],ballots:string[],weights:Weights){
 const all:Point[]=[],constant:Point[]=[],member:Point[]=[];
 const folds=ballots.map(ballotId=>{
  const test=rows.filter(r=>r.ballotId===ballotId),meeting=test[0].meeting;
  const prior=rows.filter(r=>r.meeting<meeting),model=train(prior,weights),means=new Map<string,{sum:number;n:number}>();
  for(const r of prior){const x=means.get(r.memberId)??{sum:0,n:0};x.sum+=r.rating;x.n++;means.set(r.memberId,x);}
  const points=test.map(r=>({predicted:model.predict(r.memberId,r.genre,r.submitterId),actual:r.rating}));all.push(...points);
  for(const r of test){constant.push({predicted:3,actual:r.rating});const x=means.get(r.memberId);member.push({predicted:x?x.sum/x.n:model.globalMean,actual:r.rating});}
  return {ballotId,meeting,trainingCount:prior.length,metrics:metrics(points)};
 });
 return {metrics:metrics(all),baselines:{constantThree:metrics(constant),priorMemberMean:metrics(member)},folds};
}
export function prepareAnalysis(input:Observation[],targetMeeting:number){
 if(!Number.isInteger(targetMeeting)||targetMeeting<1)throw new Error('A positive target meeting is required.');
 const rows=uniqueObservations(input.filter(r=>r.meeting<targetMeeting));
 const ballots=[...new Set(rows.map(r=>r.ballotId))];
 if(ballots.length<3)return {protocol:'chronological tuning, then frozen-choice walk-forward evaluation' as const,rows,selected:passes[0],tuningBallots:[] as string[],evaluationBallots:[] as string[],candidates:[] as {name:string;mae:number}[],evaluation:null,notice:'At least three earlier ballots with preference votes are needed for separate tuning and evaluation. The default member-only model is used.'};
 const evaluationCount=Math.min(3,Math.max(1,Math.floor((ballots.length-1)/3)));
 const tuningBallots=ballots.slice(1,-evaluationCount),evaluationBallots=ballots.slice(-evaluationCount);
 const candidates=passes.map(pass=>({name:pass.name,mae:evaluate(rows,tuningBallots,pass.weights).metrics!.mae}));
 let best=0;for(let i=1;i<candidates.length;i++)if(candidates[i].mae<candidates[best].mae)best=i;
 const selected=passes[best];
 return {protocol:'chronological tuning, then frozen-choice walk-forward evaluation' as const,rows,selected,tuningBallots,evaluationBallots,candidates,evaluation:evaluate(rows,evaluationBallots,selected.weights),notice:null};
}
