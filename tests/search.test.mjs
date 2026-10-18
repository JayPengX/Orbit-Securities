import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog } from '../public/lib/catalog.mjs';

const find = q => searchCatalog(q, 60).map(i => i.symbol);

test('dividend funds however their names write it: Div, 高息, 優息; in English or Chinese, with or without "etf"', () => {
  const all = ['0056.TW', '00878.TW', '00919.TW', '00929.TW', '00940.TW', '00713.TW', 'SCHD', 'VYM'];
  for (const q of ['dividend', '高股息', '股息', 'dividend etf', '高股息 etf'])
    for (const s of all) assert.ok(find(q).includes(s), `${q} finds ${s}`);
  assert.ok(!find('dividend').includes('2330.TW'));
  assert.ok(!find('div').some(s => /^\^/.test(s)), 'div a whole word: no index for it');
});

test('a symbol or a name still finds itself first', () => {
  assert.equal(find('AAPL')[0], 'AAPL');
  assert.equal(find('台積')[0], '2330.TW');
});
