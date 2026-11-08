import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../app/connected/notification-delivery.ts',import.meta.url),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {deliveryView} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('uncertain delivery is separate from ordinary failure and offers no retry',()=>{
  const result=deliveryView({pending:0,sent:3,failed:1,heldUnknown:1,retryable:0});
  assert.equal(result.heldUnknown,1);
  assert.equal(result.ordinaryFailed,0);
  assert.equal(result.retryable,0);
  assert.equal(result.sent,3);
});
test('mixed failures only offer the server-confirmed safe retry subset',()=>{
  const result=deliveryView({pending:2,sent:4,failed:4,heldUnknown:2,retryable:1});
  assert.equal(result.ordinaryFailed,2);
  assert.equal(result.heldUnknown,2);
  assert.equal(result.retryable,1);
  assert.equal(result.pending,2);
});
test('an older status response cannot authorize retrying every failure',()=>{
  const result=deliveryView({pending:0,sent:0,failed:2});
  assert.equal(result.ordinaryFailed,2);
  assert.equal(result.retryable,0);
});
