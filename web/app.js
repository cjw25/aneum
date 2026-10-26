const $=s=>document.querySelector(s);
let token=sessionStorage.getItem('aneum-admin')||'';
let serverReady=true;
$('#admin').value=token;
$('#date').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date());
const time=t=>t?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).format(t):'아직 없음';
async function api(route,method='GET',body){
 const r=await fetch('/api/'+route,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw Error(data.error||'연결 실패');return data;
}
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function render(devices){
 $('#count').textContent=devices.length;$('#cards').replaceChildren();
 if(!devices.length){$('#cards').append(el('div',serverReady?'아직 연결된 가족이 없어요. 확인 화면을 연결하고 휴대폰을 등록해주세요.':'연결 대기 중이에요. 실제 휴대폰에서 활동 기록이 도착하면 이곳에 표시됩니다. 현재 서버 연결 설정이 필요합니다.','empty'));return;}
 for(const d of devices){
  const card=el('article',undefined,'card'),top=el('div',undefined,'card-top');
  top.append(el('div',d.name.slice(0,1),'avatar'));
  const who=el('div');who.append(el('h3',d.name),el('span',d.platform==='ios'?'아이폰 · 걸음 기록':'갤럭시 · 휴대폰 사용 기록','device'));top.append(who);
  card.append(top,el('span',d.status.label,'badge '+d.status.kind),el('p',d.status.detail,'detail'));
  const facts=el('div',undefined,'facts'),latest=d.latest;
  const rows=[['활동 기록 범위 끝',time(latest?.windowEnd)],['서버가 받은 시각',time(latest?.receivedAt)],['오늘 수집된 활동',!latest||latest.permissionGranted===false||latest.measurementError?'확인 불가':latest.activityCount+(d.platform==='ios'?'걸음':'회 (사용 이벤트)')]];
  for(const [a,b] of rows){const row=el('div',undefined,'fact');row.append(el('span',a),el('strong',b));facts.append(row);}
  card.append(facts);
  const remove=el('button','연결 해제 및 기록 삭제','remove');
  remove.onclick=async()=>{if(!confirm(d.name+' 연결과 기록을 삭제할까요?'))return;try{await api('devices/'+d.id,'DELETE');await refresh();}catch(e){$('#error').textContent=e.message;}};
  card.append(remove);$('#cards').append(card);
 }
}
async function refresh(){
 $('#error').textContent='';if(!serverReady||!token){render([]);return;}
 try{const d=await api('devices');render(d.devices);$('#authStatus').textContent='확인 화면이 연결됐어요.';}catch(e){$('#error').textContent=e.message;render([]);}
}
$('#auth').onsubmit=async e=>{e.preventDefault();token=$('#admin').value.trim();sessionStorage.setItem('aneum-admin',token);await refresh();};
$('#enroll').onsubmit=async e=>{
 e.preventDefault();if(!serverReady)return;const btn=e.target.querySelector('button');btn.disabled=true;
 try{const d=await api('devices','POST',{name:$('#name').value,platform:$('#platform').value});$('#keyValue').textContent=d.deviceToken;$('#deviceKey').hidden=false;$('#name').value='';await refresh();}catch(err){$('#error').textContent=err.message;}finally{btn.disabled=false;}
};
$('#closeKey').onclick=()=>{$('#keyValue').textContent='';$('#deviceKey').hidden=true;};$('#refresh').onclick=refresh;
async function bootstrap(){
 try{
  const response=await fetch('/api/status');
  if(response.ok&&(await response.json()).mode!=='live'){
   serverReady=false;
   $('#banner').textContent='연결 대기 · 서버 연결 설정이 필요합니다. 아직 수집된 활동 정보가 없습니다.';
   $('#connect h2').textContent='가족 연결을 준비하고 있어요';
   $('#connect p').textContent='서버 연결 설정이 완료되면 부모님 휴대폰을 등록할 수 있어요. 실제 기기의 활동 기록만 표시합니다.';
   $('#connect .forms').hidden=true;
  }
 }catch{serverReady=false;$('#banner').textContent='서버에 연결하지 못했어요. 연결 상태를 확인해주세요.';}
 await refresh();setInterval(refresh,30_000);
}
bootstrap();
