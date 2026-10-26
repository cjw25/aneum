export function assess(device, now = Date.now()) {
  const sample = device.latest;
  if (!sample) return {kind:'waiting', label:'연결 대기', detail:'아직 휴대폰에서 받은 정보가 없어요.'};
  if (now - sample.receivedAt > 90 * 60_000 || now - sample.windowEnd > 90 * 60_000) return {kind:'stale', label:'정보 갱신 지연', detail:'최근 정보가 도착하지 않아 활동 여부를 판단하기 어려워요.'};
  if (!sample.permissionGranted) return {kind:'permission', label:'설정 확인 필요', detail:'휴대폰의 활동 정보 권한이 꺼져 있어요.'};
  if (sample.measurementError) return {kind:'unavailable', label:'측정 불가', detail:'휴대폰에서 활동 기록을 읽지 못했어요.'};
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const sampleDay = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(sample.windowEnd);
  if (day !== sampleDay) return {kind:'stale',label:'오늘 정보 대기', detail:'오늘의 활동 기록이 아직 도착하지 않았어요.'};
  if (sample.activityCount > 0) return {kind:'active', label:'오늘 활동 확인', detail:device.platform === 'ios' ? '오늘 걸음 기록이 있어요. 휴대폰 잠금 해제 여부와는 다른 정보예요.' : '오늘 휴대폰 사용 기록이 있어요.'};
  return {kind:'quiet', label:'활동 미확인', detail:'수집한 범위에서 오늘 활동 신호가 없어요. 필요하면 연락해보세요.'};
}

export function validateSample(body, platform, now = Date.now()) {
  if (!body || typeof body !== 'object') throw Error('잘못된 측정값');
  const {windowStart, windowEnd, activityCount, permissionGranted, measurementError = false} = body;
  if (![windowStart,windowEnd,activityCount].every(Number.isSafeInteger) || windowStart > windowEnd || windowStart < now - 48*3600_000 || windowEnd > now + 300_000 || windowEnd < now - 24*3600_000 || activityCount < 0 || activityCount > 1_000_000 || typeof permissionGranted !== 'boolean' || typeof measurementError !== 'boolean') throw Error('측정 범위 또는 값이 잘못되었습니다');
  if ((!permissionGranted || measurementError) && activityCount !== 0) throw Error('읽지 못한 기록을 활동으로 보고할 수 없습니다');
  return {windowStart, windowEnd, activityCount, permissionGranted, measurementError, signal:platform === 'ios' ? 'steps' : 'usage', receivedAt:now};
}
