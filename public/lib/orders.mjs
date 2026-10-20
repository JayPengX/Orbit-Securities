// When an order past its end may lapse. The proxy fills every order
// (Shared-Proxy stock-fill.js) from the price bars since it last looked, so
// an order that reached its price just before its end (or while the page was
// closed, or while the proxy couldn't be reached) is only known to have
// filled once the proxy has been asked after that end. Until then it stays
// open; past LAPSE_GRACE after its end it lapses anyway (the proxy out of
// reach for that long: its cash or shares aren't held for ever).
import { expireOrders } from './account.mjs';
import { isTradingDay, localDay } from './holidays.mjs';

export const LAPSE_GRACE = 30 * 60_000;

// Past its end, and asked about since (or long enough past it).
export function mayLapse(order, askedAt, now = Date.now(), grace = LAPSE_GRACE) {
  if (order.status !== 'open' || !order.expires || now < order.expires || order.forced) return false;
  return askedAt >= order.expires || now >= order.expires + grace;
}

// The kit's expireOrders, for the orders that may lapse now: { account,
// expired, waiting } (`waiting`: past their end, the proxy still to be asked).
// `askedAt(id)`: when the proxy last answered for an order; null: no proxy
// (every order past its end lapses, as before).
export function expireAsked(account, askedAt, now = Date.now(), grace = LAPSE_GRACE) {
  if (!askedAt) return { ...expireOrders(account, now), waiting: [] };
  const waiting = account.orders.filter(o => o.status === 'open' && o.expires && now >= o.expires && !o.forced && !mayLapse(o, askedAt(o.id), now, grace));
  if (!waiting.length) return { ...expireOrders(account, now), waiting };
  const held = new Set(waiting.map(o => o.id));
  const ex = expireOrders({ ...account, orders: account.orders.filter(o => !held.has(o.id)) }, now);
  if (!ex.expired.length) return { account, expired: [], waiting };
  const done = new Map(ex.account.orders.map(o => [o.id, o]));
  return { account: { ...ex.account, orders: account.orders.map(o => done.get(o.id) || o) }, expired: ex.expired, waiting };
}

// When an overdraft (NT$ cash below zero) that began at `since` defaults:
// T+2, two Taiwan business days on (weekends and market holidays skipped),
// at the same time of day. (Taipei keeps no summer time, so whole days do.)
const OD_DAYS = 2;
export function odDeadline(since, days = OD_DAYS) {
  let t = since;
  for (let n = days, i = 0; n > 0 && i < 60; i++) {
    t += 86_400_000;
    if (isTradingDay('TW', localDay(t, 'Asia/Taipei'))) n--;
  }
  return t;
}
