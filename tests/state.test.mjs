import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,validateSample} from '../server/state.mjs';
const now=Date.parse('2026-10-26T03:00:00Z');
const sample={windowStart:now-3600_000,windowEnd:now,activityCount:4,permissionGranted:true,receivedAt:now};
test('no incoming information is not inactivity',()=>{assert.equal(assess({}).kind,'waiting');});
test('old active information is stale, not reassurance',()=>{assert.equal(assess({latest:{...sample,receivedAt:now-2*3600_000}},now).kind,'stale');});
test('recent receipt cannot make an old measurement fresh',()=>{assert.equal(assess({latest:{...sample,windowEnd:now-2*3600_000}},now).kind,'stale');});
test('permission denial and reading failure are not inactivity',()=>{
 assert.equal(assess({latest:{...sample,activityCount:0,permissionGranted:false}},now).kind,'permission');
 assert.equal(assess({latest:{...sample,activityCount:0,measurementError:true}},now).kind,'unavailable');
});
test('fresh zero count and positive count are different states',()=>{
 assert.equal(assess({latest:{...sample,activityCount:0}},now).kind,'quiet');
 assert.equal(assess({platform:'ios',latest:sample},now).kind,'active');
});
test('yesterday activity cannot count as today after midnight Korea time',()=>{
 const midnight=Date.parse('2026-10-26T15:05:00Z');
 assert.equal(assess({latest:{...sample,windowEnd:midnight-10*60_000,receivedAt:midnight}},midnight).kind,'stale');
});
test('reject fabricated counts, impossible timestamps and contradictory measurements',()=>{
 for(const patch of [{activityCount:-1},{activityCount:0.5},{windowEnd:now+600_000},{windowStart:now+1},{permissionGranted:false},{measurementError:true}]) {
  assert.throws(()=>validateSample({...sample,...patch},'android',now));
 }
});
test('server controls receipt time and signal type',()=>{
 const valid=validateSample({...sample,receivedAt:0,signal:'calls'},'ios',now);
 assert.equal(valid.receivedAt,now);assert.equal(valid.signal,'steps');
});
