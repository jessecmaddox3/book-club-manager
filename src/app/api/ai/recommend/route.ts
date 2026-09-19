import {NextResponse} from 'next/server';
import {z} from 'zod';
import {apiActor,apiFailure,readJson} from '@/lib/api';
import {askForJSON,suggestedBookSchema} from '@/lib/ai/service';
import {bookRecommendPrompt} from '@/lib/ai/prompts';
import {getRepository} from '@/lib/store';
export async function POST(request:Request){
 try{
  await apiActor(request);
  const {preferences}=z.object({preferences:z.string().trim().max(500).optional()}).parse(await readJson(request));
  const readBooks=await(await getRepository()).readBooks();
  const prompt=bookRecommendPrompt(readBooks.map(row=>({title:row.book.title,author:row.book.author})),preferences);
  return NextResponse.json(await askForJSON(prompt,z.object({recommendations:z.array(suggestedBookSchema).max(5)})));
 }catch(error){return apiFailure(error);}
}
