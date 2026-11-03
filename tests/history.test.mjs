// 紀錄: 交易明細 never shows a day with nothing under it, and 委託's rows stay calm.
// (Jay 11-03: an empty 2026/10/30, his 開戶 papers' `access` records had no row;
// 委託 "too less gap and too much text cramped together".)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dayGroups } from '../public/lib/activity.mjs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const fnBody = name => {
  const at = app.indexOf(`function ${name}(`);
  return app.slice(at, app.indexOf('\n}\n', at));
};

test('dayGroups: a record that draws nothing makes no day', () => {
  const days = dayGroups([
    { day: '2026-11-03', html: '<a>1</a>' },
    { day: '2026-10-30', html: '' },
    { day: '2026-10-30', html: '  ' },
    { day: '2026-10-26', html: '<a>2</a>' },
    { day: '2026-11-03', html: '<a>3</a>' }
  ]);
  assert.deepEqual(days.map(([d]) => d), ['2026-11-03', '2026-10-26']);
  assert.deepEqual(days[0][1], ['<a>1</a>', '<a>3</a>']);
  for (const [, rows] of days) assert.ok(rows.length > 0);
});

test('交易明細 groups rows already drawn, so the more bar counts only rows shown', () => {
  const body = fnBody('renderHistory');
  assert.match(body, /\.map\(e => \(\{ day: taipeiDay\(e\.t\), html: activityRow\(e\) \}\)\)\.filter\(r => r\.html\)/);
  assert.match(body, /dayGroups\(shown\)/);
  assert.doesNotMatch(body, /g\.map\(activityRow\)/);
});

test('every kind of record the account log makes has a row in 交易明細', () => {
  const kit = new URL('../../Orbit-Core/kit/', import.meta.url);
  const sources = [app, ...readdirSync(new URL('../public/lib/', import.meta.url)).map(f => readFileSync(new URL(`../public/lib/${f}`, import.meta.url), 'utf8'))];
  for (const f of readdirSync(kit).filter(f => /^stock-.*\.mjs$/.test(f))) sources.push(readFileSync(new URL(f, kit), 'utf8'));
  const made = new Set(['div', 'fx', 'interest', 'split', 'link']);
  for (const src of sources) for (const m of src.matchAll(/id: [^,]{1,60}, type: '([a-z]+)'/g)) made.add(m[1]);
  const row = fnBody('activityRow');
  for (const type of made) assert.match(row, new RegExp(`case '${type}':`), `${type} records have no row`);
});

test('委託 rows: grey status in one short line, the kit button for 取消, no orange', () => {
  const row = fnBody('orderRow');
  assert.doesNotMatch(row, /class="\$\{o\.status === 'open' \? 'wait'/);
  assert.match(row, /class="q-btn small order-cancel"/);
  assert.doesNotMatch(row, /tifDayUntil|status_expired/);
  const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.order-row small\.wait/);
  assert.match(css, /\.order-row \.q-btn\.order-cancel \{[^}]*color: var\(--q-label\)/);
});

test('a tool sheet\'s pinned button covers down past the sheet\'s edge (nothing shows under it)', () => {
  const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  const rule = css.match(/\.tool-sheet \.tool-page > \.q-btn\.primary:not\(\.small\):last-child \{[^}]*\}/)[0];
  const [, y, spread] = rule.match(/0 (\d+)px 0 (\d+)px var\(--q-sheet\)/).map(Number);
  // The sheet's padding (16 + the home bar's 26) and the button's lift (12 + 26) is 80px on an iPhone.
  assert.ok(y + spread >= 200 && y <= spread, rule);
});
