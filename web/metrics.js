const labels={permission_denied:'권한 미허용',unsupported:'지원 안 됨',not_enabled:'이 빌드에서 미수집',error:'읽기 실패'};
export function metricRows(sample,formatTime){
 const names=['첫 화면 켜짐','첫 잠금 해제','화면 켜짐 횟수','잠금 해제 횟수','받은 전화','건 전화 (발신 기록)','부재중 전화'];
 if(!sample)return names.map(label=>[label,'아직 수신 안 됨']);
 if(sample.schemaVersion!==2)return names.map(label=>[label,'이전 버전 · 미수집']);
 const usage=labels[sample.usageStatus],calls=labels[sample.callStatus];
 return [
  [names[0],usage|| (sample.firstScreenOnAt===null?'기록 없음':formatTime(sample.firstScreenOnAt))],
  [names[1],usage|| (sample.firstUnlockAt===null?'기록 없음':formatTime(sample.firstUnlockAt))],
  [names[2],usage||sample.screenOnCount+'회'],[names[3],usage||sample.unlockCount+'회'],
  [names[4],calls||sample.incomingCallCount+'회'],[names[5],calls||sample.outgoingCallCount+'회'],[names[6],calls||sample.missedCallCount+'회']
 ];
}
