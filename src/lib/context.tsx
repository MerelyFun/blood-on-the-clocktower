import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { BASE_SCRIPTS, type Script } from './domain';
import { loadScripts, persistScripts } from './storage';
import { supabase } from './supabase';
interface Context {scripts:Script[];saveScript:(s:Script)=>Promise<void>;deleteScript:(id:string)=>Promise<void>;user:User|null;cloud:boolean;toast:(text:string)=>void;}
const C=createContext<Context>(null!);
export const useApp=()=>useContext(C);
export function AppProvider({children}:{children:ReactNode}){
 const [custom,setCustom]=useState(loadScripts),[user,setUser]=useState<User|null>(null),[message,setMessage]=useState('');const sb=supabase();
 useEffect(()=>{if(!sb)return;sb.auth.getSession().then(({data})=>setUser(data.session?.user??null));const {data}=sb.auth.onAuthStateChange((_e,s)=>setUser(s?.user??null));return ()=>data.subscription.unsubscribe();},[sb]);
 useEffect(()=>{if(!sb||!user)return;let live=true;sb.from('bt_scripts').select('data').then(({data,error})=>{if(!live||error)return;setCustom(old=>{const map=new Map(old.map(s=>[s.id,s]));for(const {data:s} of data||[]){const script=s as Script;const local=map.get(script.id);if(!local||script.updatedAt>local.updatedAt)map.set(script.id,script);}const merged=[...map.values()];persistScripts(merged);return merged;});});return ()=>{live=false;};},[sb,user?.id]);
 useEffect(()=>{if(!message)return;const id=setTimeout(()=>setMessage(''),5000);return ()=>clearTimeout(id);},[message]);
 const saveScript=async(s:Script)=>{const next={...s,updatedAt:new Date().toISOString()};const list=[...custom.filter(x=>x.id!==s.id),next];persistScripts(list);setCustom(list);if(sb&&user){const {error}=await sb.from('bt_scripts').upsert({id:s.id,owner_id:user.id,data:next,updated_at:next.updatedAt});if(error){setMessage('剧本已保存在本机，云端同步失败，可稍后再次保存。');return;}}setMessage('剧本已保存');};
 const deleteScript=async(id:string)=>{if(sb&&user){const {error}=await sb.from('bt_scripts').delete().eq('id',id);if(error)throw new Error('删除云端剧本失败。');}const list=custom.filter(x=>x.id!==id);persistScripts(list);setCustom(list);};
 return <C.Provider value={{scripts:[...BASE_SCRIPTS,...custom],saveScript,deleteScript,user,cloud:!!sb,toast:setMessage}}>{children}{message&&<div className="toast" role="status">{message}<button onClick={()=>setMessage('')} aria-label="关闭提示">×</button></div>}</C.Provider>;
}
