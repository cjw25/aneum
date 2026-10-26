import {handleCloud} from '../../../server/cloud-api.mjs';

// Supabase supplies the database credential inside its own runtime.
// Only the hash of the separate Aneum administrator key is stored in settings.
Deno.serve(async (request: Request) => {
  const responseHeaders = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  try {
    const url = new URL(request.url);
    const route = url.pathname.split('/').filter(Boolean).pop() || '';
    if (!['status','devices','device','report'].includes(route)) return new Response(JSON.stringify({error:'찾을 수 없습니다'}),{status:404,headers:responseHeaders});
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    const key = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const projectURL = Deno.env.get('SUPABASE_URL');
    if (!key || !projectURL) throw Error('Missing runtime configuration');
    const dbHeaders: Record<string,string> = {apikey:key,Accept:'application/json'};
    if (!key.startsWith('sb_secret_')) dbHeaders.Authorization = 'Bearer '+key;
    const settings = await fetch(projectURL+'/rest/v1/aneum_backend_settings?key=eq.admin_token_hash&select=value',{headers:dbHeaders,signal:AbortSignal.timeout(10000)});
    if (!settings.ok) throw Error('Settings unavailable');
    const rows = await settings.json();
    const digest = rows[0]?.value;
    if (!/^[a-f0-9]{64}$/.test(digest || '')) throw Error('Administrator configuration unavailable');
    let body: unknown = undefined;
    if (request.method === 'POST') {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      if (reader) {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.length;
          if (size > 8192) { await reader.cancel(); return new Response(JSON.stringify({error:'요청이 너무 큽니다'}),{status:413,headers:responseHeaders}); }
          chunks.push(chunk.value);
        }
      }
      const bytes = new Uint8Array(size); let offset=0;
      for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
      try {body=JSON.parse(new TextDecoder().decode(bytes)||'{}');}
      catch {return new Response(JSON.stringify({error:'올바른 JSON 요청을 보내주세요'}),{status:400,headers:responseHeaders});}
    }
    let output = ''; let status = 200;
    const res = {setHeader(name:string,value:string){responseHeaders.set(name,value);},get statusCode(){return status;},set statusCode(value:number){status=value;},end(value:string){output=value;}};
    const headers = Object.fromEntries(request.headers.entries());
    headers.host = url.host;
    await handleCloud({headers,method:request.method,url:request.url,body},res,route,{env:{SUPABASE_URL:projectURL,SUPABASE_SECRET_KEY:key,ANEUM_ADMIN_TOKEN_SHA256:digest}});
    return new Response(output,{status,headers:responseHeaders});
  } catch {
    return new Response(JSON.stringify({error:'데이터 저장소 연결을 확인해주세요.'}),{status:503,headers:responseHeaders});
  }
});
