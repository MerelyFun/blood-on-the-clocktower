import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotebook,markAt,playerAnnotations,stateAt,syncPublicRoom,validateNotebook,importNotebook,type RoleMark} from '../src/lib/notebooks.ts';
import {writeDraft,readDraft,saveNotebook,listNotebooks,deleteNotebook,NotebookConflictError,type NotebookContext} from '../src/lib/notebookStorage.ts';
import {BASE_SCRIPTS} from '../supabase/functions/_shared/catalog.ts';
import type {PublicGame} from '../supabase/functions/_shared/types.ts';

test('claims carry forward; changes, typo corrections and clearing guesses preserve prior days',()=>{
 const book=createNotebook('测试',7),playerId=book.players[0].id;
 const mark=(day:number,roles:string[],kind:RoleMark['kind']='claim',createdAt='2026-09-13T00:00:00Z'):RoleMark=>({id:crypto.randomUUID(),playerId,day,phase:'day',kind,roles,createdAt});
 book.marks.push(mark(1,['washerwoman','empath','chef']),mark(2,['empath']),mark(1,['spy'],'guess'),mark(2,[],'guess'));
 assert.deepEqual(markAt(book,playerId,'claim',1)?.roles,['washerwoman','empath','chef']);
 assert.deepEqual(markAt(book,playerId,'claim',3)?.roles,['empath']);
 assert.deepEqual(markAt(book,playerId,'guess',1)?.roles,['spy']);
 assert.deepEqual(markAt(book,playerId,'guess',2)?.roles,[]);
 book.marks.push(mark(2,['chef'],'claim','2026-09-13T01:00:00Z'));
 assert.deepEqual(markAt(book,playerId,'claim',2)?.roles,['chef']);assert.equal(book.marks.length,5);
 book.entries.push({id:crypto.randomUUID(),day:1,phase:'night',kind:'player',playerId,text:'首夜信息',important:false,createdAt:new Date().toISOString()});
 book.currentDay=2;assert.equal(book.entries.filter(e=>e.day===2).length,0);
});
function room():PublicGame {return {id:crypto.randomUUID(),code:'123456',title:'测试房间',script:BASE_SCRIPTS[0],phase:'day',round:3,paused:false,seats:[{id:'seat-a',occupantId:'person-a',index:0,name:'甲',traveller:false,left:false,alive:false,voteAvailable:true}],events:[{id:'public-1',round:2,phase:'day',at:new Date().toISOString(),text:'公开处决',visibility:'public'},{id:'secret-1',round:2,phase:'night',at:new Date().toISOString(),text:'隐藏身份',visibility:'host'}],nominations:[],timer:{endsAt:null,remaining:0},winner:'',review:null,fabled:[]};}

test('player annotations retain historical primary and extra states with explicit clearing',()=>{
 const book=createNotebook('标记',7),playerId=book.players[0].id;book.currentDay=3;
 const mark=(day:number,kind:RoleMark['kind'],roles:string[],time=0):RoleMark=>({id:crypto.randomUUID(),playerId,day,phase:'day',kind,roles,createdAt:`2026-09-13T0${time}:00:00Z`});
 book.marks.push(mark(1,'primary',['chef']),mark(1,'extra',['spy','中毒']),mark(2,'primary',['empath']),mark(2,'extra',['醉酒']));
 assert.deepEqual(playerAnnotations(book,playerId,1),{primary:'chef',extras:['spy','中毒']});
 assert.deepEqual(playerAnnotations(book,playerId,3),{primary:'empath',extras:['醉酒']});
 book.marks.push(mark(2,'primary',['washerwoman'],1),mark(3,'primary',[]),mark(3,'extra',[]));
 assert.deepEqual(playerAnnotations(book,playerId,2),{primary:'washerwoman',extras:['醉酒']});
 assert.deepEqual(playerAnnotations(book,playerId,3),{primary:undefined,extras:[]});
 assert.equal(validateNotebook(book),true);
 const imported=importNotebook(JSON.parse(JSON.stringify(book)));
 assert.deepEqual(imported.marks,book.marks);assert.deepEqual(playerAnnotations(imported,playerId,1),{primary:'chef',extras:['spy','中毒']});
 assert.equal(validateNotebook({...book,marks:[mark(1,'primary',['chef','spy'])]}),false);
});

test('legacy claims and guesses remain readable until new annotations override them',()=>{
 const book=createNotebook('旧标记',7),playerId=book.players[0].id;book.currentDay=3;
 const mark=(day:number,kind:RoleMark['kind'],roles:string[]):RoleMark=>({id:crypto.randomUUID(),playerId,day,phase:'day',kind,roles,createdAt:book.createdAt});
 book.marks.push(mark(1,'guess',['spy','chef']));
 assert.deepEqual(playerAnnotations(book,playerId,1),{primary:'spy',extras:['chef']});
 book.marks.push(mark(2,'claim',['empath','chef','washerwoman']),mark(2,'guess',['spy','chef','empath']));
 assert.deepEqual(playerAnnotations(book,playerId,2),{primary:'empath',extras:['chef','washerwoman','spy']});
 book.marks.push(mark(3,'primary',[]),mark(3,'extra',[]));
 assert.deepEqual(playerAnnotations(book,playerId,3),{primary:undefined,extras:[]});
 assert.deepEqual(markAt(book,playerId,'claim',3)?.roles,['empath','chef','washerwoman']);
 assert.deepEqual(playerAnnotations(book,playerId,2),{primary:'empath',extras:['chef','washerwoman','spy']});
});
test('public sync deduplicates events, excludes secrets, never invents old states, follows occupant identity',()=>{
 const initial=createNotebook('房间',7);initial.players=[];initial.states=[];
 const publicRoom=room();const first=syncPublicRoom(initial,publicRoom,'seat-a');
 assert.equal(first.entries.length,1);assert.equal(first.entries[0].sourceId,'public-1');
 assert.equal(stateAt(first,'person-a',2),undefined);assert.equal(stateAt(first,'person-a',3)?.alive,false);
 assert.equal(first.myPlayerId,'person-a');
 const repeated=syncPublicRoom(first,publicRoom,'seat-a');assert.equal(repeated.entries.length,1);assert.equal(repeated.states.length,1);
 publicRoom.seats[0].id='seat-b';publicRoom.seats[0].name='新名字';
 const moved=syncPublicRoom(repeated,publicRoom);assert.equal(moved.players.length,1);assert.equal(moved.players[0].id,'person-a');
 publicRoom.seats[0].occupantId='person-b';
 const replaced=syncPublicRoom(moved,publicRoom);assert.equal(replaced.players.length,2);assert.equal(replaced.players.find(p=>p.id==='person-a')?.left,true);
 assert.equal(replaced.players.find(p=>p.id==='person-b')?.seatId,'seat-b');
});
test('import is validated and produces an independent copy without discarding legacy text',()=>{
 const book=createNotebook('旧笔记',7,BASE_SCRIPTS[0]);book.room={id:crypto.randomUUID(),ownerId:'alice',mode:'cloud'};book.legacyText='未分日\n原文';
 assert.equal(validateNotebook(book),true);const imported=importNotebook(book);assert.notEqual(imported.id,book.id);assert.equal(imported.room,undefined);assert.equal(imported.legacyText,book.legacyText);
 assert.equal(validateNotebook({...book,marks:[{day:1}]}),false);assert.throws(()=>importNotebook({schemaVersion:1}));
});

test('seat numbers start at one; oversized and impossible imported histories are rejected',()=>{
 const book=createNotebook('测试',7);assert.deepEqual(book.players.map(p=>p.index),[1,2,3,4,5,6,7]);
 assert.equal(validateNotebook({...book,currentDay:366}),false);
 assert.equal(validateNotebook({...book,legacyText:'x'.repeat(500001)}),false);
 assert.equal(validateNotebook({...book,entries:Array(10001).fill({})}),false);
 assert.equal(validateNotebook({...book,states:[{...book.states[0],day:2}]}),false);
});
test('public nomination snapshots update in place with totals but never voter identities',()=>{
 const book=createNotebook('房间',7);book.players=[];book.states=[];
 const r=room();r.nominations=[{id:'nom-1',round:3,type:'nomination',nominator:'seat-a',nominee:'seat-a',threshold:4,tally:0,status:'open'}];
 const first=syncPublicRoom(book,r);r.nominations[0].status='tallied';r.nominations[0].tally=5;
 const second=syncPublicRoom(first,r);assert.equal(second.entries.filter(e=>e.sourceId==='nomination:nom-1').length,1);assert.match(second.entries.find(e=>e.sourceId==='nomination:nom-1')!.text,/5 票/);
 r.round=4;r.seats.push({...r.seats[0],id:'seat-c',occupantId:'person-c',index:2});
 const joined=syncPublicRoom(second,r);assert.equal(stateAt(joined,'person-c',3),undefined);assert.ok(stateAt(joined,'person-c',4));
});

class MemoryStorage {data=new Map<string,string>();get length(){return this.data.size;}key(i:number){return [...this.data.keys()][i]??null;}getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}removeItem(k:string){this.data.delete(k);}clear(){this.data.clear();}}
test('synchronous drafts survive reload, standalone saves need no account, stale tabs retain both copies',async()=>{
 Object.defineProperty(globalThis,'localStorage',{value:new MemoryStorage(),configurable:true});
 const book=createNotebook('本机',7),original=writeDraft(book);assert.equal(original.dirty,false);
 const saved=await saveNotebook(book,undefined,original.token);assert.equal(saved.token,original.token);
 const edited={...book,title:'新内容'};writeDraft(edited,undefined,original.token);
 assert.throws(()=>writeDraft({...book,title:'另一标签页'},undefined,original.token),NotebookConflictError);
 assert.equal(readDraft(book.id)?.data.title,'新内容');assert.equal((await listNotebooks()).length,2);
});
test('room draft caches are owner scoped and pending sync; storage failures leave old draft intact',()=>{
 Object.defineProperty(globalThis,'localStorage',{value:new MemoryStorage(),configurable:true});
 const book=createNotebook('私人',7);book.room={id:'room',ownerId:'alice',mode:'cloud'};
 const draft=writeDraft(book,{ownerId:'alice',mode:'cloud'});assert.equal(draft.dirty,true);
 assert.equal(readDraft(book.id,{ownerId:'bob',mode:'cloud'}),undefined);assert.throws(()=>writeDraft(book,{ownerId:'bob'}));
 const storage=globalThis.localStorage;const setter=storage.setItem.bind(storage);storage.setItem=()=>{throw new Error('quota');};
 assert.throws(()=>writeDraft({...book,title:'满磁盘'},{ownerId:'alice',mode:'cloud'},draft.token),/quota/);
 storage.setItem=setter;assert.equal(readDraft(book.id,{ownerId:'alice',mode:'cloud'})?.data.title,'私人');
});

function reset(){Object.defineProperty(globalThis,'localStorage',{value:new MemoryStorage(),configurable:true});}
function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
test('browser-local associated rooms never call a transport or remain dirty',async()=>{
 reset();const book=createNotebook('浏览器房间',7);book.room={id:'room',ownerId:'alice',mode:'local'};
 const ctx:NotebookContext={ownerId:'alice',mode:'local',transport:async()=>{throw new Error('must not contact server');}};
 const draft=writeDraft(book,ctx);assert.equal(draft.dirty,false);await saveNotebook(book,ctx,draft.token);
 assert.equal((await listNotebooks(ctx,{strictRemote:true})).length,1);await deleteNotebook(book.id,ctx);assert.equal(readDraft(book.id,ctx),undefined);
});
test('strict list fails offline instead of allowing duplicate room notebook creation',async()=>{
 reset();const ctx:NotebookContext={ownerId:'alice',mode:'cloud',transport:async()=>{throw new Error('offline');}};
 assert.deepEqual(await listNotebooks(ctx),[]);await assert.rejects(listNotebooks(ctx,{strictRemote:true}),/offline/);
});
test('late save acknowledgements neither replace newer text nor make a newer synced version dirty',async()=>{
 reset();const book=createNotebook('原文',7);book.room={id:'room',ownerId:'alice',mode:'cloud'};
 const requests:Array<ReturnType<typeof deferred<unknown>>>=[];
 const ctx:NotebookContext={ownerId:'alice',mode:'cloud',transport:async()=>{const request=deferred<unknown>();requests.push(request);return request.promise;}};
 const first=writeDraft(book,ctx),savingFirst=saveNotebook(book,ctx,first.token);
 const changed={...book,title:'更新内容'},second=writeDraft(changed,ctx,first.token),savingSecond=saveNotebook(changed,ctx,second.token);
 requests[1].resolve({notebook:{revision:2}});await savingSecond;
 requests[0].resolve({notebook:{revision:1}});await savingFirst;
 assert.equal(readDraft(book.id,ctx)?.data.title,'更新内容');assert.equal(readDraft(book.id,ctx)?.revision,2);assert.equal(readDraft(book.id,ctx)?.dirty,false);
 const third=writeDraft({...changed,title:'仍在输入'},ctx,second.token),savingThird=saveNotebook(third.data,ctx,third.token);
 writeDraft({...third.data,title:'更新的草稿'},ctx,third.token);requests[2].resolve({notebook:{revision:3}});await savingThird;
 assert.equal(readDraft(book.id,ctx)?.data.title,'更新的草稿');assert.equal(readDraft(book.id,ctx)?.dirty,true);
});
test('delete waits for pending saves, uses acknowledged revision, and cannot revive a deleted notebook',async()=>{
 reset();const book=createNotebook('待删除',7);book.room={id:'room',ownerId:'alice',mode:'cloud'};
 const request=deferred<unknown>();let deleteRevision:unknown;
 const ctx:NotebookContext={ownerId:'alice',mode:'cloud',transport:async(op,extra)=>{if(op==='save')return request.promise;if(op==='delete'){deleteRevision=extra.expectedRevision;return {};}throw new Error('unexpected');}};
 const draft=writeDraft(book,ctx),saving=saveNotebook(book,ctx,draft.token),removing=deleteNotebook(book.id,ctx);
 assert.throws(()=>writeDraft(book,ctx,draft.token),/删除/);await assert.rejects(saveNotebook(book,ctx,draft.token),/删除/);
 request.resolve({notebook:{revision:1}});await saving;await removing;assert.equal(deleteRevision,1);assert.equal(readDraft(book.id,ctx),undefined);
});

test('LAN HTTP without randomUUID can create and persist notebooks',()=>{
 reset();const descriptor=Object.getOwnPropertyDescriptor(crypto,'randomUUID');
 Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});
 try{const book=createNotebook('局域网',7),draft=writeDraft(book);assert.match(book.id,/^[a-f0-9-]{36}$/);assert.equal(readDraft(book.id)?.token,draft.token);assert.equal(book.players.length,7);}
 finally{if(descriptor)Object.defineProperty(crypto,'randomUUID',descriptor);else delete (crypto as unknown as {randomUUID?:unknown}).randomUUID;}
});
test('historical seat names and order survive later movement; join date stays stable',()=>{
 const book=createNotebook('房间',7);book.players=[];book.states=[];const r=room();r.seats[0].index=1;
 const initial=syncPublicRoom(book,r);r.round=4;r.seats[0].index=5;r.seats[0].name='乙';
 const changed=syncPublicRoom(initial,r);assert.equal(changed.players[0].joinedDay,3);assert.equal(stateAt(changed,'person-a',3)?.index,1);assert.equal(stateAt(changed,'person-a',3)?.name,'甲');assert.equal(stateAt(changed,'person-a',4)?.index,5);assert.equal(stateAt(changed,'person-a',4)?.name,'乙');
});
test('remote version conflict retains local copy and restores server winner',async()=>{
 reset();const book=createNotebook('本机新文字',7);book.room={id:'room',ownerId:'alice',mode:'cloud'};
 const winner={...book,title:'远端文字'};
 const ctx:NotebookContext={ownerId:'alice',mode:'cloud',transport:async(op)=>{if(op==='save')throw Object.assign(new Error('VERSION_CONFLICT'),{code:'VERSION_CONFLICT'});if(op==='get')return {notebook:{data:winner,revision:4}};return {notebooks:[]};}};
 const draft=writeDraft(book,ctx);await assert.rejects(saveNotebook(book,ctx,draft.token),NotebookConflictError);
 assert.equal(readDraft(book.id,ctx)?.data.title,'远端文字');const all=await listNotebooks(ctx);assert.ok(all.some(b=>b.title==='本机新文字（冲突副本）'&&!b.room));
});

test('simultaneous first room association recovers canonical notebook with a different ID',async()=>{
 reset();const book=createNotebook('第一次关联',7);book.room={id:'room',ownerId:'alice',mode:'cloud'};
 const winner={...book,id:crypto.randomUUID(),title:'另一设备的原笔记'};
 const ctx:NotebookContext={ownerId:'alice',mode:'cloud',transport:async(op)=>{
  if(op==='save')throw Object.assign(new Error('VERSION_CONFLICT'),{code:'VERSION_CONFLICT'});
  if(op==='get')return {notebook:null};return {notebooks:[{id:winner.id,roomId:'room',data:winner,revision:1}]};
 }};
 const draft=writeDraft(book,ctx);
 await assert.rejects(saveNotebook(book,ctx,draft.token),(error:unknown)=>error instanceof NotebookConflictError&&error.current?.data.id===winner.id);
 assert.equal(readDraft(book.id,ctx),undefined);assert.equal(readDraft(winner.id,ctx)?.data.title,'另一设备的原笔记');
 assert.ok((await listNotebooks(ctx)).some(b=>b.title==='第一次关联（冲突副本）'));
});
test('imports reject duplicate entry, role mark and state identities',()=>{
 const book=createNotebook('验证',7),entry={id:'entry',day:1,phase:'day',kind:'free',text:'内容',important:false,createdAt:book.createdAt};
 assert.equal(validateNotebook({...book,entries:[entry,entry]}),false);
 const mark={id:'mark',day:1,phase:'day',kind:'claim',roles:['chef'],playerId:book.players[0].id,createdAt:book.createdAt};
 assert.equal(validateNotebook({...book,marks:[mark,mark]}),false);
 assert.equal(validateNotebook({...book,states:[book.states[0],book.states[0]]}),false);
});

test('conflict copies remain owner-private through editing, listing and account changes',async()=>{
 reset();const book=createNotebook('私密信息',7);book.room={id:'room',ownerId:'alice',mode:'cloud'};
 const ctx:NotebookContext={ownerId:'alice',mode:'cloud',transport:async()=>({notebooks:[]})};
 const draft=writeDraft(book,ctx);writeDraft({...book,title:'新版本'},ctx,draft.token);
 let copyId='';try{writeDraft({...book,title:'本机私密副本'},ctx,draft.token);}catch(error){assert.ok(error instanceof NotebookConflictError);copyId=error.preserved.id;assert.equal(error.preserved.privateOwnerId,'alice');assert.equal(error.preserved.room,undefined);}
 assert.ok(copyId);assert.equal(readDraft(copyId),undefined);
 const bob:NotebookContext={ownerId:'bob',mode:'cloud',transport:async()=>({notebooks:[]})};
 assert.equal(readDraft(copyId,bob),undefined);assert.ok(!(await listNotebooks(bob)).some(b=>b.id===copyId));assert.ok(!(await listNotebooks()).some(b=>b.id===copyId));
 const copy=readDraft(copyId,ctx)!;assert.equal(copy.dirty,false);
 const updated=writeDraft({...copy.data,title:'编辑私密副本'},ctx,copy.token);await saveNotebook(updated.data,ctx,updated.token);
 assert.equal(readDraft(copyId,ctx)?.data.title,'编辑私密副本');assert.equal(readDraft(copyId,bob),undefined);
 assert.throws(()=>writeDraft(updated.data,bob),/所属账号/);
 const exportedImport=importNotebook(updated.data);assert.equal(exportedImport.privateOwnerId,undefined);
 await deleteNotebook(copyId,ctx);assert.equal(readDraft(copyId,ctx),undefined);
});

test('private player names survive room updates without changing room names',()=>{
 const source=room();let book=syncPublicRoom(createNotebook('称呼',7),source);
 book.players.find(p=>p.id==='person-a')!.noteName='小林';
 source.seats[0].name='房间新名字';book=syncPublicRoom(book,source);
 assert.equal(book.players.find(p=>p.id==='person-a')?.noteName,'小林');
 assert.equal(source.seats[0].name,'房间新名字');
 assert.equal(validateNotebook({...book,players:book.players.map(p=>({...p,noteName:23}))}),false);
});
