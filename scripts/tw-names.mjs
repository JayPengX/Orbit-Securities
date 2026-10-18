// Builds public/lib/twnames.mjs: the Chinese short name of every Taiwan
// listing (TWSE's and TPEx's daily close lists), for a stock found by search
// that isn't in the catalogue (Yahoo gives its English name only: 3055 is
// "SPIROX CORP", not 蔚華科). Run it now and then: `node scripts/tw-names.mjs`.
// It uses curl and writes the map; the app reads it, nothing more.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const get = url => {
  for (let tries = 0; tries < 3; tries++) {
    try {
      return JSON.parse(execFileSync('curl', ['-s', '-m', '60', url], { maxBuffer: 32 << 20 }));
    } catch {}
  }
  return null;
};
const twse = get('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL') || [];
const tpex = get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes') || [];
if (twse.length < 500 || tpex.length < 300) throw new Error(`lists too short: TWSE ${twse.length}, TPEx ${tpex.length}`);
const names = {};
for (const r of twse) if (/^\d{4,6}[A-Z]?$/.test(r.Code) && r.Name) names[`${r.Code}.TW`] = r.Name.trim();
for (const r of tpex) if (/^\d{4,6}[A-Z]?$/.test(r.SecuritiesCompanyCode) && r.CompanyName) names[`${r.SecuritiesCompanyCode}.TWO`] = r.CompanyName.trim();
const body = Object.keys(names).sort().map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(names[k])},`).join('\n');
writeFileSync(new URL('../public/lib/twnames.mjs', import.meta.url), `// Made by scripts/tw-names.mjs: every Taiwan listing's Chinese short name.
// Don't edit by hand; run the script again.
export const TW_NAMES = {
${body}
};
`);
console.log(`${Object.keys(names).length} names`);
