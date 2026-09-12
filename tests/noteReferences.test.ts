import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceText,editReferenceText,insertSeatReference} from '../src/lib/noteReferences.ts';

test('the editor displays labels and never reference IDs',()=>{
  assert.equal(referenceText('听@[4号](stable-player-a)说@[5号](stable-player-b)是好人'),'听4号说5号是好人');
  assert.equal(referenceText('普通笔记\n下一条'),'普通笔记\n下一条');
});

test('typing before, after and between references retains their original identity',()=>{
  const raw='@[4号](person-a)说@[5号](person-b)是好人';
  assert.equal(editReferenceText(raw,'首夜4号说5号是好人'),'首夜'+raw);
  assert.equal(editReferenceText(raw,'4号说5号是好人？'),raw+'？');
  assert.equal(editReferenceText(raw,'4号告诉我5号是好人'),'@[4号](person-a)告诉我@[5号](person-b)是好人');
  assert.equal(editReferenceText(raw,referenceText(raw)),raw);
});

test('editing inside a reference degrades only that reference to ordinary text',()=>{
  const raw='@[4号](person-a)说@[5号](person-b)';
  assert.equal(editReferenceText(raw,'6号说5号'),'6号说@[5号](person-b)');
  assert.equal(editReferenceText(raw,'4？号说5号'),'4？号说@[5号](person-b)');
  assert.equal(editReferenceText(raw,'说5号'),'说@[5号](person-b)');
  assert.equal(editReferenceText(raw,''),'');
});

test('seat insertion respects visible cursor positions and replacement selections',()=>{
  const raw='@[4号](person-a)说好人';
  assert.equal(insertSeatReference(raw,3,3,'5号','person-b'),'@[4号](person-a)说@[5号](person-b)好人');
  assert.equal(insertSeatReference(raw,0,2,'6号','person-c'),'@[6号](person-c)说好人');
  assert.equal(insertSeatReference(raw,1,2,'6号','person-c'),'4@[6号](person-c)说好人');
  assert.equal(insertSeatReference(raw,1,1,'6号','person-c'),'4@[6号](person-c)号说好人');
});

test('repeated labels never silently inherit the wrong player ID after ambiguous deletion',()=>{
  const raw='@[4号](former-player)@[4号](current-player)';
  assert.equal(editReferenceText(raw,'4号'),'4号');
  assert.equal(editReferenceText(raw,'4号4号！'),raw+'！');
  assert.equal(insertSeatReference(raw,0,2,'5号','person-c'),'@[5号](person-c)@[4号](current-player)');
  assert.equal(insertSeatReference(raw,2,4,'5号','person-c'),'@[4号](former-player)@[5号](person-c)');
});

test('visible offsets use the same UTF-16 units as a textarea, including emoji',()=>{
  const raw='👻@[4号](person-a)';
  assert.equal(insertSeatReference(raw,2,2,'5号','person-b'),'👻@[5号](person-b)@[4号](person-a)');
  assert.equal(editReferenceText(raw,'👻4号。'),raw+'。');
});
