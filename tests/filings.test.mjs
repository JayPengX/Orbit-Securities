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
