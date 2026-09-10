import { createClient, type SupabaseClient } from '@supabase/supabase-js';
export interface CloudConfig {url:string;key:string;turnstile?:string;}
export function config():CloudConfig {let saved:Partial<CloudConfig>={};try{saved=JSON.parse(localStorage.getItem('bt-cloud')||'{}');}catch{}return {url:saved.url||import.meta.env.VITE_SUPABASE_URL||'',key:saved.key||import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'',turnstile:saved.turnstile||import.meta.env.VITE_TURNSTILE_SITE_KEY||''};}
export function validateConfig(c:CloudConfig){let u:URL;try{u=new URL(c.url);}catch{throw new Error('请输入有效的 Supabase 项目 URL。');}if(u.protocol!=='https:'&&u.hostname!=='localhost'&&u.hostname!=='127.0.0.1')throw new Error('Supabase URL 必须使用 HTTPS。');
 if(c.key.startsWith('sb_secret_'))throw new Error('不能在前端使用 secret 密钥，请改用 publishable key。');
 if(c.key.startsWith('eyJ')){try{const body=JSON.parse(atob(c.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(body.role!=='anon')throw new Error();}catch{throw new Error('仅允许 publishable key 或旧版 anon key。');}}
 else if(!c.key.startsWith('sb_publishable_'))throw new Error('请填写项目的 publishable key。');
}
let client:SupabaseClient|null=null;
export function supabase(){if(client)return client;const c=config();if(!c.url||!c.key)return null;try{validateConfig(c);client=createClient(c.url,c.key,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});return client;}catch{return null;}}
export function saveConfig(c:CloudConfig){validateConfig(c);localStorage.setItem('bt-cloud',JSON.stringify(c));location.reload();}
export function redirectUrl(){return new URL('./',location.href.split('#')[0].split('?')[0]).href;}
export class ApiError extends Error {constructor(message:string,public code='NETWORK'){super(message);}}
let clockOffset=0;
export const serverNow=()=>Date.now()+clockOffset;
export async function api<T>(body:Record<string,unknown>):Promise<T> {
 const sb=supabase();if(!sb)throw new ApiError('请先配置 Supabase。','CONFIG');
 const {data:{session}}=await sb.auth.getSession();if(!session)throw new ApiError('请先登录或匿名加入。','UNAUTHENTICATED');
 let result;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);try{result=await sb.functions.invoke('game',{body,headers:{Authorization:`Bearer ${session.access_token}`},signal:controller.signal});}catch{throw new ApiError('连接超时或失败，提交结果暂时无法确认。');}finally{clearTimeout(timeout);}
 if(result.error){let detail:{error?:string;code?:string}={};try{detail=await result.error.context?.json();}catch{}throw new ApiError(detail?.error||'无法连接联机服务，请检查网络和 Supabase 部署。',detail?.code||'NETWORK');}
 if(result.data?.error)throw new ApiError(result.data.error,result.data.code);
 if(typeof result.data?.serverTime==='number')clockOffset=result.data.serverTime-Date.now();
 return result.data as T;
}
