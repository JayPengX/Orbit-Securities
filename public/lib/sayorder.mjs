// 用說的下單 (the family's AI plan, Jay 11-10; code first, no AI): an order
// typed in plain words in the search box (用 5 萬買台積電零股, 買兩張鴻海,
// 賣掉一半聯發科) read into what the ticket needs. It only fills the ticket;
// the person sees it and places it.
// → { side: 'buy'|'sell', name, money (NT$) | shares | lots | part (0–1), odd } or null.

const DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNITS = { 十: 10, 百: 100, 千: 1000 };
// 三千五 → 3500, 十二 → 12, 兩百 → 200 (under 萬; 萬 is taken apart below).
function smallZh(s) {
  if (!s) return NaN;
  if (/^[\d.]+$/.test(s)) return Number(s);
  let total = 0;
  let n = null;
  let last = 1;
  for (const ch of s) {
    if (ch in DIGITS) n = DIGITS[ch];
    else if (ch in UNITS) {
      total += (n ?? 1) * UNITS[ch];
      last = UNITS[ch];
      n = null;
    } else return NaN;
  }
  // (三千五: the 五 after 千 is 500.)
  if (n != null) total += last > 1 ? (n * last) / 10 : n;
  return total;
}
export function zhNumber(s) {
  const t = String(s || '').replace(/[,，\s]/g, '');
  if (!t) return NaN;
  const i = t.indexOf('萬');
  if (i < 0) return smallZh(t);
  const hi = smallZh(t.slice(0, i) || '一');
  const lo = t.slice(i + 1) ? smallZh(t.slice(i + 1)) : 0;
  // (5萬5: 55,000.)
  const tail = /^[\d一二兩三四五六七八九]$/.test(t.slice(i + 1)) ? lo * 1000 : lo;
  return hi * 10_000 + tail;
}

const NUM = '(?:[\\d.,]+萬?\\d*|[零〇一二兩三四五六七八九十百千萬]+)';
const BUY = /買進|買入|買|加碼|進場/;
const SELL = /賣出|賣掉|賣|出清|停利|停損/;

export function readOrder(text) {
  let s = String(text || '').trim().replace(/\s+/g, '');
  if (!s || s.length > 40) return null;
  const sell = SELL.test(s);
  const buy = !sell && BUY.test(s);
  if (!buy && !sell) return null;
  const out = { side: buy ? 'buy' : 'sell', name: '', odd: /零股/.test(s) };
  const take = re => {
    const m = re.exec(s);
    if (m) s = s.slice(0, m.index) + s.slice(m.index + m[0].length);
    return m;
  };
  let m;
  if ((m = take(new RegExp(`(?:NT\\$|\\$)?(${NUM})(?:塊錢|元|塊)`)) || take(new RegExp(`用(${NUM})`)) || take(new RegExp(`(${NUM}萬)`)))) out.money = zhNumber(m[1]);
  else if ((m = take(new RegExp(`(${NUM})張`)))) out.lots = zhNumber(m[1]);
  else if ((m = take(new RegExp(`(${NUM})股`)))) out.shares = zhNumber(m[1]);
  else if (sell && (m = take(/全部|全賣|出清|所有/))) out.part = 1;
  else if (sell && (m = take(/一半|半數/))) out.part = 0.5;
  else if (sell && (m = take(/(?:三分之一)/))) out.part = 1 / 3;
  for (const k of ['money', 'lots', 'shares']) if (k in out && !(out[k] > 0)) return null;
  out.name = s
    .replace(/買進|買入|賣出|賣掉|加碼|進場|出清|停利|停損|零股|整股|股票|現股|[買賣用的了把我要想幫]|市價|[\s,，。.!！?？、]/g, '')
    .trim();
  return out.name ? out : null;
}

// How many shares that comes to at a price: money buys whole shares (whole
// lots of 1,000 unless 零股); lots × 1,000; a part of what's held (whole lots
// when what's held is, else shares).
export function sharesFor(order, { price = 0, held = 0, lot = 1000 } = {}) {
  if (!order) return 0;
  if (order.shares) return Math.floor(order.shares);
  if (order.lots) return Math.floor(order.lots) * lot;
  if (order.part) {
    const n = Math.floor(held * order.part);
    return held % lot === 0 && n >= lot ? Math.floor(n / lot) * lot : n;
  }
  if (order.money && price > 0) {
    const n = Math.floor(order.money / price);
    return order.odd ? n : Math.floor(n / lot) * lot;
  }
  return 0;
}
