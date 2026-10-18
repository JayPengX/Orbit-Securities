// TWSE's 處置 (punished) and 注意 (attention) stock lists, which brokers' apps flag
// on a quote. Listed (.TW) stocks only: TPEx keeps its own lists.
// 處置: matched every 5 minutes (first time) or 20 (again), and large orders
// prepaid (TWSE 公布或通知注意交易資訊暨處置作業要點 §4-6).
export const PUNISH_URL = 'https://www.twse.com.tw/rwd/zh/announcement/punish?response=json';
export const NOTICE_URL = 'https://www.twse.com.tw/rwd/zh/announcement/notice?response=json';

// '113/10/18' (民國) to that day's midnight in Taipei, as ms; null if not a date.
export function rocDate(text) {
  const m = /(\d{2,3})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(String(text || ''));
  return m ? Date.UTC(+m[1] + 1911, +m[2] - 1, +m[3]) - 8 * 3_600_000 : null;
}

// A column by its name (TWSE's: 證券代號, 處置起迄時間), else the first like it.
const column = (fields, name, re) => {
  const list = (fields || []).map(f => String(f).trim());
  const exact = list.indexOf(name);
  return exact >= 0 ? exact : list.findIndex(f => re.test(f));
};

// TWSE's {stat, fields, data} as Map(code -> { until }) for 處置 (until: the last
// day's end, or null when the list doesn't say) or Map(code -> {}) for 注意.
// Columns are found by name, so a reordered list still reads.
export function parseAlertList(json, kind) {
  const out = new Map();
  if (!json || !Array.isArray(json.data)) return out;
  const code = column(json.fields, '證券代號', /代號/);
  if (code < 0) return out;
  const period = kind === 'punish' ? column(json.fields, '處置起迄時間', /起迄|期間|處置期/) : -1;
  for (const row of json.data) {
    const c = String(row?.[code] ?? '').trim();
    if (!/^\d{4,6}[A-Z]?$/.test(c)) continue;
    if (kind !== 'punish') {
      out.set(c, {});
      continue;
    }
    const days = String(row[period] ?? '').split(/[～~至-]/).map(rocDate).filter(x => x != null);
    out.set(c, { until: days.length > 1 ? days[days.length - 1] + 86_400_000 : null });
  }
  return out;
}

// '處置' or '注意' (punish first, it's the stricter) for a symbol, or ''.
export function alertOf(symbol, { punish, notice } = {}, now = Date.now()) {
  const m = /^(\d{4,6}[A-Z]?)\.TW$/.exec(String(symbol || ''));
  if (!m) return '';
  const p = punish?.get(m[1]);
  if (p && !(p.until && now >= p.until)) return 'punish';
  return notice?.has(m[1]) ? 'notice' : '';
}
