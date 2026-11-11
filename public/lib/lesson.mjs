// 這筆交易學到什麼 (the family's AI plan): a sale that closed a holding, told
// back from the account's own numbers. Code works out every row (what it
// cost, what it sold for, how long it was held, the best and worst close
// while held, the market over the same days, what trading cost); the AI
// only says, in one line, what the trade teaches and lights the rows it
// rests on (Orbit-Core ai-features.js 'sec-lesson'). It's a study app.

const DAY = 86_400_000;
// The market a symbol's trade is measured against.
export const indexOf = symbol => (/\.(TW|TWO)$/.test(symbol) ? '^TWII' : /\.HK$/.test(symbol) ? '^HSI' : /\.T$/.test(symbol) ? '^N225' : /^[A-Z.]+$/.test(symbol) ? '^GSPC' : '');

const within = (points, from, to) => (points || []).filter(([t, c]) => c > 0 && t >= from - DAY && t <= to + DAY);
const change = (points, from, to) => {
  const p = within(points, from, to);
  return p.length >= 2 ? p.at(-1)[1] / p[0][1] - 1 : null;
};

// The rows: [{ id, value, sub? }] (figures as numbers; the app formats them), and the facts the AI is told.
// c: the account's closed entry; e: the sale's fill event; closes / market: [[t, close]] over the holding.
export function lessonOf(c, e, { closes = [], market = [] } = {}) {
  if (!c || !e || !(c.qty > 0)) return null;
  const from = c.t - (c.held || 0);
  const days = Math.max(0, Math.round((c.held || 0) / DAY));
  const local = c.realizedLocal ?? c.realized;
  const cost = Math.abs(c.cost) / c.qty;
  const costs = (e.commission || 0) + (e.tax || 0) + (e.fee || 0);
  const rows = [
    { id: 'pl', value: local, pct: c.pct },
    { id: 'buy', value: cost },
    { id: 'sell', value: e.price },
    { id: 'held', value: days }
  ];
  const held = within(closes, from, c.t);
  if (held.length >= 3) {
    const hi = held.reduce((a, b) => (b[1] > a[1] ? b : a));
    const lo = held.reduce((a, b) => (b[1] < a[1] ? b : a));
    rows.push({ id: 'high', value: hi[1], at: hi[0], pct: hi[1] / cost - 1 }, { id: 'low', value: lo[1], at: lo[0], pct: lo[1] / cost - 1 });
  }
  const m = change(market, from, c.t);
  if (m != null) rows.push({ id: 'market', value: m });
  if (costs) rows.push({ id: 'costs', value: costs });
  return { rows, days, short: !!c.short };
}

const r2 = n => Math.round(n * 100) / 100;
const p1 = n => `${n >= 0 ? '+' : ''}${Math.round(n * 1000) / 10}%`;
const md = t => new Date(t + 8 * 3_600_000).toISOString().slice(5, 10).replace('-', '/');
// What the AI is told: a line a row, its id first.
export function lessonFacts(l, { name = '', currency = 'TWD' } = {}) {
  const say = {
    pl: r => `[pl] Result: ${r2(r.value)} ${currency} (${p1(r.pct)})${l.short ? ', a short sale closed' : ''}`,
    buy: r => `[buy] Average cost a share: ${r2(r.value)}`,
    sell: r => `[sell] Sold at: ${r2(r.value)}`,
    held: r => `[held] Held: ${r.value} days`,
    high: r => `[high] Best close while held: ${r2(r.value)} on ${md(r.at)} (${p1(r.pct)} on cost)`,
    low: r => `[low] Worst close while held: ${r2(r.value)} on ${md(r.at)} (${p1(r.pct)} on cost)`,
    market: r => `[market] The market over the same days: ${p1(r.value)}`,
    costs: r => `[costs] Fees and tax on the sale: ${r2(r.value)} ${currency}`
  };
  return [`Stock: ${name}`, ...l.rows.map(r => say[r.id]?.(r)).filter(Boolean)].join('\n');
}
