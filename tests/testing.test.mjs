import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STRINGS } from '../public/lib/i18n.mjs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const tools = readFileSync(new URL('../public/testing.mjs', import.meta.url), 'utf8');

test('a credit account is pointed to where it is now: 資金 › 信用帳戶', () => {
  assert.match(STRINGS.zh.err_creditNeeded, /資金 › 信用帳戶/);
  assert.match(STRINGS.en.err_creditNeeded, /Money › Credit account/);
});

test('switching between 資格 items clears the quiz answers too (as openAccess does)', () => {
  const block = app.slice(app.indexOf("case 'access-key':"), app.indexOf("case 'access-back':"));
  assert.match(block, /accessUi\(\)\.li = \[\]/);
});

test('every 測試工具 switch is read in the app, and none touches the Worker or the account', () => {
  const flags = [...tools.matchAll(/flag: '(\w+)'/g)].map(m => m[1]);
  assert.ok(flags.length >= 5);
  const quotes = readFileSync(new URL('../public/lib/quotes.mjs', import.meta.url), 'utf8');
  for (const f of flags) assert.ok(app.includes(`testFlag('${f}')`) || quotes.includes(`flags?.${f}`), f);
  // Read only in drawing code: never next to commit(), workerJson or place().
  for (const line of app.split('\n').filter(l => /testFlag\(|testOwed\(/.test(l))) assert.doesNotMatch(line, /commit\(|workerJson|place\(/);
});

test('quotes fail with the 讀不到報價 switch on', async () => {
  delete globalThis.ORBIT_TEST;
  const q = await import('../public/lib/quotes.mjs');
  globalThis.ORBIT_TEST = { flags: { quotesFail: true } };
  await assert.rejects(q.fetchQuotes(['2330.TW']), /quotes failing/);
  delete globalThis.ORBIT_TEST;
});
