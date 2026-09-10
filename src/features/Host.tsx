import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Camera, Eye, FileClock, Gavel, Moon, NotebookPen, Pause, Play, Plus, RotateCw, Settings2, Sun, Tag, Users } from 'lucide-react';
import { findRole, publicGame, type Game } from '../lib/domain';
import type { RoomController } from '../lib/useRoom';
import { serverNow } from '../lib/supabase';
import { phaseLabel } from '../lib/storage';
import { Alert, Button, Field, Modal, NoteEditor, ScriptRead, SeatChecks } from '../components/ui';
import { TownBoard } from '../components/TownBoard';
import { Setup, TravellerForm, FabledRules } from './Setup';
import { Scripts } from './Scripts';
import { Night } from './Night';
import { SeatInspector, MarkerForm } from './SeatInspector';
import { Votes } from './Votes';
import { Archive } from './Archive';
import { Members } from './Members';
import { PublicTown } from './Player';
export function Host({game:g,controller:c,mode}:{game:Game;controller:RoomController;mode:'local'|'cloud'}){
 const [tab,setTab]=useState('grim'),[selected,setSelected]=useState(''),[more,setMore]=useState(false),[scriptEdit,setScriptEdit]=useState(false),[members,setMembers]=useState(false),[publicOnly,setPublic]=useState(false),[marker,setMarker]=useState(false),[notes,setNotes]=useState(false),[dawn,setDawn]=useState(false),[phase,setPhase]=useState(false),[finish,setFinish]=useState(false),[announce,setAnnounce]=useState(false),[traveller,setTraveller]=useState(false),[swap,setSwap]=useState(false),[handoff,setHandoff]=useState(false);
 const seat=g.seats.find(s=>s.id===selected);
 const pending=g.seats.filter(s=>s.alive!==s.publicAlive);
 const candidates=c.view?.kind==='host'?c.view.members:[];
 const hasRequests=candidates.some(m=>m.status==='pending');
 const openTool=(open:()=>void)=>{setMore(false);open();};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.shiftKey&&e.key==='Escape')setPublic(true);};window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);},[]);
 if(handoff)return <Handoff game={g} onClose={()=>setHandoff(false)}/>;
 if(publicOnly)return <main className="privacy-view"><PublicTown room={publicGame(g)} exit={()=>setPublic(false)}/></main>;
 return <div className="host-app">
  <header className={`room-toolbar ${tab!=='grim'?'compact':''}`}>
   <div className="host-identity"><h1>{g.title}</h1><p>{mode==='local'?'本机主持':`房间 ${g.code}`}{g.title!==g.script.name&&` · ${g.script.name}`}</p></div>
   <div className="host-status"><span className="phase-label">{g.phase==='night'?<Moon size={20}/>:<Sun size={20}/>} {phaseLabel(g.phase,g.round)}</span>{(mode==='cloud'||c.connection==='连接中断')&&<span className={`connection ${c.connection==='连接中断'?'offline':''}`}><i/>{c.connection}</span>}</div>
   <div className="host-quick-actions">
    <Button onClick={()=>setPublic(true)}><Eye size={24}/><span>公开视图</span></Button>
    <Button onClick={()=>setNotes(true)}><NotebookPen size={24}/><span>笔记</span></Button>
    <Button onClick={()=>setMore(true)} aria-label={hasRequests?'更多，有新入座申请':'更多'}><Settings2 size={24}/><span>更多{hasRequests&&' · 新申请'}</span></Button>
   </div>
  </header>
  <div className="host-layout">
   <nav className="host-nav" aria-label="说书人工具">{[['grim','魔典',BookOpen],['night','夜晚',Moon],['votes','计票',Users],['archive','记录',FileClock],['script','剧本',BookOpen]].map(([id,label,Icon]:any)=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);setSelected('');}}><Icon size={25}/><span>{label}</span></button>)}</nav>
   <main className={`host-main ${tab==='grim'&&g.phase!=='setup'?'grimoire-layout':''}`}>
    {g.phase==='setup'&&tab==='grim'?<Setup game={g} run={c.run} busy={c.busy} onScript={()=>setScriptEdit(true)} onMembers={()=>setMembers(true)}/>:tab==='grim'?<>
     <section className="grimoire-canvas">
      {g.paused&&<Alert>对局已暂停。<Button onClick={()=>c.run('pause',{paused:false})} disabled={c.busy}><Play size={20}/> 继续对局</Button></Alert>}
      {g.phase==='ended'&&<Alert kind="success">游戏结束：{g.winner}。可在记录中查看复盘。</Alert>}
      <TownBoard seats={g.seats.map(s=>({...s,role:findRole(g.script,s.roleId)?.name,roleData:findRole(g.script,s.roleId),marks:g.reminders.filter(m=>m.target===s.id).map(m=>m.label)}))} phase={g.phase} round={g.round} winner={g.winner} list selected={selected} onSelect={setSelected} centerAction={g.phase!=='ended'&&<Button variant="primary" disabled={c.busy||g.paused} onClick={()=>setPhase(true)}>进入{g.phase==='night'?'白天':'夜晚'}<ArrowRight size={20}/></Button>}/>
      {pending.length>0&&<div className="canvas-actions"><Button variant="primary" onClick={()=>setDawn(true)} disabled={c.busy}>公布生死 · {pending.length}</Button></div>}
     </section>
     {seat&&<div className="inspector-column seat-open"><SeatInspector key={seat.id} game={g} seat={seat} run={c.run} busy={c.busy} onClose={()=>setSelected('')}/></div>}
    </>:tab==='night'?<div className="feature-wrap"><Night game={g} run={c.run} busy={c.busy}/></div>:tab==='votes'?<Votes game={g} run={c.run} busy={c.busy}/>:tab==='archive'?<Archive game={g} run={c.run} busy={c.busy} mode={mode}/>:<div className="feature-wrap">{g.phase==='setup'&&<Button onClick={()=>setScriptEdit(true)}>编辑本局剧本</Button>}<FabledRules game={g} run={c.run} busy={c.busy}/><ScriptRead script={g.script}/></div>}
   </main>
  </div>
  {more&&<Modal title="对局工具" onClose={()=>setMore(false)}>
   <div className="stack">
    {mode==='cloud'&&<p className="muted">房间号 {g.code}</p>}
    <div className="host-more-actions">
     <Button onClick={()=>openTool(()=>setMembers(true))}><Users size={24}/> 邀请 / 入座{hasRequests&&' · 新申请'}</Button>
     <Button onClick={()=>openTool(()=>setMarker(true))}><Tag size={24}/> 添加标记</Button>
     <Button onClick={()=>openTool(()=>setSwap(true))} disabled={g.seats.length<2}><Settings2 size={24}/> 调整座位</Button>
     <Button onClick={()=>openTool(()=>setTraveller(true))} disabled={g.phase==='ended'}><Plus size={24}/> 旅行者</Button>
     {mode==='local'&&<Button onClick={()=>openTool(()=>setHandoff(true))} disabled={!g.seats.length}><Eye size={24}/> 本机展示身份</Button>}
     {g.phase!=='setup'&&<>
      <Button disabled={c.busy||g.phase==='ended'} onClick={()=>c.run('pause',{paused:!g.paused})}>{g.paused?<Play size={24}/>:<Pause size={24}/>} {g.paused?'继续对局':'暂停对局'}</Button>
      <Button onClick={()=>openTool(()=>setAnnounce(true))}><BookOpen size={24}/> 城镇公告</Button>
      <Button disabled={c.busy} onClick={()=>c.run('snapshot',{label:`${phaseLabel(g.phase,g.round)} · 手动快照`})}><Camera size={24}/> 保存快照</Button>
     </>}
    </div>
    {g.phase!=='setup'&&<div className="host-more-timer"><h3>计时器</h3><GameTimer game={g} controller={c} mode={mode}/></div>}
    <Button variant="danger" onClick={()=>openTool(()=>setFinish(true))} disabled={g.phase==='ended'||g.phase==='setup'}><Gavel size={24}/> 结束对局</Button>
   </div>
  </Modal>}
  {scriptEdit&&<Modal title="编辑本局角色池" wide onClose={()=>setScriptEdit(false)}><Scripts initial={g.script} onApply={script=>c.run('script',{script})} onClose={()=>setScriptEdit(false)}/></Modal>}
  {members&&<Members game={g} members={candidates} controller={c} mode={mode} onClose={()=>setMembers(false)}/>}
  {marker&&<MarkerForm game={g} seatId={selected} run={c.run} busy={c.busy} onClose={()=>setMarker(false)}/>}
  {notes&&<Modal title="说书人笔记" onClose={()=>setNotes(false)}><NoteEditor value={g.notes.global||''} onSave={text=>c.run('note',{text})}/></Modal>}
  {dawn&&<Dawn game={g} controller={c} onClose={()=>setDawn(false)}/>}
  {phase&&<PhaseDialog game={g} controller={c} onClose={()=>setPhase(false)}/>}
  {finish&&<Finish game={g} controller={c} onClose={()=>setFinish(false)}/>}
  {announce&&<Announce controller={c} onClose={()=>setAnnounce(false)}/>}
  {traveller&&<TravellerForm script={g.script} run={c.run} busy={c.busy} onClose={()=>setTraveller(false)}/>}
  {swap&&<Swap game={g} controller={c} onClose={()=>setSwap(false)}/>}
 </div>;
}
function Dawn({game:g,controller:c,onClose}:{game:Game;controller:RoomController;onClose:()=>void}){const pending=g.seats.filter(s=>s.alive!==s.publicAlive);const [seats,setSeats]=useState(pending.map(s=>s.id));return <Modal title="公布生命状态" onClose={onClose} footer={<Button variant="primary" disabled={c.busy||!seats.length} onClick={async()=>{if(await c.run('publish_dawn',{seats}))onClose();}}>公布所选变化</Button>}><div className="stack"><p>以下变化尚未公开。只会公布勾选的座位。</p><SeatChecks seats={pending} selected={seats} onChange={setSeats} labels={s=>s.alive?'宣布复活':'宣布死亡'}/></div></Modal>;}
function PhaseDialog({game:g,controller:c,onClose}:{game:Game;controller:RoomController;onClose:()=>void}){const [phase,setPhase]=useState(g.phase==='night'?'day':'night'),[round,setRound]=useState(g.round+(g.phase==='day'?1:0)),[reason,setReason]=useState('');const incomplete=g.nightTasks.filter(t=>!t.done).length;const openNomination=g.nominations.some(n=>n.status==='open');return <Modal title="切换游戏阶段" onClose={onClose} footer={<Button variant="primary" disabled={c.busy||openNomination} onClick={async()=>{if(await c.run('phase',{phase,round,reason}))onClose();}}>确认进入第 {round} {phase==='night'?'夜':'天'}</Button>}><div className="stack">{openNomination&&<Alert>还有未结算的提名，请先在“提名计票”中结算或取消，再切换阶段。</Alert>}{g.phase==='night'&&incomplete>0&&<Alert>还有 {incomplete} 项夜间任务未勾选完成，请确认已处理。</Alert>}{g.seats.some(s=>s.alive!==s.publicAlive)&&<Alert>有尚未公布的生命变化。切换阶段不会自动公布，稍后可在魔典中选择公布。</Alert>}<div className="form-grid"><Field label="目标阶段"><select value={phase} onChange={e=>setPhase(e.target.value)}><option value="day">白天</option><option value="night">夜晚</option></select></Field><Field label="轮次"><input type="number" min={1} max={100} value={round} onChange={e=>setRound(Number(e.target.value))}/></Field></div><Field label="阶段更正说明（如需）"><input value={reason} onChange={e=>setReason(e.target.value)} maxLength={300}/></Field><p className="muted small">进入夜晚会重新生成任务；到期标记随黎明 / 黄昏移除。</p></div></Modal>;}
function Finish({game:g,controller:c,onClose}:{game:Game;controller:RoomController;onClose:()=>void}){const [winner,setWinner]=useState('善良阵营获胜'),[reason,setReason]=useState('');return <Modal title="宣布对局结束" onClose={onClose} footer={<Button variant="danger" disabled={c.busy} onClick={async()=>{if(await c.run('finish',{winner,reason}))onClose();}}>确认结束并公布结果</Button>}><div className="stack"><Alert>请先核对恶魔继承、特殊胜负和角色延续。系统不会自动判定胜负。</Alert><Field label="胜负结果"><select value={winner} onChange={e=>setWinner(e.target.value)}><option>善良阵营获胜</option><option>邪恶阵营获胜</option><option>平局</option><option>中止对局</option></select></Field><Field label="公开说明"><textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></Field></div></Modal>;}
function Announce({controller:c,onClose}:{controller:RoomController;onClose:()=>void}){const [text,setText]=useState('');return <Modal title="向城镇发布公告" onClose={onClose} footer={<Button variant="primary" disabled={c.busy||!text.trim()} onClick={async()=>{if(await c.run('announce',{text}))onClose();}}>发布给全体玩家</Button>}><Field label="公开内容"><textarea rows={5} value={text} onChange={e=>setText(e.target.value)} maxLength={2000} placeholder="例如：请回到座位，进入提名环节。"/></Field></Modal>;}
function Swap({game:g,controller:c,onClose}:{game:Game;controller:RoomController;onClose:()=>void}){const [a,setA]=useState(g.seats[0]?.id||''),[b,setB]=useState(g.seats[1]?.id||'');return <Modal title="交换座位位置" onClose={onClose} footer={<Button variant="primary" disabled={c.busy||a===b} onClick={async()=>{if(await c.run('swap_seats',{a,b}))onClose();}}>交换位置</Button>}><div className="stack"><Alert>玩家的身份、标记、私信和账号仍跟随本人，只交换座次。</Alert>{[a,b].map((value,i)=><Field label={`玩家 ${i+1}`} key={i}><select value={value} onChange={e=>(i===0?setA:setB)(e.target.value)}>{g.seats.map(s=><option key={s.id} value={s.id}>{s.index}. {s.name}</option>)}</select></Field>)}</div></Modal>;}
function GameTimer({game:g,controller:c,mode}:{game:Game;controller:RoomController;mode:'local'|'cloud'}){const [now,setNow]=useState(mode==='cloud'?serverNow():Date.now()),[minutes,setMinutes]=useState(5);useEffect(()=>{const id=setInterval(()=>setNow(mode==='cloud'?serverNow():Date.now()),1000);return ()=>clearInterval(id);},[]);const seconds=Math.ceil(Math.max(0,g.timer.endsAt?g.timer.endsAt-now:g.timer.remaining)/1000);return <div className="game-timer"><strong>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</strong><input type="number" aria-label="计时分钟数" min={1} max={120} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/><small>分</small><Button variant="ghost" disabled={c.busy||g.paused} onClick={()=>c.run('timer',{seconds:g.timer.endsAt?seconds:(seconds||minutes*60),running:!g.timer.endsAt})}>{g.timer.endsAt?<Pause size={16}/>:<Play size={16}/>}</Button><Button variant="ghost" disabled={c.busy||g.paused} aria-label="重设计时" onClick={()=>c.run('timer',{seconds:minutes*60,running:false})}><RotateCw size={15}/></Button><Button variant="ghost" disabled={c.busy||g.paused||seconds>7140} onClick={()=>c.run('timer',{seconds:seconds+60,running:!!g.timer.endsAt})}>+1 分</Button></div>;}
function Handoff({game:g,onClose}:{game:Game;onClose:()=>void}){const [seatId,setSeat]=useState(g.seats[0]?.id||''),[show,setShow]=useState(false);const s=g.seats.find(s=>s.id===seatId),r=findRole(g.script,s?.shownRoleId||'');useEffect(()=>{const hide=()=>setShow(false);window.addEventListener('blur',hide);return ()=>window.removeEventListener('blur',hide);},[]);return <Modal title="本机展示身份" onClose={onClose}><div className="stack"><Alert>此页面在说书人设备上，仅供当面逐人展示。远程私密发牌请使用联机房间。</Alert>{!show&&<Field label="交给哪位玩家查看"><select value={seatId} onChange={e=>setSeat(e.target.value)}>{g.seats.map(s=><option key={s.id} value={s.id}>{s.index}. {s.name}</option>)}</select></Field>}{show?<div className="handoff-card"><h2>{r?.name}</h2><p className={s?.shownAlignment}>{s?.shownAlignment==='good'?'善良阵营':'邪恶阵营'}</p><p>{r?.ability}</p></div>:<div className="handoff-cover"><Eye size={35}/><p>{s?.index} 号 {s?.name}，准备好后查看。</p></div>}<Button variant="primary" onClick={()=>setShow(!show)}>{show?'遮住并交还说书人':'查看身份'}</Button></div></Modal>;}

