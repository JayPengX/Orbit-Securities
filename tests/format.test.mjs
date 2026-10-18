import test from 'node:test';
import assert from 'node:assert/strict';
import { money, price, pct, qty, compact, num, cleanNumber, escapeHtml, setFormatLocale } from '../public/lib/format.mjs';
import { pointAt, movingAverage } from '../public/lib/series.mjs';
import { pack, unpack } from '../public/lib/codec.mjs';

test('money: NT$ without decimals, a sign only where a figure shows (never +NT$0 or −NT$0)', () => {
  setFormatLocale('zh');
  assert.equal(money(1234.4, 'TWD'), 'NT$1,234');
  assert.equal(money(-1234.6, 'TWD'), '−NT$1,235');
  assert.equal(money(500, 'TWD', { sign: true }), '+NT$500');
  // A rounding speck: NT$0, plain, either way (it read +NT$0).
  assert.equal(money(0.3, 'TWD', { sign: true }), 'NT$0');
  assert.equal(money(-0.3, 'TWD', { sign: true }), 'NT$0');
  assert.equal(money(0, 'TWD', { sign: true }), 'NT$0');
  assert.equal(money(0.004, 'USD', { sign: true }), 'US$0.00');
  assert.equal(money(0.005, 'USD', { sign: true }), '+US$0.01');
  assert.equal(money(12.5, 'USD'), 'US$12.50');
  assert.equal(money(1234, 'JPY'), '¥1,234');
  assert.equal(money(3.2, 'XYZ'), 'XYZ 3.20');
  assert.equal(money(NaN, 'TWD'), '—');
  assert.equal(money(undefined, 'TWD'), '—');
});

test('pct: two decimals, a sign only on what shows', () => {
  assert.equal(pct(0.01234), '+1.23%');
  assert.equal(pct(-0.01234), '−1.23%');
  assert.equal(pct(0.00001), '0.00%');
  assert.equal(pct(-0.00001), '0.00%');
  assert.equal(pct(0), '0.00%');
  assert.equal(pct(0.5, { digits: 0, sign: false }), '50%');
  assert.equal(pct(Infinity), '—');
});

test("price: Taiwan's two decimals, no cents from 1,000 up on a card, tiny coins to 8", () => {
  assert.equal(price(67.3, 'TWD'), '67.30');
  assert.equal(price(2550, 'TWD'), '2,550.00');
  assert.equal(price(2550, 'TWD', { short: true }), '2,550');
  assert.equal(price(1.1402, 'USD'), '1.1402');
  assert.equal(price(0.000012, 'USD'), '0.000012');
  assert.equal(price(150.5, 'JPY'), '150.5');
  assert.equal(price(null, 'TWD'), '—');
});

test('quantities, 萬/億, and plain numbers', () => {
  assert.equal(qty(1000), '1,000');
  assert.equal(qty(0.12345678), '0.12345678');
  assert.equal(qty(1234.56789), '1,234.568');
  setFormatLocale('zh');
  assert.equal(compact(12_345), '1.2萬');
  assert.equal(compact(2_500_000), '250萬');
  assert.equal(compact(340_000_000), '3.4億');
  assert.equal(compact(6.418e13), '64.18兆');
  assert.equal(compact(-12_345), '−1.2萬');
  setFormatLocale('en');
  assert.equal(compact(12_345), '12K');
  assert.equal(compact(3_400_000), '3.4M');
  assert.equal(compact(4.98e12), '4.98T');
  assert.equal(num(1234.5, 1), '1,234.5');
  setFormatLocale('zh');
});

test('what a number field keeps: digits and the first point only', () => {
  assert.equal(cleanNumber('1,234.5'), '1234.5');
  assert.equal(cleanNumber('NT$ 1,000'), '1000');
  assert.equal(cleanNumber('1.2.3'), '1.2');
  // A second point ends the number, so a paste can't move the decimal point.
  assert.equal(cleanNumber('1.2.3.4'), '1.2');
  assert.ok(Number.isFinite(Number(cleanNumber('1.2.3.4'))));
  assert.equal(cleanNumber('.5'), '.5');
  assert.equal(cleanNumber('abc'), '');
  assert.equal(cleanNumber(undefined), '');
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('a series read at a moment: the last point at or before it (null before it starts)', () => {
  const pts = [[10, 1], [20, 2], [30, 3]];
  assert.equal(pointAt(pts, 5), null);
  for (const [t, want] of [[10, 1], [15, 1], [20, 2], [29, 2], [30, 3], [99, 3]]) {
    assert.equal(pointAt(pts, t), want);
  }
  assert.equal(pointAt([], 5), null);
  assert.equal(pointAt(null, 5), null);
  // Many points: the same as a walk from the start.
  const many = Array.from({ length: 1000 }, (_, i) => [i * 7, i]);
  for (const t of [0, 6, 7, 3500, 6993, 7000]) assert.equal(pointAt(many, t), many.filter(p => p[0] <= t).at(-1)?.[1] ?? null);
});

test('moving averages: none for the first n−1, then the mean of the last n', () => {
  const pts = [1, 2, 3, 4, 5].map((v, i) => [i, v]);
  assert.deepEqual(movingAverage(pts, 3), [[2, 2], [3, 3], [4, 4]]);
  assert.deepEqual(movingAverage(pts, 6), []);
  assert.deepEqual(movingAverage(pts, 1), pts);
});

test('saves: compressed and back the same; a broken or empty save reads as nothing (never as an account)', async () => {
  const value = { v: 1, id: 'acc', events: [{ id: 'deposit:start', amount: 30_000, name: '台積電' }], orders: [] };
  const packed = await pack(value);
  assert.ok(packed.startsWith('gz1:'));
  assert.deepEqual(await unpack(packed), value);
  // Older saves were plain JSON.
  assert.deepEqual(await unpack(JSON.stringify(value)), value);
  assert.equal(await unpack('gz1:not-base64!!'), null);
  assert.equal(await unpack(packed.slice(0, 40)), null);
  assert.equal(await unpack('{broken'), null);
  assert.equal(await unpack(''), null);
  assert.equal(await unpack(null), null);
});
