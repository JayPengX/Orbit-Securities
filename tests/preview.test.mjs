import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccount, replay, placeOrder, valuate, estimate, openDeposit, matureDeposits } from '../public/lib/account.mjs';
import { SHORT_INITIAL } from '../public/lib/markets.mjs';
import * as markets from '../public/lib/markets.mjs';
import { LEND_RATE, TD_TERMS, tdRate } from '../public/lib/savings.mjs';
import * as kit from '../public/lib/account.mjs';
import { ticketEstimate, dayTradeShareOf, shortRoom, shortCredit, heldQty, tdPreview, tdFull, lendYear, historyRange } from '../public/lib/preview.mjs';
import { signed } from './signed.mjs';
import { oddLotNeedsLimit, boardLots, placeLots } from '../public/lib/preview.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const isDayTradeSell = (account, order, now) => dayTradeShareOf(account, { qty: 1000, ...order }, now) > 0;
const tpe = (d, hm) => Date.parse(`${d}T${hm}:00+08:00`);
const RATES = { TWD: 1, USD: 32 };
const T0 = tpe('2028-03-01', '10:00'); // a Wednesday
const quote = (symbol, price, at = T0, over = {}) => ({
  symbol, name: symbol, kind: 'stock', market: 'TW', currency: 'TWD', price, prev: price, pct: 0, dayHigh: price, dayLow: price,
  session: { start: tpe(new Date(at + 8 * HOUR).toISOString().slice(0, 10), '09:00'), end: tpe(new Date(at + 8 * HOUR).toISOString().slice(0, 10), '13:30') }, marketTime: at, line: [], ...over
});
const val = (a, t, quotes) => valuate(replay(a, t), new Map(quotes), RATES);
// The day-trade tax (half of 0.3%) ends with 2027 in law.
const HALF_TAX = markets.DAY_TRADE_TAX_UNTIL > T0 ? 1500 : 3000;
// An account opened `months` before T0 with `n` trades in the last year.
function trader(months, n) {
  const created = T0 - months * 31 * DAY;
  const a = newAccount(5_000_000, created, 'acc');
  const fills = Array.from({ length: n }, (_, i) => ({ id: `fill:h${i}`, type: 'fill', t: T0 - (i + 1) * DAY, symbol: 'H.TW', name: 'H', kind: 'stock', market: 'TW', currency: 'TWD', side: i % 2 ? 'sell' : 'buy', qty: 1000, price: 100, gross: 100_000, commission: 0, tax: 0, fee: 0, total: 100_000, twd: 1 }));
  // (Three months and ten trades: day trading applied for, as a trader would.)
  const t = { ...a, created, events: [...a.events, ...fills] };
  return months >= 3 && n >= 10 ? signed(t, 'daytrade') : t;
}
// (A credit account holder applies for day trading too.)
const withCredit = (a, limit = 5_000_000) => signed({ ...a, events: [...a.events, { id: 'credit:test', type: 'credit', t: a.created, limit }] }, 'daytrade', 'kyc', 'sub');

test('the ticket shows the day-trade tax a same-day sale pays (it showed the full 0.3%)', () => {
  const q = quote('2330.TW', 1000);
  const bought = placeOrder(trader(4, 12), { side: 'buy', type: 'limit', limit: 1000, qty: 1000 }, { quote: q, rates: RATES, valuation: val(trader(4, 12), T0, [['2330.TW', q]]), now: T0, id: 'b' }).account;
  const later = T0 + HOUR;
  const lq = quote('2330.TW', 1000, later);
  const fill = placeOrder(bought, { side: 'sell', type: 'limit', limit: 1000, qty: 1000 }, { quote: lq, rates: RATES, valuation: val(bought, later, [['2330.TW', lq]]), now: later, id: 's' }).fill;
  const shown = ticketEstimate(bought, { quote: lq, side: 'sell', qty: 1000, price: 1000, now: later });
  assert.equal(fill.tax, HALF_TAX);
  assert.equal(shown.tax, fill.tax);
  assert.equal(shown.total, fill.total);
  assert.equal(shown.dayTrade, true);
  // What the ticket used to show: the full tax.
  assert.equal(estimate({ market: 'TW', kind: 'stock', currency: 'TWD', side: 'sell', qty: 1000, price: 1000 }).tax, 3000);
  // Not yet allowed to day trade (a month open): the full tax, on the ticket and the fill alike.
  assert.equal(isDayTradeSell(trader(1, 12), { symbol: '2330.TW', market: 'TW', side: 'sell' }, later), false);
  // Bought yesterday: no day trade.
  assert.equal(isDayTradeSell(bought, { symbol: '2330.TW', market: 'TW', side: 'sell' }, T0 + DAY), false);
  // Elsewhere, or buying: never.
  assert.equal(isDayTradeSell(bought, { symbol: '2330.TW', market: 'US', side: 'sell' }, later), false);
  assert.equal(isDayTradeSell(bought, { symbol: '2330.TW', market: 'TW', side: 'buy' }, later), false);
  // A day trade sold first is one by definition.
  assert.equal(isDayTradeSell(newAccount(), { symbol: 'X', market: 'TW', side: 'sell', dayShort: true }, later), true);
});

test('a sale of more lots than were bought today pays the day-trade tax on the matched lots only, on the ticket as on the fill', () => {
  // 2027: the half tax still stands (to 2027-12-31).
  const at = tpe('2027-03-03', '10:00');
  const yesterday = tpe('2027-03-02', '10:00');
  let a = withCredit(newAccount(10_000_000, at - 200 * DAY, 'acc'));
  const q = (t0, over) => quote('2330.TW', 1000, t0, over);
  a = placeOrder(a, { side: 'buy', type: 'limit', limit: 1000, qty: 2000 }, { quote: q(yesterday), rates: RATES, valuation: val(a, yesterday, [['2330.TW', q(yesterday)]]), now: yesterday, id: 'old' }).account;
  a = placeOrder(a, { side: 'buy', type: 'limit', limit: 1000, qty: 1000 }, { quote: q(at), rates: RATES, valuation: val(a, at, [['2330.TW', q(at)]]), now: at, id: 'today' }).account;
  const later = at + HOUR;
  const lq = q(later);
  const shown = ticketEstimate(a, { quote: lq, side: 'sell', qty: 3000, price: 1000, now: later });
  const fill = placeOrder(a, { side: 'sell', type: 'limit', limit: 1000, qty: 3000 }, { quote: lq, rates: RATES, valuation: val(a, later, [['2330.TW', lq]]), now: later, id: 's' }).fill;
  // 3 lots sold, 1 bought today: a third at 0.15%, the rest at 0.3%.
  assert.equal(fill.tax, Math.floor(3_000_000 * (0.0015 / 3 + (0.003 * 2) / 3)));
  assert.equal(shown.tax, fill.tax);
  assert.equal(shown.dayTrade, true);
});

test('lending at the lender’s own ask: the year’s figure at that rate', () => {
  const going = lendYear('stock', 1000, 100);
  assert.equal(going.rate, LEND_RATE.stock);
  const mine = lendYear('stock', 1000, 100, 0.005);
  assert.equal(mine.rate, 0.005);
  assert.ok(mine.net < going.net);
});

test('the ticket shows 融券 handling (0.08% of the part sold short) as the fill charges it', () => {
  let a = withCredit(newAccount(1_000_000, T0, 'acc'));
  const q = quote('2330.TW', 2000);
  // 50 held, 150 sold: 100 of them short.
  a = placeOrder(a, { side: 'buy', type: 'limit', limit: 2000, qty: 50 }, { quote: q, rates: RATES, valuation: val(a, T0, [['2330.TW', q]]), now: T0, id: 'b' }).account;
  const r = placeOrder(a, { side: 'sell', type: 'limit', limit: 2000, qty: 150 }, { quote: q, rates: RATES, valuation: val(a, T0, [['2330.TW', q]]), now: T0, id: 's' });
  assert.equal(r.error, undefined);
  const shown = ticketEstimate(a, { quote: q, side: 'sell', qty: 150, price: 2000, credit: true, held: heldQty(a, '2330.TW', T0), now: T0 });
  assert.equal(r.fill.handling, Math.floor(300_000 * (100 / 150) * 0.0008));
  assert.equal(shown.handling, r.fill.handling);
  assert.equal(shown.fee, r.fill.fee);
  assert.equal(shown.total, r.fill.total);
});

test('how much can be sold short: 150% cover elsewhere; 融券 by its credit limit and the 90% deposit the cash covers', () => {
  const a = newAccount(1_000_000, T0, 'acc');
  const v = val(a, T0, []);
  // No debt: (1,000,000 − 0) / 0.5 = NT$2,000,000 of shorts, 2,000 at NT$1,000.
  assert.equal(shortRoom(v, { unit: 1000, price: 1000, kind: 'stock' }), 2000);
  assert.equal(shortRoom(v, { unit: 1000, price: 1000, kind: 'stock' }), Math.floor((v.assets - SHORT_INITIAL * 0) / (SHORT_INITIAL - 1) / 1000));
  // Under a margin call: nothing.
  assert.equal(shortRoom({ ...v, margin: 'call' }, { unit: 1000, price: 1000, kind: 'stock' }), 0);
  // 融券: the deposit binds (NT$1,000,000 cash ÷ 90% of NT$1,000 = 1,111), then the limit (NT$500,000 → 500).
  const c = withCredit(a);
  assert.equal(shortRoom(val(c, T0, []), { unit: 1000, price: 1000, kind: 'stock', credit: shortCredit(c, 'TW', T0), cash: 1_000_000 }), 1111);
  const small = withCredit(a, 500_000);
  assert.equal(shortRoom(val(small, T0, []), { unit: 1000, price: 1000, kind: 'stock', credit: shortCredit(small, 'TW', T0), cash: 1_000_000 }), 500);
  // What it says is what the ticket's orders take (1,000 and 111, each its own deposit up to the NT$100): 1,111 goes, 1,112 needs more deposit than the cash.
  const q = quote('2330.TW', 1000);
  const opts = { quote: q, rates: RATES, valuation: val(c, T0, []), now: T0 };
  assert.equal(placeLots(c, { side: 'sell', type: 'limit', limit: 1000, qty: 1111 }, opts).failed, null);
  assert.equal(placeLots(c, { side: 'sell', type: 'limit', limit: 1000, qty: 1112 }, opts).failed?.r.error, 'funds');
  // NT$999,950 of cash: 90% of NT$1,111,000 is NT$999,900, but the odd lot's own NT$99,900 deposit fits only once the first's NT$900,000 is out (NT$99,950 left): 1,111 still; at NT$999,850, 1,110.
  assert.equal(shortRoom(val(c, T0, []), { unit: 1000, price: 1000, kind: 'stock', credit: shortCredit(c, 'TW', T0), cash: 999_850 }), 1110);
  // Only Taiwan's credit account sets 融券's terms.
  assert.equal(shortCredit(c, 'US', T0), null);
  assert.equal(shortRoom(null, { unit: 1, price: 1, kind: 'stock' }), 0);
});

test("a time deposit's preview ends when openDeposit says (Jan 31 + 1 month is Feb 28, not Mar 3) and pays what maturity pays", () => {
  const at = tpe('2027-01-31', '10:00');
  const a = newAccount(1_000_000, tpe('2027-01-01', '10:00'), 'acc');
  const { event } = openDeposit(a, { amount: 100_000, months: 1 }, at, 'x');
  const p = tdPreview(100_000, 1, at);
  assert.equal(p.ends, event.ends);
  assert.equal(new Date(p.ends + 8 * HOUR).toISOString().slice(0, 10), '2027-02-28');
  assert.equal(p.rate, tdRate(1));
  // At maturity the account is paid exactly the preview's interest.
  const done = matureDeposits({ ...a, events: [...a.events, event] }, p.ends + 1);
  assert.equal(done.events.find(e => e.type === 'tdend').interest, p.gross);
  assert.equal(tdFull(event), p.gross);
  for (const { months } of TD_TERMS) assert.equal(tdPreview(250_000, months, at).gross, Math.round((250_000 * tdRate(months) * months) / 12));
  assert.equal(tdPreview(100_000, 2, at), null);
});

test("lending's yearly fee by kind is the kit's own rate (stocks 1.2%, ETFs 0.6%), the broker's 30% and taxes out", () => {
  assert.equal(lendYear('stock', 1000, 100).rate, LEND_RATE.stock);
  assert.equal(lendYear('etf', 1000, 100).rate, LEND_RATE.etf);
  // NT$100,000 a year at 1.2%: 1,200, the broker keeps 360.
  assert.equal(lendYear('stock', 1000, 100).net, 840);
  assert.equal(lendYear('stock', 0, 100).net, 0);
});

test('the history charts read a range that covers the account', () => {
  assert.equal(historyRange(3 * DAY), '1mo');
  assert.equal(historyRange(100 * DAY), '6mo');
  assert.equal(historyRange(200 * DAY), '1y');
  assert.equal(historyRange(800 * DAY), '5y');
});

test('the most a day trade can sell first stays within the day-trade limit left', async () => {
  const { dayTradeLeft } = await import('../public/lib/preview.mjs');
  const a = trader(4, 12);
  const q = quote('2330.TW', 1000);
  const v = val(a, T0, [['2330.TW', q]]);
  const room = dayTradeLeft(a, v.netWorth, T0);
  assert.equal(room.used, 0);
  assert.equal(room.left, room.limit);
  assert.equal(room.limit, Math.floor((v.netWorth * 2) / 100_000) * 100_000);
  // 150% of assets alone would allow far more than the limit.
  const free = shortRoom(v, { unit: 1000, price: 1000, kind: 'stock' });
  const capped = shortRoom(v, { unit: 1000, price: 1000, kind: 'stock', dayLeft: room.left });
  assert.ok(free > capped);
  assert.equal(capped, room.left / 1000);
  // And the ticket's orders agree: one share more is refused.
  assert.equal(placeLots(a, { side: 'sell', type: 'limit', limit: 1000, qty: capped + 1 }, { quote: q, rates: RATES, valuation: v, now: T0, id: 'x' }).failed?.r.error, 'dayTradeLimit');
  assert.equal(placeLots(a, { side: 'sell', type: 'limit', limit: 1000, qty: capped }, { quote: q, rates: RATES, valuation: v, now: T0, id: 'y' }).failed, null);
});

test('a limit or stop field starts on the exchange tick (a US price of 187.4321 opened on a refused price)', async () => {
  const { startPrice } = await import('../public/lib/preview.mjs');
  const { tickSize, onTick } = await import('../public/lib/markets.mjs');
  const us = { symbol: 'AAPL', market: 'US', kind: 'stock', price: 187.4321 };
  assert.equal(startPrice(us), '187.43');
  assert.ok(onTick(Number(startPrice(us)), tickSize('US', 'stock', 187.43)));
  assert.equal(startPrice({ market: 'US', kind: 'stock', price: 0.51237 }), '0.5124');
  assert.equal(startPrice({ market: 'TW', kind: 'stock', price: 1085 }), '1085');
  assert.equal(startPrice({ market: 'HK', kind: 'stock', price: 412.3 }), '412.4');
  // No tick (crypto): six figures, as before.
  assert.equal(startPrice({ market: 'CRYPTO', kind: 'crypto', price: 67123.456789 }), '67123.5');
  assert.equal(startPrice(null), '');
});

test('Taiwan whole lots and odd lots are separate orders: 1,500 shares is 1,000 and 500', async () => {
  const { lotSplit } = await import('../public/lib/preview.mjs');
  assert.deepEqual(lotSplit('TW', 'stock', 1500), { board: 1000, odd: 500 });
  assert.deepEqual(lotSplit('TW', 'etf', 2001), { board: 2000, odd: 1 });
  assert.equal(lotSplit('TW', 'stock', 2000), null);
  assert.equal(lotSplit('TW', 'stock', 999), null);
  assert.equal(lotSplit('US', 'stock', 1500), null);
});

test('the ticket\'s 最大 is the most the cash holds (it was about 3.5% short), 融資 counting only one\'s own part', async () => {
  const { maxBuy } = await import('../public/lib/preview.mjs');
  const { requiredCash } = await import('../public/lib/account.mjs');
  const q = { ...quote('2330.TW', 100), kind: 'etf' };
  const hold = margin => n => requiredCash({ type: 'limit', qty: n, limit: 100, waitFresh: 1, margin }, q, T0).reserve;
  // NT$50,000 at 100: 499 shares (49,900 + NT$71 commission), not 481.
  const cash = maxBuy({ holdFor: hold(0), spendable: 50_000, price: 100, kind: 'etf', market: 'TW' });
  assert.equal(cash, 499);
  assert.ok(hold(0)(cash) <= 50_000 && hold(0)(cash + 1) > 50_000);
  // Past a lot, the two orders a mixed quantity goes in as (整零合併), each
  // held with its own commission: NT$150,000 buys 1,497 (it was 1,000, whole lots only).
  const { lotsHold } = await import('../public/lib/preview.mjs');
  const lots = margin => n => lotsHold({ type: 'limit', qty: n, limit: 100, waitFresh: 1, margin }, q, T0).reserve;
  const mixed = maxBuy({ holdFor: lots(0), spendable: 150_000, price: 100, kind: 'etf', market: 'TW' });
  assert.equal(mixed, 1497);
  assert.ok(lots(0)(mixed) <= 150_000 && lots(0)(mixed + 1) > 150_000);
  // 融資 6成: about 2.5 times as much (it stopped at 1,000).
  const margin = maxBuy({ holdFor: lots(0.6), spendable: 50_000, price: 100, kind: 'etf', market: 'TW', margin: 0.6 });
  assert.ok(margin > 1200 && lots(0.6)(margin) <= 50_000 && lots(0.6)(margin + 1) > 50_000);
  // ...and within the credit limit left: NT$30,000 of 融資 room is 500 shares at 60.
  assert.equal(maxBuy({ holdFor: lots(0.6), spendable: 50_000, price: 100, kind: 'etf', market: 'TW', margin: 0.6, cap: 30_000 / 60 }), 500);
  // Crypto to its step.
  const c = { symbol: 'BTC-USD', market: 'CRYPTO', kind: 'crypto', currency: 'USD', price: 60_000, session: null };
  const btc = maxBuy({ holdFor: n => requiredCash({ type: 'limit', qty: n, limit: 60_000, waitFresh: 1 }, c, T0).reserve, spendable: 1000, price: 60_000, kind: 'crypto', market: 'CRYPTO' });
  assert.ok(btc > 0.0166 && btc < 0.01667);
});

test("the ticket's day-trade room counts at the order price: the limit, or 漲停 for a market order (it counted at the last price)", async () => {
  const { dayTradeLeft, dayTradePrice } = await import('../public/lib/preview.mjs');
  const a = trader(4, 12);
  const q = quote('2330.TW', 1000);
  const v = val(a, T0, [['2330.TW', q]]);
  const left = dayTradeLeft(a, v.netWorth, T0).left;
  assert.equal(dayTradePrice(q, { type: 'limit', limit: 1050 }, T0), 1050);
  assert.equal(dayTradePrice(q, { type: 'market' }, T0), 1100); // 漲停: 1000 + 10% (in the session: 盤後定價 fills a market order at the close)
  assert.equal(dayTradePrice(q, { type: 'stop', stop: 990 }, T0), 1100);
  assert.equal(dayTradePrice({ ...q, market: 'US', currency: 'USD' }, { type: 'market' }, T0), 1000); // no band: the price
  // A limit sale at 1050: the room is what fits at 1050, and placeOrder agrees to the share.
  const at = shortRoom(v, { unit: 1000, price: 1000, kind: 'stock', dayLeft: left, dayUnit: 1050 });
  assert.equal(at, Math.floor(left / 1050));
  assert.ok(at < left / 1000);
  const opts = { quote: q, rates: RATES, valuation: v, now: T0 };
  assert.equal(placeLots(a, { side: 'sell', type: 'limit', limit: 1050, qty: at + 1 }, { ...opts, id: 'x' }).failed?.r.error, 'dayTradeLimit');
  assert.equal(placeLots(a, { side: 'sell', type: 'limit', limit: 1050, qty: at }, { ...opts, id: 'y' }).failed, null);
  // A market sale at 漲停, as the kit counts it too (in whole lots: an odd lot takes limit orders only).
  const mkt = shortRoom(v, { unit: 1000, price: 1000, kind: 'stock', dayLeft: left, dayUnit: dayTradePrice(q, { type: 'market' }, T0) });
  assert.equal(mkt, Math.floor(left / 1100));
  const lots = Math.floor(mkt / 1000) * 1000;
  assert.equal(placeOrder(a, { side: 'sell', type: 'market', qty: lots }, { ...opts, id: 'z' }).error, undefined);
  assert.equal(placeOrder(a, { side: 'sell', type: 'market', qty: lots + 1000 }, { ...opts, id: 'w' }).error, 'dayTradeLimit');
});

test('整零合併: 1,500 shares go in as two orders at one price and type, 1,000 整股 then 500 盤中零股', async () => {
  const { placeLots, lotParts } = await import('../public/lib/preview.mjs');
  assert.deepEqual(lotParts('TW', 'stock', 1500), [1000, 500]);
  assert.deepEqual(lotParts('TW', 'stock', 2000), [2000]);
  assert.deepEqual(lotParts('US', 'stock', 1500), [1500]);
  const q = quote('2330.TW', 100);
  const a = newAccount(1_000_000, T0, 'acc');
  const opts = { quote: q, rates: RATES, valuation: val(a, T0, [['2330.TW', q]]), now: T0, id: 'o' };
  const r = placeLots(a, { symbol: '2330.TW', side: 'buy', type: 'limit', limit: 100, qty: 1500, fresh: true }, opts);
  assert.equal(r.failed, null);
  assert.deepEqual(r.parts.map(p => p.qty), [1000, 500]);
  const open = r.account.orders.filter(o => o.status === 'open');
  assert.deepEqual(open.map(o => [o.qty, o.type, o.limit]), [[1000, 'limit', 100], [500, 'limit', 100]]);
  assert.equal(new Set(open.map(o => o.id)).size, 2);
  // Whole lots alone: one order, as before.
  const one = placeLots(a, { symbol: '2330.TW', side: 'buy', type: 'market', qty: 2000, fresh: true }, opts);
  assert.equal(one.parts.length, 1);
  assert.equal(one.account.orders.length, 1);
});

test('整零合併: when the odd-lot order fails the whole-lot one stands, and the failure says which', async () => {
  const { placeLots } = await import('../public/lib/preview.mjs');
  const q = quote('2330.TW', 100);
  const a = newAccount(1_000_000, T0, 'acc');
  const opts = { quote: q, rates: RATES, valuation: val(a, T0, [['2330.TW', q]]), now: T0 };
  // (Its check passes; the price moved before the odd lot was sent.)
  let tries = 0;
  const place = (acc, req, o) => (req.qty === 500 && ++tries > 1 ? { error: 'tick', tick: 0.5 } : placeOrder(acc, req, o));
  const r = placeLots(a, { symbol: '2330.TW', side: 'buy', type: 'limit', limit: 100, qty: 1500, fresh: true }, opts, place);
  assert.equal(r.failed.qty, 500);
  assert.equal(r.failed.r.error, 'tick');
  assert.deepEqual(r.account.orders.map(o => [o.qty, o.status]), [[1000, 'open']]);
});

test('整零合併: the two orders together pass what one of the whole would (融資 within the credit limit), else neither goes in', async () => {
  const { placeLots } = await import('../public/lib/preview.mjs');
  const q = quote('2330.TW', 100);
  // NT$80,000 of 融資 room: 1,000 (NT$60,000 lent) and 500 (NT$30,000) each fit, together they don't.
  const a = withCredit(trader(4, 12), 80_000);
  const opts = { quote: q, rates: RATES, valuation: val(a, T0, [['2330.TW', q]]), now: T0 };
  const r = placeLots(a, { symbol: '2330.TW', side: 'buy', type: 'limit', limit: 100, qty: 1500, margin: true, fresh: true }, opts);
  assert.equal(r.account, null);
  assert.equal(r.failed.qty, 1500);
  assert.equal(r.failed.r.error, 'creditLimit');
});

test("整零合併: the ticket's estimate and hold are the two orders' added up, each with its own commission", async () => {
  const { lotsEstimate, lotsHold, ticketEstimate: one } = await import('../public/lib/preview.mjs');
  const { requiredCash } = await import('../public/lib/account.mjs');
  const q = quote('2330.TW', 100);
  const a = newAccount(1_000_000, T0, 'acc');
  const est = lotsEstimate(a, { quote: q, side: 'buy', qty: 1500, price: 100, now: T0 });
  const board = one(a, { quote: q, side: 'buy', qty: 1000, price: 100, now: T0 });
  const odd = one(a, { quote: q, side: 'buy', qty: 500, price: 100, now: T0 });
  assert.equal(est.gross, 150_000);
  assert.equal(est.commission, board.commission + odd.commission);
  assert.equal(est.total, board.total + odd.total);
  assert.equal(est.price, 100);
  const order = { type: 'market', qty: 1500, waitFresh: 1 };
  const held = lotsHold(order, q, T0);
  const parts = [1000, 500].map(n => requiredCash({ ...order, qty: n }, q, T0));
  assert.equal(held.reserve, parts[0].reserve + parts[1].reserve);
  assert.equal(held.buffer, parts[0].buffer + parts[1].buffer);
  // One order: as requiredCash has it.
  assert.deepEqual(lotsHold({ ...order, qty: 2000 }, q, T0).reserve, requiredCash({ ...order, qty: 2000 }, q, T0).reserve);
});

test("the ticket's 最大 is what the ticket's own order then takes: the most the cash holds, one more refused (limit in mixed lots, market in whole lots)", async () => {
  const { ticketMax, placeLots } = await import('../public/lib/preview.mjs');
  const { marketFill } = await import('../public/lib/markets.mjs');
  const q = quote('2330.TW', 500);
  const a = newAccount(1_000_000, T0, 'acc');
  const opts = { quote: q, rates: RATES, valuation: val(a, T0, [['2330.TW', q]]), now: T0 };
  for (const order of [{ type: 'limit', limit: 495 }, { type: 'market' }]) {
    const ref = order.type === 'limit' ? order.limit : marketFill('TW', 'stock', 'buy', q.price);
    const max = ticketMax(a, { quote: q, order, ref, spendable: 1_000_000, now: T0 });
    // A market order: whole lots (held at 漲停, 550: 1,000), as an odd lot takes limit orders only.
    const step = order.type === 'limit' ? 1 : 1000;
    if (order.type === 'limit') assert.ok(max > 1000 && max % 1000, `${order.type}: ${max} mixes lots`);
    else assert.equal(max, 1000);
    const req = n => ({ symbol: '2330.TW', side: 'buy', ...order, qty: n, fresh: true });
    assert.equal(placeLots(a, req(max), opts).failed, null, `${order.type}: ${max} goes in`);
    assert.equal(placeLots(a, req(max + step), opts).failed?.r.error, 'funds', `${order.type}: ${max + step} is refused`);
  }
  assert.equal(ticketMax(a, { quote: q, order: { type: 'market' }, ref: 0, spendable: 1_000_000, now: T0 }), 0);
});

test("融資 on the ticket: only with an open credit account and no default, and its 最大 stops at the credit limit left, as placeOrder counts it", async () => {
  const { ticketMax, marginRateFor, placeLots } = await import('../public/lib/preview.mjs');
  const q = quote('2330.TW', 500);
  const plain = trader(4, 12);
  const a = withCredit(plain, 400_000);
  assert.equal(marginRateFor(plain, q, 'buy', T0), 0);
  assert.equal(marginRateFor(a, q, 'buy', T0), 0.6);
  assert.equal(marginRateFor(a, q, 'sell', T0), 0);
  assert.equal(marginRateFor(a, quote('6488.TWO', 500), 'buy', T0), 0.5);
  const valuation = val(a, T0, [['2330.TW', q]]);
  const opts = { quote: q, rates: RATES, valuation, now: T0 };
  // NT$400,000 of room, each order's loan counted at its price × 60% with the part under NT$1,000 not lent:
  // a market order at 漲停 (550, NT$330 a share), in whole lots: 1,000; a limit of 510 at its limit (NT$306 a share):
  // 1,310 (1,000 lending NT$306,000 and 310 NT$94,000), 1,311 over.
  for (const [order, want, step] of [[{ type: 'market' }, 1000, 1000], [{ type: 'limit', limit: 510 }, 1310, 1]]) {
    const max = ticketMax(a, { quote: q, order, ref: order.limit || 501, spendable: 5_000_000, margin: 0.6, valuation, now: T0 });
    assert.equal(max, want);
    const req = n => ({ symbol: '2330.TW', side: 'buy', ...order, qty: n, margin: true, fresh: true });
    assert.equal(placeLots(a, req(max), opts).failed, null);
    assert.equal(placeLots(a, req(max + step), opts).failed?.r.error, 'creditLimit');
  }
  // What's already lent counts: NT$120,000 out leaves NT$280,000, 918 shares at 510.
  const lent = { ...valuation, positions: [...valuation.positions, { market: 'TW', financed: 120_000 }] };
  assert.equal(ticketMax(a, { quote: q, order: { type: 'limit', limit: 510 }, ref: 510, spendable: 5_000_000, margin: 0.6, valuation: lent, now: T0 }), 918);
  // No 融資: the cash alone, no cap (NT$5,000,000 held at 漲停: 9 lots).
  assert.equal(ticketMax(a, { quote: q, order: { type: 'market' }, ref: 501, spendable: 5_000_000, valuation, now: T0 }), 9000);
});

test('盤中零股 takes limit orders only: a market or stop order with an odd-lot part is refused, whole lots are not', () => {
  assert.equal(oddLotNeedsLimit('TW', 'stock', 500, 'market'), true);
  assert.equal(oddLotNeedsLimit('TW', 'stock', 1500, 'stop'), true);
  assert.equal(oddLotNeedsLimit('TW', 'stock', 500, 'limit'), false);
  assert.equal(oddLotNeedsLimit('TW', 'stock', 2000, 'market'), false);
  assert.equal(oddLotNeedsLimit('US', 'stock', 5, 'market'), false);
});

test('a Taiwan holding in 張 and 股: under a lot nothing extra, a short counted the same', () => {
  assert.equal(boardLots(500), null);
  assert.deepEqual(boardLots(1000), { lots: 1, odd: 0 });
  assert.deepEqual(boardLots(2500), { lots: 2, odd: 500 });
  assert.deepEqual(boardLots(-1500), { lots: 1, odd: 500 });
});

test('the ticket offers only what the kit takes: no 融資 or short abroad, Hong Kong limit only, 盤前／盤後 in their hours, STAR and ChiNext sold only, US fractions sold', async () => {
  const { cashOnly, orderTypes, usSessionOf, extOffered, northboundBlock, sellFraction, ticketRound, ticketStepOk, marginRateFor } = await import('../public/lib/preview.mjs');
  const credited = signed({ ...newAccount(1_000_000, T0 - 400 * DAY, 'acc'), events: [...newAccount(1_000_000, T0 - 400 * DAY, 'acc').events, { id: 'credit:t', type: 'credit', t: T0 - DAY, limit: 5_000_000 }] }, 'kyc', 'sub');
  const us = quote('AAPL', 200, T0, { market: 'US', currency: 'USD' });
  const hk = quote('0700.HK', 400, T0, { market: 'HK', currency: 'HKD' });
  const tw = quote('2330.TW', 1000);
  const star = quote('688981.SS', 90, T0, { market: 'CN', currency: 'CNY' });
  const main = quote('600519.SS', 1500, T0, { market: 'CN', currency: 'CNY' });
  // 融資 at home with the credit account; abroad never (複委託 is cash only).
  assert.equal(marginRateFor(credited, tw, 'buy', T0), 0.6);
  assert.equal(marginRateFor(credited, us, 'buy', T0), 0);
  assert.equal(cashOnly(us), true);
  assert.equal(cashOnly(tw), false);
  assert.equal(cashOnly(quote('EURUSD=X', 1.1, T0, { kind: 'fx', market: 'FX', currency: 'USD' })), false);
  // Each one agrees with placeOrder.
  const v = val(credited, T0, [['AAPL', us]]);
  const margin = placeOrder(credited, { side: 'buy', type: 'limit', limit: 200, qty: 1, margin: true }, { quote: us, rates: RATES, valuation: v, now: T0 });
  assert.equal(margin.error, 'cashOnly');
  assert.deepEqual(orderTypes(hk), ['limit']);
  assert.deepEqual(orderTypes(us), ['market', 'limit', 'stop']);
  assert.equal(northboundBlock(star), 'star');
  assert.equal(northboundBlock(quote('300750.SZ', 200, T0, { market: 'CN', currency: 'CNY' })), 'chinext');
  assert.equal(northboundBlock(main), null);
  // 2028-03-01 (Wednesday, EST): 08:00 New York is the pre-market, 12:00 regular, 17:00 post, 19:00 shut.
  const ny = hm => Date.parse(`2028-03-01T${hm}:00-05:00`);
  assert.deepEqual(['08:00', '12:00', '17:00', '19:00'].map(x => usSessionOf(us, ny(x))), ['pre', 'regular', 'post', null]);
  assert.equal(usSessionOf(tw, ny('08:00')), undefined);
  assert.equal(extOffered(us, { type: 'limit' }, ny('08:00')), true);
  assert.equal(extOffered(us, { type: 'limit', tif: 'gtc' }, ny('08:00')), false);
  assert.equal(extOffered(us, { type: 'market' }, ny('17:00')), false);
  assert.equal(extOffered(us, { type: 'limit' }, ny('12:00')), false);
  // A pre-market order the ticket offers is one the kit takes, lasting to 18:00.
  const funded = kit.exchange(signed(newAccount(1_000_000, T0 - DAY, 'b'), 'kyc', 'sub'), { from: 'TWD', to: 'USD', amount: 64_000 }, { rates: RATES, now: T0 - DAY, id: 'x' }).account;
  const r = placeOrder(funded, { side: 'buy', type: 'limit', limit: 190, qty: 1, ext: true }, { quote: us, rates: RATES, now: ny('08:00') });
  assert.equal(r.error, undefined);
  assert.equal(r.order.ext, true);
  assert.equal(r.order.expires, ny('18:00'));
  // A US plan's fractions sell down to 0.0001; buys and other markets whole.
  assert.equal(sellFraction(us, 'sell'), markets.US_FRACTION);
  assert.equal(sellFraction(us, 'buy'), null);
  assert.equal(ticketRound(us, 'sell', 2.59857), 2.5985);
  assert.equal(ticketStepOk(us, 'sell', 2.5985), true);
  assert.equal(ticketStepOk(us, 'buy', 2.5985), false);
  assert.equal(ticketStepOk(tw, 'sell', 2.5), false);
});
