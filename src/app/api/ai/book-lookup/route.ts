import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiActor,apiFailure,readJson} from '@/lib/api';
import {askForJSON,suggestedBookSchema} from '@/lib/ai/service';
import {bookLookupPrompt} from '@/lib/ai/prompts';
export async function POST(request:Request){
 try{
  await apiActor(request);
  const input=z.object({title:z.string().trim().min(1).max(300),author:z.string().trim().min(1).max(200)}).parse(await readJson(request));
  return NextResponse.json(await askForJSON(bookLookupPrompt(input.title,input.author),suggestedBookSchema));
 }catch(error){return apiFailure(error);}
}
