import type { Role } from '../lib/domain';
import { RoleToken, StatusIcon } from './ui';
import { artUrl } from '../lib/art';
import { BookOpen, Skull, Axe, Shield, Flame } from 'lucide-react';
import type { ReactNode, CSSProperties } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { phaseLabel } from '../lib/storage';
export interface DisplaySeat {id:string;index:number;name:string;role?:string;roleData?:Role;alignment?:string;alive:boolean;voteAvailable:boolean;left:boolean;marks?:string[];traveller?:boolean;pendingDeath?:boolean;executed?:boolean;}
export function AvatarFrame({children}:{children:ReactNode}){return <span className="portrait-frame"><span className="portrait-content">{children}</span><img src={artUrl('art/table/avatar-frame.webp')} alt="" className="portrait-border" width={192} height={192} decoding="async"/></span>}
export function TownBoard({seats,phase,round,selected,onSelect,centerAction,winner,showAllMarks=false,compactNotes=false,onStoryteller}:{seats:DisplaySeat[];phase:string;round:number;selected?:string;onSelect?:(id:string)=>void;list?:boolean;centerAction?:ReactNode;winner?:string;showAllMarks?:boolean;compactNotes?:boolean;onStoryteller?:()=>void}){
 const ringRef=useRef<HTMLDivElement>(null);
 const [seatHeight,setSeatHeight]=useState(48);
 const [noteHeights,setNoteHeights]=useState<{seats:Record<string,number>;center:number}>({seats:{},center:190});
 const seatIds=seats.map(seat=>seat.id).join('|');
 useLayoutEffect(()=>{
  if((!showAllMarks&&!compactNotes)||!ringRef.current)return;
  const nodes=Array.from(ringRef.current.querySelectorAll<HTMLElement>('.seat-node'));
  const center=ringRef.current.querySelector<HTMLElement>('.town-center');
  const measure=()=>{
   if(!compactNotes){setSeatHeight(Math.max(48,...nodes.map(node=>Math.ceil(node.getBoundingClientRect().height))));return;}
   const measured=Object.fromEntries(nodes.map(node=>[node.dataset.seatId!,Math.ceil(node.getBoundingClientRect().height)]));
   const centerHeight=Math.max(190,Math.ceil(center?.getBoundingClientRect().height??0)+12);
   setNoteHeights(previous=>previous.center===centerHeight&&Object.keys(previous.seats).length===nodes.length&&Object.entries(measured).every(([id,h])=>previous.seats[id]===h)?previous:{seats:measured,center:centerHeight});
  };
  measure();
  const observer=new ResizeObserver(measure);
  nodes.forEach(node=>observer.observe(node));
  if(compactNotes&&center)observer.observe(center);
  return()=>observer.disconnect();
 },[showAllMarks,compactNotes,seatIds]);
 // Clockwise around a rounded table. Add side space for travellers instead of overlapping seats.
 const cap=seats.length>=13?3:seats.length>=9?2:seats.length>0?1:0;
 const rightCount=Math.ceil((seats.length-cap*2)/2),leftCount=seats.length-cap*2-rightCount;
 const edge=showAllMarks||compactNotes?seatHeight/2+6:22;
 const noteSeatHeight=(i:number)=>noteHeights.seats[seats[i]?.id]??48;
 const topHeight=Math.max(0,...seats.slice(0,cap).map((_,i)=>noteSeatHeight(i)));
 const bottomStart=cap+rightCount;
 const bottomHeight=Math.max(0,...seats.slice(bottomStart,bottomStart+cap).map((_,i)=>noteSeatHeight(bottomStart+i)));
 const columnHeight=(start:number,count:number)=>Array.from({length:Math.max(0,count)},(_,i)=>noteSeatHeight(start+i)).reduce((total,h)=>total+h,0)+Math.max(0,count-1)*6;
 const rightHeight=columnHeight(cap,rightCount),leftHeight=columnHeight(cap*2+rightCount,leftCount);
 const middleHeight=Math.max(noteHeights.center,rightHeight+12,leftHeight+12);
 const height=compactNotes?topHeight+middleHeight+bottomHeight+12:showAllMarks?Math.max(248,(rightCount+1)*(seatHeight+10)+edge*2):Math.max(248,(rightCount+1)*46+44);
 const noteColumnY=(i:number,start:number,count:number,total:number,reverse=false)=>{
  const extra=(middleHeight-total)/(count+1);
  const preceding=Array.from({length:i-start},(_,offset)=>noteSeatHeight(start+offset)+6+extra).reduce((sum,h)=>sum+h,0);
  const offset=extra+preceding+noteSeatHeight(i)/2;
  return 6+topHeight+(reverse?middleHeight-offset:offset);
 };
 const position=(i:number)=>{
  if(compactNotes){
   if(i<cap)return {x:(i+1)*100/(cap+1),y:6+topHeight-noteSeatHeight(i)/2};
   if(i<bottomStart)return {x:89,y:noteColumnY(i,cap,rightCount,rightHeight)};
   if(i<bottomStart+cap)return {x:100-(i-bottomStart+1)*100/(cap+1),y:6+topHeight+middleHeight+noteSeatHeight(i)/2};
   return {x:11,y:noteColumnY(i,bottomStart+cap,leftCount,leftHeight,true)};
  }
  if(i<cap)return {x:(i+1)*100/(cap+1),y:edge};
  if(i<cap+rightCount)return {x:89,y:edge+((i-cap+1)/(rightCount+1))*(height-edge*2)};
  if(i<cap*2+rightCount)return {x:100-(i-cap-rightCount+1)*100/(cap+1),y:height-edge};
  return {x:11,y:height-edge-((i-cap*2-rightCount+1)/(leftCount+1))*(height-edge*2)};
 };
 return <div className={`town-board scene-board ${showAllMarks?'all-seat-marks':''} ${compactNotes?'compact-notes':''} ${phase==='night'?'scene-night':''}`}><div ref={ringRef} className="seat-ring" style={{height:showAllMarks||compactNotes?height:height*2.6,'--ring-height':`${height}px`} as CSSProperties}>
 <div className="town-center" style={compactNotes?{top:`${(6+topHeight+middleHeight/2)/height*100}%`}:undefined}><AvatarFrame><BookOpen size={38}/></AvatarFrame><strong>{compactNotes&&onStoryteller?<button className="note-storyteller" onClick={onStoryteller}>0 说书人</button>:compactNotes?'0 说书人':'说书人'}</strong><h2>{phaseLabel(phase,round)}</h2><p>{phase==='ended'?winner:`存活 ${seats.filter(s=>s.alive&&!s.left).length} 人`}</p>{centerAction}</div>
 {seats.map((s,i)=>{const {x,y}=position(i);return <button key={s.id} data-seat-id={s.id} className={`seat-node ${s.alignment||'neutral'} ${!s.alive?'dead':''} ${s.left?'left':''} ${selected===s.id?'selected':''} ${s.traveller?'traveller-seat':''}`} style={{left:`${x}%`,top:`${y/height*100}%`} as CSSProperties} onClick={()=>onSelect?.(s.id)} aria-label={`${s.index} 号 ${s.name} ${s.role||''} ${showAllMarks?(s.marks||[]).join('、'):''} ${s.left?'离场':s.executed?'已处决':s.alive?'存活':'死亡'}`}>
 <span className="seat-art"><AvatarFrame>{s.roleData?<RoleToken role={s.roleData} alignment={s.alignment}/>:<img className="player-avatar" src={artUrl('art/table/player-avatar.webp')} alt="" width={192} height={192} decoding="async"/>}</AvatarFrame>{!s.alive&&!s.executed&&<img className="death-slash" src={artUrl('art/table/death-slash.webp')} alt="死亡"/>}{compactNotes&&s.executed&&<Axe className="execution-mark" aria-label="处决"/>}</span><strong><span className="seat-index">{s.index}</span>{s.name}</strong>{(!compactNotes||s.role)&&<span className="seat-role">{s.role||(s.left?'已离场':s.alive?'存活':'死亡')}</span>}{compactNotes?<span className="seat-flags note-seat-states">{s.alignment==='good'&&<small><Shield size={11}/>正义</small>}{s.alignment==='evil'&&<small><Flame size={11}/>邪恶</small>}{s.executed&&<small><Axe size={11}/>处决</small>}{!s.alive&&<small><Skull size={11}/>死亡</small>}{s.left&&<small>离场</small>}{s.traveller&&<small>旅行者</small>}{s.pendingDeath&&<small>待公布死亡</small>}{!s.voteAvailable&&<small>死者票已用</small>}</span>:<span className="seat-flags">{s.pendingDeath&&<StatusIcon status="pending-death" size={18} label="待公布死亡"/>}{s.traveller&&<small>旅行者</small>}{!s.alive&&<><Skull size={13}/><StatusIcon status={s.voteAvailable?"ghost-vote-available":"ghost-vote-used"} size={16} label={s.voteAvailable?"死者票可用":"死者票已用"}/></>}</span>}{!!s.marks?.length&&<span className="seat-markers"><>{showAllMarks?s.marks.map((mark,index)=><small key={`${mark}-${index}`}>{mark}</small>):<small>{s.marks[0]}{s.marks.length>1?` +${s.marks.length-1}`:''}</small>}</></span>}</button>})}</div></div>
}



