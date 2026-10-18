import test from 'node:test';
import assert from 'node:assert/strict';
import { twHits, twFirst } from '../public/lib/twsearch.mjs';

const names = { '2330.TW': '台積電', '3056.TW': '富華新', '2492.TW': '華新科', '1605.TW': '華新', '3055.TW': '蔚華科', '6488.TWO': '環球晶' };

test("a four-digit code finds Taiwan's listing, a new one from the subscription list too", () => {
  assert.deepEqual(twHits('2330', names), ['2330.TW']);
  assert.deepEqual(twHits('6488', names), ['6488.TWO']);
  // 6898 listed 10/15, newer than the names file: from TWSE's list (Yahoo's search gives Tokyo's 6898).
  assert.deepEqual(twHits('6898', names, [{ code: '6898', symbol: '6898.TW' }]), ['6898.TW']);
  assert.deepEqual(twHits('9999', names), []);
});

test('Chinese finds names, the ones starting with it first', () => {
  assert.deepEqual(twHits('華新', names), ['1605.TW', '2492.TW', '3056.TW']);
  assert.deepEqual(twHits('AAPL', names), []);
});

test("Yahoo's results put Taiwan's first, the rest in order", () => {
  assert.deepEqual(twFirst([{ symbol: '6898.T' }, { symbol: '6898.TW' }, { symbol: 'X' }]).map(r => r.symbol), ['6898.TW', '6898.T', 'X']);
});
