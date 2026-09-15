import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Axe, Skull, Shield, Flame, ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, MoreHorizontal, NotebookPen, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useApp } from '../lib/context';
import { CATALOG, TEAMS, TEAM_LABELS, publicGame, uid, type PublicGame, type Role, type RoomView } from '../lib/domain';
import { api, supabase } from '../lib/supabase';
import { localApi, localBackendEnabled } from '../lib/localBackend';
import { download, getLocal, listLocal, navigate, readFile } from '../lib/storage';
import { createNotebook, importNotebook, noteStatus, noteTags, setNoteTags, markAt, playerAnnotations, stateAt, syncPublicRoom, type Notebook, type NoteEntry, type NotePlayer, type RoleMark } from '../lib/notebooks';
import { listNotebooks, loadNotebook, writeDraft, type NotebookContext, type NotebookDraft } from '../lib/notebookStorage';
import { referenceText, editReferenceText, insertSeatReference } from '../lib/noteReferences';
import { useNotebook } from '../lib/useNotebook';
import { Alert, Button, Empty, Field, Modal, RoleToken, Spinner } from '../components/ui';
import { NoteActionComposer } from '../components/NoteActionComposer';
import { noteParticipants, notePlayerLabel, STORYTELLER_ID, applyNoteBroadcast } from '../lib/noteActions';
import { NoteBubble } from '../components/NoteBubble';
import { TownBoard, type DisplaySeat } from '../components/TownBoard';

const now = () => new Date().toISOString();
type Change = (change: (book: Notebook) => Notebook) => void;

async function openRoomNotebook(room: PublicGame, ownerId: string, mode: 'local'|'cloud', mySeatId?: string) {
  const ctx: NotebookContext = { ownerId, mode };
  const cached = await listNotebooks(mode==='local'?undefined:ctx);
  const cachedBook=cached.find(b=>b.room?.id===room.id&&(mode==='local'||b.room.ownerId===ownerId));
  if(cachedBook)return (await loadNotebook(cachedBook.id,ctx))!;
  const books = mode==='cloud'?await listNotebooks(ctx,{strictRemote:true}):cached;
  let book = books.find(b => b.room?.id === room.id && b.room?.ownerId === ownerId);
  if (book) return (await loadNotebook(book.id, ctx))!;
  book = { ...createNotebook(room.title, 7, room.script), players:[], states:[], room: { id: room.id, ownerId, mode } };
  book = syncPublicRoom(book, room, mySeatId);
  if (mode === 'cloud') {
    // The legacy row remains intact; a later successful sync confirms migration.
    if (localBackendEnabled) {
      const old = await localApi<{body:string}>({action:'notes',operation:'get',roomId:room.id});
      if (old.body) book.legacyText = old.body;
    } else {
      const result = await supabase()!.from('bt_notes').select('body').eq('room_id', room.id).eq('user_id', ownerId).maybeSingle();
      if (result.error) throw result.error;
      if (result.data?.body) book.legacyText = result.data.body;
    }
    const oldDraft=sessionStorage.getItem(`bt-note-draft-${room.id}-${ownerId}`);
    if(oldDraft&&oldDraft!==book.legacyText)book.legacyText=[book.legacyText,'本机未同步的旧草稿：',oldDraft].filter(Boolean).join('\n\n');
  }
  return writeDraft(book, ctx);
}

export function RoomNotes({room,mySeatId}:{room:PublicGame;mySeatId:string}) {
  const {user} = useApp();
  const [initial,setInitial] = useState<NotebookDraft>(), [error,setError] = useState('');
  useEffect(() => { let live=true;
    if(user) openRoomNotebook(room,user.id,'cloud',mySeatId).then(d=>{if(live)setInitial(d);}).catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[room.id,user?.id]);
  if(error)return <Alert kind="error">{error}<Button onClick={()=>location.reload()}>重新读取</Button></Alert>;
  if(!initial||!user)return <Spinner/>;
  return <NotebookEditor key={initial.data.id} initial={initial} context={{ownerId:user.id,mode:'cloud'}} room={room} mySeatId={mySeatId} embedded/>;
}

export function Notes({id}:{id?:string}) {
  const {user,scripts,cloud} = useApp();
  const context:NotebookContext={ownerId:user?.id,mode:'cloud'};
  const [books,setBooks]=useState<Notebook[]>([]),[initial,setInitial]=useState<NotebookDraft>(),[error,setError]=useState('');
  const [creating,setCreating]=useState(false),[kind,setKind]=useState<'independent'|'room'>('independent');
  const [title,setTitle]=useState(''),[count,setCount]=useState(7),[scriptId,setScriptId]=useState(''),[archived,setArchived]=useState(false);
  const [rooms,setRooms]=useState<{id:string;title:string;mode:'local'|'cloud'}[]>([]),[busy,setBusy]=useState(false);
  const file=useRef<HTMLInputElement>(null);
  useEffect(()=>{let live=true;setError('');setInitial(undefined);
    (id?loadNotebook(id,context).then(d=>{if(live){setInitial(d);if(!d)setError('未找到这本笔记，请使用原来的浏览器或账号。');}}):listNotebooks(context).then(b=>{if(live)setBooks(b);})).catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[id,user?.id]);
  useEffect(()=>{if(!creating||kind!=='room')return;let live=true;
    Promise.all([listLocal(),cloud&&user?api<{rooms:any[]}>({action:'list'}):Promise.resolve({rooms:[]})]).then(([local,remote])=>{
      if(live)setRooms([...local.map(g=>({id:g.id,title:g.title,mode:'local' as const})),...remote.rooms.filter(r=>r.status==='active').map(r=>({id:r.room_id,title:r.bt_rooms?.title||'房间',mode:'cloud' as const}))]);
    }).catch(e=>setError(e.message));return()=>{live=false;};
  },[creating,kind,user?.id]);
  async function associate(r:{id:string;mode:'local'|'cloud'}) {
    setBusy(true);setError('');
    try {
      const v:RoomView=r.mode==='local'?{kind:'host',game:await getLocal(r.id),members:[]}:await api({action:'get',roomId:r.id});
      if(v.kind==='pending')throw new Error('请先等待入座批准。');
      const room=v.kind==='host'?(v.publicRoom??publicGame(v.game)):v.room;
      const d=await openRoomNotebook(room,user?.id||'device',r.mode,v.kind==='player'?v.personal.seatId:undefined);
      navigate(`/notes/${d.data.id}`);setCreating(false);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function importFile(f?:File){if(!f)return;try{const b=importNotebook(JSON.parse(await readFile(f,1_100_000)));writeDraft(b,context);navigate(`/notes/${b.id}`);}catch(e){setError((e as Error).message);}}
  if(id)return error&&!initial?<main className="page"><Alert kind="error">{error}</Alert><Button onClick={()=>navigate('/notes')}>返回笔记</Button></main>:initial?<NotebookEditor key={`${id}-${user?.id||'device'}`} initial={initial} context={context}/>:<Spinner/>;
  return <main className="page notes-library">
    <div className="section-heading"><div><h1>笔记工具</h1></div><NotebookPen size={28}/></div>
    {error&&<Alert kind="error">{error}</Alert>}
    <div className="row between"><Button variant="primary" onClick={()=>setCreating(true)}><Plus size={17}/>新建笔记</Button><div className="row"><Button variant="ghost" onClick={()=>file.current?.click()}>导入</Button><button className="note-text-button" onClick={()=>setArchived(!archived)}>{archived?'查看进行中':'已归档'}</button></div></div>
    <input hidden ref={file} type="file" accept=".json,application/json" onChange={e=>{void importFile(e.target.files?.[0]);e.target.value='';}}/>
    <div className="notebook-list">{books.filter(b=>b.archived===archived).map(b=><button className="notebook-card" key={b.id} onClick={()=>navigate(`/notes/${b.id}`)}><BookOpen size={25}/><span><strong>{b.title}</strong><small>{b.script?.name||'自由记录'} · {b.players.length} 人 · 第 {b.currentDay} 天</small><small>{b.room?'房间笔记':'此浏览器'} · {new Date(b.updatedAt).toLocaleDateString('zh-CN')}</small></span><ChevronRight size={18}/></button>)}</div>
    {!books.some(b=>b.archived===archived)&&<Empty title={archived?'暂无归档':'尚无定论'}>{archived?'归档的笔记会保留在这里。':'新建笔记，或关联已有房间。'}</Empty>}
    {creating&&<Modal title="新建笔记" onClose={()=>setCreating(false)}>
      <div className="note-segments"><button className={kind==='independent'?'active':''} onClick={()=>setKind('independent')}>独立记录</button><button className={kind==='room'?'active':''} onClick={()=>setKind('room')}>关联我的房间</button></div>
      {kind==='independent'?<div className="stack"><Field label="笔记名称"><input value={title} maxLength={100} placeholder="今晚的钟楼" onChange={e=>setTitle(e.target.value)}/></Field><div className="form-grid"><Field label="普通玩家"><select value={count} onChange={e=>setCount(+e.target.value)}>{Array.from({length:11},(_,i)=>i+5).map(n=><option key={n}>{n}</option>)}</select></Field><Field label="剧本"><select value={scriptId} onChange={e=>setScriptId(e.target.value)}><option value="">暂不选择</option>{scripts.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div><Button className="full" variant="primary" onClick={()=>{try{const b=createNotebook(title.trim()||'今晚的钟楼',count,scripts.find(s=>s.id===scriptId));writeDraft(b,context);navigate(`/notes/${b.id}`);setCreating(false);}catch(e){setError((e as Error).message);}}}>开始记录<ArrowRight size={17}/></Button><small className="muted">保存在此浏览器，无需登录。旅行者可在桌面中添加。</small></div>:<div className="stack">{rooms.map(r=><Button disabled={busy} key={`${r.mode}-${r.id}`} onClick={()=>void associate(r)}>{r.title}<ChevronRight size={16}/></Button>)}{!rooms.length&&<p className="muted">还没有可关联的房间。加入房间并入座后即可使用。</p>}</div>}
    </Modal>}
  </main>;
}

function NotebookEditor({initial,context,room:providedRoom,mySeatId,embedded=false}:{initial:NotebookDraft;context:NotebookContext;room?:PublicGame;mySeatId?:string;embedded?:boolean}) {
  const {book,update,error,dirty,saving,retry,remove}=useNotebook(initial,context);
  const day=book.currentDay;
  const [selected,setSelected]=useState<string>(),[menu,setMenu]=useState(false),[editing,setEditing]=useState<string>();
  const [roomError,setRoomError]=useState('');
  const [configuration,setConfiguration]=useState(false),[broadcast,setBroadcast]=useState(false);
  const snapshot=useRef(book);snapshot.current=book;
  const sync=(r:PublicGame,seat?:string)=>update(b=>{const next=syncPublicRoom(b,r,seat);return JSON.stringify(next)===JSON.stringify(b)?b:next;});
  useEffect(()=>{if(providedRoom)sync(providedRoom,mySeatId);},[providedRoom,mySeatId]);
  useEffect(()=>{if(!book.room||providedRoom)return;let live=true,working=false;
    const refresh=async()=>{if(working||document.visibilityState==='hidden')return;working=true;try{const link=snapshot.current.room!;const v:RoomView=link.mode==='local'?{kind:'host',game:await getLocal(link.id),members:[]}:await api({action:'get',roomId:link.id});if(!live)return;if(v.kind==='pending')throw new Error('尚未入座，不能同步房间。');sync(v.kind==='host'?(v.publicRoom??publicGame(v.game)):v.room,v.kind==='player'?v.personal.seatId:undefined);setRoomError('');}catch(e){if(live)setRoomError((e as Error).message);}finally{working=false;}};
    void refresh();const t=setInterval(()=>void refresh(),3000);return()=>{live=false;clearInterval(t);};
  },[book.room?.id,providedRoom!==undefined]);
  const visible=visiblePlayers(book,day);
  const seats:DisplaySeat[]=visible.map(p=>{
    const annotation=playerAnnotations(book,p.id,day),state=stateAt(book,p.id,day),status=noteStatus(book,p.id,day);
    return {id:p.id,index:p.index,name:`${p.name}${book.myPlayerId===p.id?' · 我':''}`,alive:status.alive,executed:status.executed,voteAvailable:status.voteAvailable,left:state?.left??false,traveller:p.traveller,alignment:annotation.extras.includes('邪恶')?'evil':annotation.extras.includes('善良')||annotation.extras.includes('正义')?'good':undefined,role:annotation.primary?roleName(book,annotation.primary):undefined,roleData:[...bRoles(book)].find(r=>r.id===annotation.primary),marks:noteTags(book,p.id,day).filter(v=>!['死亡','处决','死者票已用','善良','正义','邪恶'].includes(v)).map(v=>roleName(book,v))};
  });
  const rotation=((book.tableRotation??0)%seats.length+seats.length)%seats.length||0;
  const arrangedSeats=[...seats.slice(rotation),...seats.slice(0,rotation)];
  const rotate=(step:number)=>update(b=>({...b,tableRotation:((b.tableRotation??0)+step+seats.length)%seats.length}));
  function addEntry(kind:NoteEntry['kind'],playerId?:string){const id=uid();update(b=>({...b,entries:[...b.entries,{id,day,phase:b.phase,kind,playerId,text:'',important:false,createdAt:now()}]}));setEditing(id);}
  const person=noteParticipants(book).find(p=>p.id===selected)||book.players.find(p=>p.id===selected);
  function selectPlayer(id:string){if(id===STORYTELLER_ID&&!book.players.some(p=>p.id===id))update(b=>({...b,players:[...b.players,noteParticipants(b).find(p=>p.id===id)!]}));setSelected(id);}
  const back=()=>navigate(book.room?`/${book.room.mode}/${book.room.id}`:'/notes');
  return <main className={`notebook-page ${embedded?'embedded':''}`}>
    <header className="notebook-heading"><Button variant="ghost" aria-label="返回" onClick={back}><ArrowLeft size={20}/></Button><div><h1>{book.title}</h1><small role="status">{error?'保存遇到问题':saving?'正在同步…':dirty?'已保存在此设备，待同步':'已保存'} · 仅自己可见</small></div><Button variant="ghost" aria-label="笔记选项" onClick={()=>setMenu(true)}><MoreHorizontal size={22}/></Button></header>
    {error&&<Alert kind="error">{error}<div className="row"><Button onClick={retry}>重试同步</Button><Button onClick={()=>navigate('/notes')}>查看保留的笔记</Button></div></Alert>}
    {roomError&&<Alert>房间暂未同步：{roomError} 已保存的笔记仍可继续记录。</Alert>}
    <div className="note-script-heading"><span>{book.script?.name||'未选择剧本'}</span><button className="note-text-button" onClick={()=>setConfiguration(true)}>本局配置</button></div>
    <div className="notebook-workspace"><div className="notebook-table-column"><div className="notebook-table"><div className="note-table-controls"><button aria-label="逆时针旋转座位" onClick={()=>rotate(1)}>↶ 旋转</button><button aria-label="顺时针旋转座位" onClick={()=>rotate(-1)}>旋转 ↷</button></div><TownBoard compactNotes onStoryteller={()=>selectPlayer(STORYTELLER_ID)} showAllMarks seats={arrangedSeats} phase="day" round={day} centerAction={<><Button className="note-next-day" disabled={!!book.room||book.currentDay>=365} title={book.room?'关联笔记的日期随房间同步':undefined} onClick={()=>update(b=>({...b,currentDay:b.currentDay+1,phase:'day'}))}>{book.room?'随房间进入下一天':'进入下一天'}</Button><Button className="note-next-day" onClick={()=>setBroadcast(true)}>添加广播信息</Button></>} selected={selected} onSelect={id=>{selectPlayer(id);setEditing(undefined);}}/></div>
      <section className="note-general">
        <div className="note-section-heading"><h2>笔记工具</h2><Button variant="ghost" onClick={()=>addEntry('free')}><Plus size={16}/>记一条</Button></div>
        <div className="note-general-scroll"><GroupedEntries book={book} entries={book.entries.filter(e=>e.kind!=='player')} update={update} editing={editing} setEditing={setEditing} onPlayer={selectPlayer}/></div>
      </section>
    </div>
    {!person&&<aside className="note-desktop-hint"><NotebookPen size={30}/><h2>点一位玩家</h2><p>标记角色与状态，查看和补充信息。</p></aside>}
    {person&&<PlayerPanel key={person.id} player={person} book={book} day={day} update={update} editing={editing} setEditing={setEditing} onPlayer={selectPlayer} onClose={()=>{setSelected(undefined);setEditing(undefined);}} onAdd={()=>addEntry('player',person.id)}/>}
    </div>
    {configuration&&<NotebookConfiguration book={book} onClose={()=>setConfiguration(false)}/>}
    {broadcast&&<NoteActionComposer book={book} title="添加广播信息" submitLabel="添加到相关人物和主笔记" onClose={()=>setBroadcast(false)} onGenerate={(text,ids)=>{update(b=>applyNoteBroadcast(b,text,ids));setBroadcast(false);}}/>}
    {menu&&<NotebookOptions book={book} update={update} remove={remove} onClose={()=>setMenu(false)} embedded={embedded}/>}
  </main>;
}

function bRoles(book:Notebook){return [...book.script?.roles||[],...CATALOG];}
function roleName(book:Notebook,value:string){return book.script?.roles.find(r=>r.id===value)?.name||CATALOG.find(r=>r.id===value)?.name||value;}
function markLabel(book:Notebook,mark?:RoleMark){return mark?.roles.length?mark.roles.map(r=>roleName(book,r)).join(' / '):'未标记';}
function visiblePlayers(book:Notebook,day:number){return book.players.filter(p=>p.id!==STORYTELLER_ID&&(p.joinedDay??1)<=day&&!(stateAt(book,p.id,day)?.left??p.left??false)).map(p=>{const state=stateAt(book,p.id,day);return {...p,index:state?.index??p.index,name:p.noteName??state?.name??p.name};}).sort((a,b)=>a.index-b.index);}

function PlayerPanel({player,book,day,update,editing,setEditing,onPlayer,onClose,onAdd}:{player:NotePlayer;book:Notebook;day:number;update:Change;editing?:string;setEditing:(id?:string)=>void;onPlayer:(id:string)=>void;onClose:()=>void;onAdd:()=>void}) {
  const [pick,setPick]=useState<{kind:RoleMark['kind'];editId?:string}>(),[renaming,setRenaming]=useState(false),[nameDraft,setNameDraft]=useState(player.name);
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{const old=document.activeElement as HTMLElement|null,before=document.body.style.overflow,mobile=matchMedia('(max-width:700px)').matches;
    if(mobile)document.body.style.overflow='hidden';panel.current?.focus();
    const resize=()=>{const viewport=window.visualViewport;panel.current?.style.setProperty('--note-viewport-height',`${viewport?.height??innerHeight}px`);panel.current?.style.setProperty('--note-keyboard-offset',`${Math.max(0,innerHeight-(viewport?.height??innerHeight)-(viewport?.offsetTop??0))}px`);};
    resize();window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
    const key=(e:KeyboardEvent)=>{if(document.querySelector('.modal-overlay'))return;if(e.key==='Escape')onClose();if(e.key==='Tab'&&mobile){const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea,select,summary')||[]).filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);if(mobile)document.body.style.overflow=before;old?.focus();};},[]);
  const annotation=playerAnnotations(book,player.id,day);
  const entries=book.entries.filter(e=>e.playerId===player.id);
  function move(offset:number){const visible=noteParticipants(book,day),i=visible.findIndex(p=>p.id===player.id);if(visible.length)onPlayer(visible[(i+offset+visible.length)%visible.length].id);setEditing(undefined);}
  function rename(){const name=nameDraft.trim();if(name)update(b=>({...b,players:b.players.map(p=>p.id===player.id?{...p,noteName:name}:p)}));setRenaming(false);}
  return <><div className="note-panel-backdrop" onClick={onClose}/><aside ref={panel} tabIndex={-1} className="note-player-panel" aria-label={`${player.index} 号玩家笔记`}>
    <header><Button variant="ghost" aria-label="上一位" onClick={()=>move(-1)}><ChevronLeft size={20}/></Button><div className="note-player-identity"><span>{player.index}</span>{renaming?<input className="note-player-name" aria-label="玩家姓名" autoFocus maxLength={40} value={nameDraft} onChange={e=>setNameDraft(e.target.value)} onBlur={rename} onKeyDown={e=>{if(e.key==='Enter')rename();if(e.key==='Escape'){e.stopPropagation();setRenaming(false);}}}/>:<button className="note-player-name" aria-label="修改玩家姓名" onClick={()=>{setNameDraft(player.name);setRenaming(true);}}>{player.name}</button>}<button className="note-header-role" aria-label="修改主身份" onClick={()=>setPick({kind:'primary'})}>{annotation.primary?roleName(book,annotation.primary):'标记身份'}</button></div><Button variant="ghost" aria-label="下一位" onClick={()=>move(1)}><ChevronRight size={20}/></Button><Button variant="ghost" aria-label="关闭玩家笔记" onClick={onClose}><X size={20}/></Button></header>
    <div className="note-player-body">
      <button className="note-extra-line" aria-label="修改标签" onClick={()=>setPick({kind:'extra'})}>{noteTags(book,player.id,day).length?noteTags(book,player.id,day).map(v=><span key={v}><NoteTagLabel label={roleName(book,v)}/></span>):'＋ 标签'}</button>
      <GroupedEntries book={book} entries={entries} update={update} editing={editing} setEditing={setEditing} onPlayer={onPlayer}/>
    </div><footer>{entries.some(e=>e.id===editing)?<Button variant="primary" className="full" onClick={()=>setEditing(undefined)}>完成记录</Button>:<Button variant="primary" className="full" onClick={onAdd}><Plus size={17}/>记一条信息</Button>}</footer>
  </aside>{pick&&<RolePicker book={book} playerId={player.id} day={day} kind={pick.kind} editId={pick.editId} update={update} onClose={()=>setPick(undefined)}/>}</>;
}

function RolePicker({book,playerId,day,kind,editId,update,onClose}:{book:Notebook;playerId:string;day:number;kind:RoleMark['kind'];editId?:string;update:Change;onClose:()=>void}) {
  const annotation=playerAnnotations(book,playerId,day),multi=kind!=='primary';
  const [chosen,setChosen]=useState<string[]>(kind==='extra'?noteTags(book,playerId,day):annotation.primary?[annotation.primary]:[]);
  const [query,setQuery]=useState(''),[identities,setIdentities]=useState(kind!=='extra'),[custom,setCustom]=useState(''),[ability,setAbility]=useState<Role>();
  const availableRoles=book.script?.roles??CATALOG;
  const roles=availableRoles.filter(r=>r.name.includes(query)||r.id.includes(query.toLowerCase()));
  const quick=['死亡','处决','死者票已用','醉酒','中毒','善良','邪恶'];
  function commit(values:string[]){update(b=>kind==='extra'?setNoteTags(b,playerId,day,values):({...b,marks:editId?b.marks.map(m=>m.id===editId?{...m,roles:values}:m):[...b.marks,{id:uid(),playerId,day,phase:b.phase,kind,roles:values,createdAt:now()}]}));onClose();}
  function choose(value:string){if(!multi){commit([value]);return;}setChosen(v=>v.includes(value)?v.filter(x=>x!==value):[...v,value]);}
  return <Modal title={kind==='extra'?'标签':'身份标签'} onClose={onClose} footer={<div className="row between"><Button variant="ghost" onClick={()=>commit([])}>清空标记</Button>{multi&&<Button variant="primary" onClick={()=>commit(chosen)}>完成</Button>}</div>}>
    {kind==='extra'&&<><div className="note-quick">{quick.map(v=><button key={v} aria-pressed={chosen.includes(v)} onClick={()=>choose(v)}>{chosen.includes(v)?'✓ ':''}<NoteTagLabel label={v}/></button>)}</div><Button className="full" aria-expanded={identities} onClick={()=>setIdentities(!identities)}>身份标签{chosen.filter(v=>availableRoles.some(r=>r.id===v)).length?` · ${chosen.filter(v=>availableRoles.some(r=>r.id===v)).length}`:''}</Button></>}
    {identities&&<><label className="note-search"><Search size={17}/><input aria-label="搜索角色" value={query} maxLength={100} placeholder={book.script?'搜索本剧本角色':'搜索全部角色'} onChange={e=>setQuery(e.target.value)}/></label>{TEAMS.map(team=>{const group=roles.filter(r=>r.team===team);return group.length?<section key={team}><h3 className="note-team-heading">{TEAM_LABELS[team]}</h3><div className="note-role-picker">{group.map(r=><div key={r.id}><button aria-pressed={chosen.includes(r.id)} className={chosen.includes(r.id)?'selected':''} onClick={()=>choose(r.id)}><span>{chosen.includes(r.id)?'✓ ':''}{r.name}</span></button><button aria-label={`查看${r.name}能力`} className="note-role-help" onClick={()=>setAbility(ability?.id===r.id?undefined:r)}>?</button>{ability?.id===r.id&&<p>{r.ability}</p>}</div>)}</div></section>:null;})}</>}
    {kind==='extra'&&<><Field label="自定义标签"><div className="row"><input aria-label="自定义标签" value={custom} maxLength={80} placeholder="自由输入标签" onChange={e=>setCustom(e.target.value)}/><Button disabled={!custom.trim()} onClick={()=>{setChosen(v=>[...new Set([...v,custom.trim()])]);setCustom('');}}>添加</Button></div></Field><div className="note-quick">{chosen.filter(v=>!quick.includes(v)&&!availableRoles.some(r=>r.id===v)).map(v=><button key={v} aria-pressed onClick={()=>choose(v)}>✓ {roleName(book,v)}</button>)}</div></>}
  </Modal>;
}

function NoteTagLabel({label}:{label:string}) {const Icon=label==='死亡'?Skull:label==='处决'?Axe:['善良','正义'].includes(label)?Shield:label==='邪恶'?Flame:undefined;return <>{Icon&&<Icon size={12} aria-hidden/>}{label}</>;}

function NotebookConfiguration({book,onClose}:{book:Notebook;onClose:()=>void}) {
 return <Modal title="本局配置" onClose={onClose}><p className="muted">{book.script?.name||'尚未选择剧本'}</p>{TEAMS.map(team=>{const roles=book.script?.roles.filter(r=>r.team===team)||[];return roles.length?<section key={team}><h3 className="note-team-heading">{TEAM_LABELS[team]} · {roles.length}</h3><div className="note-config-roles">{roles.map(r=><div key={r.id} className="note-config-role"><RoleToken role={r} small/><div><strong>{r.name}</strong><p>{r.ability||'暂无能力说明'}</p></div></div>)}</div></section>:null;})}</Modal>;
}

function markKindLabel(kind:RoleMark['kind']){return {claim:'原声明',guess:'原猜测',primary:'主角色',extra:'额外状态'}[kind];}

function GroupedEntries(props:Parameters<typeof EntryList>[0]) {
  const days=Array.from(new Set(props.entries.map(e=>e.day))).sort((a,b)=>b-a);
  return <>{!days.length&&<p className="note-empty">暂无记录。</p>}{days.map(day=><section className="note-day-group" key={day}><h3>第 {day} 天{day===props.book.currentDay?' · 当天':''}</h3>{(['night','day'] as const).filter(phase=>props.entries.some(e=>e.day===day&&e.phase===phase)).map(phase=><section className="note-phase-group" key={phase}><h4>{phase==='night'?'夜晚':'白天'}</h4><EntryList {...props} colorOffset={props.entries.filter(e=>e.day>day||(e.day===day&&phase==='day'&&e.phase==='night')).length} entries={props.entries.filter(e=>e.day===day&&e.phase===phase)}/></section>)}</section>)}</>;
}

function EntryList({book,entries,update,editing,setEditing,onPlayer,colorOffset=0}:{book:Notebook;entries:NoteEntry[];colorOffset?:number;update:Change;editing?:string;setEditing:(id?:string)=>void;onPlayer:(id:string)=>void}) {
  const [actionId,setActionId]=useState<string>();
  const action=entries.find(e=>e.id===actionId&&!e.sourceId);
  const sorted=[...entries].sort((a,b)=>Number(b.important)-Number(a.important)||a.createdAt.localeCompare(b.createdAt));
  return <><div className="note-entries">{!sorted.length&&<p className="note-empty">暂无记录。</p>}{sorted.map((entry,index)=>editing===entry.id&&!entry.sourceId?<EntryInput tone={(colorOffset+index)%3} key={entry.id} entry={entry} book={book} update={update} done={()=>setEditing(undefined)}/>:<NoteBubble onActions={entry.sourceId?undefined:()=>setActionId(entry.id)} key={entry.id} className={`note-entry note-tone-${(colorOffset+index)%3} ${entry.important?'important':''} ${entry.sourceId?'system':''}`}>{entry.sourceId&&<small className="note-source">房间公开记录</small>}{entry.important&&<Star className="note-important-icon" aria-label="重点" size={13} fill="currentColor"/>}<p>{entry.text?<SeatReferences text={entry.text} players={noteParticipants(book)} onPlayer={onPlayer}/>:<span className="muted">空白草稿</span>}</p></NoteBubble>)}</div>{action&&<Modal title="这条笔记" onClose={()=>setActionId(undefined)}><div className="stack"><Button onClick={()=>{update(b=>({...b,entries:b.entries.map(e=>e.id===action.id?{...e,important:!e.important}:e)}));setActionId(undefined);}}><Star size={16}/>{action.important?'取消重点':'标记重点'}</Button><Button onClick={()=>{setEditing(action.id);setActionId(undefined);}}>编辑</Button><Button variant="danger" onClick={()=>{{update(b=>({...b,entries:b.entries.filter(e=>e.id!==action.id)}));setActionId(undefined);}}}><Trash2 size={16}/>删除</Button></div></Modal>}</>;
}

function EntryInput({entry,book,update,done,tone=0}:{tone?:number;entry:NoteEntry;book:Notebook;update:Change;done:()=>void}) {
  const input=useRef<HTMLTextAreaElement>(null);
  const [generating,setGenerating]=useState(false);
  useEffect(()=>{input.current?.focus();},[]);
  const edit=(text:string)=>update(b=>({...b,entries:b.entries.map(e=>e.id===entry.id?{...e,text}:e)}));
  return <div className={`note-entry-editor note-tone-${tone}`}><div className="row between"><select aria-label="记录日期" value={entry.day} onChange={e=>update(b=>({...b,entries:b.entries.map(x=>x.id===entry.id?{...x,day:Number(e.target.value)}:x)}))}>{Array.from({length:book.currentDay},(_,i)=>i+1).map(d=><option key={d} value={d}>第 {d} 天{d===book.currentDay?'（当天）':''}</option>)}</select><select aria-label="记录时段" value={entry.phase} onChange={e=>update(b=>({...b,entries:b.entries.map(x=>x.id===entry.id?{...x,phase:e.target.value as 'day'|'night'}:x)}))}><option value="night">夜晚</option><option value="day">白天</option></select></div><textarea ref={input} aria-label="信息内容" value={referenceText(entry.text)} maxLength={10000} placeholder="他说了什么？或记下你的想法…" onChange={e=>edit(editReferenceText(entry.text,e.target.value))}/><div className="note-seat-insert" aria-label="插入座位引用">{noteParticipants(book,entry.day).map(p=><button key={p.id} onPointerDown={e=>e.preventDefault()} onClick={()=>{const el=input.current,start=el?.selectionStart??referenceText(entry.text).length,end=el?.selectionEnd??start,label=notePlayerLabel(p);edit(insertSeatReference(entry.text,start,end,label,p.id));requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+label.length,start+label.length);});}}>{notePlayerLabel(p)}</button>)}</div><div className="row between"><Button onClick={()=>setGenerating(true)}>动作生成</Button><Button onClick={done}>完成</Button></div>{generating&&<NoteActionComposer book={book} day={entry.day} initialPlayerId={entry.playerId} title="生成一条笔记" submitLabel="填入这条笔记" onClose={()=>setGenerating(false)} onGenerate={(text)=>{edit(entry.text?`${entry.text}\n${text}`:text);setGenerating(false);}}/>}</div>;
}

function SeatReferences({text,players,onPlayer}:{text:string;players:NotePlayer[];onPlayer:(id:string)=>void}) {
  const nodes:ReactNode[]=[];const re=/@\[([^\]]+)\]\(([^)]+)\)/g;let start=0;for(const match of text.matchAll(re)){nodes.push(text.slice(start,match.index));const p=players.find(x=>x.id===match[2]);nodes.push(p?<button key={`${match.index}-${p.id}`} className="note-reference" onClick={()=>onPlayer(p.id)}>{notePlayerLabel(p)}</button>:match[1]);start=match.index!+match[0].length;}nodes.push(text.slice(start));return <>{nodes}</>;
}

function NotebookOptions({book,update,remove,onClose,embedded}:{book:Notebook;update:Change;remove:()=>Promise<void>;onClose:()=>void;embedded:boolean}) {
  const {scripts}=useApp();const [error,setError]=useState('');
  function addTraveller(){update(b=>{const id=uid(),index=Math.max(0,...b.players.map(p=>p.index))+1;return {...b,players:[...b.players,{id,index,name:'旅行者',traveller:true,joinedDay:b.currentDay}],states:[...b.states,{id:uid(),playerId:id,day:b.currentDay,phase:b.phase,alive:true,voteAvailable:true,left:false,index,name:'旅行者',createdAt:now()}]};});onClose();}
  return <Modal title="笔记选项" onClose={onClose}><div className="stack">
    {error&&<Alert kind="error">{error}</Alert>}
    <Field label="笔记名称"><input value={book.title} maxLength={100} onChange={e=>update(b=>({...b,title:e.target.value}))}/></Field>
    {!book.room&&<><Field label="剧本"><select value={book.script?.id||''} onChange={e=>update(b=>({...b,script:scripts.find(s=>s.id===e.target.value)}))}><option value="">暂不选择</option>{scripts.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><div className="field"><span>当前天数</span><div className="row"><span>第 {book.currentDay} 天</span><Button disabled={book.currentDay>=365} onClick={()=>update(b=>({...b,currentDay:b.currentDay+1,phase:'day'}))}>进入下一天</Button></div></div><Field label="当前时段"><select value={book.phase} onChange={e=>update(b=>({...b,phase:e.target.value as 'day'|'night'}))}><option value="day">白天</option><option value="night">夜晚</option></select></Field><Button disabled={book.players.filter(p=>!p.left).length>=20} onClick={addTraveller}>添加旅行者</Button></>}
    <Button onClick={()=>{download(`${book.title}-私人笔记.json`,book);}}>导出私人笔记</Button>
    <Button onClick={()=>{update(b=>({...b,archived:!b.archived}));onClose();}}>{book.archived?'取消归档':'归档笔记'}</Button>
    {embedded&&<Button onClick={()=>navigate(`/notes/${book.id}`)}>在笔记工具中打开</Button>}
    {book.legacyText&&<details><summary>未分日旧笔记</summary><p className="note-legacy">{book.legacyText}</p></details>}
    {book.players.some(p=>p.left)&&<details><summary>已替换参与者的记录</summary>{book.players.filter(p=>p.left).map(p=><section key={p.id}><h3>{p.index} {p.name}</h3>{book.marks.filter(m=>m.playerId===p.id).map(m=><p key={m.id}>第{m.day}天 · {markKindLabel(m.kind)}：{markLabel(book,m)}</p>)}{book.entries.filter(e=>e.playerId===p.id).map(e=><p key={e.id}>第{e.day}天 · {e.text}</p>)}</section>)}</details>}
    <Button variant="danger" onClick={async()=>{try{await remove();navigate('/notes');}catch(e){setError((e as Error).message);}}}>删除笔记</Button>
  </div></Modal>;
}



