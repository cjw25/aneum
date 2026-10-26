import test from 'node:test';
import assert from 'node:assert/strict';
import {supabaseStore} from '../server/supabase-store.mjs';
import {configured,handleCloud} from '../server/cloud-api.mjs';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',ANEUM_ADMIN_TOKEN:'a'.repeat(64)};
test('Supabase configuration is accepted without Redis settings',()=>{
 assert.equal(configured(env),true);assert.equal(configured({...env,SUPABASE_SECRET_KEY:''}),false);
});
test('modern Supabase secret is server-side apikey, not a JWT bearer',async()=>{
 let captured;
 const store=supabaseStore(env,async(url,options)=>{captured={url,options};return {ok:true,status:200,json:async()=>[{id:'1',name:'부모님',platform:'android',token_hash:'hash',created_at:'1234',latest:null}]};});
 const rows=await store.list();assert.equal(rows[0].tokenHash,'hash');assert.equal(rows[0].createdAt,1234);
 assert.equal(captured.options.headers.apikey,'sb_secret_test');assert.equal('Authorization' in captured.options.headers,false);
 assert.equal(captured.url.origin,'https://example.supabase.co');assert.equal(captured.url.pathname,'/rest/v1/aneum_devices');
});
test('legacy service-role key remains compatible without exposing it in request URL',async()=>{
 let captured;
 const store=supabaseStore({NEXT_PUBLIC_SUPABASE_URL:env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:'legacy-jwt'},async(url,options)=>{captured={url,options};return {ok:true,status:200,json:async()=>[]};});
 await store.list();assert.equal(captured.options.headers.Authorization,'Bearer legacy-jwt');assert.equal(captured.url.href.includes('legacy-jwt'),false);
});
test('register and report use transaction-safe RPC; deletion targets one device',async()=>{
 const calls=[];const responses=[true,0,null];
 const store=supabaseStore(env,async(url,options)=>{calls.push({url,options});const data=responses.shift();return {ok:true,status:data===null?204:200,json:async()=>data};});
 const device={id:'1'.repeat(24),name:'시험',platform:'ios'};
 assert.equal(await store.create(device),true);
 assert.equal(await store.report(device.id,'hash',{windowEnd:123}),0);
 await store.remove(device.id);
 assert.equal(calls[0].url.pathname,'/rest/v1/rpc/aneum_register_device');assert.deepEqual(JSON.parse(calls[0].options.body),{p_device:device});
 assert.equal(calls[1].url.pathname,'/rest/v1/rpc/aneum_report_activity');assert.equal(calls[2].options.method,'DELETE');assert.equal(calls[2].url.searchParams.get('id'),'eq.'+device.id);
 await assert.rejects(()=>store.remove('bad&select=*'));
});
test('Supabase backend failures never expose upstream credentials or errors',async()=>{
 const store=supabaseStore(env,async()=>({ok:false,status:401,json:async()=>({secret:'must not leak'})}));
 const res={setHeader(){},end(value){this.body=JSON.parse(value);}};
 await handleCloud({headers:{host:'aneum.example',authorization:'Bearer '+env.ANEUM_ADMIN_TOKEN},method:'GET',url:'/api/devices'},res,'devices',{env,store});
 assert.equal(res.statusCode,503);assert.equal(JSON.stringify(res.body).includes('must not leak'),false);
});
test('invalid upstream URLs are rejected',()=>{
 for(const url of ['http://example.supabase.co','https://user:pass@example.supabase.co','https://example.supabase.co/custom?token=x'])assert.throws(()=>supabaseStore({...env,SUPABASE_URL:url}));
});
