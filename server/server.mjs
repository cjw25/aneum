import http from 'node:http';
import {randomBytes, timingSafeEqual, createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {assess,validateSample} from './state.mjs';
const base = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.ANEUM_DATA_DIR || path.join(base,'../data');
await mkdir(dataDir,{recursive:true});
const secretFile = path.join(dataDir,'admin-token');
let adminToken;
try { adminToken = (await readFile(secretFile,'utf8')).trim(); } catch(e) {if(e.code!=='ENOENT')throw e; adminToken=randomBytes(32).toString('hex'); await writeFile(secretFile,adminToken,{mode:0o600});}
let db={devices:[]};
try {db=JSON.parse(await readFile(path.join(dataDir,'devices.json'),'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;}
const save=async()=>{const f=path.join(dataDir,'devices.json'); await writeFile(f+'.tmp',JSON.stringify(db,null,2),{mode:0o600});await rename(f+'.tmp',f);};
const hash=x=>createHash('sha256').update(x).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
const body=async req=>{let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw Error('요청이 너무 큽니다');} return JSON.parse(text||'{}');};
const publicDevice=d=>({id:d.id,name:d.name,platform:d.platform,createdAt:d.createdAt,latest:d.latest,status:assess(d)});
let queue=Promise.resolve();
const server=http.createServer((req,res)=>{queue=queue.then(async()=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 const url=new URL(req.url,'http://localhost');
 if (!['127.0.0.1','localhost','[::1]'].includes((req.headers.host||'').split(/:(?=\d+$)/)[0])) return json(res,403,{error:'허용되지 않은 호스트'});
 if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return json(res,403,{error:'다른 사이트에서의 요청은 허용되지 않습니다'});
 if(req.method==='GET'&&['/','/app.js','/metrics.js','/style.css'].includes(url.pathname)) {
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1);res.setHeader('Content-Type',file.endsWith('html')?'text/html; charset=utf-8':file.endsWith('js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');return res.end(await readFile(path.join(base,'../web',file)));
 }
 if(!url.pathname.startsWith('/api/'))return json(res,404,{error:'찾을 수 없습니다'});
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(url.pathname==='/api/report'&&req.method==='POST') {
  const device=db.devices.find(d=>equal(d.tokenHash,hash(token)));
  if(!device)return json(res,401,{error:'휴대폰 연결 키가 올바르지 않습니다'});
  const sample=validateSample(await body(req),device.platform);
  if(device.latest && sample.windowEnd < device.latest.windowEnd) return json(res,200,{ok:true,ignoredOlderSample:true});
  device.latest=sample;await save();return json(res,200,{ok:true,receivedAt:sample.receivedAt});
 }
 if(!equal(token,adminToken))return json(res,401,{error:'관리자 연결 키를 확인해주세요'});
 if(req.method==='GET'&&url.pathname==='/api/devices')return json(res,200,{devices:db.devices.map(publicDevice)});
 if(req.method==='POST'&&url.pathname==='/api/devices') {
  const b=await body(req);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>40||!['ios','android'].includes(b.platform))return json(res,400,{error:'이름과 기종을 확인해주세요'});
  if(db.devices.length>=20)return json(res,400,{error:'시험 버전은 20대까지 연결할 수 있습니다'});
  const deviceToken=randomBytes(32).toString('hex');const d={id:randomBytes(12).toString('hex'),name:b.name.trim(),platform:b.platform,tokenHash:hash(deviceToken),createdAt:Date.now(),latest:null};db.devices.push(d);await save();return json(res,201,{device:publicDevice(d),deviceToken});
 }
 if(req.method==='DELETE'&&url.pathname.startsWith('/api/devices/')) {const id=url.pathname.split('/').pop();db.devices=db.devices.filter(d=>d.id!==id);await save();return json(res,200,{ok:true});}
 return json(res,404,{error:'찾을 수 없습니다'});
 }).catch(e=>{if(!res.headersSent)json(res,400,{error:e.message});else res.end();});});
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>{console.log(`안음 시험 서버: http://127.0.0.1:${server.address().port}`);console.log(`관리자 연결 키: ${adminToken}`);console.log('이 키를 확인 화면에 입력하세요. 외부에 공유하지 마세요.');});
