import { CATALOG, ROLE_MAP } from './catalog.ts';
import { TEAMS, type Role, type Script } from './types.ts';
export function uid():string {
 // randomUUID is restricted to secure contexts; getRandomValues also works on LAN HTTP.
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function copyScript(script: Script): Script {return {...structuredClone(script),id:uid(),name:`${script.name} · 自定义`,author:'',version:1,updatedAt:new Date().toISOString()};}
function order(x:unknown) {return typeof x==='number' && Number.isFinite(x) && x>=0?Math.min(x,10000):0;}
function strings(x:unknown):string[] {return Array.isArray(x)?x.filter(v=>typeof v==='string').map(v=>v.slice(0,200)).slice(0,50):[];}
export function availableTravellerRoles(script: Script): Role[] {
 const roles = new Map<string, Role>();
 for (const role of [...script.roles, ...CATALOG]) {
  if (!roles.has(role.id)) roles.set(role.id, role);
 }
 return [...roles.values()].filter(role => role.team === 'traveller' && !role.unresolved);
}
export function importScript(text: string): {script:Script; warnings:string[]} {
 if(new TextEncoder().encode(text).length>2_000_000)throw new Error('剧本文件不能超过 2 MB。');
 let data:unknown; try{data=JSON.parse(text);}catch{throw new Error('无法解析 JSON，请检查逗号、引号和括号。');}
 if(!Array.isArray(data)||data.length>300)throw new Error('请导入最多 300 项的官方格式 JSON 数组。');
 const warnings:string[]=[];const roles:Role[]=[];const extras:unknown[]=[];let meta:Record<string,unknown>={id:'_meta',name:'导入剧本'};
 data.forEach((entry,i)=>{
  if(typeof entry!=='string' && (!entry || typeof entry!=='object' || Array.isArray(entry)))throw new Error(`第 ${i+1} 项必须是角色 ID 或对象。`);
  const raw:Record<string,unknown>=typeof entry==='string'?{id:entry}:entry as Record<string,unknown>;
  if(raw.id==='_meta'){meta={...raw};return;}
  if(typeof raw.id!=='string'||!raw.id.trim())throw new Error(`第 ${i+1} 项缺少角色 ID。`);
  if(raw.id.startsWith('_')){extras.push(raw);warnings.push(`保留扩展条目 ${raw.id}，不会作为角色加入。`);return;}
  const normalized=raw.id.toLowerCase().replace(/[\s_-]/g,'');const known=ROLE_MAP[raw.id]??ROLE_MAP[normalized];
  const id=known?.id??raw.id;
  if(roles.some(r=>r.id===id)){extras.push(raw);warnings.push(`角色 ${id} 重复：保留原条目，但角色池只展示一次；本局允许分配重复身份。`);return;}
  const isCustom=typeof raw.name==='string' && typeof raw.ability==='string' && TEAMS.includes(raw.team as Role['team']);
  if(isCustom){roles.push({id,name:String(raw.name).slice(0,80),team:raw.team as Role['team'],ability:String(raw.ability).slice(0,4000),firstNight:order(raw.firstNight),otherNight:order(raw.otherNight),firstNightReminder:typeof raw.firstNightReminder==='string'?raw.firstNightReminder.slice(0,4000):undefined,otherNightReminder:typeof raw.otherNightReminder==='string'?raw.otherNightReminder.slice(0,4000):undefined,reminders:strings(raw.reminders),setup:!!raw.setup,custom:true,raw:{...raw,id}});}
  else if(known){
   const role:Role={...structuredClone(known),raw:{...raw,id}};
   if(typeof raw.name==='string')role.name=raw.name.slice(0,80);
   if(typeof raw.ability==='string')role.ability=raw.ability.slice(0,4000);
   if(TEAMS.includes(raw.team as Role['team']))role.team=raw.team as Role['team'];
   if('firstNight' in raw)role.firstNight=order(raw.firstNight);
   if('otherNight' in raw)role.otherNight=order(raw.otherNight);
   if(typeof raw.firstNightReminder==='string')role.firstNightReminder=raw.firstNightReminder.slice(0,4000);
   if(typeof raw.otherNightReminder==='string')role.otherNightReminder=raw.otherNightReminder.slice(0,4000);
   if(Array.isArray(raw.reminders))role.reminders=strings(raw.reminders);
   if(typeof raw.setup==='boolean')role.setup=raw.setup;
   roles.push(role);
  }
  else {roles.push({id,name:typeof raw.name==='string'?raw.name:id,team:'townsfolk',ability:'尚未补全该角色资料。请编辑类别、能力和夜序，或导入完整角色定义。',firstNight:0,otherNight:0,reminders:[],unresolved:true,custom:true,raw:{...raw}});warnings.push(`未知角色 ${id} 已保留，开局前需补全资料。`);}
 });
 if(!roles.length)throw new Error('剧本内没有角色。');
 return {script:{id:uid(),name:String(meta.name??'导入剧本').slice(0,100),author:String(meta.author??'').slice(0,100),description:'从 JSON 导入',version:1,roles,meta,extras,updatedAt:new Date().toISOString()},warnings};
}
export function exportScript(s:Script) {return JSON.stringify([{...s.meta,id:'_meta',name:s.name,author:s.author},...s.roles.map(r=>r.custom?{...r.raw,id:r.id,name:r.name,team:r.team,ability:r.ability,firstNight:r.firstNight,otherNight:r.otherNight,firstNightReminder:r.firstNightReminder,otherNightReminder:r.otherNightReminder,reminders:r.reminders,setup:r.setup}:({...r.raw,id:r.id})),...s.extras],null,2);}
export function scriptWarnings(s:Script) {
 const warnings:string[]=[];
 if(s.roles.some(r=>r.setup))warnings.push('包含初始配置修正：请按角色要求调整镇民 / 外来者数量。');
 if(s.roles.some(r=>r.unresolved))warnings.push('有未补全角色，不能给这些角色发牌。');
 if(s.roles.some(r=>r.custom))warnings.push('自制角色按提供的夜序与手动裁定运行。');
 const jinxes=s.roles.flatMap(r=>Array.isArray(r.raw?.jinxes)?r.raw.jinxes:[]);
 if(jinxes.length) warnings.push(`导入资料含 ${jinxes.length} 项相克说明，请在角色详情中核对。`);
 if(s.roles.some(r=>r.edition==='bmr') && s.roles.some(r=>r.edition==='snv'))warnings.push('跨剧本混合配置：额外核对死亡、疯狂、醉毒与信息类能力的相互作用。');
 return warnings;
}
export const ALL_ROLES = CATALOG;
