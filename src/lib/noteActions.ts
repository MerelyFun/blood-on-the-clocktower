import { uid } from '../../supabase/functions/_shared/scripts.ts';
import { stateAt, type Notebook, type NotePhase, type NotePlayer } from './notebooks.ts';

export const STORYTELLER_ID = 'notebook-storyteller';
export type NoteActionKind = 'chat' | 'death' | 'execution' | 'claim' | 'nomination' | 'custom';
export interface NoteAction { actorId:string; kind:NoteActionKind; targetIds?:string[]; detail?:string; customAction?:string; }
export function noteParticipants(book:Notebook,day=book.currentDay):NotePlayer[] {
  const players=book.players.filter(p=>p.id!==STORYTELLER_ID&&p.index!==0&&(p.joinedDay??1)<=day).map(p=>{
    const state=stateAt(book,p.id,day);
    return {...p,index:state?.index??p.index,name:p.noteName?.trim()||state?.name||p.name};
  }).sort((a,b)=>a.index-b.index);
  return [...players,{id:STORYTELLER_ID,index:0,name:'说书人',traveller:false}];
}
export function notePlayerLabel(player:NotePlayer):string { return `${player.index} ${player.noteName?.trim()||player.name}`; }
export function notePlayerReference(player:NotePlayer):string {
  return `@[${notePlayerLabel(player).replaceAll(']','］')}](${player.id})`;
}
export function generateNoteAction(book:Notebook,action:NoteAction,day=book.currentDay):{text:string;involvedIds:string[]} {
  const players=noteParticipants(book,day),actor=players.find(p=>p.id===action.actorId);
  if(!actor)throw new Error('请选择发起者。');
  const needsTargets=['chat','nomination','custom'].includes(action.kind);
  const targetIds=needsTargets?[...new Set(action.targetIds??[])]:[];
  const targets=targetIds.map(id=>players.find(p=>p.id===id));
  if(targets.some(p=>!p))throw new Error('所选对象已不存在，请重新选择。');
  if((action.kind==='chat'||action.kind==='nomination')&&!targets.length)throw new Error('请选择动作对象。');
  if(action.kind==='chat'&&targetIds.includes(actor.id))throw new Error('私聊对象不能是自己。');
  if(action.kind==='nomination'&&targets.length!==1)throw new Error('提名只能选择一名对象。');
  const actorText=notePlayerReference(actor),targetText=(targets as NotePlayer[]).map(notePlayerReference).join('和');
  let text:string;
  switch(action.kind){
    case 'chat':text=`${actorText}与${targetText}进行了私聊。`;break;
    case 'death':text=`${actorText}死亡了。`;break;
    case 'execution':text=`${actorText}被处决了。`;break;
    case 'claim':if(!action.detail?.trim())throw new Error('请填写声称的信息。');text=`${actorText}声称：${action.detail.trim()}`;break;
    case 'nomination':text=`${actorText}提名了${targetText}。`;break;
    case 'custom':if(!action.customAction?.trim())throw new Error('请填写自定义动作。');text=`${actorText}${action.customAction.trim()}了${targetText}。`;break;
    default:throw new Error('请选择动作。');
  }
  return {text,involvedIds:[...new Set([actor.id,...targetIds])]};
}
/** Broadcast means copying into this notebook only; no room event or message is sent. */
export function applyNoteBroadcast(book:Notebook,text:string,involvedIds:string[],day=book.currentDay,phase:NotePhase=book.phase):Notebook {
  const ids=[...new Set(involvedIds)],validIds=new Set(noteParticipants(book,day).map(p=>p.id));
  if(!text.trim()||ids.some(id=>!validIds.has(id)))throw new Error('广播内容或涉及的玩家无效。');
  if(!Number.isInteger(day)||day<1||day>book.currentDay)throw new Error('笔记日期无效。');
  const createdAt=new Date().toISOString();
  const players=ids.includes(STORYTELLER_ID)&&!book.players.some(p=>p.id===STORYTELLER_ID)
    ?[...book.players,{id:STORYTELLER_ID,index:0,name:'说书人',traveller:false}]:book.players;
  return {...book,players,updatedAt:createdAt,entries:[...book.entries,
    {id:uid(),day,phase,kind:'public',text,important:false,createdAt},
    ...ids.map(playerId=>({id:uid(),day,phase,kind:'player' as const,playerId,text,important:false,createdAt}))]};
}
