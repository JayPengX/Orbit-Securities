// Taiwan's trading day as TWSE runs it (https://www.twse.com.tw/zh/products/system/trading.html):
// orders from 08:30, with 試撮 (trial prices) until the 09:00 opening call
// auction; continuous trading to 13:25; the closing call auction 13:25–13:30
// (試撮 again); then the after-hours sessions, 盤後零股 taking orders from
// 13:40 and 盤後定價 from 14:00, each matched once at 14:30.
import { isTradingDay, localDay } from './holidays.mjs';
import { MARKET_TZ, marketOf, priceLimits, tickSize, isOddLot } from './markets.mjs';

const at = (day, hm) => Date.parse(`${day}T${hm}:00+08:00`);
const PHASES = [
  ['08:30', 'preopen'],
  ['09:00', 'continuous'],
  ['13:25', 'closing'],
  ['13:30', 'after'],
  ['14:30', null]
];

// The phase Taiwan's market is in at `t`: { id, from, until }, or null
// (closed: before 08:30, after 14:30, weekends and holidays).
export function twPhase(t) {
  const day = localDay(t, 'Asia/Taipei');
  if (!isTradingDay('TW', day)) return null;
  for (let i = 0; i < PHASES.length - 1; i++) {
    const from = at(day, PHASES[i][0]);
    const until = at(day, PHASES[i + 1][0]);
    if (t >= from && t < until) return { id: PHASES[i][1], from, until };
  }
  return null;
}

// An order placed after hours (13:30–14:30): when it reaches the exchange,
// 盤後零股 (`odd`) from 13:40 and 盤後定價 from 14:00 (one placed before is
// held until then), and the 14:30 match. Null outside those hours.
export function afterHoursSend(t, odd) {
  const p = twPhase(t);
  if (p?.id !== 'after') return null;
  const opens = at(localDay(t, 'Asia/Taipei'), odd ? '13:40' : '14:00');
  return { sends: Math.max(t, opens), match: p.until, waits: t < opens };
}

// A price at the day's limit: 'up' at 漲停, 'down' at 跌停, else null (no
// band, as in the US, or no previous close to count it from). Taiwan's
// brokers mark it on the price (a red or green fill).
export function atLimit(q) {
  const band = q ? priceLimits(q) : null;
  if (!band || !(q.price > 0)) return null;
  const tick = tickSize(q.market, q.kind, q.price, q.symbol) || 1e-6;
  if (q.price >= band.up - tick / 2) return 'up';
  if (q.price <= band.down + tick / 2) return 'down';
  return null;
}

// The holdings that go 除息 (a dividend's ex-date) or 除權 (a split, Yahoo's
// stock dividends among them) today, in each one's own market day:
// Map symbol → 'div' | 'split' | 'both'.
export function exDayTags(events, now = Date.now()) {
  const out = new Map();
  for (const e of events || []) {
    const at = e.type === 'div' ? e.ex : e.type === 'split' ? e.t : null;
    if (at == null) continue;
    const tz = MARKET_TZ[e.market || marketOf(e.symbol)] || 'Asia/Taipei';
    if (localDay(at, tz) !== localDay(now, tz)) continue;
    const was = out.get(e.symbol);
    out.set(e.symbol, !was || was === e.type ? e.type : 'both');
  }
  return out;
}

// A Taiwan whole-lot day order's 13:30 closing match, where the kit keeps it
// open past the close (CLOSE_DECIDE) until that match is known: the close it
// ends with, as the exchange has it. Null otherwise, and on a kit without
// `closingAuction` (stock-credit.mjs).
export function closeMatchOf(o, closingAuction) {
  if (o.tif !== 'day' || o.market !== 'TW' || o.after || !o.expires || !['stock', 'etf', 'bond'].includes(o.kind) || isOddLot(o.market, o.kind, o.qty)) return null;
  const match = closingAuction?.(o.expires)?.match;
  return match && o.expires > match ? match : null;
}
// What an open order's row says it waits for: 'after' (an after-hours order
// not yet sent), 'closeMatch' (past 13:30, the closing match not known yet:
// 等待 13:30 收盤撮合結果), or null (waiting for a price).
export function orderWaitKind(o, closeAt, now) {
  if (o.status !== 'open') return null;
  if (o.after) return 'after';
  return closeAt && now >= closeAt ? 'closeMatch' : null;
}
