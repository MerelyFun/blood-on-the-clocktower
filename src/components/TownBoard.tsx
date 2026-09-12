import type { Role } from '../lib/domain';
import { RoleToken, StatusIcon } from './ui';
import { artUrl } from '../lib/art';
import { BookOpen, Skull, UserRound } from 'lucide-react';
import type { ReactNode, CSSProperties } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { phaseLabel } from '../lib/storage';
export interface DisplaySeat {id:string;index:number;name:string;role?:string;roleData?:Role;alignment?:string;alive:boolean;voteAvailable:boolean;left:boolean;marks?:string[];traveller?:boolean;pendingDeath?:boolean;}
export function AvatarFrame({children}:{children:ReactNode}){return <span className="portrait-frame"><span className="portrait-content">{children}</span><img src={artUrl('art/table/avatar-frame.webp')} alt="" className="portrait-border"/></span>}
export function TownBoard({seats,phase,round,selected,onSelect,centerAction,winner,showAllMarks=false}:{seats:DisplaySeat[];phase:string;round:number;selected?:string;onSelect?:(id:string)=>void;list?:boolean;centerAction?:ReactNode;winner?:string;showAllMarks?:boolean}){
 const ringRef=useRef<HTMLDivElement>(null);
 const [seatHeight,setSeatHeight]=useState(48);
 const seatIds=seats.map(seat=>seat.id).join('|');
 useLayoutEffect(()=>{
  if(!showAllMarks||!ringRef.current)return;
  const nodes=Array.from(ringRef.current.querySelectorAll<HTMLElement>('.seat-node'));
  const measure=()=>setSeatHeight(Math.max(48,...nodes.map(node=>Math.ceil(node.getBoundingClientRect().height))));
  measure();
  const observer=new ResizeObserver(measure);
  nodes.forEach(node=>observer.observe(node));
  return()=>observer.disconnect();
 },[showAllMarks,seatIds]);
 // Clockwise around a rounded table. Add side space for travellers instead of overlapping seats.
 const cap=seats.length>=13?3:seats.length>=9?2:1;
 const rightCount=Math.ceil((seats.length-cap*2)/2),leftCount=seats.length-cap*2-rightCount;
 const edge=showAllMarks?seatHeight/2+6:22;
 const height=showAllMarks?Math.max(248,(rightCount+1)*(seatHeight+10)+edge*2):Math.max(248,(rightCount+1)*46+44);
 const position=(i:number)=>{
  if(i<cap)return {x:(i+1)*100/(cap+1),y:edge};
  if(i<cap+rightCount)return {x:89,y:edge+(i-cap+1)*(height-edge*2)/(rightCount+1)};
  if(i<cap*2+rightCount)return {x:100-(i-cap-rightCount+1)*100/(cap+1),y:height-edge};
  return {x:11,y:height-edge-(i-cap*2-rightCount+1)*(height-edge*2)/(leftCount+1)};
 };
 return <div className={`town-board scene-board ${showAllMarks?'all-seat-marks':''} ${phase==='night'?'scene-night':''}`}><div ref={ringRef} className="seat-ring" style={{height:showAllMarks?height:height*2.6,'--ring-height':`${height}px`} as CSSProperties}>
 <div className="town-center"><AvatarFrame><BookOpen size={38}/></AvatarFrame><strong>说书人</strong><h2>{phaseLabel(phase,round)}</h2><p>{phase==='ended'?winner:`存活 ${seats.filter(s=>s.alive&&!s.left).length} 人`}</p>{centerAction}</div>
 {seats.map((s,i)=>{const {x,y}=position(i);return <button key={s.id} className={`seat-node ${s.alignment||'neutral'} ${!s.alive?'dead':''} ${s.left?'left':''} ${selected===s.id?'selected':''} ${s.traveller?'traveller-seat':''}`} style={{left:`${x}%`,top:`${y/height*100}%`} as CSSProperties} onClick={()=>onSelect?.(s.id)} aria-label={`${s.index} 号 ${s.name} ${s.role||''} ${showAllMarks?(s.marks||[]).join('、'):''} ${s.left?'离场':s.alive?'存活':'死亡'}`}>
 <span className="seat-art"><AvatarFrame>{s.roleData?<RoleToken role={s.roleData} alignment={s.alignment}/>:<UserRound size={34}/>}</AvatarFrame>{!s.alive&&<img className="death-slash" src={artUrl('art/table/death-slash.webp')} alt="死亡"/>}</span><strong><span className="seat-index">{s.index}</span>{s.name}</strong><span className="seat-role">{s.role||(s.left?'已离场':s.alive?'存活':'死亡')}</span><span className="seat-flags">{s.pendingDeath&&<StatusIcon status="pending-death" size={18} label="待公布死亡"/>}{s.traveller&&<small>旅行者</small>}{!s.alive&&<><Skull size={13}/><StatusIcon status={s.voteAvailable?"ghost-vote-available":"ghost-vote-used"} size={16} label={s.voteAvailable?"死者票可用":"死者票已用"}/></>}</span>{!!s.marks?.length&&<span className="seat-markers"><>{showAllMarks?s.marks.map((mark,index)=><small key={`${mark}-${index}`}>{mark}</small>):<small>{s.marks[0]}{s.marks.length>1?` +${s.marks.length-1}`:''}</small>}</></span>}</button>})}</div></div>
}



