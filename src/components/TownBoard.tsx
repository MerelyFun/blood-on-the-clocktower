import type { Role } from '../lib/domain';
import { RoleToken } from './ui';
import { artUrl } from '../lib/art';
import { BookOpen, Skull, Vote, UserRound } from 'lucide-react';
import type { ReactNode, CSSProperties } from 'react';
import { phaseLabel } from '../lib/storage';
export interface DisplaySeat {id:string;index:number;name:string;role?:string;roleData?:Role;alignment?:string;alive:boolean;voteAvailable:boolean;left:boolean;marks?:string[];traveller?:boolean;}
export function AvatarFrame({children}:{children:ReactNode}){return <span className="portrait-frame"><span className="portrait-content">{children}</span><img src={artUrl('art/table/avatar-frame.webp')} alt="" className="portrait-border"/></span>}
export function TownBoard({seats,phase,round,selected,onSelect,centerAction,winner}:{seats:DisplaySeat[];phase:string;round:number;selected?:string;onSelect?:(id:string)=>void;list?:boolean;centerAction?:ReactNode;winner?:string}){
 const sideCount=Math.ceil(Math.max(0,seats.length-2)/2);const height=Math.max(640,(sideCount-1)*240+160);
 return <div className={`town-board scene-board ${phase==='night'?'scene-night':''}`}><div className="seat-ring" style={{height} as CSSProperties}>
 <div className="town-center"><AvatarFrame><BookOpen size={38}/></AvatarFrame><strong>说书人</strong><h2>{phaseLabel(phase,round)}</h2><p>{phase==='ended'?winner:`存活 ${seats.filter(s=>s.alive&&!s.left).length} 人`}</p>{centerAction}</div>
 {seats.map((s,i)=>{let x=50,y=12;if(i===sideCount+1&&i>0)y=88;else if(i>0){const right=i<=sideCount;const j=right?i-1:i-sideCount-2;const total=right?sideCount:seats.length-2-sideCount;x=right?83:17;y=total===1?50:right?24+j/(total-1)*52:76-j/(total-1)*52;}return <button key={s.id} className={`seat-node ${s.alignment||'neutral'} ${!s.alive?'dead':''} ${s.left?'left':''} ${selected===s.id?'selected':''} ${s.traveller?'traveller-seat':''}`} style={{left:`${x}%`,top:`${y}%`} as CSSProperties} onClick={()=>onSelect?.(s.id)} aria-label={`${s.index} 号 ${s.name} ${s.role||''} ${s.left?'离场':s.alive?'存活':'死亡'}`}>
 <span className="seat-art"><AvatarFrame>{s.roleData?<RoleToken role={s.roleData} alignment={s.alignment}/>:<UserRound size={34}/>}</AvatarFrame>{!s.alive&&<img className="death-slash" src={artUrl('art/table/death-slash.webp')} alt="死亡"/>}</span><strong><span className="seat-index">{s.index}</span>{s.name}</strong><span className="seat-role">{s.role||(s.left?'已离场':s.alive?'存活':'死亡')}</span><span className="seat-flags">{s.traveller&&<small>旅行者</small>}{!s.alive&&<><Skull size={13}/><Vote size={13} className={s.voteAvailable?'gold':'muted'}/></>}</span>{!!s.marks?.length&&<span className="seat-markers"><small>{s.marks[0]}{s.marks.length>1?` +${s.marks.length-1}`:''}</small></span>}</button>})}</div></div>
}



