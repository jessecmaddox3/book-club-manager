import assert from 'node:assert/strict';import test from 'node:test';
import {runtimeConfig,safeRedirect,requireSameOrigin} from '../src/lib/runtime/config';
test('demo never falls through to inherited cloud or AI credentials',()=>{
 const c=runtimeConfig({DATABASE_URL:'do-not-connect',ANTHROPIC_API_KEY:'unused-fixture',BOOKCLUB_ENABLE_AI:'yes'});
 assert.equal(c.mode,'demo');assert.equal(c.databaseUrl,undefined);assert.equal(c.aiEnabled,false);
 for(const env of [{VERCEL:'1'},{BOOKCLUB_ORIGIN:'https://club.example'},{BOOKCLUB_MODE:'other'}])assert.throws(()=>runtimeConfig(env));
 assert.throws(()=>runtimeConfig({BOOKCLUB_MODE:'production'}),/missing/);
});
test('redirects reject cross-origin, encoded slash and backslash bypasses',()=>{
 for(const value of ['https://outside.invalid','//outside.invalid','/\\outside.invalid','/%2foutside.invalid','/%255coutside.invalid','/%0aevil',null])assert.equal(safeRedirect(value),'/');
 assert.equal(safeRedirect('/books/rate?from=ballot'),'/books/rate?from=ballot');
});
test('writes require the configured origin and same-origin browser context',()=>{
 const c=runtimeConfig({});
 requireSameOrigin(new Request(c.origin+'/api/survey',{method:'POST',headers:{host:'127.0.0.1:5055',origin:c.origin,'sec-fetch-site':'same-origin'}}),c);
 for(const headers of ([{},{origin:'https://outside.invalid'},{origin:c.origin,'sec-fetch-site':'cross-site'}] as Record<string,string>[]))assert.throws(()=>requireSameOrigin(new Request(c.origin+'/api/survey',{method:'POST',headers}),c));
 assert.throws(()=>requireSameOrigin(new Request('http://example.invalid/api/survey',{method:'POST',headers:{origin:c.origin}}),c));
});
test('the actual host is checked even when Next normalizes its internal URL',()=>{
 const c=runtimeConfig({});
 assert.throws(()=>requireSameOrigin(new Request(c.origin+'/api/survey',{method:'POST',headers:{host:'outside.invalid',origin:c.origin}}),c));
 assert.throws(()=>requireSameOrigin(new Request(c.origin+'/api/survey',{method:'POST',headers:{host:'127.0.0.1:5055@outside.invalid',origin:c.origin}}),c));
 requireSameOrigin(new Request('http://localhost:9999/api/survey',{method:'POST',headers:{host:'127.0.0.1:5055',origin:c.origin}}),c);
});
test('production rejects non-HTTP identity services and non-PostgreSQL databases',()=>{
 const production={BOOKCLUB_MODE:'production',BOOKCLUB_ORIGIN:'https://club.example',DATABASE_URL:'postgresql://reader:secret@localhost:5432/club',SUPABASE_URL:'https://identity.example',SUPABASE_PUBLISHABLE_KEY:'example-public-key',SESSION_SECRET:'a'.repeat(48)};
 assert.throws(()=>runtimeConfig({...production,SUPABASE_URL:'ftp://localhost/auth'}),/HTTP/);
 assert.throws(()=>runtimeConfig({...production,SUPABASE_URL:'https://name:secret@identity.example'}),/credentials/);
 assert.throws(()=>runtimeConfig({...production,DATABASE_URL:'https://database.example'}),/PostgreSQL/);
 assert.throws(()=>runtimeConfig({...production,DATABASE_URL:'postgresql:///club?sslmode=require'}),/explicit hostname/);
 assert.equal(runtimeConfig(production).mode,'production');
});
