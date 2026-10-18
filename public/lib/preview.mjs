// What a screen shows before anything is done: the ticket's estimate, the
// most a short can sell, Plus's price on the same trade, a time deposit's
// end and interest, a loan of shares' fee. Each is worked out by the very
// rules that then do it (the kit's stock-*), so the preview is what happens.
import { defaulted, estimate, placeOrder, replay, requiredCash } from './account.mjs';
import { SHORT_INITIAL, collateralRate, dealPrice, isOddLot, localDayOf, priceLimits, qtyStep, roundQty, tickSize, toTick, tradeCosts } from './markets.mjs';
import { SHORT_DEPOSIT, SHORT_HANDLING, creditAccount, creditUsed, dayTradeBuyFirst } from './credit.mjs';
import * as credit from './credit.mjs';
import { addMonths, lendFee, LEND_RATE, tdInterest, tdRate } from './savings.mjs';

const DAY = 86_400_000;
const YEAR = 365 * DAY;

// A Taiwan sale that pays the day-trade tax (half): a day trade sold first
// (現股當沖), or shares bought today by an account that may day trade
// buying first (3 months open, 10 trades in the year), as a fill has it.
export function isDayTradeSell(account, { symbol, market, side, dayShort = false }, now = Date.now()) {
  if (side !== 'sell' || market !== 'TW') return false;
  if (dayShort) return true;
  if (!dayTradeBuyFirst(account, now)) return false;
  const today = localDayOf(now, 'TW');
  return (account?.events || []).some(e => e.type === 'fill' && e.symbol === symbol && e.side === 'buy' && e.t <= now && localDayOf(e.t, 'TW') === today);
}

// The ticket's estimate, as the fill will be: the day-trade tax where it
// applies, and a 融券 sale's 0.08% handling on the part sold short (`held`:
// the shares there are).
export function ticketEstimate(account, { quote, side, qty, price, first = false, credit = false, dayShort = false, held = 0, now = Date.now() }) {
  const dayTrade = isDayTradeSell(account, { symbol: quote.symbol, market: quote.market, side, dayShort }, now);
  let est = estimate({ market: quote.market, kind: quote.kind, currency: quote.currency, side, qty, price, t: now, dayTrade, first });
  if (credit && side === 'sell' && qty > 0) {
    const handling = Math.floor(((est.gross * Math.max(0, qty - Math.max(0, held))) / qty) * SHORT_HANDLING);
    if (handling > 0) est = { ...est, fee: est.fee + handling, costs: est.costs + handling, total: est.total - handling, handling };
  }
  return { ...est, dayTrade };
}

// The commission the same trade pays a Quadra Plus member: the discount,
// then the market's minimum (a broker's 2.8折 still charges NT$20 at least).
export function plusCommission({ market, kind, side, gross, currency, qty, dayTrade = false }, discount) {
  return tradeCosts({ market, side, kind, gross, currency, discount, oddLot: isOddLot(market, kind, qty), dayTrade }).commission;
}

// How many more can be sold short than are held, by the rule the order is
// checked against: in Taiwan with the credit account (融券), the credit
// limit left and the 90% deposit the cash covers; elsewhere (and a day trade
// sold first), assets of SHORT_INITIAL of everything owed afterwards; a
// day trade sold first, within the day's day-trade limit left too (`dayLeft`,
// NT$). `unit`: one share's NT$ value now; `dayUnit`: one share's NT$ at the
// price the day-trade limit counts it (dayTradePrice; `unit` if not given).
export function shortRoom(v, { unit, price, kind, credit = null, cash = 0, dayLeft = null, dayUnit = unit }) {
  if (!v || v.margin !== 'ok' || !(unit > 0)) return 0;
  if (credit?.open) {
    const limit = Math.max(0, credit.limit - creditUsed(v).short);
    return roundQty(Math.max(0, Math.min(limit / price, Math.max(0, cash) / (SHORT_DEPOSIT * price))), kind);
  }
  const room = Math.max(0, (v.assets - SHORT_INITIAL * (v.debtTWD + v.shortTWD)) / (SHORT_INITIAL - 1));
  return roundQty(Math.min(room / unit, dayLeft == null ? Infinity : dayLeft / (dayUnit > 0 ? dayUnit : unit)), kind);
}

// The price a day trade sold first is counted at against the day's limit
// (當沖額度), as a broker counts it: a limit order at its limit; a market (or
// stop) order at the most it could fill at, 漲停 (the price where there's no
// band).
export function dayTradePrice(quote, { type, limit } = {}) {
  if (type === 'limit' && Number(limit) > 0) return Number(limit);
  return priceLimits(quote)?.up ?? quote.price;
}

// The day's day-trade limit (當沖額度) on what's sold first: { limit, used,
// left } in NT$, or null on a kit without it (read through the module: a
// phone may run an older kit).
export const dayTradeLeft = (account, netWorthTWD, now = Date.now()) => credit.dayTradeRoom?.(account, netWorthTWD, now) ?? null;
// (The credit account for a Taiwan short, or none: it's only Taiwan's that sets 融券's terms.)
export const shortCredit = (account, market, now = Date.now()) => (market === 'TW' ? creditAccount(account, now) : null);

// The shares held of a symbol now (for a 融券's handling: only the part sold short pays it).
export const heldQty = (account, symbol, now = Date.now()) => Math.max(0, replay(account, now).positions[symbol]?.qty || 0);

// A time deposit opened now: its rate, when it ends (openDeposit's date, the
// month's last day when it's short) and its interest at maturity.
export function tdPreview(amount, months, now = Date.now()) {
  const rate = tdRate(months);
  if (rate == null) return null;
  const ends = addMonths(now, months);
  return { rate, ends, gross: tdInterest({ amount, rate, months, t: now, ends }, ends).gross };
}
// What a deposit pays at maturity.
export const tdFull = td => tdInterest(td, td.ends).gross;

// Lending `qty` shares at `price` for a year: the rate, and what comes in after the broker's cut and taxes.
export function lendYear(kind, qty, price) {
  const rate = LEND_RATE[kind] ?? 0;
  return { rate, net: qty > 0 && price > 0 ? lendFee({ qty, price, rate, t: 0 }, YEAR).net : 0 };
}

// The chart range an account's history reads, by its age.
export const historyRange = age => (age < 25 * DAY ? '1mo' : age < 170 * DAY ? '6mo' : age < 360 * DAY ? '1y' : '5y');

// The price a limit or stop field starts at: the last price on the
// exchange's tick (Yahoo's US prices carry 4 decimals: 187.4321 opened the
// ticket on a price the exchange refuses); no tick, as it was.
export function startPrice(q) {
  if (!(q?.price > 0)) return '';
  const tick = tickSize(q.market, q.kind, q.price);
  return String(tick ? toTick(q.price, tick) : +q.price.toPrecision(6));
}

// Taiwan takes whole lots (整股, 1,000 shares) and odd lots (零股, 1 to 999)
// as separate orders: 1,500 shares is two. { board, odd } when `qty` mixes
// them, else null.
export function lotSplit(market, kind, qty) {
  if (!isOddLot(market, kind, qty) || qty < 1000) return null;
  const board = Math.floor(qty / 1000) * 1000;
  return { board, odd: qty - board };
}
// Taiwan's 盤中零股 takes limit orders only (TWSE): an order with an odd-lot
// part, alone or after its whole lots, must be a limit order.
export function oddLotNeedsLimit(market, kind, qty, type) {
  return type !== 'limit' && isOddLot(market, kind, qty);
}
// The orders a quantity goes in as (整零合併, as Taiwan's broker apps do it):
// a mixed one is two, the whole lots then the odd lot; any other, itself.
export function lotParts(market, kind, qty) {
  const split = lotSplit(market, kind, qty);
  return split ? [split.board, split.odd] : [qty];
}

// The ticket's estimate over those orders, added up (each pays its own
// commission, the odd lot at its NT$1 minimum); the welcome's free first
// trade on the first, a 融券 sale's shares held taken by the first.
const ADDED = ['gross', 'commission', 'tax', 'fee', 'costs', 'total'];
export function lotsEstimate(account, opts) {
  const parts = lotParts(opts.quote.market, opts.quote.kind, opts.qty);
  if (parts.length === 1) return ticketEstimate(account, opts);
  let held = opts.held || 0;
  const each = parts.map((qty, i) => {
    const est = ticketEstimate(account, { ...opts, qty, held, first: Boolean(opts.first) && i === 0 });
    held = Math.max(0, held - qty);
    return est;
  });
  const sum = { ...each[0] };
  for (const k of ADDED) if (typeof sum[k] === 'number') sum[k] = each.reduce((n, e) => n + (e[k] || 0), 0);
  const handling = each.reduce((n, e) => n + (e.handling || 0), 0);
  if (handling) sum.handling = handling;
  return sum;
}

// What a buy holds (requiredCash) over those orders, added up: { reserve, buffer }.
export function lotsHold(order, quote, now = Date.now()) {
  const held = lotParts(quote.market, quote.kind, order.qty).map(qty => requiredCash({ ...order, qty }, quote, now));
  if (held.length === 1) return held[0];
  return { reserve: held.reduce((n, x) => n + x.reserve, 0), buffer: held.reduce((n, x) => n + x.buffer, 0) };
}

// Places `req` as those orders, each on the account the one before left.
// A mixed quantity is first checked whole (what's checked per order, such
// as 融資's credit limit, counts both): when the whole would fail, neither
// goes in. When the odd lot fails after the whole lots went in, the whole
// lots stand (two orders, as at a broker). `place`: placeOrder or the
// app's wrapper of it.
// { account (null: nothing changed), parts: [{ qty, r }], failed: { qty, r } | null }.
const refused = r => Boolean((r.error && !r.account) || r.order?.status === 'rejected');
export function placeLots(account, req, opts, place = placeOrder) {
  const qty = Number(req.qty);
  const parts = opts.quote ? lotParts(opts.quote.market, opts.quote.kind, qty) : [qty];
  if (parts.length > 1) {
    const whole = place(account, req, opts);
    if (whole.error && !whole.account) return { account: null, parts: [], failed: { qty, r: whole } };
  }
  const done = [];
  let next = account;
  let changed = false;
  for (const [i, n] of parts.entries()) {
    const r = place(next, { ...req, qty: n }, i && opts.id ? { ...opts, id: `${opts.id}:${i}` } : opts);
    done.push({ qty: n, r });
    if (r.account) {
      next = r.account;
      changed = true;
    }
    if (refused(r)) return { account: changed ? next : null, parts: done, failed: { qty: n, r } };
  }
  return { account: changed ? next : null, parts: done, failed: null };
}

// The most a buy can be for: the largest quantity whose hold (`holdFor(n)`,
// lotsHold's reserve, 融資's own part only) fits `spendable`. `price`: one
// unit's price, for the search's top. `cap`: a quantity it can't pass
// (融資 within the credit limit left).
export function maxBuy({ holdFor, spendable, price, kind, margin = 0, cap = Infinity }) {
  if (!(spendable > 0) || !(price > 0)) return 0;
  const step = qtyStep(kind);
  // In steps: the top a little past what the cash buys on its own part.
  let lo = 0;
  let hi = Math.ceil(spendable / (price * Math.max(0.05, 1 - margin)) / step) + 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (holdFor(roundQty(mid * step, kind)) <= spendable + 1e-9) lo = mid;
    else hi = mid - 1;
  }
  return roundQty(Math.min(lo * step, cap), kind);
}

// 融資's rate on the ticket: a buy of what the broker lends against, only
// with the credit account open and not after a default (no 融資 then,
// DEFAULT_BAN long); else 0.
export function marginRateFor(account, quote, side, now = Date.now()) {
  if (side !== 'buy' || !creditAccount(account, now).open || defaulted(account, now)) return 0;
  return collateralRate(quote.kind, quote.market, quote.symbol);
}

// The ticket's 最大 for a buy of `order` ({ type, limit, stop }) filling at
// `ref`: what `spendable` holds (lotsHold, held for a fresh price as every
// order from the ticket is); on 融資 (`margin`, its rate) one's own part
// only and, in Taiwan, within the credit limit left as placeOrder counts it
// (the last price × shares × rate against the limit less what's lent).
export function ticketMax(account, { quote, order, ref, spendable, margin = 0, valuation = null, now = Date.now() }) {
  if (!(ref > 0)) return 0;
  const holdFor = n => lotsHold({ type: order.type, qty: n, limit: Number(order.limit), stop: Number(order.stop), waitFresh: 1, margin }, quote, now).reserve;
  const room = margin > 0 && quote.market === 'TW' ? creditAccount(account, now).limit - creditUsed(valuation).loan : Infinity;
  const cap = margin > 0 ? Math.max(0, room) / (quote.price * margin) : Infinity;
  return maxBuy({ holdFor, spendable, price: dealPrice(quote.market, 'buy', ref), kind: quote.kind, margin, cap });
}
