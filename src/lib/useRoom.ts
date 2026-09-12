import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, supabase } from './supabase';
import { localBackendEnabled } from './localBackend';
import { getLocal, localSubscription, mutateLocal } from './storage';
import { uid, type Command, type Game, type RoomView } from './domain';
export type Run=(type:string,payload?:Record<string,unknown>)=>Promise<boolean>;
export function useRoom(mode:'local'|'cloud',id:string){
 const [view,setView]=useState<RoomView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[connection,setConnection]=useState(mode==='local'?'本机存档':'正在连接'),[uncertain,setUncertain]=useState(false);
 const current=useRef<RoomView|null>(null),working=useRef(false),generation=useRef(0),pending=useRef<Record<string,unknown>|null>(null),active=useRef(true);
 const set=(v:RoomView)=>{if(active.current){if(v.kind==='host'&&current.current?.kind==='host'&&v.game.id===current.current.game.id&&v.game.version<current.current.game.version)return;current.current=v;setView(v);}};
 const refresh=useCallback(async()=>{const gen=++generation.current;try{const v=mode==='local'?{kind:'host' as const,game:await getLocal(id),members:[]}:await api<RoomView>({action:'get',roomId:id});if(gen!==generation.current||!active.current)return;set(v);setConnection(mode==='local'?'本机存档':'已同步');}catch(e){if(gen!==generation.current||!active.current)return;setError((e as Error).message);setConnection('连接中断');if(e instanceof ApiError&&['FORBIDDEN','UNAUTHENTICATED'].includes(e.code)){current.current=null;setView(null);}}},[id,mode]);
 useEffect(()=>{active.current=true;setView(null);current.current=null;setError('');pending.current=null;setUncertain(false);try{pending.current=JSON.parse(sessionStorage.getItem(`bt-pending-${id}`)||'null');if(pending.current){setUncertain(true);setError('上次提交的结果尚未确认，可使用同一请求安全重试。');}}catch{}void refresh();
  const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};const offline=()=>setConnection('连接中断');window.addEventListener('online',refresh);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',onVisible);
  let dispose=()=>{};let interval:ReturnType<typeof setInterval>|undefined;
  if(mode==='local')dispose=localSubscription(id,()=>void refresh());
  else if(localBackendEnabled){interval=setInterval(()=>{if(document.visibilityState==='visible'&&!working.current)void refresh();},1500);}
  else {let realtimeReady=false;let lastRefresh=Date.now();const sb=supabase();const channel=sb?.channel(`bt-signals-${id}-${uid()}`).on('postgres_changes',{event:'*',schema:'public',table:'bt_signals',filter:`room_id=eq.${id}`},()=>{lastRefresh=Date.now();void refresh();}).subscribe(status=>{realtimeReady=status==='SUBSCRIBED';if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')setConnection('轮询同步');});dispose=()=>{if(channel)void sb?.removeChannel(channel);};interval=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastRefresh>=(realtimeReady?60000:10000)){lastRefresh=Date.now();void refresh();}},10000);}
  return ()=>{active.current=false;generation.current++;dispose();if(interval)clearInterval(interval);window.removeEventListener('online',refresh);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',onVisible);};
 },[id,mode,refresh]);
 const clearPending=()=>{pending.current=null;sessionStorage.removeItem(`bt-pending-${id}`);setUncertain(false);};
 const submit=async(body:Record<string,unknown>):Promise<boolean>=>{if(working.current)return false;working.current=true;setBusy(true);setError('');try{
  generation.current++;let v:RoomView;
  if(mode==='cloud')v=await api<RoomView>(body);
  else {const game=await mutateLocal(id,body.command as Command,Number(body.expectedVersion),String(body.opId));v={kind:'host',game,members:[]};}
  generation.current++;set(v);setConnection(mode==='local'?'本机存档':'已同步');clearPending();return true;
 }catch(e){setError((e as Error).message);if(e instanceof ApiError&&['NETWORK','INTERNAL_ERROR'].includes(e.code)){pending.current=body;sessionStorage.setItem(`bt-pending-${id}`,JSON.stringify(body));setUncertain(true);setConnection('提交待确认');}else{clearPending();await refresh();}return false;}finally{working.current=false;setBusy(false);}};
 const run:Run=async(type,payload={})=>{if(pending.current){setError('请先重试上一次待确认的提交。');return false;}if(mode==='cloud'&&!navigator.onLine){setError('当前离线，恢复连接后才能提交。');return false;}const v=current.current;if(!v)return false;return submit({action:'command',roomId:id,opId:uid(),expectedVersion:v.kind==='host'?v.game.version:undefined,command:{type,payload}});};
 const member=async(target:string,memberAction:string,seatId?:string,rebind=false)=>{if(working.current||pending.current)return false;working.current=true;setBusy(true);try{generation.current++;const response=await api<RoomView>({action:'member',roomId:id,target,memberAction,seatId,rebind});generation.current++;set(response);return true;}catch(e){await refresh();setError(`${(e as Error).message} 请核对已刷新的成员状态，确认是否已生效后再操作。`);return false;}finally{working.current=false;setBusy(false);}};
 return {view,busy,error,connection,uncertain,run,member,refresh,retry:()=>pending.current?submit(pending.current):Promise.resolve(false),setError};
}
export type RoomController=ReturnType<typeof useRoom>;
export function hostGame(v:RoomView|null):Game|null{return v?.kind==='host'?v.game:null;}
