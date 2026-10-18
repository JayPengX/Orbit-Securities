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

// A won IPO's shares come in an `ipowin`, not a `fill`: they get dividends too.
test('a 新股申購 holding gets its dividends like any other', () => {
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
  // A Taiwan holiday on a weekday (2026-10-26, 光復節): the US, which traded overnight.
  assert.equal(moverGroupNow(tpe('2026-10-26', '10:00')), 'us');
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

// The held kit's TWSE rules (closing call auction, after-hours order windows,
// 新上市 with no limit, 追繳 met by paying the 差額, NHI rounded half up),
// each checked on the kit in use: an older kit keeps its own behaviour.
import * as SA from '../public/lib/account.mjs';
import * as SM from '../public/lib/markets.mjs';
import * as SC from '../public/lib/credit.mjs';
import * as SI from '../public/lib/ipo.mjs';
import { readFileSync } from 'node:fs';

const twseKit = typeof SC.closingAuction === 'function';
const twAt = (day, hm, price = 100, over = {}) => ({
  symbol: '2330.TW', name: 'TSMC', kind: 'stock', market: 'TW', currency: 'TWD', price, prev: price, tz: 'Asia/Taipei',
  marketTime: tpe(day, hm), session: { start: tpe(day, '09:00'), end: tpe(day, '13:30') }, line: [], ...over
});

test("TWSE's closing call auction (13:25-13:30): a whole-lot market order is refused, a limit one taken (older kit: as before)", () => {
  const day = '2026-10-13';
  const a = newAccount(1_000_000, tpe(day, '09:00') - 10 * DAY, 'acc');
  const now = tpe(day, '13:27');
  const place = req => placeOrder(a, { side: 'buy', qty: 1000, ...req }, { quote: twAt(day, '13:07'), rates: { TWD: 1 }, valuation: valuate(replay(a, now), new Map(), { TWD: 1 }), now, id: 'o' });
  const market = place({ type: 'market' });
  if (twseKit) assert.deepEqual(market, { error: 'closingAuction', match: tpe(day, '13:30') });
  else assert.notEqual(market.error, 'closingAuction');
  const limit = place({ type: 'limit', limit: 100 });
  assert.equal(limit.error, undefined);
  // A day order: on the held kit it waits CLOSE_DECIDE past 13:30 for that match.
  assert.equal(limit.order.expires, tpe(day, '13:30') + (twseKit ? SA.CLOSE_DECIDE : 0));
});

test('after hours: 盤後零股 takes orders from 13:40, 盤後定價 from 14:00, both matched at 14:30 (older kit: held until then)', () => {
  const day = '2026-10-13';
  const a = newAccount(1_000_000, tpe(day, '09:00') - 10 * DAY, 'acc');
  const place = (qty, hm) => placeOrder(a, { side: 'buy', type: 'limit', limit: 100, qty }, { quote: twAt(day, '13:30'), rates: { TWD: 1 }, valuation: valuate(replay(a, tpe(day, hm)), new Map(), { TWD: 1 }), now: tpe(day, hm), id: `o${qty}${hm}` });
  for (const [qty, hm, from] of [[500, '13:35', '13:40'], [1000, '13:45', '14:00']]) {
    const r = place(qty, hm);
    if (twseKit) assert.deepEqual(r, { error: 'afterHoursWait', from: tpe(day, from) });
    else assert.equal(r.order.after, tpe(day, '14:30'));
  }
  assert.equal(place(500, '13:45').order.after, tpe(day, '14:30'));
  assert.equal(place(1000, '14:05').order.after, tpe(day, '14:30'));
  if (twseKit) assert.deepEqual(SC.afterHours(tpe(day, '13:35'), true), { from: tpe(day, '13:40'), match: tpe(day, '14:30') });
});

test('a first listing (初上市) has no daily limit for its first five trading days, once the app sets quote.listed (older kit: ±10%)', () => {
  const list = [{ symbol: '7867.TW', kind: '初上市', list: tpe('2026-10-22', '00:00') }];
  const listed = SI.listedOn?.(list, '7867.TW') ?? null;
  const q = { symbol: '7867.TW', kind: 'stock', market: 'TW', currency: 'TWD', price: 60, prev: 50, listed };
  const band = priceLimits(q, tpe('2026-10-28', '10:00'));
  if (typeof SI.listedOn === 'function') {
    assert.equal(listed, tpe('2026-10-22', '00:00'));
    assert.equal(band, null);
    assert.deepEqual(priceLimits(q, tpe('2026-10-30', '10:00')), { up: 55, down: 45 }, 'the sixth trading day: ±10% again');
  } else assert.deepEqual(band, { up: 55, down: 45 });
});

test('追繳 is met once the 差額 called is paid in full (callPaid), on a kit that counts it; else only back at 166%', () => {
  const now = tpe('2026-10-13', '15:00');
  const call = { since: now, due: now + 2 * DAY, need: 10_000 };
  const v = { owed: 100_000, assets: 125_000, ratio: 1.25 };
  const account = { events: [{ id: 'repay:p1', type: 'repay', t: now + 1000, currency: 'TWD', amount: 10_000 }] };
  const paid = SA.callPaid?.(account, call, { TWD: 1 }) ?? 0;
  const c = SA.callState(call, v, now + DAY, paid);
  if (typeof SA.callPaid === 'function') {
    assert.equal(paid, 10_000);
    assert.deepEqual(c, { call: null, sell: false, event: 'met', paid: true });
  } else assert.deepEqual(c.call, call);
});

test("二代健保 on a dividend: 2.11% to the dollar, half up on the kit with NT$10M's cap (older kit: cut down)", () => {
  const halfUp = typeof SM.nhiPremium === 'function';
  assert.equal(dividendTaxes('TW', 20_030).nhi, halfUp ? 423 : 422);
  assert.equal(dividendTaxes('TW', 20_010).nhi, 422);
  assert.equal(dividendTaxes('TW', 12_000_000).nhi, halfUp ? 211_000 : 253_200);
});

test("the app reads the held kit's new exports through the module, never by name (a phone may run an older kit)", () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const named = [...app.matchAll(/^import \{([^}]*)\} from '\.\/lib\/[a-z]+\.mjs'/gm)].flatMap(m => m[1].split(',').map(x => x.trim()));
  for (const name of ['closingAuction', 'closingMatch', 'CLOSE_DECIDE', 'callPaid', 'listedOn', 'divPayDate', 'nhiPremium', 'NHI_CAP', 'newListing']) assert.ok(!named.includes(name), name);
  assert.match(app, /stockAccount\.callPaid\?\.\(/);
  assert.match(app, /stockIpo\.listedOn\?\.\(/);
});
