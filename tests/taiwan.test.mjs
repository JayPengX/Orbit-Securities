// Taiwan's own rules at their edges (ticks, the ±10% limit, odd lots, the
// NHI line), 新股申購, settlement across a clock change, and the home's
// movers and picks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tickSize, onTick, toTick, priceLimits, isOddLot, oddLotOpen, dividendTaxes, settleDate, marketFill } from '../public/lib/markets.mjs';
import { newAccount, replay, placeOrder, valuate, applyCorporateActions, quoteExchange, amountFor } from '../public/lib/account.mjs';
import { rocDay, parseIpoList, ipoOpen, ipoDrawn, ipoWon, ipoHold, ipoApplyEvent, ipoBackEvent, ipoWinEvent, IPO_FEE, IPO_WIN_FEE } from '../public/lib/ipo.mjs';
import { moverGroupNow, moverGroupOf, movers, candidates, wantedSymbols, forYou, POPULAR } from '../public/lib/foryou.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const tpe = (d, hm) => Date.parse(`${d}T${hm}:00+08:00`);

test('Taiwan ticks at every band edge (stocks; ETFs and bond ETFs finer)', () => {
  for (const [p, tick] of [[9.99, 0.01], [10, 0.05], [49.95, 0.05], [50, 0.1], [99.9, 0.1], [100, 0.5], [499.5, 0.5], [500, 1], [999, 1], [1000, 5], [2550, 5]]) assert.equal(tickSize('TW', 'stock', p), tick, String(p));
  for (const [p, tick] of [[49.99, 0.01], [50, 0.05], [190.35, 0.05]]) assert.equal(tickSize('TW', 'etf', p), tick, String(p));
  assert.equal(tickSize('TW', 'bond', 33.33), 0.01);
  // On the tick, floats and all.
  assert.ok(onTick(1005, 5) && !onTick(1003, 5));
  assert.ok(onTick(10.05, 0.05) && onTick(0.3, 0.1) && !onTick(10.03, 0.05));
  assert.equal(toTick(10.03, 0.05, 1), 10.05);
  assert.equal(toTick(10.03, 0.05, -1), 10);
  assert.equal(toTick(10.05, 0.05, 1), 10.05);
});

test("Taiwan's ±10%: the up limit cut down to its tick, the down limit rounded up (each in its own band)", () => {
  const lim = prev => priceLimits({ market: 'TW', kind: 'stock', prev, symbol: '2330.TW' });
  assert.deepEqual(lim(1000), { up: 1100, down: 900 });
  // 9.1 × 1.1 = 10.01, in the 0.05 band: 10.00. 9.1 × 0.9 = 8.19.
  assert.deepEqual(lim(9.1), { up: 10, down: 8.19 });
  // 46 × 1.1 = 50.6 (a 0.1 band), 46 × 0.9 = 41.4 (a 0.05 band, rounded up to 41.4).
  assert.deepEqual(lim(46), { up: 50.6, down: 41.4 });
  // 1,234 × 1.1 = 1,357.4 → 1,355; × 0.9 = 1,110.6 → 1,115.
  assert.deepEqual(lim(1234), { up: 1355, down: 1115 });
  assert.equal(lim(0), null);
  // A limit order past the limit is refused with the range; at the limit it goes.
  const q = { symbol: '2330.TW', name: 'TSMC', kind: 'stock', market: 'TW', currency: 'TWD', price: 1000, prev: 1000, dayHigh: 1000, dayLow: 1000, session: { start: tpe('2028-03-01', '09:00'), end: tpe('2028-03-01', '13:30') }, marketTime: tpe('2028-03-01', '10:00') };
  const a = newAccount(5_000_000, tpe('2028-01-01', '10:00'), 'acc');
  const now = tpe('2028-03-01', '10:00');
  const opts = { quote: q, rates: { TWD: 1 }, valuation: valuate(replay(a, now), new Map(), { TWD: 1 }), now };
  assert.deepEqual(placeOrder(a, { side: 'buy', type: 'limit', limit: 1105, qty: 1000 }, opts).error, 'priceLimit');
  assert.equal(placeOrder(a, { side: 'buy', type: 'limit', limit: 1100, qty: 1000 }, opts).error, undefined);
  assert.equal(placeOrder(a, { side: 'buy', type: 'limit', limit: 1003, qty: 1000 }, opts).error, 'tick');
});

test('odd lots: under 1,000 or not whole lots; only from 09:10 Taipei', () => {
  assert.equal(isOddLot('TW', 'stock', 999), true);
  assert.equal(isOddLot('TW', 'stock', 1500), true);
  assert.equal(isOddLot('TW', 'stock', 2000), false);
  assert.equal(isOddLot('TW', 'etf', 1), true);
  assert.equal(isOddLot('US', 'stock', 1), false);
  assert.equal(isOddLot('TW', 'metal', 3), false);
  assert.equal(oddLotOpen(tpe('2028-03-01', '09:09')), false);
  assert.equal(oddLotOpen(tpe('2028-03-01', '09:10')), true);
  // Taiwan's market orders cross half a tick (no share of the price on top).
  assert.equal(marketFill('TW', 'stock', 'buy', 1000), 1000 + 2.5);
});

test('dividends: the 2.11% NHI premium from NT$20,000 a payment, nothing below', () => {
  assert.deepEqual(dividendTaxes('TW', 19_999), { withheld: 0, nhi: 0, net: 19_999 });
  assert.deepEqual(dividendTaxes('TW', 20_000), { withheld: 0, nhi: 422, net: 19_578 });
  assert.equal(dividendTaxes('US', 100).withheld, 30);
  assert.equal(dividendTaxes('JP', 10_000).withheld, 1532);
});

test('settlement keeps 23:59 in the market across a clock change (New York, November)', () => {
  // A Friday 30 Oct 2026 sale (EDT) settles Monday 2 Nov, after the clocks went back (EST).
  assert.equal(settleDate('US', Date.parse('2026-10-30T15:00:00-04:00')), Date.parse('2026-11-02T23:59:59-05:00'));
  // March: a Friday 12 Mar 2027 sale (EST) settles Monday 15 Mar (EDT).
  assert.equal(settleDate('US', Date.parse('2027-03-12T15:00:00-05:00')), Date.parse('2027-03-15T23:59:59-04:00'));
  // London across its October change.
  assert.equal(settleDate('UK', Date.parse('2026-10-23T12:00:00+01:00')), Date.parse('2026-10-27T23:59:59+00:00'));
});

test('exchange: what you get is rounded down to its unit, a closed market doubles the spread, and amountFor always covers what is wanted', () => {
  const rates = { TWD: 1, USD: 32, JPY: 0.21 };
  const q = quoteExchange('TWD', 'JPY', 10_000, rates);
  assert.equal(q.received, Math.floor(10_000 / 0.21 * (1 - 0.003)));
  assert.ok(Number.isInteger(q.received));
  assert.ok(quoteExchange('TWD', 'USD', 10_000, rates, false).received < quoteExchange('TWD', 'USD', 10_000, rates, true).received);
  for (const need of [0.01, 1, 99.99, 1234.56, 31_250]) {
    const pay = amountFor('TWD', 'USD', need, rates);
    assert.ok(quoteExchange('TWD', 'USD', pay, rates).received >= need, String(need));
    if (pay > 1) assert.ok(quoteExchange('TWD', 'USD', pay - 1, rates).received < need, String(need));
  }
  assert.equal(quoteExchange('TWD', 'TWD', 100, rates), null);
  assert.equal(quoteExchange('TWD', 'USD', 0, rates), null);
  assert.equal(quoteExchange('TWD', 'XYZ', 10, rates), null);
});

// TWSE's list, as its JSON has it (fields by name).
const IPO_FIELDS = ['序號', '抽籤日期', '證券名稱', '證券代號', '發行市場', '申購開始日', '申購結束日', '承銷股數', '實際承銷股數', '承銷價(元)', '實際承銷價(元)', '撥券日期(上市、上櫃日期)', '主辦券商', '申購股數', '總合格件', '中籤率(%)', '取消公告'];
const row = over => {
  const base = { 抽籤日期: '115/10/22', 證券名稱: '新創', 證券代號: '7777', 發行市場: '初上市', 申購開始日: '115/10/15', 申購結束日: '115/10/19', '承銷價(元)': '50.00', '實際承銷價(元)': '未訂出', '撥券日期(上市、上櫃日期)': '115/10/29', 申購股數: '1,000', '中籤率(%)': '', 取消公告: '' };
  const r = { ...base, ...over };
  return IPO_FIELDS.map(f => r[f] ?? '');
};

test('新股申購: TWSE\'s list read by its field names (ROC dates, shares only, cancelled left out)', () => {
  assert.equal(rocDay('115/10/22'), tpe('2026-10-22', '00:00'));
  assert.equal(rocDay('bad'), null);
  const list = parseIpoList({ fields: IPO_FIELDS, data: [row({}), row({ 證券代號: '77771' }), row({ 證券代號: '6666', 發行市場: '上櫃增資', '實際承銷價(元)': '88.5', '中籤率(%)': '2.5' }), row({ 證券代號: '5555', 取消公告: '取消' }), row({ 證券代號: '4444', 發行市場: '公司債' }), row({ 證券代號: '3333', '承銷價(元)': '' })] });
  assert.deepEqual(list.map(s => s.code), ['7777', '6666']);
  const [ipo, otc] = list;
  assert.equal(ipo.symbol, '7777.TW');
  assert.equal(ipo.ipo, true);
  assert.equal(ipo.qty, 1000);
  assert.equal(ipo.rate, null);
  assert.equal(otc.symbol, '6666.TWO');
  assert.equal(otc.price, 88.5);
  assert.equal(otc.rate, 0.025);
  assert.deepEqual(parseIpoList({ fields: [], data: [] }), []);
  assert.deepEqual(parseIpoList(null), []);
  // The window: the first day's 09:00 to the last day's 14:00.
  assert.equal(ipoOpen(ipo, tpe('2026-10-15', '08:59')), false);
  assert.equal(ipoOpen(ipo, tpe('2026-10-15', '09:00')), true);
  assert.equal(ipoOpen(ipo, tpe('2026-10-19', '13:59')), true);
  assert.equal(ipoOpen(ipo, tpe('2026-10-19', '14:00')), false);
  assert.equal(ipoDrawn(ipo, tpe('2026-10-23', '00:00')), false);
  assert.equal(ipoDrawn(otc, tpe('2026-10-22', '00:00')), true);
  assert.equal(ipoHold(ipo), 50_000 + IPO_FEE);
  assert.equal(ipoWon('00000000', 0.01), true);
  assert.equal(ipoWon('ffffffff', 0.99), false);
  assert.equal(ipoWon('ffffffff', 1), true);
  assert.equal(ipoWon('00000000', 0), false);
});

test('新股申購 in the account: held at applying, back the day after a lost draw (the fee kept), shares on the listing day for a win', () => {
  const s = parseIpoList({ fields: IPO_FIELDS, data: [row({})] })[0];
  const start = tpe('2026-10-01', '10:00');
  const a = newAccount(100_000, start, 'acc');
  const applied = { ...a, events: [...a.events, ipoApplyEvent(s, tpe('2026-10-16', '10:00'))] };
  const app = applied.events.at(-1);
  assert.equal(replay(applied, tpe('2026-10-16', '11:00')).cash.TWD, 100_000 - 50_000 - IPO_FEE);
  // Lost: the money back at 09:00 the day after the draw.
  const lost = { ...applied, events: [...applied.events, ipoBackEvent(app)] };
  assert.equal(replay(lost, tpe('2026-10-23', '08:59')).cash.TWD, 100_000 - 50_020);
  assert.equal(replay(lost, tpe('2026-10-23', '09:00')).cash.TWD, 100_000 - IPO_FEE);
  // Won: 1,000 shares on the listing day, NT$50 more.
  const won = { ...applied, events: [...applied.events, ipoWinEvent(app)] };
  const s1 = replay(won, tpe('2026-10-29', '09:00'));
  assert.equal(s1.positions['7777.TW'].qty, 1000);
  assert.equal(s1.positions['7777.TW'].cost, 50_000);
  assert.equal(s1.cash.TWD, 100_000 - 50_000 - IPO_FEE - IPO_WIN_FEE);
  assert.equal(replay(won, tpe('2026-10-29', '08:59')).positions['7777.TW'], undefined);
  // An issue's application counts once, however many copies a merge brings.
  const twice = { ...won, events: [...won.events, { ...app, id: 'ipo:dup', t: app.t + 1 }] };
  assert.equal(replay(twice, tpe('2026-11-01', '00:00')).cash.TWD, s1.cash.TWD);
});

// Kit bug (Shared-Proxy kit/stock-account.mjs: applyCorporateActions and
// sharesAt count only `fill` events, and a won IPO's shares come in an
// `ipowin`): shares from a 新股申購 get no dividends or splits. Reported to the
// kit; marked todo here until the kit counts them.
test('a 新股申購 holding gets its dividends like any other', { todo: 'kit: applyCorporateActions/sharesAt ignore ipowin' }, () => {
  const s = parseIpoList({ fields: IPO_FIELDS, data: [row({})] })[0];
  const a = newAccount(100_000, tpe('2026-10-01', '10:00'), 'acc');
  const app = ipoApplyEvent(s, tpe('2026-10-16', '10:00'));
  const won = { ...a, events: [...a.events, app, ipoWinEvent(app)] };
  const now = tpe('2027-08-01', '10:00');
  const r = applyCorporateActions(won, '7777.TW', { dividends: [{ date: tpe('2027-07-01', '00:00'), amount: 2 }], splits: [] }, { rates: { TWD: 1 }, now });
  assert.equal(r.added.length, 1);
  assert.equal(r.added[0].gross, 2000);
});

test("today's movers by market: Taiwan by day in Taipei, the US by night and at weekends", () => {
  assert.equal(moverGroupNow(tpe('2026-10-14', '10:00')), 'tw');
  assert.equal(moverGroupNow(tpe('2026-10-14', '06:59')), 'us');
  assert.equal(moverGroupNow(tpe('2026-10-14', '19:59')), 'tw');
  assert.equal(moverGroupNow(tpe('2026-10-14', '22:00')), 'us');
  assert.equal(moverGroupNow(tpe('2026-10-17', '10:00')), 'us'); // a Saturday
  assert.equal(moverGroupOf({ market: 'TW' }), 'tw');
  assert.equal(moverGroupOf({ market: 'CRYPTO', kind: 'crypto' }), 'crypto');
  assert.equal(moverGroupOf({ market: 'FX' }), null);
  assert.equal(moverGroupOf({ market: 'JP' }), 'world');
  const quotes = new Map([
    ['2330.TW', { symbol: '2330.TW', market: 'TW', kind: 'stock', pct: 0.05 }],
    ['2317.TW', { symbol: '2317.TW', market: 'TW', kind: 'stock', pct: -0.02 }],
    ['0050.TW', { symbol: '0050.TW', market: 'TW', kind: 'etf', pct: 0 }],
    ['NVDA', { symbol: 'NVDA', market: 'US', kind: 'stock', pct: 0.1 }],
    ['2454.TW', { symbol: '2454.TW', market: 'TW', kind: 'stock', pct: NaN }]
  ]);
  assert.deepEqual(movers(quotes, { up: true, group: 'tw' }).map(q => q.symbol), ['2330.TW']);
  assert.deepEqual(movers(quotes, { up: false, group: 'tw' }).map(q => q.symbol), ['2317.TW']);
  assert.deepEqual(movers(quotes, { up: true }).map(q => q.symbol), ['NVDA', '2330.TW']);
  // Watch-only lists (indexes, currencies) are never picks; the popular names and gaps are always read.
  const all = candidates();
  assert.ok(!all.some(s => /^\^(TWII|GSPC|IXIC)$/.test(s)));
  assert.ok(!all.some(s => s.endsWith('=X')));
  assert.ok(new Set(all).size === all.length);
  const wanted = wantedSymbols({ held: ['2330.TW'], max: 500 });
  for (const s of POPULAR) assert.ok(wanted.includes(s), s);
  assert.ok(wantedSymbols({ max: 5 }).length <= 5);
});

test("the bond and commodity lists' yields and futures (watch-only) are never a pick or a mover (^TNX showed as a US mover)", () => {
  const quotes = new Map([
    ['^TNX', { symbol: '^TNX', market: 'US', kind: 'index', pct: 0.06 }],
    ['GC=F', { symbol: 'GC=F', market: 'US', kind: 'future', pct: 0.05 }],
    ['TLT', { symbol: 'TLT', market: 'US', kind: 'etf', pct: 0.04 }],
    ['XAU', { symbol: 'XAU', market: 'METAL', kind: 'metal', pct: 0.04 }]
  ]);
  assert.ok(candidates().includes('^TNX'));
  assert.deepEqual(movers(quotes, { up: true }).map(q => q.symbol), ['TLT', 'XAU']);
  assert.deepEqual(movers(quotes, { up: true, group: 'us' }).map(q => q.symbol), ['TLT']);
  const picks = forYou({ quotes, held: ['2330.TW'], n: 10, aff: {}, now: tpe('2026-10-14', '10:00') }).map(r => r.symbol);
  assert.ok(picks.includes('TLT'));
  assert.ok(!picks.includes('^TNX') && !picks.includes('GC=F'), picks.join());
});
