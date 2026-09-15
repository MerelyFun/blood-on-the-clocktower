import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotebook, validateNotebook } from '../src/lib/notebooks.ts';
import { applyNoteBroadcast, generateNoteAction, noteParticipants, STORYTELLER_ID } from '../src/lib/noteActions.ts';
import { referenceText } from '../src/lib/noteReferences.ts';

function fixture(){const book=createNotebook('动作测试',5);book.players[0].noteName='小明';book.players[1].noteName='小红';return book;}
test('actions select 0 storyteller last and display seat names',()=>{
  const book=fixture(),players=noteParticipants(book);
  assert.equal(players.at(-1)?.id,STORYTELLER_ID);
  const result=generateNoteAction(book,{actorId:players[0].id,kind:'chat',targetIds:[players[1].id,STORYTELLER_ID]});
  assert.equal(referenceText(result.text),'1 小明与2 小红和0 说书人进行了私聊。');
  assert.deepEqual(result.involvedIds,[players[0].id,players[1].id,STORYTELLER_ID]);
});
test('broadcast copies only into local notebook public and involved player records, including valid storyteller',()=>{
  const book=fixture(),result=generateNoteAction(book,{actorId:STORYTELLER_ID,kind:'nomination',targetIds:[book.players[0].id]});
  const next=applyNoteBroadcast(book,result.text,[...result.involvedIds,STORYTELLER_ID]);
  assert.equal(next.entries.length,3);assert.equal(next.entries.filter(e=>e.kind==='public').length,1);
  assert.equal(book.entries.length,0);assert.equal(next.states.length,book.states.length);assert.ok(validateNotebook(next));
});
test('execution does not imply death and actions ignore hidden targets',()=>{
  const book=fixture(),actorId=book.players[0].id;
  for(const kind of ['death','execution','claim'] as const){const result=generateNoteAction(book,{actorId,kind,detail:'我是厨师',targetIds:[book.players[1].id]});assert.deepEqual(result.involvedIds,[actorId]);}
  assert.equal(referenceText(generateNoteAction(book,{actorId,kind:'execution'}).text),'1 小明被处决了。');
  assert.equal(referenceText(generateNoteAction(book,{actorId,kind:'custom',customAction:'怀疑',targetIds:[book.players[1].id]}).text),'1 小明怀疑了2 小红。');
  assert.throws(()=>generateNoteAction(book,{actorId,kind:'chat',targetIds:[actorId]}));
  assert.throws(()=>generateNoteAction(book,{actorId,kind:'claim'}));
  assert.throws(()=>generateNoteAction(book,{actorId,kind:'nomination',targetIds:[book.players[1].id,book.players[2].id]}));
});
