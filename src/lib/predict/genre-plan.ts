import {open,readFile} from 'node:fs/promises';
import {z} from 'zod';
import {genreUpdateSchema,type GenreBook} from './genres';
export type GenreUpdate=z.infer<typeof genreUpdateSchema>;

// An exclusive, synced append journal keeps each paid batch recoverable even if
// a later provider request fails. Its directory must already exist.
export async function reserveGenrePlan(file:string,books:GenreBook[]){
 const handle=await open(file,'wx',0o600);let closed=false;
 const append=async(value:unknown)=>{await handle.writeFile(JSON.stringify(value)+'\n');await handle.sync();};
 try{await append({version:1,kind:'genre-plan',books:books.map(({bookId,title,author,genre})=>({bookId,title,author,expectedGenre:genre}))});}
 catch(error){await handle.close();throw error;}
 return {async checkpoint(updates:GenreUpdate[]){if(closed)throw new Error('The genre plan is closed.');await append({kind:'batch',updates});},async complete(){await append({kind:'complete'});},async close(){if(!closed){closed=true;await handle.close();}}};
}

export async function readGenrePlan(file:string):Promise<{updates:GenreUpdate[];complete:boolean}>{
 const text=await readFile(file,'utf8');
 if(text.trimStart().startsWith('['))return {updates:z.array(genreUpdateSchema).parse(JSON.parse(text)),complete:true};
 const lines=text.split('\n'),updates:GenreUpdate[]=[];let complete=false;
 const header=JSON.parse(lines.shift()??'');if(header.version!==1||header.kind!=='genre-plan'||!Array.isArray(header.books))throw new Error('Unknown genre plan format.');
 for(let i=0;i<lines.length;i++){
  if(!lines[i].trim())continue;
  let entry;try{entry=JSON.parse(lines[i]);}catch{if(i===lines.length-1)break;throw new Error('The genre plan has a malformed batch.');}
  if(entry.kind==='complete'){complete=true;continue;}
  if(entry.kind!=='batch')throw new Error('The genre plan has an unknown entry.');
  updates.push(...z.array(genreUpdateSchema).parse(entry.updates));
 }
 return {updates,complete};
}
