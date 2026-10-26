import test from 'node:test';
import assert from 'node:assert/strict';
import {handleCloud} from '../server/cloud-api.mjs';
import {redisStore} from '../server/redis-store.mjs';
const env={ANEUM_ADMIN_TOKEN:'a'.repeat(64),UPSTASH_REDIS_REST_URL:'https://example.invalid',UPSTASH_REDIS_REST_TOKEN:'test'};
async function request(route,{token='',method='GET',body,url='/api/'+route,origin,store,configuration=env}={}){
 const headers={host:'aneum.example','authorization':'Bearer '+token,...(origin?{origin}:{})};
 const result={headers:{},setHeader(k,v){this.headers[k]=v;},end(raw){this.body=JSON.parse(raw);}};
 await handleCloud({headers,method,body,url},result,route,{env:configuration,store});return result;
}
function memoryStore(){const rows=new Map();return {
 list:async()=>[...rows.values()],create:async d=>{rows.set(d.id,d);return true;},remove:async id=>{rows.delete(id);},
 report:async(id,hash,sample)=>{const d=rows.get(id);if(!d||d.tokenHash!==hash)return -1;if(d.latest&&sample.windowEnd<d.latest.windowEnd)return 0;d.latest=sample;return 1;}
};}
test('unconfigured deployment explicitly reports preview and blocks enrollment',async()=>{
 assert.equal((await request('status',{configuration:{}})).body.mode,'preview');
 assert.equal((await request('devices',{configuration:{},method:'POST',body:{name:'엄마'}})).statusCode,503);
});
test('cloud APIs enforce administrator authentication and same-origin requests',async()=>{
 assert.equal((await request('devices',{token:'b'.repeat(64)})).statusCode,401);
 assert.equal((await request('devices',{token:env.ANEUM_ADMIN_TOKEN,origin:'https://evil.example'})).statusCode,403);
});
test('cloud enrollment, reporting, listing, and revocation work across handler calls',async()=>{
 const store=memoryStore();const admin=env.ANEUM_ADMIN_TOKEN;
 const created=await request('devices',{method:'POST',token:admin,body:{name:'부모님',platform:'ios'},store});assert.equal(created.statusCode,201);
 const {device,deviceToken}=created.body;const now=Date.now();const payload={windowStart:now-60000,windowEnd:now,activityCount:12,permissionGranted:true};
 assert.equal((await request('devices',{token:deviceToken,store})).statusCode,401);
 assert.equal((await request('report',{method:'POST',token:deviceToken,body:payload,store})).statusCode,200);
 const listed=await request('devices',{token:admin,store});assert.equal(listed.body.devices[0].latest.signal,'steps');assert.equal(listed.body.devices[0].status.kind,'active');assert.equal('tokenHash' in listed.body.devices[0],false);
 assert.equal((await request('device',{method:'DELETE',url:'/api/device?id='+device.id,token:admin,store})).statusCode,200);
 assert.equal((await request('report',{method:'POST',token:deviceToken,body:payload,store})).statusCode,401);
});
test('storage outages do not produce fabricated successful data',async()=>{
 const store={list:async()=>{throw Error('secret upstream detail');}};
 const r=await request('devices',{token:env.ANEUM_ADMIN_TOKEN,store});assert.equal(r.statusCode,503);assert.equal(JSON.stringify(r.body).includes('secret'),false);
});
test('oversized JSON and invalid device identifiers are rejected',async()=>{
 const store=memoryStore();
 assert.equal((await request('devices',{method:'POST',token:env.ANEUM_ADMIN_TOKEN,body:{name:'x'.repeat(9000)},store})).statusCode,400);
 assert.equal((await request('device',{method:'DELETE',token:env.ANEUM_ADMIN_TOKEN,url:'/api/device?id=other-key',store})).statusCode,400);
});
test('concurrent revocation is honored by atomic report result',async()=>{
 const store=memoryStore();const created=await request('devices',{method:'POST',token:env.ANEUM_ADMIN_TOKEN,body:{name:'시험',platform:'android'},store});
 store.report=async()=>-1;const now=Date.now();
 assert.equal((await request('report',{method:'POST',token:created.body.deviceToken,body:{windowStart:now-1000,windowEnd:now,activityCount:1,permissionGranted:true},store})).statusCode,401);
});
test('Redis adapter uses HTTPS and keeps bearer credentials out of commands',async()=>{
 let captured;
 const store=redisStore(env,async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({result:[]})};});
 assert.deepEqual(await store.list(),[]);assert.equal(captured.options.headers.Authorization,'Bearer test');assert.deepEqual(JSON.parse(captured.options.body),['HVALS','aneum-pilot:devices']);
 assert.throws(()=>redisStore({...env,UPSTASH_REDIS_REST_URL:'http://example.invalid'}));
});
