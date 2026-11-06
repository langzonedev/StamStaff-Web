import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNotificationMobile,contactReadinessLabel} from '../app/connected/notification-mobile.ts';

// Fictional format fixtures only; these values are never used for SMS delivery.

test('notification mobile normalizes supported Australian entry formats and clearing',()=>{
 for(const input of ['0400 000 001','(0400) 000-001','+61 400 000 001','61400000001','+61400000001'])
  assert.equal(normalizeNotificationMobile(input),'+61400000001');
 for(const input of ['','  ','\t'])assert.equal(normalizeNotificationMobile(input),'');
});
test('notification mobile rejects ambiguous, international and malformed destinations',()=>{
 for(const input of ['0240000001','+15550000001','040000000','04000000011','04OO000001','0400000001 ext 2',
  '00400000001','++61400000001','+61.400.000.001','0400000001\u200b',' '.repeat(65)+'0400000001'])
  assert.equal(normalizeNotificationMobile(input),null,input);
});
test('readiness labels distinguish manager confirmation from missing numbers and account eligibility',()=>{
 assert.equal(contactReadinessLabel('confirmed'),'SMS: number confirmed by manager');
 assert.match(contactReadinessLabel('unconfirmed'),/needs confirmation/);
 assert.match(contactReadinessLabel('missing'),/no mobile/);
 assert.match(contactReadinessLabel('ineligible'),/account not ready/);
});
