import test from 'node:test';
import assert from 'node:assert/strict';
import {paintMinute, paintRange, paintProblem, snapPaint, freeWindows, windowTimes} from '../app/connected/paint.ts';
const day={id:'day',date:'2026-10-20',open:420,close:1380};
const available=[{dayId:'day',start:600,end:840},{dayId:'day',start:1020,end:1260}];
test('paint snaps and clamps both drag directions to the trading window',()=>{
 assert.equal(paintMinute(day,-.1),420); assert.equal(paintMinute(day,1.2),1365);
 assert.equal(paintMinute(day,.202),600);
 assert.deepEqual(paintRange(day,825,600),{dayId:'day',start:600,end:840});
 assert.deepEqual(paintRange(day,600,600),{dayId:'day',start:600,end:615});
});

test('overshooting one available block snaps both directions; crossing a gap stays invalid',()=>{
 const block={dayId:'day',start:600,end:780};
 assert.deepEqual(snapPaint(paintRange(day,585,795),[block]),block);
 assert.deepEqual(snapPaint(paintRange(day,795,585),[block]),block);
 const crossing={dayId:'day',start:600,end:1080};
 assert.deepEqual(snapPaint(crossing,available),crossing);
 assert.match(paintProblem(snapPaint(crossing,available),available,[]),/submitted availability/);
});
test('time choices subtract assignments and cannot cross unavailable gaps',()=>{
 const assigned=[{id:'one',memberId:'fictional',dayId:'day',start:660,end:720}];
 const free=freeWindows(available,assigned);
 assert.deepEqual(free,[{dayId:'day',start:600,end:660},{dayId:'day',start:720,end:840},available[1]]);
 assert.deepEqual(windowTimes(free,'end',600),[615,630,645,660]);
 assert.ok(!windowTimes(free,'start').includes(660));
 assert.ok(!windowTimes(free,'start').includes(900));
 assert.deepEqual(windowTimes(free,'start',660),[600,615,630,645]);
});
test('paint rejects an availability gap and overlapping shift, allowing adjacent split shifts',()=>{
 const assigned=[{id:'one',memberId:'fictional',dayId:'day',start:600,end:660}];
 assert.match(paintProblem({dayId:'day',start:780,end:1080},available,assigned),/submitted availability/);
 assert.match(paintProblem({dayId:'day',start:645,end:720},available,assigned),/already has/);
 assert.equal(paintProblem({dayId:'day',start:660,end:840},available,assigned),null);
 assert.equal(paintProblem({dayId:'day',start:1020,end:1260},available,assigned),null);
 assert.deepEqual(assigned,[{id:'one',memberId:'fictional',dayId:'day',start:600,end:660}]);
});

test('minimum shift feedback filters manager times without altering staff availability',()=>{
 const windows=[{dayId:'day',start:600,end:720},{dayId:'day',start:900,end:1140}];
 assert.deepEqual(windowTimes(windows,'start',undefined,180),[900,915,930,945,960]);
 assert.deepEqual(windowTimes(windows,'end',900,180),[1080,1095,1110,1125,1140]);
 assert.match(paintProblem(windows[0],windows,[],180),/3 hours/);
 assert.equal(paintProblem({dayId:'day',start:900,end:1080},windows,[],180),null);
 assert.equal(windows[0].end-windows[0].start,120);
});
