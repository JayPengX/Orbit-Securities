import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KEYS, detectLocale } from '../public/lib/i18n.mjs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const zh = new Set(KEYS.zh);
const en = new Set(KEYS.en);

test('Chinese and English have the same keys', () => {
  assert.deepEqual([...zh].filter(k => !en.has(k)), []);
  assert.deepEqual([...en].filter(k => !zh.has(k)), []);
});

test('every key the page asks for exists', () => {
  const used = new Set([...app.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map(m => m[1]));
  // Keys picked by a condition inside t(...).
  for (const m of app.matchAll(/\bt\(([^()]*\?[^()]*)\)/g)) for (const k of m[1].matchAll(/'([a-z][A-Za-z0-9_]*)'/g)) used.add(k[1]);
  for (const m of html.matchAll(/data-t="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
  for (const k of ['alertHitAbove', 'alertHitBelow', 'alertWhenAbove', 'alertWhenBelow', 'alertAddAbove', 'alertAddBelow']) used.add(k);
  const families = {
    kind_: ['stock', 'etf', 'bond', 'fund', 'crypto', 'metal', 'index', 'future', 'fx', 'cash', 'govbond', 'cb', 'warrant'],
    range_: ['1d', '5d', '1mo', '6mo', 'ytd', '1y', '5y', 'max'],
    otype_: ['market', 'limit', 'stop'],
    status_: ['open', 'filled', 'cancelled', 'rejected'],
    alloc_: ['kind', 'currency', 'market'],
    hview_: ['activity', 'orders', 'stats'],
    rating_: ['strong_buy', 'buy', 'hold', 'underperform', 'sell'],
    af_: ['all', 'trades', 'fx', 'income', 'loans', 'cash'],
    margin_: ['ok', 'call', 'liquidate'],
    tab_: ['home', 'markets', 'portfolio', 'fx', 'history'],
    err_: ['funds', 'shares', 'qty', 'qtyStep', 'limit', 'stop', 'noQuote', 'notTradable', 'noRate', 'side', 'fx', 'tooSmall', 'amount', 'capacity', 'margin', 'noLoan', 'shortMargin', 'noValuation', 'planAmount', 'planDay', 'alertPrice', 'tick', 'priceLimit', 'unsettled', 'dayTradeLimit', 'split', 'cashOnly', 'limitOnly', 'northboundBoard', 'noDayTrade', 'navOnly', 'extLimit', 'planMarket', 'planMin'],
    session_: ['regular', 'pre', 'post'],
    cnBoard_: ['star', 'chinext'],
    listKind_: ['s', 'e', 'b', 'n', 'r', 'd', 'p', 'm', 'c', 'w', 'x', 'q', 'y', 'l', 'u', 'o', 'i', 'k', 'z']
  };
  for (const [prefix, list] of Object.entries(families)) for (const k of list) used.add(prefix + k);
  for (const m of app.matchAll(/para\)|\['(g_[a-z]+\d)'/g)) if (m[1]) used.add(m[1]);
  for (const m of app.matchAll(/'(g_[a-z]+\d?)'/g)) used.add(m[1]);
  const missing = [...used].filter(k => !zh.has(k));
  assert.deepEqual(missing, []);
});

test('no string is empty: a blank key only kept a dead branch alive (lotNote, forYouSub, plansNote, ...)', async () => {
  const { STRINGS } = await import('../public/lib/i18n.mjs');
  for (const lang of ['zh', 'en']) assert.deepEqual(Object.entries(STRINGS[lang]).filter(([, s]) => s === '').map(([k]) => k), [], lang);
});

test('the old margin-buy flag is gone (it was always null, and its 融資買進 string unshown)', () => {
  assert.doesNotMatch(app, /\bmarginBuy\b/);
  assert.ok(!zh.has('marginBuy') && !en.has('marginBuy'));
});

test('the language saved in any Quadra app wins over the phone', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = v => Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => (k === 'quadra.lang' ? v : null) }, configurable: true });
  try {
    store('en');
    assert.equal(detectLocale(), 'en');
    store('zh');
    assert.equal(detectLocale(), 'zh');
    store('fr');
    assert.ok(['zh', 'en'].includes(detectLocale()));
  } finally {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete globalThis.localStorage;
  }
});
