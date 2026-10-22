// 真相's numbers (資金 › 真相): what trading costs, the overdraft's year, this account's record.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { roundTrip, overdraftYear, overdraftPaid } = await import('../public/lib/truth.mjs');

test('truth: what trading costs', () => {
  assert.deepEqual(roundTrip(100_000), { fee: 284, tax: 300, total: 584, share: 0.00584 });
  // The commission minimum still applies.
  assert.equal(roundTrip(1_000).fee, 40);
  assert.ok(roundTrip(100_000, { dayTrade: true }).tax < roundTrip(100_000).tax);
  assert.ok(overdraftYear() > 0.12 && overdraftYear() < 0.13);
});

test('truth: overdraft interest paid, from the Worker’s entries only', () => {
  const w = { entries: [{ id: 'eco:od:2026-10', app: 'eco', kind: 'od', amount: -120 }, { id: 'eco:od:2026-11', app: 'eco', kind: 'od', amount: -80 }, { id: 'x', app: 'stock', kind: 'od', amount: -999 }] };
  assert.equal(overdraftPaid(w), 200);
  assert.equal(overdraftPaid(null), 0);
});
