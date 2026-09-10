import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createGame, restoreGame } from '../supabase/functions/_shared/engine.ts';
import { archiveBytes, createBackup, validateArchive, MAX_ARCHIVE_BYTES } from '../supabase/functions/_shared/archive.ts';
import { BASE_SCRIPTS } from '../supabase/functions/_shared/catalog.ts';
import type { Game } from '../supabase/functions/_shared/types.ts';
const run = (g: Game, type: string, payload: Record<string, unknown> = {}) => applyCommand(g, { type, payload }, { kind: 'host' });
function day() {
  let g = createGame(BASE_SCRIPTS[0], 7);
  g = run(g, 'auto_setup'); g = run(g, 'deal'); return run(g, 'phase', { phase: 'day' });
}
function nomination(g: Game) { return run(g, 'nominate', { nominator: g.seats[0].id, nominee: g.seats[1].id }); }

test('ordinary nomination cannot target a traveller; a reasoned ability exception can', () => {
  let g = run(day(), 'add_traveller', { roleId: 'scapegoat' });
  const payload = { nominator: g.seats[0].id, nominee: g.seats.at(-1)!.id };
  assert.throws(() => run(g, 'nominate', payload), /旅行者/);
  assert.throws(() => run(g, 'nominate', { ...payload, override: true }), /原因/);
  g = run(g, 'nominate', { ...payload, override: true, reason: '角色能力允许本次例外' });
  assert.equal(g.nominations[0].type, 'nomination');
  g = run(g, 'tally', { id: g.nominations[0].id, voters: g.seats.map(s => s.id) });
  assert.throws(() => run(g, 'execute', { id: g.nominations[0].id, dies: true }), /旅行者/);
  assert.throws(() => run(g, 'execute', { id: g.nominations[0].id, override: true }), /原因/);
  const executed = run(g, 'execute', { id: g.nominations[0].id, override: true, reason: '能力造成处决', dies: true });
  assert.equal(executed.seats.at(-1)!.alive, false);
});

test('traveller exile remains independent and does not consume ghost votes', () => {
  let g = run(day(), 'add_traveller', { roleId: 'scapegoat' });
  g.seats[0].publicAlive = false;
  g = run(g, 'nominate', { nominator: g.seats[0].id, nominee: g.seats.at(-1)!.id, exile: true });
  g = run(g, 'tally', { id: g.nominations[0].id, voters: g.seats.map(s => s.id) });
  assert.equal(g.seats[0].voteAvailable, true);
  g = run(g, 'execute', { id: g.nominations[0].id }); assert.equal(g.seats.at(-1)!.left, true);
});

test('open nomination blocks phase change atomically until explicitly cancelled', () => {
  let g = nomination(day()); const before = structuredClone(g);
  assert.throws(() => run(g, 'phase', { phase: 'night' }), /未结算/); assert.deepEqual(g, before);
  g = run(g, 'cancel_nomination', { id: g.nominations[0].id, reason: '进入夜晚前取消' });
  g = run(g, 'phase', { phase: 'night' }); assert.equal(g.phase, 'night');
});

test('old open nominations can be cancelled but cannot be tallied at night or another round', () => {
  const g = nomination(day()); const payload = { id: g.nominations[0].id, voters: [] };
  assert.throws(() => run({ ...g, phase: 'night' }, 'tally', payload), /当前白天/);
  assert.throws(() => run({ ...g, round: 2 }, 'tally', payload), /当前白天/);
  assert.equal(run({ ...g, round: 2 }, 'cancel_nomination', { id: payload.id }).nominations[0].status, 'cancelled');
});

test('standard nomination, ghost vote consumption, execution and next phase still work', () => {
  let g = day(); g.seats[2].publicAlive = false; g = nomination(g);
  g = run(g, 'tally', { id: g.nominations[0].id, voters: g.seats.slice(0, 4).map(s => s.id) });
  assert.equal(g.seats[2].voteAvailable, false);
  g = run(g, 'execute', { id: g.nominations[0].id, dies: true }); assert.equal(g.seats[1].alive, false);
  assert.equal(run(g, 'phase', { phase: 'night' }).phase, 'night');
});

test('full archive round trips a played game with messages, markers, review and snapshots', () => {
  let g = day(); g = run(g, 'marker_add', { target: g.seats[1].id, source: g.seats[0].id, label: '中毒' });
  g = run(g, 'message_send', { seatId: g.seats[0].id, kind: 'choice', text: '请选择', options: ['甲', '乙'], min: 1, max: 1 });
  g = applyCommand(g, { type: 'respond', payload: { id: g.messages[0].id, response: ['甲'] } }, { kind: 'player', seatId: g.seats[0].id });
  g = run(g, 'message_send', { seatId: g.seats[1].id, kind: 'grimoire', seats: g.seats.map(s => s.id), withMarkers: true });
  g = run(g, 'snapshot', { label: '完整状态' }); g = run(g, 'finish', { winner: '善良' });
  g = run(g, 'review', { seats: g.seats.map(s => s.id), text: '复盘' });
  const backup = JSON.parse(JSON.stringify(createBackup(g))); const restored = restoreGame(backup);
  assert.notEqual(restored.id, g.id); assert.equal(restored.version, 0); assert.deepEqual(restored.messages, g.messages);
  assert.deepEqual(restored.review, g.review); assert.equal(restored.snapshots.length, 0); assert.equal(g.snapshots.length, 2);
  assert.equal(createBackup(g, { includeSnapshots: false }).game.snapshots.length, 0);
  assert.deepEqual(validateArchive(backup), g);
});

test('setup saves and legacy missing fabled/snapshots remain readable', () => {
  const g: any = createGame(BASE_SCRIPTS[0]); delete g.fabled; delete g.snapshots;
  g.notes['removed-seat'] = '历史座位笔记';
  assert.equal(restoreGame(g).phase, 'setup'); assert.equal(restoreGame(g).notes['removed-seat'], '历史座位笔记');
});

const mutations: [string, (g: any) => void][] = [
  ['seat boolean', g => { g.seats[0].alive = 'false'; }],
  ['duplicate seat index', g => { g.seats[1].index = g.seats[0].index; }],
  ['missing role', g => { g.seats[0].roleId = 'unknown-role'; }],
  ['invalid role shape', g => { g.script.roles[0].reminders = {}; }],
  ['notes value', g => { g.notes.global = {}; }],
  ['timer', g => { g.timer.remaining = -1; }],
  ['message reference', g => { g.messages.push({ id: 'bad', seatId: 'missing' }); }],
  ['marker reference', g => { g.reminders.push({ id: 'bad', target: 'missing', source: '', label: 'x', duration: 'manual' }); }],
  ['task reference', g => { g.nightTasks[0].targets = ['missing']; }],
  ['nomination reference', g => { g.nominations[0].nominee = 'missing'; }],
  ['event visibility', g => { g.events[0].visibility = 'private-player'; }],
  ['review structure', g => { g.review = {}; }],
  ['snapshot corruption', g => { g.snapshots[0].state.timer = null; }],
  ['nested snapshot', g => { g.snapshots[0].state.snapshots = []; }],
];
for (const [name, mutate] of mutations) test(`archive rejects ${name} without mutating input`, () => {
  const g = nomination(day()); mutate(g); const before = structuredClone(g);
  assert.throws(() => restoreGame(g), /存档/); assert.deepEqual(g, before);
});

test('size limits measure UTF-8 bytes and never silently discard snapshots', () => {
  const g = day(); g.script.meta.extra = '中'.repeat(Math.ceil(MAX_ARCHIVE_BYTES / 3));
  assert.ok(archiveBytes(g) > MAX_ARCHIVE_BYTES); assert.throws(() => restoreGame(g), /4 MB/);
  assert.throws(() => createBackup(g), /3.9 MB/);
});

test('public records and circular objects are rejected with readable errors', () => {
  assert.throws(() => restoreGame({ kind: 'public', game: day() }), /说书人/);
  const g: any = day(); g.cycle = g; assert.throws(() => restoreGame(g), /JSON/);
});

test('pretty JSON backup stays inside the downloadable and cloud request budgets', () => {
  const g = day(); g.notes.global = '中文与 English '.repeat(2000);
  const backup = createBackup(g);
  assert.equal(archiveBytes(backup, true), new TextEncoder().encode(JSON.stringify(backup, null, 2)).length);
  assert.ok(archiveBytes(backup, true) > archiveBytes(backup));
  // Many preserved extension entries amplify pretty-printing overhead.
  g.script.extras = Array.from({ length: 35000 }, () => ({ text: '中'.repeat(30) }));
  const raw = { schemaVersion: 1, kind: 'storyteller', game: g };
  assert.ok(archiveBytes(raw) < 3_900_000);
  assert.ok(archiveBytes(raw, true) > 3_900_000);
  assert.throws(() => createBackup(g), /3.9 MB/);
});

test('restore validation failures retain a client-readable error code', () => {
  assert.throws(() => restoreGame({}), (e: any) => e.code === 'INVALID_ARCHIVE');
});

test('all base scripts and custom traveller archives remain restorable', () => {
  for (const script of BASE_SCRIPTS) {
    let g = createGame(script, 7); g = run(g, 'auto_setup'); g = run(g, 'deal');
    assert.equal(restoreGame(createBackup(g)).script.id, script.id);
  }
  const g = day(); const custom = { ...BASE_SCRIPTS[0].roles[0], id: 'custom-traveller', name: '自制旅行者', team: 'traveller' as const, custom: true };
  g.script.roles.push(custom);
  const added = run(g, 'add_traveller', { roleId: custom.id });
  assert.equal(restoreGame(createBackup(added)).seats.at(-1)!.roleId, custom.id);
});

test('explicit snapshot-free backup can recover a state whose historical snapshots exceed the budget', () => {
  let g = day(); g.notes.global = '中'.repeat(180000);
  for (let i = 0; i < 8; i++) g = run(g, 'snapshot', { label: `${i}` });
  assert.throws(() => createBackup(g), /3.9 MB/);
  const backup = createBackup(g, { includeSnapshots: false });
  assert.equal(restoreGame(backup).notes.global, g.notes.global); assert.equal(g.snapshots.length, 8);
});
