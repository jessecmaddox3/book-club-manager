type Cookie={name:string;value:string};
export const authCookieName='book-club-auth';
const belongs=(name:string)=>name===authCookieName||name.startsWith(authCookieName+'.');

// The provider verifies tokens. This only catches corrupt serialization before
// SSR's cookie decoder can throw during middleware/client initialization.
export function invalidAuthCookies(cookies:Cookie[]):string[]{
 const own=cookies.filter(c=>belongs(c.name));if(!own.length)return [];
 try{
  const root=own.find(c=>c.name===authCookieName);
  let value:string;
  if(root){if(own.length!==1)throw new Error();value=root.value;}
  else{
   const chunks=own.map(c=>({index:Number(c.name.slice(authCookieName.length+1)),value:c.value})).sort((a,b)=>a.index-b.index);
   if(chunks.some((c,i)=>c.index!==i))throw new Error();value=chunks.map(c=>c.value).join('');
  }
  if(value.length>65536)throw new Error();
  if(value.startsWith('base64-')){
   const encoded=value.slice(7);if(!/^[A-Za-z0-9_-]+$/.test(encoded))throw new Error();
   value=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(encoded,'base64url'));
  }
  const parsed=JSON.parse(value);
  if(!parsed||typeof parsed!=='object'||typeof parsed.access_token!=='string'||typeof parsed.refresh_token!=='string')throw new Error();
  return [];
 }catch{return own.map(c=>c.name);}
}
