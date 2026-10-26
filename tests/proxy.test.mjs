import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleCloud,configured} from '../server/cloud-api.mjs';
const backend='https://test.supabase.co/functions/v1/aneum-api';
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.body=JSON.parse(text);}};}
test('Vercel forwards only the caller authorization to the fixed Supabase endpoint',async()=>{
 let call;const res=response();
 await handleCloud({method:'POST',url:'/api/devices',headers:{host:'aneum.vercel.app',origin:'https://aneum.vercel.app',authorization:'Bearer test'},body:{name:'부모님',platform:'ios'}},res,'devices',{env:{ANEUM_BACKEND_URL:backend},fetcher:async(url,options)=>{call={url,options};return {status:201,json:async()=>({device:{id:'test'}})};}});
 assert.equal(res.statusCode,201);assert.equal(call.url.href,backend+'/devices');assert.equal(call.options.headers.Authorization,'Bearer test');assert.equal('Origin' in call.options.headers,false);assert.equal(JSON.parse(call.options.body).name,'부모님');
});
test('Supabase proxy rejects cross-origin requests before forwarding',async()=>{
 const res=response();let called=false;
 await handleCloud({method:'POST',url:'/api/devices',headers:{host:'aneum.vercel.app',origin:'https://other.example'}},res,'devices',{env:{ANEUM_BACKEND_URL:backend},fetcher:async()=>{called=true;}});
 assert.equal(res.statusCode,403);assert.equal(called,false);
});
test('proxy deletion preserves device ID and unsupported methods are blocked',async()=>{
 let destination;const res=response();
 await handleCloud({method:'DELETE',url:'/api/device?id=abc',headers:{}},res,'device',{env:{ANEUM_BACKEND_URL:backend},fetcher:async(url)=>{destination=url;return {status:200,json:async()=>({ok:true})};}});
 assert.equal(destination.searchParams.get('id'),'abc');
 const invalid=response();await handleCloud({method:'PUT',url:'/api/devices',headers:{}},invalid,'devices',{env:{ANEUM_BACKEND_URL:backend}});assert.equal(invalid.statusCode,405);
});
test('invalid proxy URLs and upstream failures do not leak details',async()=>{
 for(const url of ['http://test.supabase.co/functions/v1/aneum-api','https://evil.example/functions/v1/aneum-api']){
  const res=response();await handleCloud({method:'GET',url:'/api/status',headers:{}},res,'status',{env:{ANEUM_BACKEND_URL:url}});assert.equal(res.statusCode,503);
 }
});
test('Edge backend can validate the admin key using a stored hash only',async()=>{
 const key='a'.repeat(64),digest=createHash('sha256').update(key).digest('hex');
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',ANEUM_ADMIN_TOKEN_SHA256:digest};
 assert.equal(configured(env),true);
 const res=response();await handleCloud({method:'GET',url:'/api/devices',headers:{authorization:'Bearer '+key}},res,'devices',{env,store:{list:async()=>[]}});
 assert.equal(res.statusCode,200);assert.deepEqual(res.body.devices,[]);
 const denied=response();await handleCloud({method:'GET',url:'/api/devices',headers:{authorization:'Bearer '+'b'.repeat(64)}},denied,'devices',{env,store:{list:async()=>[]}});assert.equal(denied.statusCode,401);
});
