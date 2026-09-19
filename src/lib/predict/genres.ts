import {z} from 'zod';
export const genres=['politics','economics-finance','history','memoir-biography','science-tech','philosophy-psychology','business-management','society-culture','sports-adventure','true-crime','nature-environment','fantasy','literary-fiction','mystery','science-fiction','humor','adventure','nonfiction','romance','poetry','graphic-novel'] as const;
export const genreUpdateSchema=z.object({bookId:z.uuid(),expectedGenre:z.string().nullable(),genre:z.enum(genres)}).strict();
export type GenreBook={bookId:string;title:string;author:string;genre:string|null};
export function validateGenreAnswers(input:unknown,books:GenreBook[]){
 const answers=z.array(z.object({bookId:z.uuid(),genre:z.enum(genres)}).strict()).parse(input);
 const allowed=new Map(books.map(b=>[b.bookId,b])),seen=new Set<string>();
 for(const answer of answers){if(!allowed.has(answer.bookId)||seen.has(answer.bookId))throw new Error('The genre reply contains unknown or repeated book IDs.');seen.add(answer.bookId);}
 if(seen.size!==books.length)throw new Error('The genre reply is incomplete. No labels were changed.');
 return answers.map(answer=>({...answer,expectedGenre:allowed.get(answer.bookId)!.genre}));
}
