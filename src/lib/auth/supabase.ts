import {createServerClient,type CookieMethodsServer} from '@supabase/ssr';
import type {RuntimeConfig} from '../runtime/config';

import {authCookieName} from './cookies';
export {authCookieName} from './cookies';
export function authClient(config:RuntimeConfig,cookies:CookieMethodsServer){
 if(config.mode!=='production')throw new Error('Provider authentication is disabled in the local demo.');
 return createServerClient(config.authUrl!,config.authKey!,{
  cookieOptions:{name:authCookieName,path:'/',httpOnly:true,sameSite:'lax',secure:new URL(config.origin).protocol==='https:'},
  cookies,
 });
}
