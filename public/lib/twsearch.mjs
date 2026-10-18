// Searching Taiwan's listings by code or Chinese name, which Yahoo's search
// doesn't do well: a four-digit code (6898, a 10/15 listing) finds Tokyo's
// stock of the same number, and Chinese is refused. `names` is twnames.mjs'
// TW_NAMES; `ipos` is TWSE's subscription list (lib/ipo.mjs), for a listing
// newer than the names file.
const CODE = /^\d{4,6}[A-Z]?$/i;
export function twHits(query, names = {}, ipos = []) {
  const q = String(query || '').trim();
  if (!q) return [];
  if (CODE.test(q)) {
    const code = q.toUpperCase();
    const hits = [`${code}.TW`, `${code}.TWO`].filter(s => names[s]);
    for (const s of ipos || []) if (s.code === code && s.symbol && !hits.includes(s.symbol)) hits.push(s.symbol);
    return hits;
  }
  if (!/[^\x20-\x7e]/.test(q)) return [];
  const all = Object.entries(names).filter(([, name]) => name.includes(q));
  // A name that starts with the words typed first, then the shorter.
  all.sort((a, b) => Number(!a[1].startsWith(q)) - Number(!b[1].startsWith(q)) || a[1].length - b[1].length);
  return all.slice(0, 20).map(([symbol]) => symbol);
}
// Yahoo's results with Taiwan's listings first (a stable sort).
export const twFirst = results => [...results].sort((a, b) => Number(!/\.TWO?$/.test(a.symbol)) - Number(!/\.TWO?$/.test(b.symbol)));
