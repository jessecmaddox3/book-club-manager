import {randomUUID} from 'node:crypto';
import type {Database} from '../store/database';
import type {Actor} from '../auth/identity';
import {prepareAnalysis,train,type Observation} from './model';
export type PredictionSnapshot={format:'preference-additive-v1';target:{id:string;meetingNumber:number;surveyId:string;revision:number;status:string};audience:{memberId:string;name:string}[];nominees:{bookId:string;title:string;author:string;genre:string|null;submitterId:string|null}[];history:Observation[]};
export function forecast(snapshot:PredictionSnapshot){
 const analysis=prepareAnalysis(snapshot.history,snapshot.target.meetingNumber),model=train(analysis.rows,analysis.selected.weights);
 const predictions=snapshot.audience.flatMap(member=>snapshot.nominees.map(book=>({memberId:member.memberId,bookId:book.bookId,predicted:Math.round(model.predict(member.memberId,book.genre,book.submitterId)*10)/10})));
 return {version:'preference-additive-v1',snapshot,configuration:analysis.selected,evaluation:{protocol:analysis.protocol,tuningBallots:analysis.tuningBallots,evaluationBallots:analysis.evaluationBallots,candidates:analysis.candidates,heldOut:analysis.evaluation,notice:analysis.notice,observations:analysis.rows.length},predictions};
}
export async function previewPredictions(db:Database,actor:Actor,meeting:number){
 if(!Number.isInteger(meeting)||meeting<1)throw new Error('Choose a positive target meeting number.');
 const [row]=await db.query<{snapshot:PredictionSnapshot}>(`SELECT club_prediction_snapshot($1,(SELECT id FROM ballots WHERE meeting_number=$2)) AS snapshot`,[actor.memberId,meeting]);
 return {operationId:randomUUID(),request:forecast(row.snapshot)};
}
export async function savePredictions(db:Database,actor:Actor,plan:{operationId:string;request:ReturnType<typeof forecast>}){
 return (await db.query<{result:{runId:string;replayed:boolean}}>('SELECT club_save_prediction_run($1,$2,$3::jsonb) AS result',[actor.memberId,plan.operationId,JSON.stringify(plan.request)]))[0].result;
}
