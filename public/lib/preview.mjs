// What a screen shows before anything is done: the ticket's estimate, the
// most a short can sell, a time deposit's end and interest, a loan of shares'
// fee. Each is worked out by the very rules that then do it (the kit's stock-*), so the preview is what happens.
import { available, defaulted, estimate, placeOrder, replay, requiredCash } from './account.mjs';
import * as kit from './account.mjs';
import { SHORT_INITIAL, collateralRate, dealPrice, isOddLot, localDayOf, priceLimits, qtyStep, roundQty, tickSize, toTick } from './markets.mjs';
import { SHORT_DEPOSIT, SHORT_HANDLING, creditAccount, creditUsed, dayTradeBuyFirst } from './credit.mjs';
import * as credit from './credit.mjs';
import * as mk from './markets.mjs';
import { addMonths, lendFee, LEND_RATE, tdInterest, tdRate } from './savings.mjs';

const DAY = 86_400_000;
const YEAR = 365 * DAY;
const EPS = 1e-9;

// The kit's own figures, read through the module (a phone may run an older
// kit; each fallback is that kit's rule):
// - the price an order's amount is counted at (額度, deposits): its limit,
//   a Taiwan market or stop order's limit-up (漲停), else the last price;
export function quotaPrice(quote, { type, limit } = {}, now = Date.now()) {
  if (type === 'limit' && Number(limit) > 0) return Number(limit);
  return (kit.limitUpFor ? kit.limitUpFor({ type }, quote, now) : null) ?? quote.price;
}
// - what 融資 lends on a purchase (Taiwan: the trade's value × 成數, the
//   part under NT$1,000 not lent);
export const marginLoan = (market, currency, gross, total, rate) => (kit.marginLoan ? kit.marginLoan(market, currency, gross, total, rate) : Math.round(total * rate * 100) / 100);
// - 融券's deposit on a sale of `value` (90%, up to the next NT$100).
export const shortDeposit = value => (credit.shortDeposit ? credit.shortDeposit(value) : Math.round(SHORT_DEPOSIT * value));

// The share of a Taiwan sale that pays the day-trade tax (half), as a fill
// has it: all of a day trade sold first (現股當沖); else, once the account may
// day trade buying first (3 months open, 10 trades in the year), the kit's
// dayTradeShare (only the quantity the day's whole-lot cash buys match, never
// odd lots: 證券交易稅條例 §2-2). An older kit: all of it, with any buy today.
export function dayTradeShareOf(account, { symbol, market, side, kind = 'stock', qty = 0, dayShort = false }, now = Date.now()) {
  if (side !== 'sell' || market !== 'TW') return 0;
  if (dayShort) return 1;
  if (!dayTradeBuyFirst(account, now)) return 0;
  if (kit.dayTradeShare) return qty > 0 ? kit.dayTradeShare({ events: account?.events || [] }, { symbol, market, side, kind, qty }, now) : 0;
  const today = localDayOf(now, 'TW');
  return (account?.events || []).some(e => e.type === 'fill' && e.symbol === symbol && e.side === 'buy' && e.t <= now && localDayOf(e.t, 'TW') === today) ? 1 : 0;
}
// Whether a Taiwan sale pays the day-trade tax on any of it.
export const isDayTradeSell = (account, order, now = Date.now()) => dayTradeShareOf(account, { qty: 1000, ...order }, now) > 0;

// The ticket's estimate, as the fill will be: the day-trade tax where it
// applies (on the share that's day-traded), and a 融券 sale's 0.08% handling
// on the part sold short (`held`: the shares there are).
export function ticketEstimate(account, { quote, side, qty, price, first = false, credit = false, dayShort = false, held = 0, now = Date.now() }) {
  const share = dayTradeShareOf(account, { symbol: quote.symbol, market: quote.market, kind: quote.kind, side, qty, dayShort }, now);
  let est = estimate({ market: quote.market, kind: quote.kind, currency: quote.currency, side, qty, price, t: now, dayTrade: share >= 1 ? true : share, first });
  if (credit && side === 'sell' && qty > 0) {
    const handling = Math.floor(((est.gross * Math.max(0, qty - Math.max(0, held))) / qty) * SHORT_HANDLING);
    if (handling > 0) est = { ...est, fee: est.fee + handling, costs: est.costs + handling, total: est.total - handling, handling };
  }
  return { ...est, dayTrade: share > 0 };
}

// How many more can be sold short than are held, by the rule the order is
// checked against: in Taiwan with the credit account (融券), the credit
// limit left and the 90% deposit the cash covers; elsewhere (and a day trade
// sold first), assets of SHORT_INITIAL of everything owed afterwards; a
// day trade sold first, within the day's day-trade limit left too (`dayLeft`,
// NT$). `unit`: one share's NT$ value now; `dayUnit`: one share's NT$ at the
// price the day-trade limit counts it (dayTradePrice; `unit` if not given).
// 融券 counts at `price` (quotaPrice: the limit, or 漲停 for a market order),
// its deposit each order's own (a Taiwan quantity of whole and odd lots is two
// orders, the shares `held` sold by the first; `market` says whose lots).
export function shortRoom(v, { unit, price, kind, credit = null, cash = 0, dayLeft = null, dayUnit = unit, held = 0, market = 'TW' }) {
  if (!v || v.margin !== 'ok' || !(unit > 0)) return 0;
  if (credit?.open) {
    const limit = Math.max(0, credit.limit - creditUsed(v).short);
    let n = roundQty(Math.max(0, Math.min(limit / price, Math.max(0, cash) / (SHORT_DEPOSIT * price))), kind);
    while (n > 0 && lotsDeposit(market, kind, held, n, price) > cash + EPS) n = roundQty(n - qtyStep(kind), kind);
    return n;
  }
  const room = Math.max(0, (v.assets - SHORT_INITIAL * (v.debtTWD + v.shortTWD)) / (SHORT_INITIAL - 1));
  return roundQty(Math.min(room / unit, dayLeft == null ? Infinity : dayLeft / (dayUnit > 0 ? dayUnit : unit)), kind);
}

// 融券's deposit on selling `short` more than the `held` shares at `price`:
// each order's own (a mixed quantity is two orders, the first selling the
// shares held first), added up.
export function lotsDeposit(market, kind, held, short, price) {
  let have = Math.max(0, held);
  return lotParts(market, kind, have + short).reduce((sum, part) => {
    const n = Math.max(0, part - have);
    have = Math.max(0, have - part);
    return sum + (n > 0 ? shortDeposit(n * price) : 0);
  }, 0);
}

// The price a day trade sold first is counted at against the day's limit
// (當沖額度), as a broker counts it: a limit order at its limit; a market (or
// stop) order at the most it could fill at, 漲停 (the price where there's no
// band).
export function dayTradePrice(quote, { type, limit } = {}, now = Date.now()) {
  if (kit.limitUpFor) return quotaPrice(quote, { type, limit }, now);
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

// Lending `qty` shares at `price` for a year: the rate (the going rate, or
// the lender's own `ask`), and what comes in after the broker's cut and taxes.
export function lendYear(kind, qty, price, ask = null) {
  const rate = ask > 0 ? ask : (LEND_RATE[kind] ?? 0);
  return { rate, net: qty > 0 && price > 0 ? lendFee({ qty, price, rate, t: 0 }, YEAR).net : 0 };
}

// The chart range an account's history reads, by its age.
export const historyRange = age => (age < 25 * DAY ? '1mo' : age < 170 * DAY ? '6mo' : age < 360 * DAY ? '1y' : '5y');

// The price a limit or stop field starts at: the last price on the
// exchange's tick (Yahoo's US prices carry 4 decimals: 187.4321 opened the
// ticket on a price the exchange refuses); no tick, as it was.
export function startPrice(q) {
  if (!(q?.price > 0)) return '';
  const tick = tickSize(q.market, q.kind, q.price, q.symbol);
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
// A Taiwan holding as brokers show it next to its shares: 張 (lots of
// 1,000) and the 股 left over. Null under one lot, where 股 says it all.
export function boardLots(qty) {
  const n = Math.abs(Math.round(qty));
  return n < 1000 ? null : { lots: Math.floor(n / 1000), odd: n % 1000 };
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

// What 融資 lends on the ticket's buy of `qty` at `price`: each order's own
// loan (a mixed quantity is two orders), added up.
export function lotsLoan(quote, qty, price, rate) {
  if (!(rate > 0) || !(qty > 0)) return 0;
  return lotParts(quote.market, quote.kind, qty).reduce((sum, n) => {
    const est = estimate({ market: quote.market, kind: quote.kind, currency: quote.currency, side: 'buy', qty: n, price });
    return sum + marginLoan(quote.market, quote.currency, est.gross, est.total, rate);
  }, 0);
}

// Places `req` as those orders, each on the account the one before left.
// A mixed quantity (which the kit refuses as one order) is first tried as
// its two orders on a copy, and what each order checks only against the
// account as it was (融資's and 融券's credit limits) is checked for both
// together: when either would fail, neither goes in. When the odd lot still
// fails after the whole lots went in, the whole lots stand (two orders, as
// at a broker). `place`: placeOrder or the app's wrapper of it.
// { account (null: nothing changed), parts: [{ qty, r }], failed: { qty, r } | null }.
const refused = r => Boolean((r.error && !r.account) || r.order?.status === 'rejected');
function lotsCheck(account, req, opts, parts, place) {
  let next = account;
  for (const [i, n] of parts.entries()) {
    const r = place(next, { ...req, qty: n }, i && opts.id ? { ...opts, id: `${opts.id}:${i}` } : opts);
    if (refused(r)) return r;
    if (r.account) next = r.account;
  }
  const q = opts.quote;
  const now = opts.now ?? Date.now();
  const c = creditAccount(account, now);
  if (q.market !== 'TW' || !c.open || !opts.valuation) return null;
  const at = quotaPrice(q, req, now);
  const used = creditUsed(opts.valuation);
  const over = (amount, room) => (amount > room + EPS ? { error: 'creditLimit', room: Math.max(0, Math.floor(room)), limit: c.limit } : null);
  if (req.side === 'buy' && req.margin) {
    const rate = collateralRate(q.kind, q.market, q.symbol);
    return over(parts.reduce((sum, n) => sum + marginLoan('TW', q.currency, at * n, at * n, rate), 0), c.limit - used.loan);
  }
  if (req.side === 'sell') {
    const have = Math.max(0, available(account, replay(account, now)).qty[q.symbol] || 0);
    const short = Math.max(0, Number(req.qty) - have);
    if (short > EPS) return over(short * at, c.limit - used.short);
  }
  return null;
}
export function placeLots(account, req, opts, place = placeOrder) {
  const qty = Number(req.qty);
  const parts = opts.quote ? lotParts(opts.quote.market, opts.quote.kind, qty) : [qty];
  if (parts.length > 1) {
    const whole = lotsCheck(account, req, opts, parts, place);
    if (whole) return { account: null, parts: [], failed: { qty, r: whole } };
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
export function maxBuy({ holdFor, spendable, price, kind, margin = 0, cap = Infinity, fits = () => true }) {
  if (!(spendable > 0) || !(price > 0)) return 0;
  const step = qtyStep(kind);
  // In steps: the top a little past what the cash buys on its own part.
  let lo = 0;
  let hi = Math.ceil(spendable / (price * Math.max(0.05, 1 - margin)) / step) + 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const n = roundQty(mid * step, kind);
    if (holdFor(n) <= spendable + 1e-9 && fits(n)) lo = mid;
    else hi = mid - 1;
  }
  return roundQty(Math.min(lo * step, cap), kind);
}

// What a market's ticket offers, by the kit's rules (read through the
// module: an older kit has none of them, and offers all):
// - 複委託 is cash only (isSubBrokered): a foreign stock is never bought on
//   融資 nor sold short, only what's held sold (a currency pair borrows nothing);
export const cashOnly = quote => Boolean(quote && mk.isSubBrokered?.(quote.market)) && quote.kind !== 'fx';
// - the order types it takes: Hong Kong limit orders only (limitOnly);
export const orderTypes = quote => (mk.limitOnly?.(quote?.market) ? ['limit'] : ['market', 'limit', 'stop']);
// - a US stock or ETF's session now (usSession: 'pre', 'regular', 'post' or
//   null when shut), undefined for anything else;
const US_LISTED = new Set(['stock', 'etf']);
export const usSessionOf = (quote, now = Date.now()) => (quote?.market === 'US' && US_LISTED.has(quote.kind) && mk.usSession ? mk.usSession(now) : undefined);
// - 盤前／盤後 (`ext`): a US stock or ETF's day limit order, offered while
//   the pre- or post-market trades;
export const extOffered = (quote, { type, tif } = {}, now = Date.now()) => ['pre', 'post'].includes(usSessionOf(quote, now)) && type === 'limit' && tif !== 'gtc';
// - Stock Connect: a STAR or ChiNext share can be sold, never bought
//   (cnBoard: 'star' or 'chinext'; null when it can be bought).
export const northboundBlock = quote => {
  const board = quote?.market === 'CN' ? mk.cnBoard?.(quote.symbol) : null;
  return board && board !== 'main' ? board : null;
};
// - a US stock or ETF sells down to its fractions (a plan's: fractional,
//   US_FRACTION), bought in whole shares on the ticket;
export const sellFraction = (quote, side) => (side === 'sell' && mk.fractional?.(quote?.market, quote?.kind) ? mk.US_FRACTION : null);
export function ticketRound(quote, side, n) {
  const f = sellFraction(quote, side);
  return f ? +(Math.floor(n / f + 1e-6) * f).toFixed(4) : roundQty(n, quote.kind);
}
export const ticketStepOk = (quote, side, n) => Math.abs(ticketRound(quote, side, n) - n) <= (sellFraction(quote, side) || qtyStep(quote.kind)) * 1e-3;
// - the US market-wide halt now (marketHalt on the S&P 500's quote), or null.
export const usHalt = (spx, now = Date.now()) => (spx && mk.marketHalt ? mk.marketHalt(spx, now) : null);

// 融資's rate on the ticket: a buy of what the broker lends against, only
// with the credit account open and not after a default (no 融資 then,
// DEFAULT_BAN long); else 0.
export function marginRateFor(account, quote, side, now = Date.now()) {
  if (side !== 'buy' || cashOnly(quote) || !creditAccount(account, now).open || defaulted(account, now)) return 0;
  return collateralRate(quote.kind, quote.market, quote.symbol);
}

// The ticket's 最大 for a buy of `order` ({ type, limit, stop }) filling at
// `ref`: what `spendable` holds (lotsHold, held for a fresh price as every
// order from the ticket is); on 融資 (`margin`, its rate) one's own part
// only and, in Taiwan, within the credit limit left as placeOrder counts it
// (each order's loan at its quotaPrice, added up, against the limit less
// what's lent).
export function ticketMax(account, { quote, order, ref, spendable, margin = 0, valuation = null, now = Date.now() }) {
  if (!(ref > 0)) return 0;
  const holdFor = n => lotsHold({ type: order.type, qty: n, limit: Number(order.limit), stop: Number(order.stop), waitFresh: 1, margin }, quote, now).reserve;
  // A Taiwan market or stop order: whole lots only (an odd lot takes limit orders).
  const whole = n => (order.type !== 'limit' && isOddLot(quote.market, quote.kind, n) ? Math.floor(n / 1000) * 1000 : n);
  if (!(margin > 0 && quote.market === 'TW')) return whole(maxBuy({ holdFor, spendable, price: dealPrice(quote.market, 'buy', ref), kind: quote.kind, margin }));
  const room = creditAccount(account, now).limit - creditUsed(valuation).loan;
  const at = quotaPrice(quote, order, now);
  const fits = n => lotParts(quote.market, quote.kind, n).reduce((sum, part) => sum + marginLoan('TW', quote.currency, at * part, at * part, margin), 0) <= room + EPS;
  return whole(maxBuy({ holdFor, spendable, price: dealPrice(quote.market, 'buy', ref), kind: quote.kind, margin, fits }));
}
