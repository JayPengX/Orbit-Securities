// Builds public/data/listings-fund.json: every fund Taiwan's fund houses
// (投信) sell here, from SITCA's daily NAV list (投信投顧公會, the same the
// proxy prices them from: Shared-Proxy fund-nav.js). Each row is
// [`${基金統編}.TWF`, name, kind, fund house]; kinds by SITCA's type:
// q equity, y bond, l balanced, u multi-asset, o fund of funds, i index (and
// ETF feeder), k money market, z other (REIT funds, principal-protected).
// Run it now and then: `node scripts/funds.mjs`.
//
// Left out: listed ETFs (the 台股 list has them), share classes for
// institutions only, and offshore funds (境外基金: no open NAV list).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const NAV_CSV = 'https://www.sitca.org.tw/MemberK0000/F/03/nav.csv';
const read = () => {
  for (let tries = 0; tries < 4; tries++) {
    try {
      return execFileSync('curl', ['-sf', '-m', '120', '-A', 'Mozilla/5.0', NAV_CSV], { maxBuffer: 64 << 20 }).toString();
    } catch {}
  }
  throw new Error(`couldn't get ${NAV_CSV}`);
};
const csv = read();

// One CSV line's cells (a name may hold a comma in quotes).
function cells(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

const KIND = { AA: 'q', AC: 'y', AB: 'l', AJ: 'u', AE: 'o', AI: 'i', AK: 'i', AD: 'k' };
const clean = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
const head = cells(lines[0]);
const col = Object.fromEntries(head.map((name, i) => [name, i]));
for (const name of ['基金統編', '基金名稱', '基金淨值', '類型代號', '公司名稱', '受益憑證代號']) if (col[name] == null) throw new Error(`SITCA: no ${name} column`);
const rows = new Map();
for (const line of lines.slice(1)) {
  const r = cells(line);
  const code = r[col['基金統編']];
  const name = clean(r[col['基金名稱']]);
  if (!/^[A-Za-z0-9]{2,12}$/.test(code) || rows.has(`${code}.TWF`)) continue;
  if (/^00/.test(r[col['受益憑證代號']] || '') || !(Number(r[col['基金淨值']]) > 0) || /機構|法人/.test(name)) continue;
  const house = clean(r[col['公司名稱']]).replace(/投信$/, '');
  rows.set(`${code}.TWF`, [`${code}.TWF`, name, KIND[r[col['類型代號']].slice(0, 2)] || 'z', house]);
}
if (rows.size < 3000) throw new Error(`fund list too short: ${rows.size}`);

const list = [...rows.values()].sort((a, b) => a[3].localeCompare(b[3], 'zh-Hant') || a[1].localeCompare(b[1], 'zh-Hant'));
const to = new URL('../public/data/', import.meta.url);
mkdirSync(to, { recursive: true });
writeFileSync(new URL('listings-fund.json', to), `${JSON.stringify(list)}\n`);
console.log('fund', list.length);
