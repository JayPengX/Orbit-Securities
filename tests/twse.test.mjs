// Taiwan's trading day as TWSE runs it: 08:30 orders and 試撮, the 09:00
// opening auction, continuous trading, the 13:25–13:30 closing auction, and
// the after-hours sessions (盤後零股 13:40, 盤後定價 14:00, both matched at 14:30).
import test from 'node:test';
import assert from 'node:assert/strict';
import { twPhase, afterHoursSend } from '../public/lib/twse.mjs';

const tpe = (d, hm) => Date.parse(`${d}T${hm}:00+08:00`);

test("Taiwan's day in its phases, on a trading day only", () => {
  const day = '2026-10-16'; // a Friday
  const id = hm => twPhase(tpe(day, hm))?.id ?? null;
  assert.equal(id('08:29'), null);
  assert.equal(id('08:30'), 'preopen');
  assert.equal(id('08:59'), 'preopen');
  assert.equal(id('09:00'), 'continuous');
  assert.equal(id('13:24'), 'continuous');
  assert.equal(id('13:25'), 'closing');
  assert.equal(id('13:29'), 'closing');
  assert.equal(id('13:30'), 'after');
  assert.equal(id('14:29'), 'after');
  assert.equal(id('14:30'), null);
  assert.equal(twPhase(tpe(day, '08:45')).until, tpe(day, '09:00'));
  assert.equal(twPhase(tpe(day, '13:26')).until, tpe(day, '13:30'));
  assert.equal(twPhase(tpe(day, '13:50')).until, tpe(day, '14:30'));
  // A Saturday and 國慶日 (10/10) have none.
  assert.equal(twPhase(tpe('2026-10-17', '10:00')), null);
  assert.equal(twPhase(tpe('2026-10-09', '10:00')), null);
});

test('after hours: 盤後零股 takes orders from 13:40, 盤後定價 from 14:00, both matched once at 14:30', () => {
  const day = '2026-10-16';
  // Before its window, an order waits to be sent; in it, it goes at once.
  assert.deepEqual(afterHoursSend(tpe(day, '13:35'), false), { sends: tpe(day, '14:00'), match: tpe(day, '14:30'), waits: true });
  assert.deepEqual(afterHoursSend(tpe(day, '13:35'), true), { sends: tpe(day, '13:40'), match: tpe(day, '14:30'), waits: true });
  assert.deepEqual(afterHoursSend(tpe(day, '13:45'), true), { sends: tpe(day, '13:45'), match: tpe(day, '14:30'), waits: false });
  assert.deepEqual(afterHoursSend(tpe(day, '14:10'), false), { sends: tpe(day, '14:10'), match: tpe(day, '14:30'), waits: false });
  // Not after hours: during the session, from 14:30, on a Saturday.
  assert.equal(afterHoursSend(tpe(day, '13:20'), false), null);
  assert.equal(afterHoursSend(tpe(day, '14:30'), false), null);
  assert.equal(afterHoursSend(tpe('2026-10-17', '14:00'), false), null);
});
