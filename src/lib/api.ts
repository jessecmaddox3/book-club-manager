import {NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {getUser} from './session';
import {requireSameOrigin,runtimeConfig} from './runtime/config';
import {assertActorBinding} from './auth/identity';

export class ApiError extends Error{constructor(message:string,readonly status=400){super(message);}}
export async function apiActor(request:Request,admin=false){
 try{requireSameOrigin(request,runtimeConfig());}catch{throw new ApiError('Open your club page before making this change.',403);}
 const actor=await getUser();
 if(!actor)throw new ApiError('Please sign in again.',401);
 assertActorBinding(actor,request.headers.get('x-bookclub-actor'));
 if(admin&&actor.role!=='admin')throw new ApiError('An organizer account is required.',403);
 return actor;
}
export async function readJson(request:Request):Promise<unknown>{
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError('Send a JSON request.',415);
 const reader=request.body?.getReader();if(!reader)throw new ApiError('The request body is missing.');
 let size=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new ApiError('This form is too large.',413);}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApiError('The request body is not valid JSON.');}
}
export function apiFailure(error:unknown){
 if(error instanceof ApiError)return NextResponse.json({error:error.message},{status:error.status});
 if(error instanceof ZodError)return NextResponse.json({error:error.issues.map(issue=>issue.message).join(' ')},{status:400});
 const message=error instanceof Error?error.message:'';
 if(message==='stale_identity')return NextResponse.json({error:'The signed-in reader changed after you opened this page. Reload before making this change.'},{status:409});
 if(/not_authorized/.test(message))return NextResponse.json({error:'Your current membership does not permit this change.'},{status:403});
 if(/stale_|reading_assignment_changed|previous_meeting_changed|ballot_closed|ballot_not_open/.test(message))return NextResponse.json({error:'This page has changed since you opened it. Your entries are still here. Reload the page before saving again.'},{status:409});
 return NextResponse.json({error:'The change could not be completed. Your page may be out of date. Reload it and try again.'},{status:500});
}
