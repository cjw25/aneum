import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSample,assess} from '../server/state.mjs';
import {metricRows} from '../web/metrics.js';
const now=Date.parse('2026-10-28T03:00:00Z');
const base={schemaVersion:2,windowStart:now-3600000,windowEnd:now,activityCount:2,permissionGranted:true,measurementError:false,usageStatus:'available',callStatus:'not_enabled',screenOnCount:2,unlockCount:1,firstScreenOnAt:now-10000,firstUnlockAt:now-9000,incomingCallCount:null,outgoingCallCount:null,missedCallCount:null};
test('screen and unlock measurements persist as distinct metrics',()=>{
 const result=validateSample(base,'android',now);assert.equal(result.screenOnCount,2);assert.equal(result.unlockCount,1);assert.equal(result.firstScreenOnAt,now-10000);assert.equal(result.signal,'device_usage');
});
test('permission-denied call collection is never shown as zero calls',()=>{
 const result=validateSample({...base,callStatus:'permission_denied'},'android',now);
 assert.equal(metricRows(result,String).find(r=>r[0]==='받은 전화')[1],'권한 미허용');
});
test('zero calls are displayed only for a successful read',()=>{
 const result=validateSample({...base,callStatus:'available',incomingCallCount:0,outgoingCallCount:0,missedCallCount:0},'android',now);
 assert.equal(metricRows(result,String).find(r=>r[0]==='받은 전화')[1],'0회');
});
test('reject impossible times, contradictory counts and unsupported iOS measurements',()=>{
 for(const patch of [{firstUnlockAt:now+1},{screenOnCount:0},{callStatus:'available'},{callStatus:'permission_denied',incomingCallCount:0},{usageStatus:'error'}])assert.throws(()=>validateSample({...base,...patch},'android',now));
 assert.throws(()=>validateSample(base,'ios',now));
});
test('unsupported iOS state has null values and does not imply inactivity',()=>{
 const input={...base,usageStatus:'unsupported',callStatus:'unsupported',activityCount:0,firstScreenOnAt:null,firstUnlockAt:null,screenOnCount:null,unlockCount:null};
 const result=validateSample(input,'ios',now);assert.equal(assess({platform:'ios',latest:result},now).kind,'unsupported');assert.equal(metricRows(result,String)[0][1],'지원 안 됨');
});
test('older step and app-transition measurements cannot masquerade as requested metrics',()=>{
 assert.equal(metricRows({signal:'steps',activityCount:42},String)[2][1],'이전 버전 · 미수집');
});
