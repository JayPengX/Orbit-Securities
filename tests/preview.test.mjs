import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccount, replay, placeOrder, valuate, estimate, openDeposit, matureDeposits } from '../public/lib/account.mjs';
import { tradeCosts, SHORT_INITIAL } from '../public/lib/markets.mjs';
import { LEND_RATE, TD_TERMS, tdRate } from '../public/lib/savings.mjs';
import { PLUS } from '#kit/plus.mjs';
import { ticketEstimate, isDayTradeSell, plusCommission, shortRoom, shortCredit, heldQty, tdPreview, tdFull, lendYear, historyRange } from '../public/lib/preview.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const tpe = (d, hm) => Date.parse(`${d}T${hm}:00+08:00`);
const RATES = { TWD: 1, USD: 32 };
const T0 = tpe('2028-03-01', '10:00'); // a Wednesday
const quote = (symbol, price, at = T0, over = {}) => ({
  symbol, name: symbol, kind: 'stock', market: 'TW', currency: 'TWD', price, prev: price, pct: 0, dayHigh: price, dayLow: price,
  session: { start: tpe(new Date(at + 8 * HOUR).toISOString().slice(0, 10), '09:00'), end: tpe(new Date(at + 8 * HOUR).toISOString().slice(0, 10), '13:30') }, marketTime: at, line: [], ...over
});
const val = (a, t, quotes) => valuate(replay(a, t), new Map(quotes), RATES);
// An account opened `months` before T0 with `n` trades in the last year.
function trader(months, n) {
  const created = T0 - months * 31 * DAY;
  const a = newAccount(5_000_000, created, 'acc');
  const fills = Array.from({ length: n }, (_, i) => ({ id: `fill:h${i}`, type: 'fill', t: T0 - (i + 1) * DAY, symbol: 'H.TW', name: 'H', kind: 'stock', market: 'TW', currency: 'TWD', side: i % 2 ? 'sell' : 'buy', qty: 1000, price: 100, gross: 100_000, commission: 0, tax: 0, fee: 0, total: 100_000, twd: 1 }));
  return { ...a, created, events: [...a.events, ...fills] };
}
const withCredit = (a, limit = 5_000_000) => ({ ...a, events: [...a.events, { id: 'credit:test', type: 'credit', t: a.created, limit }] });

test('the ticket shows the day-trade tax a same-day sale pays (it showed the full 0.3%)', () => {
  const q = quote('2330.TW', 1000);
  const bought = placeOrder(trader(4, 12), { side: 'buy', type: 'limit', limit: 1000, qty: 1000 }, { quote: q, rates: RATES, valuation: val(trader(4, 12), T0, [['2330.TW', q]]), now: T0, id: 'b' }).account;
  const later = T0 + HOUR;
  const lq = quote('2330.TW', 1000, later);
  const fill = placeOrder(bought, { side: 'sell', type: 'limit', limit: 1000, qty: 1000 }, { quote: lq, rates: RATES, valuation: val(bought, later, [['2330.TW', lq]]), now: later, id: 's' }).fill;
  const shown = ticketEstimate(bought, { quote: lq, side: 'sell', qty: 1000, price: 1000, now: later });
  assert.equal(fill.tax, 1500);
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

test("Plus's commission on the ticket keeps the market's minimum (a NT$10,000 buy is NT$20 either way, not NT$5)", () => {
  const trade = { market: 'TW', kind: 'stock', side: 'buy', gross: 10_000, currency: 'TWD', qty: 1000 };
  const plain = tradeCosts({ ...trade }).commission;
  assert.equal(plain, 20);
  assert.equal(plusCommission(trade, PLUS.stock.commission), 20);
  // The old hint: the commission times 0.28, below the minimum.
  assert.equal(Math.floor(plain * PLUS.stock.commission), 5);
  // A big one: the discount shows (NT$1,000,000: 1,425 → 399).
  assert.equal(plusCommission({ ...trade, gross: 1_000_000 }, PLUS.stock.commission), 399);
  // An odd lot's own minimum (NT$1).
  assert.equal(plusCommission({ ...trade, gross: 2_000, qty: 2 }, PLUS.stock.commission), 1);
  // US: US$3 minimum after the discount; a fund's subscription fee is discounted with no minimum.
  assert.equal(plusCommission({ market: 'US', kind: 'stock', side: 'buy', gross: 1_000, currency: 'USD', qty: 5 }, PLUS.stock.commission), 3);
  assert.equal(plusCommission({ market: 'US', kind: 'fund', side: 'buy', gross: 1_000, currency: 'USD', qty: 5 }, PLUS.stock.commission), 2.8);
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
  // What it says is what placeOrder takes: 1,111 goes, 1,112 needs more deposit than the cash.
  const q = quote('2330.TW', 1000);
  assert.equal(placeOrder(c, { side: 'sell', type: 'limit', limit: 1000, qty: 1111 }, { quote: q, rates: RATES, valuation: val(c, T0, []), now: T0 }).error, undefined);
  assert.equal(placeOrder(c, { side: 'sell', type: 'limit', limit: 1000, qty: 1112 }, { quote: q, rates: RATES, valuation: val(c, T0, []), now: T0 }).error, 'funds');
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
  // And placeOrder agrees: one share more is refused.
  assert.equal(placeOrder(a, { side: 'sell', type: 'limit', limit: 1000, qty: capped + 1 }, { quote: q, rates: RATES, valuation: v, now: T0, id: 'x' }).error, 'dayTradeLimit');
  assert.equal(placeOrder(a, { side: 'sell', type: 'limit', limit: 1000, qty: capped }, { quote: q, rates: RATES, valuation: v, now: T0, id: 'y' }).error, undefined);
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
  // 融資 6成: about 2.5 times as much, in whole lots past one.
  const margin = maxBuy({ holdFor: hold(0.6), spendable: 50_000, price: 100, kind: 'etf', market: 'TW', margin: 0.6 });
  assert.equal(margin, 1000);
  // ...and within the credit limit left: NT$30,000 of 融資 room is 500 shares at 60.
  assert.equal(maxBuy({ holdFor: hold(0.6), spendable: 50_000, price: 100, kind: 'etf', market: 'TW', margin: 0.6, cap: 30_000 / 60 }), 500);
  // Past a lot, whole lots only: NT$150,000 buys 1,000, not 1,497.
  assert.equal(maxBuy({ holdFor: hold(0), spendable: 150_000, price: 100, kind: 'etf', market: 'TW' }), 1000);
  // Crypto to its step.
  const c = { symbol: 'BTC-USD', market: 'CRYPTO', kind: 'crypto', currency: 'USD', price: 60_000, session: null };
  const btc = maxBuy({ holdFor: n => requiredCash({ type: 'limit', qty: n, limit: 60_000, waitFresh: 1 }, c, T0).reserve, spendable: 1000, price: 60_000, kind: 'crypto', market: 'CRYPTO' });
  assert.ok(btc > 0.0166 && btc < 0.01667);
});
