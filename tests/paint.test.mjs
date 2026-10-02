import test from 'node:test';
import assert from 'node:assert/strict';
import {paintMinute, paintRange, paintProblem} from '../app/connected/paint.ts';
const day={id:'day',date:'2026-10-20',open:420,close:1380};
const available=[{dayId:'day',start:600,end:840},{dayId:'day',start:1020,end:1260}];
test('paint snaps and clamps both drag directions to the trading window',()=>{
 assert.equal(paintMinute(day,-.1),420); assert.equal(paintMinute(day,1.2),1365);
 assert.equal(paintMinute(day,.202),600);
 assert.deepEqual(paintRange(day,825,600),{dayId:'day',start:600,end:840});
 assert.deepEqual(paintRange(day,600,600),{dayId:'day',start:600,end:615});
});
test('paint rejects an availability gap and overlapping shift, allowing adjacent split shifts',()=>{
 const assigned=[{id:'one',memberId:'fictional',dayId:'day',start:600,end:660}];
 assert.match(paintProblem({dayId:'day',start:780,end:1080},available,assigned),/submitted availability/);
 assert.match(paintProblem({dayId:'day',start:645,end:720},available,assigned),/already has/);
 assert.equal(paintProblem({dayId:'day',start:660,end:840},available,assigned),null);
 assert.equal(paintProblem({dayId:'day',start:1020,end:1260},available,assigned),null);
 assert.deepEqual(assigned,[{id:'one',memberId:'fictional',dayId:'day',start:600,end:660}]);
});
