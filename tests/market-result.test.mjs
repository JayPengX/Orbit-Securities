import test from 'node:test';
import assert from 'node:assert/strict';
import { resultByMarket } from '../public/lib/account.mjs';

test('resultByMarket: closed trades and open positions, per market', () => {
  const s = { held: { '2330.TW': { market: 'TW', realized: 1200.4 }, AAPL: { market: 'US', realized: -300 } } };
  const v = { positions: [{ market: 'US', pl: 500.6 }, { market: 'JP', pl: -80 }] };
  assert.deepEqual(resultByMarket(s, v), { TW: 1200, US: 201, JP: -80 });
});
