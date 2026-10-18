// Taiwan's trading day as TWSE runs it (https://www.twse.com.tw/zh/products/system/trading.html):
// orders from 08:30, with 試撮 (trial prices) until the 09:00 opening call
// auction; continuous trading to 13:25; the closing call auction 13:25–13:30
// (試撮 again); then the after-hours sessions, 盤後零股 taking orders from
// 13:40 and 盤後定價 from 14:00, each matched once at 14:30.
import { isTradingDay, localDay } from './holidays.mjs';

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
