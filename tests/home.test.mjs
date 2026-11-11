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
  assert.match(body, /\$\{head\}\$\{mineRows\}/);
  assert.match(body, /const mineRows = mine\.length \? `<div class="q-rowcard sc-rows">/);
  // 我的 (with 總資產 in it) is the first thing after an overdraft's strip, on a phone and wide.
  assert.match(body, /const left = `\$\{mineCard\}\$\{markets\}`/);
  assert.match(body, /<div class="sc-col">\$\{left\}<\/div><div class="sc-col">\$\{right\}/);
  assert.match(body, /<div class="sc-home sc-one">\$\{left\}\$\{right\}<\/div>/);
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

test('首頁 on a phone is one flow (the place keeper holds it through a redraw), spaced inside its parts', () => {
  const css = readFileSync(new URL('../public/look.css', import.meta.url), 'utf8');
  assert.match(css, /\.sc-one > \* \+ \* \{\s*padding-top:/);
});

// Jay 2026-11-06: the quote header's grey dot touched 開盤前試撮. The hero
// shows .mkt-status inline (no capsule, so no flex gap): the dot needs its own space.
test('the market dot keeps its space where the status is a plain line', () => {
  const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  const inline = /\.sym-hero-status > :is\([^)]*\.mkt-status[^)]*\) \{[^}]*display: inline;/.test(css);
  if (!inline) return;
  const rule = css.match(/\.sym-hero-status > \.mkt-status > \.mkt-dot \{([^}]*)\}/)?.[1] || '';
  assert.match(rule, /margin-inline-end: [1-9]/);
  assert.match(rule, /vertical-align:/);
});
