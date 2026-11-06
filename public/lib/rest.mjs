// Prices that can't move until their market opens again, left out of the
// every-45-seconds reads (Jay 2026-11-06: save quota hard, never so the
// person notices): a quote whose market has shut for the day, read after
// that day's last price was out (the session's end, the market's own delay
// and half an hour more, for a late closing print), and whose next session
// is more than 15 minutes off. Before a market opens the same, from the last
// session's end. A market at lunch, past a half day's early close or shut by
// a typhoon (its session still on) is read as before, and so is a quote with
// no session or never timed (`got`).
//
// Never resting: crypto (it never shuts); currencies and futures (Yahoo's day
// for them isn't when they trade: gold from Sunday evening in New York,
// currencies from Monday morning in Wellington); and what's priced from them
// or from the day itself (TAIFEX's from the index and the day's settlement,
// passbook metals, government bonds, funds' NAVs).
import { delayOf, isOpen, zonedTime } from './markets.mjs';
import * as markets from './markets.mjs';
import { isTradingDay } from './holidays.mjs';

const MIN = 60_000;
// Read again this long before the next session starts.
export const WAKE_MS = 15 * MIN;
// Past the market's own delay, before a day's last price counts as out.
export const SETTLE_MS = 30 * MIN;
const RESTLESS_MARKETS = new Set(['CRYPTO', 'FX', 'TAIFEX', 'METAL', 'BOND', 'TWFUND']);
const RESTLESS_KINDS = new Set(['crypto', 'fx', 'future', 'fut', 'opt', 'metal', 'fund']);

// A moment's wall clock in a zone.
function wall(t, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(t).map(x => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day, hh: p.hour % 24, mm: p.minute, ss: p.second };
}
const pad = n => String(n).padStart(2, '0');

// The same wall-clock time as `t` in `tz` on the market's next (dir 1) or
// previous (dir -1) trading day: a session moved over weekends, holidays
// and a change of the clocks (09:30 in New York stays 09:30).
export function tradingDayShift(market, t, tz, dir = 1) {
  const w = wall(t, tz);
  for (let k = 1; k <= 30; k++) {
    const day = new Date(Date.UTC(w.y, w.m - 1, w.d + dir * k));
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    if (isTradingDay(market, `${y}-${pad(m)}-${pad(d)}`)) return zonedTime(y, m, d, w.hh, w.mm, w.ss, tz);
  }
  return null;
}

// Whether a quote can be left out of this read.
export function resting(q, now = Date.now()) {
  if (!q?.session || !Number.isFinite(q.got) || RESTLESS_MARKETS.has(q.market) || RESTLESS_KINDS.has(q.kind) || /=[XF]$/i.test(q.symbol || '') || isOpen(q, now)) return false;
  const tz = q.tz || 'UTC';
  const { start } = q.session;
  const end = markets.sessionEnd?.(q) ?? q.session.end;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const settle = (delayOf(q.market) || 0) * MIN + SETTLE_MS;
  let lastEnd;
  let nextStart;
  if (now >= end) {
    lastEnd = end;
    nextStart = tradingDayShift(q.market, start, tz, 1);
  } else if (now < start) {
    lastEnd = tradingDayShift(q.market, end, tz, -1);
    nextStart = start;
  } else return false;
  return lastEnd != null && nextStart != null && q.got >= lastEnd + settle && now < nextStart - WAKE_MS;
}
