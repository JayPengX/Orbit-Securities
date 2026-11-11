// 重大訊息白話 (the family's AI plan): a Taiwan stock's 重大訊息 of the past
// week, as Orbit-Core's builders/filings.js read them from TWSE and TPEx
// into rows (/data/stock/filings/<last two digits>.json). Code draws them;
// the AI only adds one plain line and picks the rows that show it
// (Orbit-Core ai-features.js 'sec-filing', kept for everyone once asked).

export const WEEK = 7 * 86_400_000;
export const SHOWN = 4;

// The Taiwan code of a symbol (2330.TW → 2330), or '' for any other market's.
export const twCode = symbol => (/^(\d{4,6}[A-Z]?)\.(TW|TWO)$/.exec(String(symbol || '')) || [])[1] || '';
export const filingsPath = code => `stock/filings/${String(code).slice(-2).padStart(2, '0')}.json`;

// A code's filings in the past week, newest first.
export function filingsOf(doc, code, now = Date.now()) {
  const list = doc?.codes?.[code];
  if (!Array.isArray(list)) return [];
  return list.filter(f => f?.id && f.title && now - Date.parse(f.at) < WEEK).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// A title without the form's own words: 公告本公司…, 本公司…, the company's own name.
export function shortTitle(title, name = '') {
  let t = String(title || '')
    .replace(/^(本公司)?(代子公司|代重要子公司)?\s*/, m => (/子公司/.test(m) ? '子公司' : ''))
    .replace(/^公告(本公司)?/, '')
    .replace(/^本公司/, '')
    .replace(/[。.]$/, '')
    .trim();
  if (name && t.startsWith(name)) t = t.slice(name.length).replace(/^[之的]/, '');
  return t || String(title || '');
}

// The rows a card shows: the ones the AI picked (in its order), else the first few; and how many more there are.
export function rowsShown(f, ai) {
  const rows = Array.isArray(f?.rows) ? f.rows : [];
  const picked = (ai?.show || []).filter(i => Number.isInteger(i) && rows[i]).map(i => rows[i]);
  const shown = picked.length ? picked : rows.slice(0, SHOWN);
  return { shown, rest: rows.filter(r => !shown.includes(r)) };
}

// The filings the AI is asked about on opening a stock: the newest two not yet told, each with rows.
export const toAsk = (list, told) => list.filter(f => f.rows?.length && !told.has(f.id)).slice(0, 2);
