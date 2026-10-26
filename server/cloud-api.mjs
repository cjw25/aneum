import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {assess,validateSample} from './state.mjs';
import {redisStore} from './redis-store.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const json=(res,status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
const publicDevice=d=>({id:d.id,name:d.name,platform:d.platform,createdAt:d.createdAt,latest:d.latest,status:assess(d)});
export function configured(env) {
  return /^[a-f0-9]{64}$/.test(env.ANEUM_ADMIN_TOKEN||'') && !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;
}
async function readBody(req) {
  if(req.body!==undefined) {
    const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
    if(Buffer.byteLength(raw)>8192)throw Error('요청이 너무 큽니다');
    return JSON.parse(raw);
  }
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw Error('요청이 너무 큽니다');}
  return JSON.parse(raw||'{}');
}
export async function handleCloud(req,res,route,{env=process.env,store}={}) {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  // Never trust a supplied Origin to choose an upstream or a redirect.
  if(req.headers.origin) {
    let origin;try{origin=new URL(req.headers.origin);}catch{return json(res,403,{error:'허용되지 않은 요청입니다'});}
    if(origin.protocol!=='https:'||origin.host!==req.headers.host)return json(res,403,{error:'다른 사이트에서의 요청은 허용되지 않습니다'});
  }
  if(route==='status'&&req.method==='GET') return json(res,200,{mode:configured(env)?'live':'preview'});
  if(!configured(env))return json(res,503,{error:'이 배포는 예시 화면입니다. 실제 연결에는 서버 인증과 영구 저장소 설정이 필요합니다.'});
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(token))return json(res,401,{error:'연결 키를 확인해주세요'});
  if(route!=='report'&&!equal(token,env.ANEUM_ADMIN_TOKEN))return json(res,401,{error:'관리자 연결 키를 확인해주세요'});
  let storage;
  try {storage=store||redisStore(env);}catch{return json(res,503,{error:'서버 저장소 설정을 확인해주세요'});}
  try {
    if(route==='devices'&&req.method==='GET')return json(res,200,{devices:(await storage.list()).map(publicDevice)});
    if(route==='devices'&&req.method==='POST') {
      let b;try{b=await readBody(req);}catch{return json(res,400,{error:'올바른 JSON 요청을 보내주세요'});}
      if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>40||!['ios','android'].includes(b.platform))return json(res,400,{error:'이름과 기종을 확인해주세요'});
      const deviceToken=randomBytes(32).toString('hex');
      const device={id:randomBytes(12).toString('hex'),name:b.name.trim(),platform:b.platform,tokenHash:hash(deviceToken),createdAt:Date.now(),latest:null};
      if(!await storage.create(device))return json(res,409,{error:'등록 한도에 도달했습니다. 연결 상태를 확인해주세요.'});
      return json(res,201,{device:publicDevice(device),deviceToken});
    }
    if(route==='device'&&req.method==='DELETE') {
      const id=new URL(req.url,'https://localhost').searchParams.get('id');
      if(!/^[a-f0-9]{24}$/.test(id||''))return json(res,400,{error:'올바른 기기 식별자가 필요합니다'});
      await storage.remove(id);return json(res,200,{ok:true});
    }
    if(route==='report'&&req.method==='POST') {
      const tokenHash=hash(token);
      const device=(await storage.list()).find(d=>equal(d.tokenHash,tokenHash));
      if(!device)return json(res,401,{error:'휴대폰 연결 키를 확인해주세요'});
      let sample;try{sample=validateSample(await readBody(req),device.platform);}catch{return json(res,400,{error:'측정 범위 또는 값이 잘못되었습니다'});}
      const result=await storage.report(device.id,tokenHash,sample);
      if(result===-1)return json(res,401,{error:'연결이 해제된 휴대폰입니다'});
      return json(res,200,result===0?{ok:true,ignoredOlderSample:true}:{ok:true,receivedAt:sample.receivedAt});
    }
    return json(res,405,{error:'지원하지 않는 요청입니다'});
  }catch{return json(res,503,{error:'저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'});}
}
