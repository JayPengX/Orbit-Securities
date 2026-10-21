// Builds public/data/listings-{tw,us,hk,jp}.json: every security a Taiwan
// resident can buy on each market (Taiwan's own exchanges, and through 複委託
// the US, Hong Kong and Japan), for the markets tab's 全部 lists and for
// search. Each file is [[Yahoo symbol, name, kind], ...]; the page fetches one
// only when it's browsed or searched. Run it now and then:
// `node scripts/listings.mjs` (needs curl and Python's openpyxl).
//
// Left out, as a broker's app has them elsewhere or Yahoo has no prices:
// warrants and callable bull/bear contracts (Taiwan's and Hong Kong's, some
// 30,000; the US's SPAC warrants, rights and units), convertible bonds, Tokyo's PRO Market (professionals only) and
// Hong Kong's debt securities.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'listings-'));
const fetchTo = (url, name) => {
  const file = join(dir, name);
  for (let tries = 0; tries < 3; tries++) {
    try {
      execFileSync('curl', ['-sf', '-m', '120', '-A', 'Mozilla/5.0', '-o', file, url]);
      return file;
    } catch {}
  }
  throw new Error(`couldn't get ${url}`);
};
const json = (url, name) => JSON.parse(execFileSync('cat', [fetchTo(url, name)], { maxBuffer: 64 << 20 }));
const text = (url, name) => execFileSync('cat', [fetchTo(url, name)], { maxBuffer: 64 << 20 }).toString();
// An Excel sheet's rows, by Python's openpyxl.
const xlsx = (url, name) =>
  JSON.parse(
    execFileSync('python3', ['-I', '-c', 'import json,sys,openpyxl\nws=openpyxl.load_workbook(sys.argv[1]).active\nprint(json.dumps([[None if c is None else str(c) for c in r] for r in ws.iter_rows(values_only=True)]))', fetchTo(url, name)], {
      maxBuffer: 256 << 20
    })
  );
const clean = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const out = {};
// Kinds, a letter each: s stock, e ETF, b bond ETF, n ETN, r REIT, d TDR, p preferred, m emerging board (興櫃).
const KIND = { stock: 's', etf: 'e', bond: 'b', etn: 'n', reit: 'r', tdr: 'd', pref: 'p', emerging: 'm' };
const add = (market, symbol, name, kind) => (out[market] ||= new Map()).has(symbol) || out[market].set(symbol, [symbol, clean(name), KIND[kind]]);

// Taiwan: TWSE's and TPEx's daily close lists (stocks, ETFs, ETNs, REITs,
// TDRs, preferred shares).
const twKind = code =>
  /^\d{4}$/.test(code) ? 'stock' : /^00\d{2,4}B$/.test(code) ? 'bond' : /^00\d{2,4}[A-Z]?$/.test(code) ? 'etf' : /^02\d{3}[0-9A-Z]$/.test(code) ? 'etn' : /^01\d{3}T$/.test(code) ? 'reit' : /^91\d{2,4}$/.test(code) ? 'tdr' : /^\d{4}[A-Z]$/.test(code) ? 'pref' : null;
const twse = json('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', 'twse.json');
const tpex = json('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', 'tpex.json');
if (twse.length < 500 || tpex.length < 300) throw new Error(`Taiwan lists too short: ${twse.length}, ${tpex.length}`);
for (const r of twse) if (twKind(r.Code)) add('tw', `${r.Code}.TW`, r.Name, twKind(r.Code));
for (const r of tpex) if (twKind(r.SecuritiesCompanyCode)) add('tw', `${r.SecuritiesCompanyCode}.TWO`, r.CompanyName, twKind(r.SecuritiesCompanyCode));
// TPEx's emerging board (興櫃): not yet listed, traded by negotiation.
const esb = json('https://www.tpex.org.tw/openapi/v1/tpex_esb_latest_statistics', 'esb.json');
if (esb.length < 200) throw new Error(`emerging board list too short: ${esb.length}`);
for (const r of esb) if (/^\d{4}$/.test(r.SecuritiesCompanyCode)) add('tw', `${r.SecuritiesCompanyCode}.TWO`, r.CompanyName, 'emerging');

// The US: Nasdaq's symbol directories (Nasdaq, NYSE, NYSE American, NYSE
// Arca, Cboe), test issues left out. Yahoo writes BRK.B as BRK-B, a
// preferred ABC$A as ABC-PA, a unit .U as -UN and a warrant .WS as -WT.
const yahooUs = s =>
  s
    .replace(/\$([A-Z]*)$/, (_, c) => `-P${c}`)
    .replace(/\.WS$/, '-WT')
    .replace(/\.U$/, '-UN')
    .replace(/\./g, '-');
// (Its names carry the share's kind: "Apple Inc. - Common Stock", "Alcoa
// Corporation Common Stock"; a class stays, the rest goes.)
const usName = s =>
  clean(s)
    .replace(/\s*-?\s*(American Depositary Shares?|ADSs?)\b.*$/i, '')
    .replace(/\s*-?\s*(Common Stock|Common Shares|Ordinary Shares?|Class [A-Z] (Common Stock|Common Shares|Ordinary Shares?|Shares?))(,.*)?$/i, m => (m.match(/Class [A-Z]/i) ? ` ${m.match(/Class [A-Z]/i)[0]}` : ''))
    .trim();
const usRows = (body, symCol, testCol, etfCol) =>
  body
    .split('\n')
    .slice(1)
    .map(l => l.split('|'))
    .filter(r => r.length > Math.max(symCol, testCol, etfCol) && r[testCol] === 'N' && !SPAC_PART.test(r[1]));
// A SPAC's warrants, rights and units: brokers here don't sell them (and
// Yahoo mostly has no price). A partnership's units, which are its shares, stay.
const SPAC_PART = /\b(warrants?|rights?)\b|- units?$|\bunits?,? each\b/i;
for (const r of usRows(text('https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt', 'nasdaq.txt'), 0, 3, 6)) add('us', yahooUs(r[0]), usName(r[1]), r[6] === 'Y' ? 'etf' : 'stock');
for (const r of usRows(text('https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt', 'other.txt'), 0, 6, 4)) add('us', yahooUs(r[0]), usName(r[1]), r[4] === 'Y' ? 'etf' : 'stock');
if ((out.us?.size || 0) < 8000) throw new Error(`US list too short: ${out.us?.size}`);

// Hong Kong: HKEX's list of securities, in Chinese (its English list for
// the kinds): shares, exchange traded products and REITs.
const hkEn = xlsx('https://www.hkex.com.hk/eng/services/trading/securities/securitieslists/ListOfSecurities.xlsx', 'hk-en.xlsx');
const hkZh = new Map(xlsx('https://www.hkex.com.hk/chi/services/trading/securities/securitieslists/ListOfSecurities_c.xlsx', 'hk-zh.xlsx').map(r => [r[0], r[1]]));
const HK_KIND = { Equity: 'stock', 'Exchange Traded Products': 'etf', 'Real Estate Investment Trusts': 'reit' };
for (const r of hkEn) {
  const kind = HK_KIND[r[2]];
  if (!kind || !/^\d{5}$/.test(r[0] || '')) continue;
  add('hk', `${r[0].slice(1).padStart(4, '0')}.HK`, hkZh.get(r[0]) || r[1], kind);
}
if ((out.hk?.size || 0) < 2000) throw new Error(`Hong Kong list too short: ${out.hk?.size}`);

// Japan: JPX's listed issues (Prime, Standard, Growth, ETFs and ETNs, REITs).
const jp = xlsx('https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xlsx', 'jp.xlsx');
for (const r of jp.slice(1)) {
  const seg = r[3] || '';
  const kind = /ETF/.test(seg) ? 'etf' : /REIT/.test(seg) ? 'reit' : /プライム|スタンダード|グロース/.test(seg) ? 'stock' : null;
  if (kind && /^[0-9A-Z]{4}$/.test(r[1] || '')) add('jp', `${r[1]}.T`, r[2], kind);
}
if ((out.jp?.size || 0) < 3000) throw new Error(`Japan list too short: ${out.jp?.size}`);

const to = new URL('../public/data/', import.meta.url);
mkdirSync(to, { recursive: true });
for (const [market, rows] of Object.entries(out)) {
  const list = [...rows.values()].sort((a, b) => a[0].localeCompare(b[0]));
  writeFileSync(new URL(`listings-${market}.json`, to), `${JSON.stringify(list)}\n`);
  console.log(market, list.length);
}
rmSync(dir, { recursive: true, force: true });
