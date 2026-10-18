import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccount, placeOrder, valuate, replay, applyFills } from '../public/lib/account.mjs';
import { expireAsked, mayLapse, LAPSE_GRACE } from '../public/lib/orders.mjs';

const HOUR = 3_600_000;
const tpe = (d, hm) => Date.parse(`${d}T${hm}:00+08:00`);
const RATES = { TWD: 1 };
const T0 = tpe('2028-03-01', '10:00');
const q = {
  symbol: '2330.TW', name: 'TSMC', kind: 'stock', market: 'TW', currency: 'TWD', price: 1000, prev: 1000, pct: 0, dayHigh: 1000, dayLow: 1000,
  session: { start: tpe('2028-03-01', '09:00'), end: tpe('2028-03-01', '13:30') }, marketTime: T0, line: []
};
// A day limit buy at 990, held for the proxy's fresh price (as every ticket order is): it ends at 13:30.
function withOrder() {
  const a = newAccount(1_000_000, T0 - 100 * 24 * HOUR, 'acc');
  const r = placeOrder(a, { side: 'buy', type: 'limit', limit: 990, qty: 1000, fresh: true }, { quote: q, rates: RATES, valuation: valuate(replay(a, T0), new Map(), RATES), now: T0, id: 'o' });
  assert.equal(r.error, undefined);
  assert.equal(r.order.expires, tpe('2028-03-01', '13:30'));
  return r.account;
}

test('a day order past its end stays open until the proxy has been asked after the end (it may have filled just before)', () => {
  const a = withOrder();
  const end = tpe('2028-03-01', '13:30');
  const after = end + 60_000;
  // Last asked at 13:25: the price reached 990 at 13:28, after that ask.
  const r = expireAsked(a, () => end - 5 * 60_000, after);
  assert.deepEqual(r.expired, []);
  assert.deepEqual(r.waiting.map(o => o.id), ['o']);
  assert.equal(r.account.orders[0].status, 'open');
  // The proxy, asked at 13:31, fills it from its bars (dated 13:28) and the fill applies.
  const filled = applyFills(r.account, { o: { quote: 990, t: end - 2 * 60_000 } }, RATES, after);
  assert.equal(filled.filled.length, 1);
  assert.equal(filled.account.orders[0].status, 'filled');
  // Asked after the end and nothing filled: now it lapses.
  const lapsed = expireAsked(a, () => after, after + 1000);
  assert.deepEqual(lapsed.expired.map(o => o.id), ['o']);
  assert.equal(lapsed.account.orders[0].status, 'expired');
  assert.equal(lapsed.account.orders[0].done, end);
});

test("an order past its end lapses anyway once the proxy couldn't be asked for LAPSE_GRACE", () => {
  const a = withOrder();
  const end = tpe('2028-03-01', '13:30');
  assert.equal(expireAsked(a, () => undefined, end + LAPSE_GRACE - 1).expired.length, 0);
  assert.equal(expireAsked(a, () => undefined, end + LAPSE_GRACE).expired.length, 1);
});

test('no proxy (an older kit): every order past its end lapses at once, as the kit has it', () => {
  const a = withOrder();
  const r = expireAsked(a, null, tpe('2028-03-01', '13:31'));
  assert.equal(r.expired.length, 1);
  assert.deepEqual(r.waiting, []);
});

test('only open, unforced orders past their end can lapse; others are left as they are', () => {
  const end = 1000;
  const o = { id: 'x', status: 'open', expires: end };
  assert.equal(mayLapse(o, end, end - 1), false);
  assert.equal(mayLapse(o, end, end), true);
  assert.equal(mayLapse({ ...o, forced: true }, end, end + 1), false);
  assert.equal(mayLapse({ ...o, status: 'filled' }, end, end + 1), false);
  assert.equal(mayLapse({ ...o, expires: 0 }, end, end + 1), false);
  // Two orders, one asked and one not: one lapses, the other's order and place in the list kept.
  const a = withOrder();
  const two = { ...a, orders: [...a.orders, { ...a.orders[0], id: 'p' }] };
  const after = tpe('2028-03-01', '13:31');
  const r = expireAsked(two, id => (id === 'p' ? after : 0), after);
  assert.deepEqual(r.account.orders.map(x => [x.id, x.status]), [['o', 'open'], ['p', 'expired']]);
  assert.deepEqual(r.waiting.map(x => x.id), ['o']);
});
