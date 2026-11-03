// 交易明細 by Taipei day. Each record's row is drawn first and a record that
// draws nothing (a dividend still to be paid, a kind with no row) is left out
// before the days are made, so a day's head never stands over nothing (Jay
// 11-03: 2026/10/30 shown empty, the day he signed 開戶 papers, whose
// `access` records had no row).
// rows: [{ day: 'YYYY-MM-DD', html }] → [[day, [html…]]…], newest day first.
export function dayGroups(rows) {
  const groups = new Map();
  for (const { day, html } of rows) {
    if (!html || !String(html).trim()) continue;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(html);
  }
  return [...groups].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}
