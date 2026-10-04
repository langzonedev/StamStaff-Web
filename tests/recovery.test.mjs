import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryAfterAuth, withoutRecoveryMarker} from '../app/account/recovery.ts';

test('completed reset stays completed through sign-out, new login and refresh',()=>{
 let intent=true;
 intent=recoveryAfterAuth(intent,'PASSWORD_RECOVERY',true);
 assert.equal(intent,true);
 intent=recoveryAfterAuth(intent,'USER_UPDATED',true);
 assert.equal(intent,true);
 // Successful update explicitly consumes intent before asynchronous sign-out.
 intent=false;
 for(const [event,session] of [['SIGNED_OUT',false],['SIGNED_IN',true],['TOKEN_REFRESHED',true],['INITIAL_SESSION',true]]){
  intent=recoveryAfterAuth(intent,event,session);
  assert.equal(intent,false);
 }
});

test('recovery survives callback ordering and same-session focus or refresh',()=>{
 for(const events of [['INITIAL_SESSION','PASSWORD_RECOVERY'],['SIGNED_IN','PASSWORD_RECOVERY'],['PASSWORD_RECOVERY','INITIAL_SESSION']]){
  let intent=true;
  for(const event of [...events,'SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED']){
   intent=recoveryAfterAuth(intent,event,true);
   assert.equal(intent,true);
  }
 }
});

test('stale reset URL without a session cannot turn a normal sign-in into recovery',()=>{
 let intent=recoveryAfterAuth(true,'INITIAL_SESSION',false);
 assert.equal(intent,false);
 intent=recoveryAfterAuth(intent,'SIGNED_IN',true);
 assert.equal(intent,false);
});

test('invalid link and completed reset remain consumed even if local sign-out fails',()=>{
 // Invalid-link handling and successful updates clear intent explicitly.
 for(const event of ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED'])
  assert.equal(recoveryAfterAuth(false,event,true),false);
 assert.equal(recoveryAfterAuth(true,'SIGNED_OUT',true),false);
});

test('URL cleanup removes reset markers and callback secrets, preserving unrelated navigation',()=>{
 assert.equal(withoutRecoveryMarker('https://example.test/StamStaff-Web/account/?recovery=1&view=events#access_token=fictional&type=recovery'),'/StamStaff-Web/account/?view=events');
 assert.equal(withoutRecoveryMarker('https://example.test/account/?recovery=1'),'/account/');
 assert.equal(withoutRecoveryMarker('https://example.test/account/?view=events#setup'),'/account/?view=events#setup');
});
