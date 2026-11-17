import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOrder, sharesFor, zhNumber } from '../public/lib/sayorder.mjs';

test('numbers as people write them', () => {
  assert.equal(zhNumber('5萬'), 50000);
  assert.equal(zhNumber('五萬'), 50000);
  assert.equal(zhNumber('三千五'), 3500);
  assert.equal(zhNumber('兩百'), 200);
  assert.equal(zhNumber('1.5萬'), 15000);
  assert.equal(zhNumber('5萬5'), 55000);
  assert.equal(zhNumber('十二'), 12);
  assert.equal(zhNumber('20,000'), 20000);
});

test('an order in plain words', () => {
  assert.deepEqual(readOrder('用 5 萬買台積電零股'), { side: 'buy', name: '台積電', odd: true, money: 50000 });
  assert.deepEqual(readOrder('買兩張鴻海'), { side: 'buy', name: '鴻海', odd: false, lots: 2 });
  assert.deepEqual(readOrder('賣掉一半聯發科'), { side: 'sell', name: '聯發科', odd: false, part: 0.5 });
  assert.deepEqual(readOrder('買 300 股 2330'), { side: 'buy', name: '2330', odd: false, shares: 300 });
  assert.deepEqual(readOrder('我想用三千塊買0050'), { side: 'buy', name: '0050', odd: false, money: 3000 });
  assert.deepEqual(readOrder('台積電全部賣出'), { side: 'sell', name: '台積電', odd: false, part: 1 });
});

test('not an order: a plain search, a name alone, nothing to buy', () => {
  assert.equal(readOrder('台積電'), null);
  assert.equal(readOrder('2330'), null);
  assert.equal(readOrder('買'), null);
  assert.equal(readOrder('用0元買台積電'), null);
});

test('how many shares it comes to', () => {
  assert.equal(sharesFor({ money: 50000, odd: true }, { price: 1100 }), 45);
  assert.equal(sharesFor({ money: 500000, odd: false }, { price: 200 }), 2000);
  assert.equal(sharesFor({ money: 50000, odd: false }, { price: 1100 }), 0);
  assert.equal(sharesFor({ lots: 2 }, {}), 2000);
  assert.equal(sharesFor({ part: 0.5 }, { held: 3000 }), 1000);
  assert.equal(sharesFor({ part: 0.5 }, { held: 75 }), 37);
});

test('a 零 inside a number, 零股 alone, all of a fraction', () => {
  assert.equal(zhNumber('一百零五'), 105);
  assert.equal(zhNumber('一千零五'), 1005);
  assert.equal(zhNumber('一千零五十'), 1050);
  assert.equal(zhNumber('三百零八'), 308);
  assert.deepEqual(readOrder('買一百零五股台積電'), { side: 'buy', name: '台積電', odd: false, shares: 105 });
  assert.deepEqual(readOrder('買台積電零股'), { side: 'buy', name: '台積電', odd: true });
  // NT$ over the price in NT$ (US$230 at 32.5: NT$7,475 a share).
  assert.equal(sharesFor({ money: 50000, odd: false }, { price: 230 * 32.5, lot: 1 }), 6);
  // All of a US holding's fractions, a coin's; a part to what can be sold.
  assert.equal(sharesFor({ part: 1 }, { held: 3.4567, lot: 1 }), 3.4567);
  assert.equal(sharesFor({ part: 1 }, { held: 0.05, lot: 1 }), 0.05);
  assert.equal(sharesFor({ part: 0.5 }, { held: 3.4567, lot: 1, round: n => Math.floor(n / 1e-4 + 1e-6) * 1e-4 }).toFixed(4), '1.7283');
});
