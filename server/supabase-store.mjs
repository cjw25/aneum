export function supabaseConfiguration(env=process.env) {
  return {url:env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL, key:env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY};
}

export function supabaseStore(env=process.env,fetcher=fetch) {
  const {url:address,key}=supabaseConfiguration(env);
  const base=new URL(address);
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!['','/'].includes(base.pathname)||!key)throw Error('Supabase configuration invalid');
  async function request(route,{method='GET',body}={}) {
    const headers={apikey:key,Accept:'application/json','Content-Type':'application/json'};
    // Modern secret keys are opaque API keys, not JWT bearer tokens.
    if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
    const response=await fetcher(new URL('/rest/v1/'+route,base),{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Supabase storage request failed');
    if(response.status===204)return null;
    return response.json();
  }
  return {
    async list(){
      const rows=await request('aneum_devices?select=id,name,platform,token_hash,created_at,latest&order=created_at.asc');
      return rows.map(r=>({id:r.id,name:r.name,platform:r.platform,tokenHash:r.token_hash,createdAt:Number(r.created_at),latest:r.latest}));
    },
    async create(device){return await request('rpc/aneum_register_device',{method:'POST',body:{p_device:device}});},
    async report(id,tokenHash,sample){return await request('rpc/aneum_report_activity',{method:'POST',body:{p_id:id,p_token_hash:tokenHash,p_sample:sample}});},
    async remove(id){
      if(!/^[a-f0-9]{24}$/.test(id))throw Error('Invalid device identifier');
      await request('aneum_devices?id=eq.'+id,{method:'DELETE'});
    }
  };
}
