import { artUrl } from './lib/art';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { BookOpen, ChevronLeft, Home as HomeIcon, NotebookPen, Settings2, UserRound } from 'lucide-react';
import { AppProvider } from './lib/context';
import { navigate } from './lib/storage';
import { useRoom } from './lib/useRoom';
import { Alert, Button, Spinner } from './components/ui';
import { Home } from './features/Home';
import { Scripts } from './features/Scripts';
import { Settings } from './features/Settings';
import { Host } from './features/Host';
import { Player } from './features/Player';
import { Notes } from './features/Notes';
function Router(){const [hash,setHash]=useState(location.hash||'#/');useEffect(()=>{const f=()=>{setHash(location.hash||'#/');window.scrollTo(0,0);};window.addEventListener('hashchange',f);return ()=>window.removeEventListener('hashchange',f);},[]);const [path,query='']=hash.slice(1).split('?');const parts=path.split('/').filter(Boolean);const inRoom=['local','cloud'].includes(parts[0])&&!!parts[1];
 return <><header className={`app-header ${inRoom?'in-room':''}`}><button className="brand" onClick={()=>navigate('/')} aria-label="返回首页"><span className="brand-mark"><img src={artUrl('art/brand/clocktower-emblem.webp')} alt="" width={42} height={42}/></span><span>血染钟楼</span></button><nav>{inRoom?<Button variant="ghost" onClick={()=>navigate('/')}><ChevronLeft size={16}/> 首页</Button>:<><button className={!parts[0]||parts[0]==='join'?'active':''} onClick={()=>navigate('/')}><HomeIcon size={16}/> 房间</button><button className={parts[0]==='scripts'?'active':''} onClick={()=>navigate('/scripts')}><BookOpen size={16}/> 剧本工坊</button><button className={parts[0]==='notes'?'active':''} onClick={()=>navigate('/notes')}><NotebookPen size={16}/> 笔记工具</button><button className={parts[0]==='settings'?'active':''} onClick={()=>navigate('/settings')} aria-label="设置与账号"><Settings2 size={16}/> 设置</button></>}</nav></header>{inRoom?<RoomPage key={`${parts[0]}-${parts[1]}`} mode={parts[0] as 'local'|'cloud'} id={parts[1]}/>:parts[0]==='scripts'?<Scripts/>:parts[0]==='notes'?<Notes key={parts[1]||'list'} id={parts[1]}/>:parts[0]==='settings'?<Settings/>:<Home key={hash} joinCode={new URLSearchParams(query).get('code')||''}/>} {!inRoom&&<footer className="app-footer"><span>血染钟楼 · 说书人与玩家工具</span><button onClick={()=>navigate('/settings')}>内容来源与设置</button></footer>}</>;
}
function RoomPage({mode,id}:{mode:'local'|'cloud';id:string}){const c=useRoom(mode,id),v=c.view;return <><div className="room-feedback">{c.error&&<Alert kind="error"><span>{c.error}</span><div className="row wrap"><Button variant="ghost" disabled={c.busy} onClick={()=>c.refresh()}>刷新状态</Button>{c.uncertain&&<Button disabled={c.busy} onClick={()=>c.retry()}>安全重试上次提交</Button>}<Button variant="ghost" onClick={()=>c.setError('')}>收起提示</Button></div></Alert>}{c.busy&&<div className="saving" role="status">正在保存操作…</div>}</div>{!v?c.error?<main className="page"><Button onClick={()=>navigate('/')}>返回房间入口</Button></main>:<Spinner/>:v.kind==='pending'?<main className="waiting-room page"><div className="waiting-orbit"><UserRound size={42}/></div><h1>等待说书人安排入座</h1><p>已经向“{v.title}”发送申请。</p><p className="muted">批准后会自动进入你的座位，请保持页面打开。</p><Button onClick={()=>c.refresh()}>刷新加入状态</Button></main>:v.kind==='host'?<Host game={v.game} controller={c} mode={mode}/>:<Player room={v.room} personal={v.personal} run={c.run} busy={c.busy}/>}</>;}
class ErrorBoundary extends Component<{children:ReactNode},{error:Error|null}>{state={error:null as Error|null};static getDerivedStateFromError(error:Error){return {error};}render(){if(this.state.error)return <main className="page"><h1>页面暂时无法继续</h1><p>已保存的对局不会因页面错误被删除。重新打开后会尝试恢复。</p><Button onClick={()=>{location.hash='/';location.reload();}}>返回房间入口</Button><details><summary>错误信息</summary><p>{this.state.error.message}</p></details></main>;return this.props.children;}}
export default function App(){return <ErrorBoundary><AppProvider><Router/></AppProvider></ErrorBoundary>;}


