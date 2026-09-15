import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X, AlertCircle, Check, Moon, BookOpen, ChevronRight, LoaderCircle } from 'lucide-react';
import { WIKI_NAMES } from '../lib/wiki';
import { artUrl, roleArt, scriptArt, TEAM_ART, STATUS_ART, reminderStatus } from '../lib/art';
import '../styles/role-art.css';
import { TEAM_LABELS, TEAMS, type Role, type Seat, type PublicSeat, type Script, findRole } from '../lib/domain';
export function Button({variant='secondary',className='',children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger';children:ReactNode}){return <button type="button" className={`button ${variant} ${className}`} {...props}>{children}</button>;}
export function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Empty({title,children,icon}:{title:string;children?:ReactNode;icon?:ReactNode}){return <div className="empty">{icon||<Moon size={36}/>}<h3>{title}</h3>{children&&<p>{children}</p>}</div>;}
export function Alert({children,kind='info'}:{children:ReactNode;kind?:'info'|'error'|'success'}){return <div className={`alert ${kind}`} role={kind==='error'?'alert':undefined}><AlertCircle size={17}/><div>{children}</div></div>;}
export function Spinner(){return <div className="loading"><LoaderCircle className="spin"/> 正在读取对局…</div>;}
/** Decorative images accompany visible text; labels are used only for standalone status badges. */
function ArtImage({src,size,label,className=''}:{src?:string;size:number;label?:string;className?:string}){
 const [failed,setFailed]=useState<string>();
 if(!src||failed===src)return null;
 return <img className={`ui-art ${className}`} src={src} width={size} height={size} style={{width:size,height:size}} alt={label||''} title={label} aria-hidden={label?undefined:true} decoding="async" onError={()=>setFailed(src)}/>;
}
export function ScriptBadge({script,size=40}:{script?:Script|null;size?:number}){return <ArtImage className="script-badge" src={scriptArt(script)} size={size}/>;}
export function TeamBadge({team,size=24}:{team:string;size?:number}){return <ArtImage className="team-badge" src={Object.hasOwn(TEAM_ART,team)?artUrl(TEAM_ART[team]):undefined} size={size}/>;}
export function StatusIcon({status,size=22,label}:{status:string;size?:number;label?:string}){return <ArtImage className="status-icon" src={Object.hasOwn(STATUS_ART,status)?artUrl(STATUS_ART[status]):undefined} size={size} label={label}/>;}
export function ReminderIcon({label,size=22}:{label:string;size?:number}){const status=reminderStatus(label);return status?<StatusIcon status={status} size={size}/>:null;}
export function Modal({title,children,onClose,footer,wide=false}:{title:string;children:ReactNode;onClose:()=>void;footer?:ReactNode;wide?:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const old=document.activeElement as HTMLElement|null;const before=document.body.style.overflow;document.body.style.overflow='hidden';const el=ref.current;el?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'&&el){const all=Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]'));const first=all[0],last=all.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===el)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return ()=>{document.removeEventListener('keydown',key);document.body.style.overflow=before;old?.focus();};},[]);
 return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><header><h2>{title}</h2><Button variant="ghost" onClick={onClose} aria-label="关闭"><X size={20}/></Button></header><div className="modal-body">{children}</div>{footer&&<footer>{footer}</footer>}</div></div>;
}
export function RoleSelect({roles,value,onChange,empty=true,disabled=false}:{roles:Role[];value:string;onChange:(id:string)=>void;empty?:boolean;disabled?:boolean}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const root=useRef<HTMLSpanElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 const selected=roles.find(r=>r.id===value);
 const matches=roles.filter(r=>`${r.name} ${r.id}`.toLowerCase().includes(query.trim().toLowerCase()));
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 function choose(next:string){onChange(next);setOpen(false);trigger.current?.focus();}
 return <span ref={root} className="role-select" onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();e.preventDefault();setOpen(false);trigger.current?.focus();}}}>
  <button ref={trigger} type="button" className="role-select-trigger" disabled={disabled} aria-expanded={open&&!disabled} aria-controls={id} onClick={()=>{setOpen(!open);setQuery('');}}>{selected&&<RoleToken small role={selected}/>}<span>{selected?.name||'选择角色'}</span><ChevronRight size={15}/></button>
  {open&&!disabled&&<span id={id} className="role-select-options" role="group" aria-label="角色选项" onClick={e=>e.preventDefault()}>
   <input autoFocus aria-label="筛选角色" placeholder="搜索角色" value={query} onChange={e=>setQuery(e.target.value)}/>
   {empty&&<button type="button" onClick={()=>choose('')}>清空选择</button>}
   {TEAMS.map(team=>{const group=matches.filter(r=>r.team===team);return group.length?<span className="role-select-team" key={team}><strong>{TEAM_LABELS[team]}</strong>{group.map(r=><button type="button" key={r.id} aria-pressed={r.id===value} onClick={()=>choose(r.id)}><RoleToken small role={r}/><span>{r.name}{r.unresolved?'（待补全）':''}</span>{r.id===value&&<Check size={16}/>}</button>)}</span>:null;})}
   {!matches.length&&<span>暂无匹配角色</span>}
  </span>}
 </span>;
}
/** Supply only the role already authorized for this view; never resolve a hidden role here. */
export function RoleToken({role,small=false,alignment}:{role?:Role|null;small?:boolean;alignment?:string}){
 const src=role?.unresolved?undefined:roleArt(role);
 const [failedSrc,setFailedSrc]=useState<string>();
 const hasArt=Boolean(src&&src!==failedSrc);
 return <span aria-hidden="true" className={`role-token ${small?'small':''} ${alignment||((role?.team==='minion'||role?.team==='demon')?'evil':'good')} ${role?.team==='traveller'?'traveller':''} ${hasArt?'has-art':''}`}>
  {hasArt?<img key={src} src={src} alt="" aria-hidden="true" width={small?26:44} height={small?26:44} decoding="async" onError={()=>setFailedSrc(src)}/>:<span>{role?.name?.slice(0,1)||'?'}</span>}
 </span>;
}
export function RoleInfo({role}:{role:Role}){const jinxes=Array.isArray(role.raw?.jinxes)?role.raw.jinxes:[];return <div className="role-info"><div className="row"><RoleToken role={role}/><div><h3>{role.name}</h3><span className={`team ${role.team}`}><TeamBadge team={role.team} size={20}/> {TEAM_LABELS[role.team]}</span><small className="muted"> · {role.id}</small></div></div><p>{role.ability}</p><div className="meta-row"><span>首夜顺序 {role.firstNight||'—'}</span><span>其他夜 {role.otherNight||'—'}</span></div>{role.firstNightReminder&&<p className="muted">首夜：{role.firstNightReminder}</p>}{role.otherNightReminder&&<p className="muted">其他夜：{role.otherNightReminder}</p>}{role.reminders.length>0&&<div className="chips">{role.reminders.map((m,i)=><span className="chip" key={i}>{m}</span>)}</div>}{jinxes.length>0&&<details><summary>相克说明</summary><pre>{JSON.stringify(jinxes,null,2)}</pre></details>}{WIKI_NAMES[role.id]&&<a className="text-link" href={`https://wiki.bloodontheclocktower.com/${encodeURIComponent(WIKI_NAMES[role.id])}`} target="_blank" rel="noreferrer">查看官方角色 Wiki <ChevronRight size={14}/></a>}<small className="muted block">本站能力为简要提示，角色结算由说书人裁定。</small></div>;}
export function SeatChecks({seats,selected,onChange,disabled,labels}:{seats:(Seat|PublicSeat)[];selected:string[];onChange:(s:string[])=>void;disabled?:(s:Seat|PublicSeat)=>boolean;labels?:(s:Seat|PublicSeat)=>string}){return <div className="seat-checks">{seats.map(s=><label key={s.id} className={`seat-check ${selected.includes(s.id)?'selected':''} ${disabled?.(s)?'disabled':''}`}><input type="checkbox" checked={selected.includes(s.id)} disabled={disabled?.(s)} onChange={()=>onChange(selected.includes(s.id)?selected.filter(id=>id!==s.id):[...selected,s.id])}/><span className="seat-number">{String(s.index).padStart(2,'0')}</span><span data-seat-index={s.index} title={`${s.index} 号 · ${s.name}`}>{s.name}<small>{labels?.(s)||''}</small></span>{selected.includes(s.id)&&<Check size={15}/>}</label>)}</div>;}
export function NoteEditor({value,onSave,label='笔记',placeholder='写下本局需要记住的事…'}:{value:string;onSave:(v:string)=>Promise<unknown>;label?:string;placeholder?:string}){const [draft,setDraft]=useState(value),[saving,setSaving]=useState(false);const last=useRef(value);useEffect(()=>{if(draft===last.current)setDraft(value);last.current=value;},[value]);return <div className="note-editor"><textarea aria-label={label} placeholder={placeholder} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={10000} rows={7}/><div className="row between"><small className="muted">{draft===value?'已保存':'未保存草稿'}</small><Button disabled={draft===value||saving} onClick={async()=>{setSaving(true);try{await onSave(draft);}finally{setSaving(false);}}}>保存笔记</Button></div></div>;}
export function ScriptRead({script}:{script:Script}){const [role,setRole]=useState<Role|null>(null);return <><div className="section-heading"><div><h2>{script.name}</h2><p>{script.author} · 剧本快照 v{script.version}</p></div><ScriptBadge script={script}/></div>{TEAMS.map(team=>{const rs=script.roles.filter(r=>r.team===team);return rs.length?<section key={team} className="role-section"><h3 className={`team ${team}`}><TeamBadge team={team} size={24}/> {TEAM_LABELS[team]} <span>{rs.length}</span></h3><div className="role-grid">{rs.map(r=><button key={r.id} className="role-row" onClick={()=>setRole(r)}><RoleToken small role={r}/><span><strong>{r.name}</strong><small>{r.ability}</small></span><ChevronRight size={15}/></button>)}</div></section>:null;})}{role&&<Modal title={role.name} onClose={()=>setRole(null)}><RoleInfo role={role}/></Modal>}</>;}
