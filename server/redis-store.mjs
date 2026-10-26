// Atomic Redis scripts prevent concurrent registrations exceeding the limit,
// older reports overwriting newer ones, or reports reviving deleted devices.
const createScript = `
if redis.call('HLEN', KEYS[1]) >= 20 then return 0 end
return redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2])`;
const reportScript = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return -1 end
local device = cjson.decode(raw)
if device.tokenHash ~= ARGV[2] then return -1 end
local sample = cjson.decode(ARGV[3])
if device.latest and device.latest ~= cjson.null and sample.windowEnd < device.latest.windowEnd then return 0 end
device.latest = sample
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(device))
return 1`;

export function redisStore(env=process.env, fetcher=fetch) {
  const url=new URL(env.UPSTASH_REDIS_REST_URL);
  if(url.protocol!=='https:'||url.username||url.password) throw Error('Storage configuration invalid');
  const key=(env.ANEUM_REDIS_NAMESPACE||'aneum-pilot')+':devices';
  async function command(args) {
    const response=await fetcher(url,{method:'POST',headers:{Authorization:'Bearer '+env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Storage request failed');
    const result=await response.json();
    if(result.error)throw Error('Storage command failed');
    return result.result;
  }
  return {
    async list(){return (await command(['HVALS',key])).map(v=>JSON.parse(v));},
    async create(device){return (await command(['EVAL',createScript,1,key,device.id,JSON.stringify(device)]))===1;},
    async report(id,tokenHash,sample){return await command(['EVAL',reportScript,1,key,id,tokenHash,JSON.stringify(sample)]);},
    async remove(id){await command(['HDEL',key,id]);}
  };
}
