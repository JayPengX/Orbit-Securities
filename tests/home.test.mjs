// 首頁's rules (Orbit's own look, 2026-11-03): it opens on 總資產, then what's yours.
// RULEBOOK 10-21 had no balance on the home; Jay 11-03 "Forget my rules" lifted it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const body = app.slice(app.indexOf('function renderHome() {'), app.indexOf('\n}\n', app.indexOf('function renderHome() {')));

test('the look is always on: data-look on the page, look.css after styles.css', () => {
  assert.match(html, /<html[^>]*data-look="native"/);
  assert.ok(html.indexOf('./look.css') > html.indexOf('./styles.css'));
  assert.doesNotMatch(app, /orbit\.look/);
});

test('首頁 opens on 總資產: the big number is the account value, over 我的', () => {
  assert.match(body, /class="sc-day-big num"[^`]*money\(v\.netWorth, BASE\)/);
  assert.match(body, /\$\{head\}<div class="q-rowcard sc-rows">/);
  // 我的 (with 總資產 in it) is the first thing after an overdraft's strip.
  assert.match(body, /`\$\{hero\}<div class="q-cols sc-home"><div class="sc-col">\$\{mineCard\}/);
});

test('首頁: what is held comes before what is starred, held by value', () => {
  assert.match(body, /sort\(\(a, b\) => Math\.abs\(b\.valueTWD\) - Math\.abs\(a\.valueTWD\)\)/);
  assert.match(body, /\[\.\.\.positions\.map\([^]*\.\.\.stars\.map/);
});

test('首頁: no sparklines or pills on its rows (not another app\'s list)', () => {
  assert.doesNotMatch(body, /sparkline|movePill|stockRowHtml/);
});

test('首頁: a tap on a pick counts for the picks', () => {
  assert.match(app, /closest\('\.sc-foryou'\)\) feedback\?\.picked/);
  assert.match(body, /cls: 'sc-foryou'/);
});
