// The account's pool, cover plan and fund fee.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccount, replay } from '../public/lib/account.mjs';

test('the pool mirrors the wallet: a deposit whose entry the clean-up retired goes', () => {
  const a = newAccount(0, Date.UTC(2026, 8, 1));
  const t = Date.UTC(2026, 8, 2);
  const before = { entries: [{ id: 'eco:pay:2026-09', t, app: 'eco', kind: 'pay', amount: 6_000 }, { id: 'vocab:shop:pack:toeic', t, app: 'vocab', kind: 'shop', amount: -990 }] };
  const { account } = applyPool(a, before);
  assert.equal(replay(account, t + 1).cash.TWD, 5_010);
  // The clean keeps the money as one entry instead.
  const after = { entries: [before.entries[0], { id: 'eco:rebase:hub', t: t + 5, app: 'eco', kind: 'rebase', amount: -990 }] };
  const next = applyPool(account, after);
  assert.deepEqual(next.added.map(e => e.id), ['x:eco:rebase:hub']);
  assert.ok(!next.account.events.some(e => e.id === 'x:vocab:shop:pack:toeic'));
  assert.equal(replay(next.account, t + 10).cash.TWD, 5_010);
  // Nothing changed: the same account back.
  assert.equal(applyPool(next.account, after).account, next.account);
});

import { coverPlan } from '../public/lib/account.mjs';
test('cover plan: the fewest, largest sales that clear an overdraft', () => {
  const v = { positions: [
    { symbol: 'A.TW', kind: 'stock', qty: 1000, valueTWD: 100_000, short: false },
    { symbol: 'B', kind: 'stock', qty: 10, valueTWD: 20_000, short: false },
    { symbol: 'S', kind: 'stock', qty: -5, valueTWD: 5_000, short: true }
  ] };
  const { plan, covered } = coverPlan(v, 30_000);
  assert.equal(covered, true);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].symbol, 'A.TW');
  assert.equal(plan[0].qty, 303);
  const big = coverPlan(v, 110_000);
  assert.deepEqual(big.plan.map(x => x.symbol), ['A.TW', 'B']);
  assert.equal(big.plan[0].all, true);
  assert.equal(coverPlan(v, 500_000).covered, false);
});

import { applyPool, valuate as valuateAcct } from '../public/lib/account.mjs';
test('the economy reset lands as a negative pooled deposit: cash can go below zero', () => {
  const a = newAccount(0, Date.UTC(2026, 8, 1));
  const wallet = { entries: [{ id: 'eco:start', t: Date.UTC(2026, 8, 1), app: 'eco', kind: 'start', amount: 110_000 }, { id: 'eco:rebase:v3', t: Date.UTC(2026, 8, 29), app: 'eco', kind: 'rebase', amount: -80_000 }, { id: 'odds:x', t: Date.UTC(2026, 8, 29), app: 'odds', kind: 'stake', amount: -50_000 }] };
  const { account } = applyPool(a, wallet);
  const s = replay(account, Date.UTC(2026, 9, 1));
  assert.equal(s.cash.TWD, -20_000);
  const v = valuateAcct(s, new Map(), { TWD: 1 });
  assert.ok(Number.isFinite(v.netWorth));
  assert.equal(v.netWorth, -20_000);
});

import { tradeCosts, FUND_FEE } from '../public/lib/markets.mjs';
test('mutual funds: a subscription fee on buying, nothing on selling', () => {
  assert.equal(tradeCosts({ market: 'US', side: 'buy', kind: 'fund', gross: 1_000, currency: 'USD' }).total, 1_000 * FUND_FEE);
  assert.deepEqual(tradeCosts({ market: 'US', side: 'sell', kind: 'fund', gross: 1_000, currency: 'USD' }), { commission: 0, tax: 0, fee: 0, total: 0, taxRate: 0, feeRate: 0 });
  // A US stock still pays the broker's commission and the SEC fee on sale.
  assert.ok(tradeCosts({ market: 'US', side: 'sell', kind: 'stock', gross: 1_000, currency: 'USD' }).fee > 0);
});
