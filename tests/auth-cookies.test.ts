import test from 'node:test';import assert from 'node:assert/strict';
import {invalidAuthCookies} from '../src/lib/auth/cookies';
test('corrupt SSR cookies are removed before decoding, while provider-verifiable sessions and unrelated cookies survive',()=>{
 const name='book-club-auth',value='base64-'+Buffer.from(JSON.stringify({access_token:'provider-must-verify',refresh_token:'provider-must-verify'})).toString('base64url');
 assert.deepEqual(invalidAuthCookies([{name,value}]),[]);
 assert.deepEqual(invalidAuthCookies([{name:name+'.1',value:value.slice(20)},{name:name+'.0',value:value.slice(0,20)}]),[]);
 for(const broken of ['base64-forged-session','base64-__8','base64-!!!','null','[]','{"role":"admin"}'])assert.deepEqual(invalidAuthCookies([{name,value:broken},{name:'unrelated',value:'keep'}]),[name]);
 assert.deepEqual(invalidAuthCookies([{name:name+'.1',value}]),[name+'.1']);
 assert.deepEqual(invalidAuthCookies([{name,value},{name:name+'.0',value}]),[name,name+'.0']);
});
