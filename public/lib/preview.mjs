// What a screen shows before anything is done: the ticket's estimate, the
// most a short can sell, Plus's price on the same trade, a time deposit's
// end and interest, a loan of shares' fee. Each is worked out by the very
// rules that then do it (the kit's stock-*), so the preview is what happens.
import { estimate, replay } from './account.mjs';
import { SHORT_INITIAL, isOddLot, localDayOf, priceLimits, qtyStep, roundQty, tickSize, toTick, tradeCosts } from './markets.mjs';
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

// The most a buy can be for: the largest quantity whose hold (`holdFor(n)`,
// requiredCash's reserve, 融資's own part only) fits `spendable`; in
// Taiwan from a lot up, whole lots (one order can't mix them). `price`:
// one unit's price, for the search's top. `cap`: a quantity it can't pass
// (融資 within the credit limit left).
export function maxBuy({ holdFor, spendable, price, kind, market, margin = 0, cap = Infinity }) {
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
  const max = roundQty(Math.min(lo * step, cap), kind);
  return lotSplit(market, kind, max) ? Math.floor(max / 1000) * 1000 : max;
}
