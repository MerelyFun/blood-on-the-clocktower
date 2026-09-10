import test from 'node:test';
import assert from 'node:assert/strict';
import { matchOcrRoles } from '../src/lib/scriptOcr.ts';
import { CATALOG, ROLE_MAP } from '../supabase/functions/_shared/catalog.ts';
import { exportScript, importScript } from '../supabase/functions/_shared/scripts.ts';

test('OCR recognizes Chinese headings with inter-character spaces, bullets and line details', () => {
  const result = matchOcrRoles('暗流涌动\r\n洗 衣 妇\r\n• 图书管理员：开局获知一名外来者。\n3. 【小恶魔】\n共情者 每夜获知信息', CATALOG);
  assert.deepEqual(result.matches.map(match => match.role.id), ['washerwoman', 'librarian', 'imp', 'empath']);
  assert.equal(result.matches[0].line, '洗 衣 妇');
  assert.equal(result.matches[0].lineNumber, 2);
  assert.deepEqual(result.unmatchedLines, ['暗流涌动']);
});

test('OCR handles English IDs and spaced display names without matching substrings', () => {
  const result = matchOcrRoles('WASHERWOMAN\nFortune Teller\nscarlet-woman: details\nIMP\nimportant\nimpersonator', CATALOG);
  assert.deepEqual(result.matches.map(match => match.role.id), ['washerwoman', 'fortuneteller', 'scarletwoman', 'imp']);
  assert.deepEqual(result.unmatchedLines, ['important', 'impersonator']);
});

test('OCR deduplicates by role ID and does not include role references within ability text', () => {
  const result = matchOcrRoles('酒鬼\n你不知道你是酒鬼。你以为你是一个镇民。\n红唇女郎：小恶魔死亡时，可能变成恶魔。\n一名玩家可能是间谍。\n小恶魔的能力不会影响你。\n酒 鬼\ndrunk', CATALOG);
  assert.deepEqual(result.matches.map(match => match.role.id), ['drunk', 'scarletwoman']);
  assert.equal(result.unmatchedLines.length, 3);
});

test('OCR leaves misspelled and unknown roles for manual review, with no fuzzy selection', () => {
  const result = matchOcrRoles('洗衣归\n新角色\n\n  ', CATALOG);
  assert.deepEqual(result.matches, []);
  assert.deepEqual(result.unmatchedLines, ['洗衣归', '新角色']);
  assert.deepEqual(matchOcrRoles('', CATALOG), { matches: [], unmatchedLines: [] });
});

test('OCR escapes catalog names and prefers the longest matching heading', () => {
  const custom = { ...ROLE_MAP.imp, id: 'custom', name: 'A+B' };
  const prefix = { ...ROLE_MAP.imp, id: 'prefix', name: 'Fortune' };
  const full = { ...ROLE_MAP.fortuneteller, name: 'Fortune Teller' };
  const result = matchOcrRoles('A+B\nAAB\nFortune Teller', [custom, prefix, full]);
  assert.deepEqual(result.matches.map(match => match.role.id), ['custom', 'fortuneteller']);
});

test('confirmed OCR roles export to existing universal BOTC JSON and round-trip', () => {
  const { script } = importScript('[{"id":"_meta","name":"图片剧本","author":"说书人"},"imp"]');
  script.roles = matchOcrRoles('洗衣妇\n图书管理员\n投毒者\n小恶魔', CATALOG).matches.map(match => match.role);
  const json = exportScript(script);
  assert.deepEqual(JSON.parse(json), [
    { id: '_meta', name: '图片剧本', author: '说书人' },
    { id: 'washerwoman' }, { id: 'librarian' }, { id: 'poisoner' }, { id: 'imp' },
  ]);
  const imported = importScript(json);
  assert.deepEqual(imported.script.roles.map(role => role.id), script.roles.map(role => role.id));
  assert.equal(imported.script.name, script.name);
  assert.deepEqual(imported.warnings, []);
});
