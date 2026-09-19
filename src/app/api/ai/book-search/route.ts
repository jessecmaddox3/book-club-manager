import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiActor,apiFailure,readJson} from '@/lib/api';
import {askForJSON,suggestedBookSchema} from '@/lib/ai/service';
import {bookSearchPrompt} from '@/lib/ai/prompts';
import {getRepository} from '@/lib/store';
export async function POST(request:Request){
 try{
  await apiActor(request);
  const {query}=z.object({query:z.string().trim().min(1).max(500)}).parse(await readJson(request));
  const readBooks=await(await getRepository()).readBooks();
  const prompt=bookSearchPrompt(query,readBooks.map(row=>row.book.title+' by '+row.book.author));
  return NextResponse.json(await askForJSON(prompt,z.object({books:z.array(suggestedBookSchema).max(5)})));
 }catch(error){return apiFailure(error);}
}
