// Prices left out of the 45-second reads while their market is shut
// (lib/rest.mjs): only once the day's last price was read, and never past
// 15 minutes before the next session, over weekends, holidays and a change
// of the clocks; never crypto, currencies, futures or what's priced from them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resting, tradingDayShift, WAKE_MS } from '../public/lib/rest.mjs';

const at = s => Date.parse(s);
const MIN = 60_000;
// A Taiwan share on a day's session (09:00–13:30), read at `got`.
const tw = (day, got, extra = {}) => ({ symbol: '2330.TW', kind: 'stock', market: 'TW', tz: 'Asia/Taipei', price: 1000, session: { start: at(`${day}T09:00:00+08:00`), end: at(`${day}T13:30:00+08:00`) }, got, ...extra });
// A US share on a session given in UTC.
const us = (start, end, got, extra = {}) => ({ symbol: 'AAPL', kind: 'stock', market: 'US', tz: 'America/New_York', price: 200, session: { start: at(start), end: at(end) }, got, ...extra });

test('a Taiwan share rests from its close (20 minutes behind and half an hour more) to 15 minutes before the next session, over the weekend', () => {
  const q = tw('2026-11-06', at('2026-11-06T14:21:00+08:00'));
  assert.equal(resting(q, at('2026-11-06T14:22:00+08:00')), true);
  assert.equal(resting(q, at('2026-11-07T12:00:00+08:00')), true, 'Saturday');
  assert.equal(resting(q, at('2026-11-09T08:44:00+08:00')), true, 'Monday, before 08:45');
  assert.equal(resting(q, at('2026-11-09T08:46:00+08:00')), false, 'Monday from 08:45: read again');
  assert.equal(resting(q, at('2026-11-10T03:00:00+08:00')), false, 'a session it missed: read');
});

test('the day\'s last price must have been read first: a price read before then is read again', () => {
  const q = tw('2026-11-06', at('2026-11-06T14:19:00+08:00'));
  assert.equal(resting(q, at('2026-11-06T14:22:00+08:00')), false);
  assert.equal(resting(q, at('2026-11-07T12:00:00+08:00')), false, 'still read on Saturday, once');
  assert.equal(resting({ ...q, got: undefined }, at('2026-11-07T12:00:00+08:00')), false, 'never timed: read');
});

test('before the open, from the last session\'s close', () => {
  const q = tw('2026-11-09', at('2026-11-06T14:30:00+08:00'));
  assert.equal(resting(q, at('2026-11-09T08:30:00+08:00')), true);
  assert.equal(resting(q, at('2026-11-09T08:50:00+08:00')), false);
  assert.equal(resting(tw('2026-11-09', at('2026-11-06T14:00:00+08:00')), at('2026-11-09T08:30:00+08:00')), false, 'Friday\'s close never read');
});

test('never while the session is on: open, at lunch, after a half day\'s early close or shut by a typhoon', () => {
  assert.equal(resting(tw('2026-11-09', at('2026-11-09T10:00:00+08:00')), at('2026-11-09T10:00:30+08:00')), false);
  const jp = { symbol: '7203.T', kind: 'stock', market: 'JP', tz: 'Asia/Tokyo', price: 3000, session: { start: at('2026-11-09T09:00:00+09:00'), end: at('2026-11-09T15:30:00+09:00') }, got: at('2026-11-09T11:59:00+09:00') };
  assert.equal(resting(jp, at('2026-11-09T12:00:00+09:00')), false, 'Tokyo at lunch');
});

test('a holiday is rested over', () => {
  const q = tw('2026-12-31', at('2026-12-31T14:30:00+08:00'));
  assert.equal(resting(q, at('2027-01-01T10:00:00+08:00')), true, 'New Year\'s Day');
  assert.equal(resting(q, at('2027-01-04T08:44:00+08:00')), true);
  assert.equal(resting(q, at('2027-01-04T08:46:00+08:00')), false);
});

test('New York\'s 09:30 stays 09:30 when the clocks change, both ways', () => {
  // Summer time ends on 2026-11-01: Friday's 09:30 EDT is 13:30 UTC, Monday's 09:30 EST 14:30.
  const fall = us('2026-10-30T13:30:00Z', '2026-10-30T20:00:00Z', at('2026-10-30T20:31:00Z'));
  assert.equal(resting(fall, at('2026-10-30T20:32:00Z')), true);
  assert.equal(resting(fall, at('2026-11-02T14:14:00Z')), true);
  assert.equal(resting(fall, at('2026-11-02T14:16:00Z')), false);
  // It starts on 2027-03-14: Friday's 09:30 EST is 14:30 UTC, Monday's 09:30 EDT 13:30 (a day of
  // 24 hours on would wake an hour late).
  const spring = us('2027-03-12T14:30:00Z', '2027-03-12T21:00:00Z', at('2027-03-12T21:31:00Z'));
  assert.equal(resting(spring, at('2027-03-15T13:14:00Z')), true);
  assert.equal(resting(spring, at('2027-03-15T13:16:00Z')), false);
  assert.equal(tradingDayShift('US', at('2027-03-12T14:30:00Z'), 'America/New_York', 1), at('2027-03-15T13:30:00Z'));
  assert.equal(tradingDayShift('US', at('2027-03-15T20:00:00Z'), 'America/New_York', -1), at('2027-03-12T21:00:00Z'));
  assert.equal(WAKE_MS, 15 * MIN);
});

test('never crypto, currencies, futures, or what\'s priced from them or the day', () => {
  const weekend = at('2026-11-07T12:00:00+08:00');
  const shut = tw('2026-11-06', at('2026-11-06T14:30:00+08:00'));
  assert.equal(resting(shut, weekend), true, 'the share itself does');
  for (const extra of [
    { symbol: 'BTC-USD', kind: 'crypto', market: 'CRYPTO' },
    { symbol: 'USDTWD=X', kind: 'fx', market: 'FX' },
    { symbol: 'GC=F', kind: 'future', market: 'US' },
    { symbol: 'TXFL6.TF', kind: 'fut', market: 'TAIFEX' },
    { symbol: 'TXO', kind: 'opt', market: 'TAIFEX' },
    { symbol: 'XAU', kind: 'metal', market: 'METAL' },
    { symbol: 'US10Y', kind: 'govbond', market: 'BOND' },
    { symbol: 'A12345.TWF', kind: 'fund', market: 'TWFUND' }
  ])
    assert.equal(resting({ ...shut, ...extra }, weekend), false, extra.symbol);
  assert.equal(resting({ ...shut, session: null }, weekend), false, 'no session');
  assert.equal(resting(undefined, weekend), false, 'never read');
});
