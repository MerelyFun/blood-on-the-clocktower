import { useState } from 'react';
import type { Notebook } from '../lib/notebooks';
import { generateNoteAction, noteParticipants, notePlayerLabel, type NoteActionKind } from '../lib/noteActions';
import { referenceText } from '../lib/noteReferences';
import { Button, Field, Modal } from './ui';

const actions:{kind:NoteActionKind;label:string}[]=[{kind:'chat',label:'私聊'},{kind:'death',label:'死亡'},{kind:'execution',label:'处决'},{kind:'claim',label:'声称'},{kind:'nomination',label:'提名'},{kind:'custom',label:'自定义动作'}];
export function NoteActionComposer({book,initialPlayerId,onGenerate,onClose,title='生成动作笔记',submitLabel='使用这条信息',day=book.currentDay}:{
  book:Notebook;initialPlayerId?:string;onGenerate:(text:string,involvedIds:string[])=>void;onClose:()=>void;title?:string;submitLabel?:string;day?:number;
}) {
  const players=noteParticipants(book,day);
  const [actorId,setActorId]=useState(initialPlayerId||players[0]?.id||'');
  const [kind,setKind]=useState<NoteActionKind>('chat'),[targetIds,setTargetIds]=useState<string[]>([]);
  const [detail,setDetail]=useState(''),[customAction,setCustomAction]=useState('');
  const targets=players.filter(p=>kind!=='chat'||p.id!==actorId);
  let generated:{text:string;involvedIds:string[]}|undefined,error='';
  try { generated=generateNoteAction(book,{actorId,kind,targetIds,detail,customAction},day); } catch(e) { error=(e as Error).message; }
  const changeKind=(next:NoteActionKind)=>{setKind(next);setTargetIds([]);};
  return <Modal title={title} onClose={onClose} footer={<Button variant="primary" disabled={!generated} onClick={()=>{if(generated)onGenerate(generated.text,generated.involvedIds);}}>{submitLabel}</Button>}>
    <div className="stack note-action-composer">
      <Field label="发起者"><select value={actorId} onChange={e=>{setActorId(e.target.value);setTargetIds([]);}}>{players.map(p=><option key={p.id} value={p.id}>{notePlayerLabel(p)}</option>)}</select></Field>
      <div className="field" role="group" aria-label="动作"><span>动作</span><div className="chips">{actions.map(a=><button type="button" key={a.kind} className={`chip ${kind===a.kind?'selected':''}`} aria-pressed={kind===a.kind} onClick={()=>changeKind(a.kind)}>{kind===a.kind?'✓ ':''}{a.label}</button>)}</div></div>
      {kind==='nomination'&&<Field label="被提名者"><select value={targetIds[0]||''} onChange={e=>setTargetIds(e.target.value?[e.target.value]:[])}><option value="">选择一位</option>{targets.map(p=><option key={p.id} value={p.id}>{notePlayerLabel(p)}</option>)}</select></Field>}
      {(kind==='chat'||kind==='custom')&&<div className="field" role="group" aria-label="动作对象"><span>{kind==='chat'?'私聊对象（可多选）':'动作对象（可多选或不选）'}</span><div className="chips">{targets.map(p=><button type="button" className={`chip ${targetIds.includes(p.id)?'selected':''}`} key={p.id} aria-pressed={targetIds.includes(p.id)} onClick={()=>setTargetIds(ids=>ids.includes(p.id)?ids.filter(id=>id!==p.id):[...ids,p.id])}>{targetIds.includes(p.id)?'✓ ':''}{notePlayerLabel(p)}</button>)}</div></div>}
      {kind==='claim'&&<Field label="声称的信息"><textarea rows={3} value={detail} maxLength={2000} onChange={e=>setDetail(e.target.value)} placeholder="例如：我是洗衣妇，2 小红和 5 小李中有一位是厨师"/></Field>}
      {kind==='custom'&&<Field label="自定义动作"><input value={customAction} maxLength={80} onChange={e=>setCustomAction(e.target.value)} placeholder="例如：怀疑"/></Field>}
      <div className="note-action-preview" aria-live="polite"><small className="muted">{generated?'生成预览':error}</small>{generated&&<p>{referenceText(generated.text)}</p>}</div>
    </div>
  </Modal>;
}
