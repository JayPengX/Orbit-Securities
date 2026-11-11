// 重大訊息白話 (lib/filings.mjs): a Taiwan stock's filings of the week, read
// from Orbit-Core's buckets, titles without the form's words, the rows a
// card shows (the AI's picks, else the first few).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { twCode, filingsPath, filingsOf, shortTitle, rowsShown, toAsk } from '../public/lib/filings.mjs';

const now = Date.parse('2026-11-11T00:00:00Z');
const doc = {
  codes: {
    2330: [
      { id: 'a', at: '2026-11-10T21:20:48+08:00', title: '本公司處分機器設備公告', rows: [['a', '1'], ['b', '2'], ['c', '3'], ['d', '4'], ['e', '5']] },
      { id: 'b', at: '2026-11-10T22:05:14+08:00', title: '公告本公司董事會決議辦理減資', rows: [] },
      { id: 'old', at: '2026-10-01T10:00:00+08:00', title: '舊的', rows: [] }
    ]
  }
};

test('a Taiwan code, its bucket; any other market has none', () => {
  assert.equal(twCode('2330.TW'), '2330');
  assert.equal(twCode('6488.TWO'), '6488');
  assert.equal(twCode('AAPL'), '');
  assert.equal(filingsPath('2330'), 'stock/filings/30.json');
  assert.equal(filingsPath('0050'), 'stock/filings/50.json');
});

test("a code's filings of the past week, newest first", () => {
  assert.deepEqual(filingsOf(doc, '2330', now).map(f => f.id), ['b', 'a']);
  assert.deepEqual(filingsOf(doc, '9999', now), []);
  assert.deepEqual(filingsOf(null, '2330', now), []);
});

test("a title without the form's words", () => {
  assert.equal(shortTitle('公告本公司董事會決議辦理減資'), '董事會決議辦理減資');
  assert.equal(shortTitle('本公司處分機器設備公告'), '處分機器設備公告');
  assert.equal(shortTitle('代子公司TSMC Partners, Ltd.公告擬投資'), '子公司TSMC Partners, Ltd.公告擬投資');
});

test("the rows shown: the AI's picks in its order, else the first four; the rest behind 全部", () => {
  const f = doc.codes[2330][0];
  assert.deepEqual(rowsShown(f, { show: [4, 0] }).shown, [['e', '5'], ['a', '1']]);
  assert.equal(rowsShown(f, { show: [4, 0] }).rest.length, 3);
  assert.deepEqual(rowsShown(f, null).shown.length, 4);
  assert.deepEqual(rowsShown(f, { show: [99] }).shown.length, 4);
});

test('asked about: the newest two with rows not told yet', () => {
  assert.deepEqual(toAsk(filingsOf(doc, '2330', now), new Set()).map(f => f.id), ['a']);
  assert.deepEqual(toAsk(filingsOf(doc, '2330', now), new Set(['a'])), []);
});

// 這筆交易學到什麼 (lib/lesson.mjs): a closed sale's rows from the account's own numbers.
import { lessonOf, lessonFacts, indexOf } from '../public/lib/lesson.mjs';
test('a sale told back: cost, sale, days, best and worst close while held, the market alongside, the costs', () => {
  const day = 86_400_000;
  const t0 = Date.parse('2026-10-01T02:00:00Z');
  const c = { id: 'x', t: t0 + 10 * day, symbol: '2330.TW', qty: 100, cost: -100_000, realized: 5000, realizedLocal: 5000, pct: 0.05, held: 10 * day };
  const e = { id: 'x', price: 1050, commission: 150, tax: 315 };
  const closes = Array.from({ length: 11 }, (_, i) => [t0 + i * day, [1000, 990, 980, 1010, 1100, 1080, 1060, 1040, 1030, 1045, 1050][i]]);
  const market = [[t0, 20000], [t0 + 10 * day, 21000]];
  const l = lessonOf(c, e, { closes, market });
  assert.deepEqual(l.rows.map(r => r.id), ['pl', 'buy', 'sell', 'held', 'high', 'low', 'market', 'costs']);
  assert.equal(l.rows[1].value, 1000);
  assert.equal(l.rows.find(r => r.id === 'high').value, 1100);
  assert.equal(l.rows.find(r => r.id === 'low').value, 980);
  assert.ok(Math.abs(l.rows.find(r => r.id === 'market').value - 0.05) < 1e-9);
  const f = lessonFacts(l, { name: '台積電' });
  assert.match(f, /\[high\] Best close while held: 1100 on 10\/05 \(\+10%/);
  assert.match(f, /\[market\] The market over the same days: \+5%/);
  assert.equal(indexOf('2330.TW'), '^TWII');
  assert.equal(indexOf('AAPL'), '^GSPC');
  assert.equal(lessonOf(c, e).rows.length, 5);
});
