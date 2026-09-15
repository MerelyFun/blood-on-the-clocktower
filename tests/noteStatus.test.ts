import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotebook,setNoteTags,noteStatus,noteTags,validateNotebook,importNotebook} from '../src/lib/notebooks.ts';

test('execution remains distinct from death, and ghost vote is visible while alive',()=>{
 let book=createNotebook('状态',7);const id=book.players[0].id;
 book=setNoteTags(book,id,1,['处决','死者票已用','醉酒','自定义']);
 assert.deepEqual(noteStatus(book,id,1),{alive:true,executed:true,voteAvailable:false});
 assert.deepEqual(noteTags(book,id,1),['醉酒','自定义','处决','死者票已用']);
 assert.equal(validateNotebook(book),true);
 assert.deepEqual(noteStatus(importNotebook(JSON.parse(JSON.stringify(book))),id,1),noteStatus(book,id,1));
 book.currentDay=2;book=setNoteTags(book,id,2,['死亡']);
 assert.deepEqual(noteStatus(book,id,2),{alive:false,executed:false,voteAvailable:true});
 assert.equal(noteStatus(book,id,1).executed,true);
 book=setNoteTags(book,id,2,[]);
 assert.deepEqual(noteTags(book,id,2),[]);
 assert.equal(validateNotebook({...book,marks:[{...book.marks[0],status:{alive:'no'}}]}),false);
});

test('private labels can override synced death and vote without changing public state',()=>{
 let book=createNotebook('私人标记');const id=book.players[0].id;
 book.room={id:'room',mode:'cloud',ownerId:'owner'};
 book.states[0].alive=false;book.states[0].voteAvailable=false;
 assert.deepEqual(noteTags(book,id,1),['死亡','死者票已用']);
 book=setNoteTags(book,id,1,['处决']);
 assert.deepEqual(noteTags(book,id,1),['处决']);
 assert.equal(book.states[0].alive,false);
 assert.equal(book.states[0].voteAvailable,false);
});

test('ordinary tags do not freeze future public death and ghost vote updates',()=>{
 let book=createNotebook('随房间更新');const id=book.players[0].id;
 book=setNoteTags(book,id,1,['醉酒']);
 book.states[0].alive=false;book.states[0].voteAvailable=false;
 assert.deepEqual(noteTags(book,id,1),['醉酒','死亡','死者票已用']);
});
