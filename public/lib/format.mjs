// Numbers, money, prices (the kit's format.mjs), dates, in the page's language.
import { DASH, num, money, price, pct, compact, setFormatLocale as setKitLocale } from '#kit/format.mjs';

export { DASH, num, money, price, pct, compact };

let locale = 'zh';
const cache = new Map();
export function setFormatLocale(l) {
  locale = l;
  cache.clear();
  setKitLocale(l);
}
const tag = () => (locale === 'zh' ? 'zh-TW' : 'en-US');

// An amount of shares or coins: whole, or up to 8 places.
export function qty(n) {
  if (!Number.isFinite(n)) return DASH;
  return new Intl.NumberFormat(tag(), { minimumFractionDigits: 0, maximumFractionDigits: Math.abs(n) >= 1000 ? 3 : 8 }).format(n);
}

function dtf(options, timeZone = 'Asia/Taipei') {
  const key = `dt:${timeZone}:${JSON.stringify(options)}`;
  if (!cache.has(key)) {
    try {
      cache.set(key, new Intl.DateTimeFormat(tag(), { ...options, timeZone }));
    } catch {
      cache.set(key, new Intl.DateTimeFormat(tag(), options));
    }
  }
  return cache.get(key);
}

export const dateTime = (t, tz) => dtf({ month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }, tz).format(t);
export const date = (t, tz) => dtf({ year: 'numeric', month: 'numeric', day: 'numeric' }, tz).format(t);
export const shortDate = (t, tz) => dtf({ month: 'numeric', day: 'numeric' }, tz).format(t);
export const clock = (t, tz) => dtf({ hour: '2-digit', minute: '2-digit', hour12: false }, tz).format(t);
export const weekdayClock = (t, tz) => dtf({ weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }, tz).format(t);
export const monthYear = (t, tz) => dtf({ year: 'numeric', month: 'short' }, tz).format(t);

// What's typed (or pasted) in a number field, as a number's text: digits
// and the first point ("1.2.3.4" is 1.234, a pasted "NT$1,234.5" 1234.5).
export function cleanNumber(value) {
  const text = String(value ?? '').replace(/[^\d.]/g, '');
  // A second dot ends the number ('1.2.3.4' is 1.2), so a slip of the finger can't move the decimal point.
  const dot = text.indexOf('.');
  const next = dot < 0 ? -1 : text.indexOf('.', dot + 1);
  return next < 0 ? text : text.slice(0, next);
}
