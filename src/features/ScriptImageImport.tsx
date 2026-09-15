import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, ImagePlus, ScanText, Search, X } from 'lucide-react';
import { Button, Field, Modal, Alert, RoleToken } from '../components/ui';
import { copyScript, BASE_SCRIPTS, exportScript, uid, type Role, type Script } from '../lib/domain';
import { RoleForm } from '../components/RoleForm';
import { download } from '../lib/storage';
import { matchOcrRoles } from '../lib/scriptOcr';
import { recognizeScriptImage, type OcrProgress } from '../lib/imageOcr';

export function ScriptImageImport({ catalog, onImport, onClose }: { catalog: Role[]; onImport: (script: Script) => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState('');
  const [name, setName] = useState(''), [text, setText] = useState(''), [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [review, setReview] = useState(false);
  const [progress, setProgress] = useState<OcrProgress>({ label: '', progress: 0 });
  const [columns, setColumns] = useState(1), [traditional, setTraditional] = useState(false), [search, setSearch] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [customRoles,setCustomRoles]=useState<Role[]>([]),[editingRole,setEditingRole]=useState<Role|null>(null);
  const availableCatalog=useMemo(()=>[...new Map([...catalog,...customRoles].map(r=>[r.id,r])).values()],[catalog,customRoles]);
  const unmatchedLines=useMemo(()=>[...new Set(matchOcrRoles(text,availableCatalog).unmatchedLines)],[text,availableCatalog]);
  const input = useRef<HTMLInputElement>(null), active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { if (!file) return; const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const roles = useMemo(() => selected.flatMap(id => { const r = availableCatalog.find(r => r.id === id); return r ? [r] : []; }), [selected, availableCatalog]);
  const found = search.trim() ? availableCatalog.filter(r => `${r.name} ${r.id}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 20) : [];
  function choose(next?: File) {
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 15 * 1024 * 1024) { setError('请选择 15 MB 以内的 JPG、PNG 或 WebP 图片。'); return; }
    active.current?.abort(); active.current = null; setBusy(false); setError(''); setFile(next);
    setCustomRoles([]); setEditingRole(null);
    setName(next.name.replace(/\.[^.]+$/, '')); setText(''); setSelected([]); setReview(false); setConfirmed(false);
  }
  const match = (value: string) => { setSelected([...new Set([...matchOcrRoles(value, availableCatalog).matches.map(m => m.role.id),...customRoles.filter(r=>selected.includes(r.id)).map(r=>r.id)])]); setConfirmed(false); setReview(true); };
  async function recognize() {
    if (!file || busy) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setConfirmed(false);
    try {
      const value = await recognizeScriptImage(file, { signal: controller.signal, columns, traditional, onProgress: setProgress });
      if (active.current !== controller) return;
      setText(value); match(value);
      if (!value.trim()) setError('没有识别出文字，请换清晰图片，或在下方手动输入角色名。');
    } catch (e) { if (active.current === controller && !controller.signal.aborted) setError(e instanceof Error && e.message ? e.message : '识别引擎加载失败，请检查网络后重试。'); }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  }
  function cancel() { active.current?.abort(); active.current = null; setBusy(false); }
  function toggle(id: string) { setSelected(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]); setConfirmed(false); }
  function result(): Script { return { ...copyScript(BASE_SCRIPTS[0]), name: name.trim()||'未命名剧本', author: '', description: '', roles: structuredClone(roles), extras: [], meta: {} }; }
  const ready = !busy && roles.length > 0 && confirmed;
  function createRole(line='') {
    const parts=line.split(/[:：]/),hasAbility=parts.length>1,name=hasAbility?parts.shift()!.trim():line.trim();
    setEditingRole({id:`custom_${uid().slice(0,8)}`,name:name.slice(0,80),ability:hasAbility?parts.join('：').trim().slice(0,4000):'',team:'townsfolk',firstNight:0,otherNight:0,reminders:[],custom:true});
  }
  return <>{!editingRole&&<Modal title="图片转剧本" wide onClose={() => { cancel(); onClose(); }} footer={review && <><Button disabled={!ready} onClick={() => download(`${name.trim()||'未命名剧本'}.json`, exportScript(result()), true)}><Download/> 下载 JSON</Button><Button variant="primary" disabled={busy || (roles.length > 0 && !confirmed)} onClick={() => onImport(result())}>放入剧本工坊</Button></>}>
    <div className="ocr-import stack">
      <p className="muted">选图片 → 识别角色 → 核对并导出</p>
      <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }}/>
      <Button className="ocr-pick" disabled={busy} onClick={() => input.current?.click()}><ImagePlus/>{file ? '更换图片' : '选择剧本图片'}</Button>
      {preview && <a className="ocr-preview" href={preview} target="_blank" rel="noreferrer" aria-label="查看原始剧本图片"><img src={preview} alt="待识别的剧本图片"/></a>}
      {file && <><details><summary>识别选项</summary><div className="stack"><Field label="图片排版"><select value={columns} onChange={e => setColumns(Number(e.target.value))} disabled={busy}><option value={1}>自动识别整张图片</option><option value={2}>两栏（从左到右）</option><option value={3}>三栏（从左到右）</option></select></Field><label className="checkbox-row"><input type="checkbox" checked={traditional} disabled={busy} onChange={e => setTraditional(e.target.checked)}/> 图片使用繁体中文</label></div></details>
      <Button variant="primary" disabled={busy} onClick={recognize}><ScanText/>{review ? '重新识别图片' : '开始识别'}</Button></>}
      {busy && <div className="ocr-progress" role="status"><p>{progress.label}</p><progress max={100} value={progress.progress}/><Button onClick={cancel}>取消识别</Button></div>}
      {error && <Alert kind="error">{error}</Alert>}
      <small className="muted">图片在此设备识别。首次需联网加载识别资源，清晰正面的截图效果更好。</small>
      <details className="ocr-text"><summary>识别文字 / 手动校正</summary><Field label="角色文字"><textarea value={text} disabled={busy} onChange={e => { setText(e.target.value); setConfirmed(false); }} placeholder="每行一个角色名，也可粘贴已识别的文字。" rows={7}/></Field><Button disabled={busy || !text.trim()} onClick={() => match(text)}>根据文字匹配角色</Button></details>
      {review && <><Field label="剧本名称"><input placeholder="可不填，默认：未命名剧本" value={name} onChange={e => setName(e.target.value)} maxLength={100}/></Field>
      <div className="ocr-result-heading"><h3>核对角色 · {roles.length} 个</h3></div>
      <p className="muted">对照图片检查漏选或误选。角色库中没有的角色，可直接创建并填写名称、阵营和能力。</p>
      {!roles.length && <Alert>暂未匹配到角色。可修正上方文字、搜索已有角色，或直接创建新角色。</Alert>}
      <div className="ocr-role-list">{roles.map(r => <div className="ocr-role" key={r.id}><RoleToken small role={r}/><span>{r.name}<small>{r.id}</small></span>{customRoles.some(c=>c.id===r.id)&&<Button variant="ghost" aria-label={`编辑新角色${r.name}`} onClick={()=>setEditingRole(r)}>编辑</Button>}<Button variant="ghost" aria-label={`移除识别角色${r.name}`} onClick={() => toggle(r.id)}><X/></Button></div>)}</div>
      <Field label="补充遗漏角色"><div className="ocr-search"><Search/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索角色名称或英文 ID"/></div></Field>
      {found.length > 0 && <div className="ocr-search-results">{found.map(r => <Button key={r.id} onClick={() => toggle(r.id)} aria-pressed={selected.includes(r.id)}><RoleToken small role={r}/>{selected.includes(r.id) && <Check/>}{r.name}</Button>)}</div>}
      <Button onClick={()=>createRole(search.trim())}>创建角色</Button>
      {unmatchedLines.length>0&&<details className="ocr-unmatched"><summary>未匹配文字 · {unmatchedLines.length} 行</summary><p className="muted">这里也可能包含标题或能力描述。选中角色名称后创建，核对能力再保存。</p>{unmatchedLines.map((line,i)=><div className="row between" key={`${i}-${line}`}><span style={{overflowWrap:'anywhere',minWidth:0}}>{line}</span><Button aria-label={`从未匹配文字创建角色：${line}`} onClick={()=>createRole(line)}>创建角色</Button></div>)}</details>}
      <label className="checkbox-row"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={!roles.length}/> 我已对照图片核对角色列表</label>
      <small className="muted">导出为通用剧本数组：剧本信息 + 角色 ID；自制角色保留完整定义。图片不会写入 JSON。</small></>}
    </div>
  </Modal>}{editingRole&&<RoleForm role={editingRole} takenIds={availableCatalog.filter(r=>r.id!==editingRole.id).map(r=>r.id)} onClose={()=>setEditingRole(null)} onSave={role=>{setCustomRoles(rs=>[...rs.filter(r=>r.id!==editingRole.id&&r.id!==role.id),role]);setSelected(ids=>[...new Set([...ids.filter(id=>id!==editingRole.id),role.id])]);setConfirmed(false);setEditingRole(null);}}/>}</>;
}
