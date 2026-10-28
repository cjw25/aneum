export function assess(device, now = Date.now()) {
  const sample = device.latest;
  if (!sample) return {kind:'waiting', label:'연결 대기', detail:'아직 휴대폰에서 받은 정보가 없어요.'};
  if (now - sample.receivedAt > 90 * 60_000 || now - sample.windowEnd > 90 * 60_000) return {kind:'stale', label:'정보 갱신 지연', detail:'최근 정보가 도착하지 않아 활동 여부를 판단하기 어려워요.'};
  if (sample.schemaVersion===2 && sample.usageStatus==='unsupported') return {kind:'unsupported',label:'요청 항목 지원 안 됨',detail:'이 기기에서는 첫 화면 사용·사용 횟수·통화 횟수를 자동 수집하지 못합니다.'};
  if (!sample.permissionGranted) return {kind:'permission', label:'설정 확인 필요', detail:'휴대폰의 활동 정보 권한이 꺼져 있어요.'};
  if (sample.measurementError) return {kind:'unavailable', label:'측정 불가', detail:'휴대폰에서 활동 기록을 읽지 못했어요.'};
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const sampleDay = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(sample.windowEnd);
  if (day !== sampleDay) return {kind:'stale',label:'오늘 정보 대기', detail:'오늘의 활동 기록이 아직 도착하지 않았어요.'};
  if (sample.activityCount > 0) return {kind:'active', label:'오늘 활동 확인', detail:sample.schemaVersion===2?'오늘 화면이 켜진 기록이 있어요. 첫 잠금 해제는 별도로 표시합니다.':device.platform === 'ios' ? '이전 버전의 걸음 기록입니다. 요청하신 휴대폰 사용·통화 기록은 아닙니다.' : '이전 버전의 앱 전환 기록입니다. 요청하신 화면 사용·통화 기록은 아닙니다.'};
  return {kind:'quiet', label:'활동 미확인', detail:'수집한 범위에서 오늘 활동 신호가 없어요. 필요하면 연락해보세요.'};
}

export function validateSample(body, platform, now = Date.now()) {
  if (!body || typeof body !== 'object') throw Error('잘못된 측정값');
  const {windowStart, windowEnd, activityCount, permissionGranted, measurementError = false} = body;
  if (![windowStart,windowEnd,activityCount].every(Number.isSafeInteger) || windowStart > windowEnd || windowStart < now - 48*3600_000 || windowEnd > now + 300_000 || windowEnd < now - 24*3600_000 || activityCount < 0 || activityCount > 1_000_000 || typeof permissionGranted !== 'boolean' || typeof measurementError !== 'boolean') throw Error('측정 범위 또는 값이 잘못되었습니다');
  if ((!permissionGranted || measurementError) && activityCount !== 0) throw Error('읽지 못한 기록을 활동으로 보고할 수 없습니다');
  const result={windowStart, windowEnd, activityCount, permissionGranted, measurementError, signal:platform === 'ios' ? 'steps' : 'usage', receivedAt:now};
  if(body.schemaVersion===undefined)return result;
  if(body.schemaVersion!==2)throw Error('지원하지 않는 측정 버전');
  const {usageStatus,callStatus}=body;
  if(!['available','permission_denied','unsupported','error'].includes(usageStatus)||!['available','permission_denied','unsupported','not_enabled','error'].includes(callStatus))throw Error('잘못된 수집 상태');
  const count=name=>{const value=body[name];if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>1_000_000))throw Error('잘못된 집계');return value;};
  const timestamp=name=>{const value=body[name];if(value!==null&&(!Number.isSafeInteger(value)||value<windowStart||value>windowEnd))throw Error('잘못된 활동 시각');return value;};
  const screenOnCount=count('screenOnCount'),unlockCount=count('unlockCount');
  const firstScreenOnAt=timestamp('firstScreenOnAt'),firstUnlockAt=timestamp('firstUnlockAt');
  const incomingCallCount=count('incomingCallCount'),outgoingCallCount=count('outgoingCallCount'),missedCallCount=count('missedCallCount');
  if(usageStatus==='available'){
    if(!permissionGranted||measurementError||screenOnCount===null||unlockCount===null||activityCount!==screenOnCount||(screenOnCount===0)!==(firstScreenOnAt===null)||(unlockCount===0)!==(firstUnlockAt===null))throw Error('활동 상태와 집계가 일치하지 않습니다');
  }else if(screenOnCount!==null||unlockCount!==null||firstScreenOnAt!==null||firstUnlockAt!==null||activityCount!==0)throw Error('미수집 값을 0으로 표시할 수 없습니다');
  if(callStatus==='available'){
    if(incomingCallCount===null||outgoingCallCount===null||missedCallCount===null)throw Error('통화 집계 누락');
  }else if(incomingCallCount!==null||outgoingCallCount!==null||missedCallCount!==null)throw Error('미수집 통화 값을 0으로 표시할 수 없습니다');
  if(platform==='ios'&&(usageStatus!=='unsupported'||callStatus!=='unsupported'))throw Error('지원되지 않는 아이폰 측정');
  return {...result,schemaVersion:2,signal:platform==='ios'?'unsupported':'device_usage',usageStatus,callStatus,screenOnCount,unlockCount,firstScreenOnAt,firstUnlockAt,incomingCallCount,outgoingCallCount,missedCallCount};
}
