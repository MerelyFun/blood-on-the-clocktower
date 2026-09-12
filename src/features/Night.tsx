import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Circle, Plus, Send, Moon } from 'lucide-react';
import { findRole, type Game } from '../lib/domain';
import type { Run } from '../lib/useRoom';
import { Alert, Button, Empty, Field, Modal, NoteEditor, SeatChecks } from '../components/ui';
import { MessageComposer } from './Messages';
export function Night({game:g,run,busy,compact=false}:{game:Game;run:Run;busy:boolean;compact?:boolean}){
 const tasks=[...g.nightTasks].sort((a,b)=>a.order-b.order),[selected,setSelected]=useState(''),[add,setAdd]=useState(false),[message,setMessage]=useState(false);
 const task=tasks.find(t=>t.id===selected)||tasks.find(t=>!t.done)||tasks[0];
 const taskIndex=tasks.findIndex(t=>t.id===task?.id),completed=tasks.filter(t=>t.done).length;
 const s=g.seats.find(s=>s.id===task?.seatId);
 const role=s?findRole(g.script,['drunk','marionette'].includes(s.roleId)?s.shownRoleId:s.roleId):null;
 return <section className={`night-panel ${compact?'compact':''}`}>
  <div className="section-heading"><div><h2>夜间行动</h2><p>{completed} / {tasks.length} 已完成</p></div><Button variant="ghost" onClick={()=>setAdd(true)} aria-label="添加夜间任务"><Plus size={19}/></Button></div>
  {g.phase!=='night'&&<p className="hint">当前为{g.phase==='setup'?'准备阶段':g.phase==='day'?'白天':'已结束'}，{g.phase==='setup'?'发牌后生成首夜清单。':'可查看上一夜记录。'}</p>}
  {!tasks.length?<Empty title="暂时没有夜间任务" icon={<Moon size={30}/>}>发牌后将生成首夜清单，也可手动添加。</Empty>:<div className="night-layout">
   <div className="night-mobile-picker">
    <Button variant="ghost" aria-label="上一项夜间任务" disabled={taskIndex<=0} onClick={()=>setSelected(tasks[taskIndex-1].id)}><ChevronLeft size={18}/></Button>
    <select aria-label={`选择夜间任务，已完成 ${completed} / ${tasks.length}`} value={task?.id||''} onChange={e=>setSelected(e.target.value)}>{tasks.map((t,i)=><option key={t.id} value={t.id}>{i+1} / {tasks.length} · {t.done?'✓ ':''}{t.label}</option>)}</select>
    <Button variant="ghost" aria-label="下一项夜间任务" disabled={taskIndex>=tasks.length-1} onClick={()=>setSelected(tasks[taskIndex+1].id)}><ChevronRight size={18}/></Button>
   </div>
   <div className="night-tasks">{tasks.map((t,i)=>{const player=g.seats.find(s=>s.id===t.seatId);return <div className={`night-task ${task?.id===t.id?'selected':''} ${t.done?'done':''}`} key={t.id}><button className="task-select" onClick={()=>setSelected(t.id)}><span className="task-order">{i+1}</span><span><strong>{t.label}</strong><small>{player?`${player.index} 号 ${player.name}${!player.alive?' · 已死，检查触发':''}`:'说书人检查项'}</small></span></button><button className="check-button" aria-label={t.done?'取消完成':'标记完成'} disabled={busy} onClick={()=>run('task_update',{id:t.id,done:!t.done})}>{t.done?<Check size={20}/>:<Circle size={19}/>}</button></div>;})}</div>
   {task&&<div className="task-detail" key={task.id}>
    <div className="row between"><h3>{task.label}</h3><small className="muted">{task.done?'已完成':'待处理'}</small></div>
    {s&&<small className="task-player muted">{s.index} 号 · {s.name}</small>}
    {role&&<p>{g.round===1?(role.firstNightReminder||role.ability):(role.otherNightReminder||role.ability)}</p>}
    {s&&<div className="chips">{g.reminders.filter(m=>m.target===s.id).map(m=><span className="chip gold" key={m.id}>{m.label}</span>)}</div>}
    {s&&!s.alive&&<Alert>实际已死亡。死亡触发或恢复能力是否行动，由你裁定。</Alert>}
    {task.note&&<p className="pre-wrap task-note-preview">{task.note}</p>}
    <div className="night-task-actions"><Button disabled={busy||g.phase==='setup'} onClick={()=>setMessage(true)}><Send size={16}/> 发送私密信息</Button><Button variant={task.done?'secondary':'primary'} disabled={busy} onClick={()=>run('task_update',{id:task.id,done:!task.done})}>{task.done?'重新打开此任务':'完成此任务'}</Button></div>
    <details className="task-targets"><summary>记录行动目标{task.targets.length?`（${task.targets.length} 人）`:''}</summary><SeatChecks seats={g.seats.filter(s=>!s.left)} selected={task.targets} onChange={targets=>{void run('task_update',{id:task.id,targets});}}/></details>
    <details className="task-records"><summary>行动记录与顺序{task.note?' · 已有记录':''}</summary><NoteEditor value={task.note} label="夜间行动记录" placeholder="记录选择、给出的信息与裁定…" onSave={note=>run('task_update',{id:task.id,note})}/><label className="order-field">执行顺序 <input aria-label="任务顺序" type="number" min={0} max={10000} defaultValue={task.order} onBlur={e=>{if(Number(e.target.value)!==task.order)void run('task_update',{id:task.id,order:Number(e.target.value)});}}/></label></details>
    <small className="muted block">醉酒、中毒不会自动跳过；能力是否生效由说书人裁定。</small>
   </div>}
  </div>}
  {add&&<AddTask game={g} run={run} busy={busy} onClose={()=>setAdd(false)}/>} {message&&<MessageComposer game={g} run={run} busy={busy} initialSeat={task?.seatId} onClose={()=>setMessage(false)}/>}
 </section>;
}
function AddTask({game:g,run,busy,onClose}:{game:Game;run:Run;busy:boolean;onClose:()=>void}){const [label,setLabel]=useState(''),[seatId,setSeatId]=useState(''),[order,setOrder]=useState(500);return <Modal title="插入手动夜间任务" onClose={onClose} footer={<Button variant="primary" disabled={busy||!label.trim()} onClick={async()=>{if(await run('task_add',{label,seatId,order}))onClose();}}>添加任务</Button>}><div className="stack"><Field label="任务名称"><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="例如：死亡触发 / 新角色能力" maxLength={100}/></Field><Field label="关联玩家"><select value={seatId} onChange={e=>setSeatId(e.target.value)}><option value="">说书人检查项</option>{g.seats.map(s=><option key={s.id} value={s.id}>{s.index}. {s.name}</option>)}</select></Field><Field label="排序值（小的先执行）"><input type="number" min={0} max={10000} value={order} onChange={e=>setOrder(Number(e.target.value))}/></Field></div></Modal>;}

