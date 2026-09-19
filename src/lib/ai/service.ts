import {z} from 'zod';
import {getAnthropic} from './client';
import {ApiError} from '../api';
export const suggestedBookSchema=z.object({title:z.string().min(1).max(300),author:z.string().min(1).max(200),description:z.string().max(2000),pageCount:z.number().int().positive().nullable().default(null),audiobookLength:z.string().max(100).nullable().default(null),goodreadsRating:z.number().min(0).max(5).nullable().optional(),whyMatch:z.string().max(1000).optional(),whyRecommend:z.string().max(1000).optional()});
export async function askForJSON<T>(prompt:string,schema:z.ZodType<T>,maxTokens=2048):Promise<T>{
 const client=getAnthropic();
 const message=await client.messages.create({model:process.env.BOOKCLUB_AI_MODEL!,max_tokens:maxTokens,messages:[{role:'user',content:prompt}]});
 const text=message.content.filter(part=>part.type==='text').map(part=>part.type==='text'?part.text:'').join('\n').trim().replace(/^```(?:json)?\s*|\s*```$/g,'');
 try{return schema.parse(JSON.parse(text));}catch{throw new ApiError('The AI returned incomplete book details. Try again or enter the book manually.',502);}
}
