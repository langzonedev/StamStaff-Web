import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftProblem,scheduledHours} from '../app/connected/types.ts';
const shift={id:'fictional',memberId:'fictional',dayId:'fictional',start:540,end:720,mealBreak:{start:600,end:630}};
test('current client validates and displays the whole shift despite historical lunch metadata',()=>{
 assert.equal(shiftProblem(shift),null);
 assert.equal(scheduledHours(shift),'3h');
 assert.match(shiftProblem({...shift,end:705}),/at least 3 hours/);
});
