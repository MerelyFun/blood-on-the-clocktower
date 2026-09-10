import { findRole } from './catalog.ts';
import type { Game } from './types.ts';

export const MAX_ARCHIVE_BYTES = 4_000_000;
export const MAX_BACKUP_BYTES = 3_900_000;
type Obj = Record<string, any>;
function check(ok: unknown, path: string, detail = '格式无效'): asserts ok {
  if (!ok) throw new Error(`存档 ${path}：${detail}。`);
}
function object(v: unknown, path: string): asserts v is Obj {
  check(v !== null && typeof v === 'object' && !Array.isArray(v), path);
}
function text(v: unknown, path: string, nonempty = false) {
  check(typeof v === 'string' && (!nonempty || v.trim().length > 0), path);
}
function number(v: unknown, path: string, min = 0, integer = false) {
  check(typeof v === 'number' && Number.isFinite(v) && v >= min && (!integer || Number.isSafeInteger(v)), path);
}
function boolean(v: unknown, path: string) { check(typeof v === 'boolean', path); }
function one(v: unknown, allowed: readonly unknown[], path: string) { check(allowed.includes(v), path); }
function array(v: unknown, path: string, max = 100000): asserts v is any[] {
  check(Array.isArray(v) && v.length <= max, path, `须为不超过 ${max} 项的数组`);
}
function strings(v: unknown, path: string, max = 100000) {
  array(v, path, max); v.forEach((s, i) => text(s, `${path}[${i}]`));
}
function unique(v: any[], field: string, path: string) {
  const values = v.map(x => { object(x, path); text(x[field], `${path}.${field}`, true); return x[field]; });
  check(new Set(values).size === values.length, path, `${field} 不能重复`);
}
const phases = ['setup', 'night', 'day', 'ended'];
const teams = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled', 'loric'];
function grim(v: unknown, path: string) {
  array(v, path, 20);
  v.forEach((c, i) => {
    const p = `${path}[${i}]`; object(c, p);
    for (const k of ['name', 'role']) text(c[k], `${p}.${k}`);
    number(c.index, `${p}.index`, 1, true); one(c.alignment, ['good', 'evil'], `${p}.alignment`);
    boolean(c.alive, `${p}.alive`); strings(c.reminders, `${p}.reminders`, 200);
  });
}
function state(g: unknown, path: string, snapshot = false): asserts g is Game {
  object(g, path); check(g.schemaVersion === 1, path, '不支持的版本');
  for (const k of ['id', 'code', 'title', 'createdAt', 'updatedAt', 'winner']) text(g[k], `${path}.${k}`);
  number(g.version, `${path}.version`, 0, true); number(g.round, `${path}.round`, 0, true);
  one(g.phase, phases, `${path}.phase`); boolean(g.paused, `${path}.paused`); boolean(g.locked, `${path}.locked`);
  object(g.script, `${path}.script`); const script = g.script;
  for (const k of ['id', 'name', 'author', 'description', 'updatedAt']) text(script[k], `${path}.script.${k}`);
  number(script.version, `${path}.script.version`, 0, true); object(script.meta, `${path}.script.meta`); array(script.extras, `${path}.script.extras`);
  array(script.roles, `${path}.script.roles`, 300); unique(script.roles, 'id', `${path}.script.roles`);
  script.roles.forEach((r: Obj) => {
    const p = `${path}.role(${r.id})`; text(r.name, `${p}.name`); text(r.ability, `${p}.ability`);
    one(r.team, teams, `${p}.team`); number(r.firstNight, `${p}.firstNight`); number(r.otherNight, `${p}.otherNight`); strings(r.reminders, `${p}.reminders`);
    for (const k of ['edition', 'firstNightReminder', 'otherNightReminder']) if (r[k] !== undefined) text(r[k], `${p}.${k}`);
    for (const k of ['setup', 'custom', 'unresolved']) if (r[k] !== undefined) boolean(r[k], `${p}.${k}`);
    if (r.raw !== undefined) object(r.raw, `${p}.raw`);
  });
  array(g.seats, `${path}.seats`, 20); check(g.seats.length >= 5, `${path}.seats`); unique(g.seats, 'id', `${path}.seats`);
  const seatIds = new Set(g.seats.map((s: Obj) => s.id));
  const seatRef = (id: unknown, p: string, empty = false) => check((empty && id === '') || seatIds.has(id), p, '引用不存在的座位');
  const roleRef = (id: unknown, p: string, empty = false) => {
    text(id, p); const role = findRole(script as Game['script'], id as string); check((empty && id === '') || (!!role && role.id === id && teams.includes(role.team)), p, '引用不存在的角色');
  };
  check(new Set(g.seats.map((s: Obj) => s.index)).size === g.seats.length, `${path}.seats.index`, '座位编号不能重复');
  g.seats.forEach((s: Obj) => {
    const p = `${path}.seat(${s.id})`; number(s.index, `${p}.index`, 1, true); check(s.index <= 20, `${p}.index`); text(s.name, `${p}.name`);
    for (const k of ['traveller', 'left', 'alive', 'publicAlive', 'voteAvailable']) boolean(s[k], `${p}.${k}`);
    for (const k of ['alignment', 'shownAlignment']) one(s[k], ['good', 'evil'], `${p}.${k}`);
    number(s.cardVersion, `${p}.cardVersion`, 0, true); number(s.acknowledged, `${p}.acknowledged`, 0, true);
    check(s.acknowledged <= s.cardVersion, `${p}.acknowledged`);
    roleRef(s.roleId, `${p}.roleId`, g.phase === 'setup'); roleRef(s.shownRoleId, `${p}.shownRoleId`, g.phase === 'setup');
  });
  g.fabled ??= [];
  for (const k of ['bluffs', 'fabled']) { strings(g[k], `${path}.${k}`, k === 'bluffs' ? 3 : 100); g[k].forEach((id: string) => roleRef(id, `${path}.${k}`)); }
  object(g.notes, `${path}.notes`); Object.entries(g.notes).forEach(([id, value]) => { text(value, `${path}.notes.${id}`); });
  // Notes may refer to seats removed during setup in older valid saves; preserve these historical notes.
  object(g.timer, `${path}.timer`); number(g.timer.remaining, `${path}.timer.remaining`);
  if (g.timer.endsAt !== null) number(g.timer.endsAt, `${path}.timer.endsAt`);
  array(g.reminders, `${path}.reminders`, 200); unique(g.reminders, 'id', `${path}.reminders`);
  g.reminders.forEach((r: Obj) => { seatRef(r.target, `${path}.reminder.target`); seatRef(r.source, `${path}.reminder.source`, true); text(r.label, `${path}.reminder.label`); one(r.duration, ['manual', 'dawn', 'dusk'], `${path}.reminder.duration`); });
  array(g.nightTasks, `${path}.nightTasks`, 100); unique(g.nightTasks, 'id', `${path}.nightTasks`);
  g.nightTasks.forEach((t: Obj) => { seatRef(t.seatId, `${path}.task.seatId`, true); text(t.label, `${path}.task.label`); text(t.note, `${path}.task.note`); number(t.order, `${path}.task.order`); boolean(t.done, `${path}.task.done`); strings(t.targets, `${path}.task.targets`, 100); t.targets.forEach((id: string) => seatRef(id, `${path}.task.targets`)); });
  array(g.messages, `${path}.messages`, 500); unique(g.messages, 'id', `${path}.messages`);
  g.messages.forEach((m: Obj) => {
    const p = `${path}.message(${m.id})`; seatRef(m.seatId, `${p}.seatId`); text(m.at, `${p}.at`); number(m.round, `${p}.round`, 0, true);
    one(m.kind, ['info', 'choice', 'grimoire'], `${p}.kind`); text(m.text, `${p}.text`); strings(m.options, `${p}.options`, 100);
    number(m.min, `${p}.min`); number(m.max, `${p}.max`); boolean(m.seen, `${p}.seen`);
    if (m.kind === 'choice') check(m.min <= m.max && m.max <= m.options.length, p, '选择范围无效');
    if (m.response !== null) { strings(m.response, `${p}.response`, 100); check(m.kind === 'choice' && m.response.length >= m.min && m.response.length <= m.max && new Set(m.response).size === m.response.length && m.response.every((x: string) => m.options.includes(x)), `${p}.response`); }
    if (m.snapshot !== undefined) grim(m.snapshot, `${p}.snapshot`);
  });
  array(g.nominations, `${path}.nominations`); unique(g.nominations, 'id', `${path}.nominations`);
  g.nominations.forEach((n: Obj) => {
    const p = `${path}.nomination(${n.id})`; number(n.round, `${p}.round`, 0, true); one(n.type, ['nomination', 'exile'], `${p}.type`);
    seatRef(n.nominator, `${p}.nominator`); seatRef(n.nominee, `${p}.nominee`); strings(n.voters, `${p}.voters`, 20); n.voters.forEach((id: string) => seatRef(id, `${p}.voters`)); check(new Set(n.voters).size === n.voters.length, `${p}.voters`);
    for (const k of ['threshold', 'tally']) number(n[k], `${p}.${k}`, 0, true);
    number(n.adjustment, `${p}.adjustment`, -100, true); text(n.reason, `${p}.reason`); one(n.status, ['open', 'tallied', 'executed', 'cancelled'], `${p}.status`);
    if (n.dies !== undefined) boolean(n.dies, `${p}.dies`);
  });
  array(g.events, `${path}.events`); unique(g.events, 'id', `${path}.events`);
  g.events.forEach((e: Obj) => { text(e.at, `${path}.event.at`); text(e.text, `${path}.event.text`); number(e.round, `${path}.event.round`, 0, true); one(e.phase, phases, `${path}.event.phase`); one(e.visibility, ['public', 'host'], `${path}.event.visibility`); });
  if (g.review !== null) { object(g.review, `${path}.review`); for (const k of ['at', 'winner', 'text']) text(g.review[k], `${path}.review.${k}`); grim(g.review.seats, `${path}.review.seats`); }
  if (snapshot) { check(g.snapshots === undefined, `${path}.snapshots`, '快照不能嵌套快照'); return; }
  g.snapshots ??= []; array(g.snapshots, `${path}.snapshots`, 8); unique(g.snapshots, 'id', `${path}.snapshots`);
  g.snapshots.forEach((s: Obj, i: number) => { text(s.at, `${path}.snapshot.at`); text(s.label, `${path}.snapshot.label`); state(s.state, `${path}.snapshots[${i}].state`, true); });
}
export function archiveBytes(input: unknown, pretty = false): number {
  try { const json = JSON.stringify(input, null, pretty ? 2 : undefined); check(typeof json === 'string', '文件'); return new TextEncoder().encode(json).length; }
  catch { throw new Error('存档必须是可序列化的 JSON 数据。'); }
}
export function validateArchive(input: unknown): Game {
  check(archiveBytes(input) <= MAX_ARCHIVE_BYTES, '文件', '不能超过 4 MB'); object(input, '文件');
  if (input.kind !== undefined) check(input.kind === 'storyteller', 'kind', '请选择说书人完整存档');
  const g = structuredClone(input.game ?? input); state(g, 'game'); return g;
}
export function createBackup(game: Game, options: { includeSnapshots?: boolean } = {}) {
  const copy = structuredClone(game); if (options.includeSnapshots === false) copy.snapshots = [];
  const backup = { schemaVersion: 1 as const, kind: 'storyteller' as const, game: copy };
  check(archiveBytes(backup, true) <= MAX_BACKUP_BYTES, '备份', '超过可安全恢复的大小（3.9 MB），请导出不含历史快照的备份');
  validateArchive(backup); return backup;
}

