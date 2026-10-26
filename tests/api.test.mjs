import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
test('enrollment, authentic reporting, revocation and private APIs',async()=>{
 const scratch=path.resolve(root,'work');await mkdir(scratch,{recursive:true});
 const dir=await mkdtemp(path.join(scratch,'aneum-api-'));
 const child=spawn(process.execPath,['server/server.mjs'],{cwd:root,env:{...process.env,PORT:'0',ANEUM_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try {
  let output='';const address=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('server startup timed out')),10000);child.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timeout);resolve(m[0]);}});child.once('error',reject);child.once('exit',()=>reject(Error('server exited')));});
  const admin=(await readFile(path.join(dir,'admin-token'),'utf8')).trim();
  const req=async(route,key,method='GET',body)=>fetch(address+'/api/'+route,{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  assert.equal((await req('devices','wrong')).status,401);
  const created=await req('devices',admin,'POST',{name:'테스트 부모님',platform:'android'});assert.equal(created.status,201);
  const {device,deviceToken}=await created.json();
  assert.equal((await req('devices',deviceToken)).status,401);
  assert.equal((await req('report',admin,'POST',{})).status,401);
  const now=Date.now();const payload={windowStart:now-60000,windowEnd:now,activityCount:3,permissionGranted:true};
  assert.equal((await req('report',deviceToken,'POST',payload)).status,200);
  const list=await (await req('devices',admin)).json();assert.equal(list.devices[0].status.kind,'active');assert.equal(list.devices[0].latest.activityCount,3);
  assert.equal(JSON.stringify(list).includes(deviceToken),false);assert.equal('tokenHash' in list.devices[0],false);
  const delayed=await req('report',deviceToken,'POST',{...payload,windowEnd:now-1000,activityCount:0});assert.equal((await delayed.json()).ignoredOlderSample,true);
  assert.equal((await (await req('devices',admin)).json()).devices[0].latest.activityCount,3);
  assert.equal((await req('report',deviceToken,'POST',{...payload,activityCount:-1})).status,400);
  assert.equal((await fetch(address+'/api/devices',{headers:{Authorization:'Bearer '+admin,Origin:'http://evil.invalid'}})).status,403);
  assert.equal((await req('devices/'+device.id,admin,'DELETE')).status,200);
  assert.equal((await req('report',deviceToken,'POST',payload)).status,401);
  assert.equal((await (await req('devices',admin)).json()).devices.length,0);
 } finally {child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));await rm(dir,{recursive:true,force:true});}
});
