import test from 'node:test';
import assert from 'node:assert/strict';
import { availableTravellerRoles, exportScript, importScript } from '../supabase/functions/_shared/scripts.ts';
import { ROLE_MAP } from '../supabase/functions/_shared/catalog.ts';
import { createGame, makeNightTasks } from '../supabase/functions/_shared/engine.ts';

test('known role partial overrides drive night tasks and survive export/import', () => {
  const raw = { id: 'imp', otherNight: 999, otherNightReminder: 'Custom reminder', extension: { preserved: true } };
  const { script } = importScript(JSON.stringify([raw]));
  const game = createGame(script);
  game.round = 2;
  game.seats[0].roleId = 'imp';
  game.seats[0].shownRoleId = 'imp';
  assert.equal(makeNightTasks(game).find(task => task.seatId === game.seats[0].id)?.order, 999);
  assert.equal(script.roles[0].name, ROLE_MAP.imp.name);
  assert.equal(script.roles[0].otherNightReminder, raw.otherNightReminder);
  const exported = exportScript(script);
  assert.deepEqual(JSON.parse(exported)[1], raw);
  assert.equal(importScript(exported).script.roles[0].otherNight, 999);
  assert.notEqual(ROLE_MAP.imp.otherNight, 999);
});

test('explicit zero disables a known role night action while omitted fields retain defaults', () => {
  const { script } = importScript(JSON.stringify([{ id: 'imp', otherNight: 0 }]));
  assert.equal(script.roles[0].otherNight, 0);
  assert.equal(script.roles[0].firstNight, ROLE_MAP.imp.firstNight);
});

test('traveller options merge script first, deduplicate and exclude unresolved roles', () => {
  const { script } = importScript(JSON.stringify([
    { id: 'scapegoat', name: 'Custom scapegoat', ability: 'Custom ability', team: 'traveller' },
    { id: 'newtraveller', name: 'New traveller', ability: 'Custom ability', team: 'traveller' },
    'imp',
  ]));
  script.roles.push({ ...ROLE_MAP.beggar, unresolved: true });
  const options = availableTravellerRoles(script);
  assert.equal(options.filter(role => role.id === 'scapegoat').length, 1);
  assert.equal(options.find(role => role.id === 'scapegoat')?.name, 'Custom scapegoat');
  assert.ok(options.some(role => role.id === 'newtraveller'));
  assert.ok(!options.some(role => role.id === 'beggar' || role.id === 'imp'));
  assert.ok(options.some(role => role.id === 'bureaucrat'));
});
