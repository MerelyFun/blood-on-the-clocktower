import test from 'node:test';
import assert from 'node:assert/strict';
import { availableTravellerRoles, exportScript, importScript } from '../supabase/functions/_shared/scripts.ts';
import { ROLE_MAP } from '../supabase/functions/_shared/catalog.ts';
import { createGame, makeNightTasks } from '../supabase/functions/_shared/engine.ts';

test('script-provided new roles retain abilities, images and extensions through editing export',()=>{
 const definition={id:'new_lantern_keeper',name:'守灯人',team:'townsfolk',ability:'每个夜晚，你得知一名玩家是否中毒。',firstNight:12,otherNight:15,reminders:['已查验'],image:'https://example.test/lantern.png',jinxes:[{id:'imp',reason:'自定义相克'}],extension:{version:2}};
 const {script,warnings}=importScript(JSON.stringify([{id:'_meta',name:'全新角色剧本'},definition]));
 assert.equal(warnings.length,0);assert.equal(script.roles.length,1);
 assert.equal(script.roles[0].custom,true);assert.ok(!script.roles[0].unresolved);
 script.roles[0].ability='每个夜晚，你得知一名玩家是否醉酒。';
 const restored=importScript(exportScript(script)).script.roles[0];
 assert.equal(restored.ability,script.roles[0].ability);
 assert.equal(restored.raw?.image,definition.image);
 assert.deepEqual(restored.raw?.jinxes,definition.jinxes);
 assert.deepEqual(restored.raw?.extension,definition.extension);
 assert.equal(restored.team,'townsfolk');assert.equal(restored.otherNight,15);
});

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
