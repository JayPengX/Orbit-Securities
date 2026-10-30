// Orbit Securities: rendering and wiring. The rules live in lib/ (account.mjs for
// the ledger, markets.mjs for fees and hours, quotes.mjs for prices).
import {
  newAccount, replay, available, dayOfChange, placeOrder, processOrders, cancelOrder, exchange, quoteExchange, amountFor, valuate, resultByMarket, repay, repayAll, liquidationPlan, callPlan, callState, callNeed, payDown, penaltyEvent, openDeposit, breakDeposit, matureDeposits, lendShares, recallShares, matureLending, recallAll, lendableQty, applyCorporateActions, applyBondCashflows, netWorthSeries, mergeAccounts, recordSnapshot, benchmarkValue, isAccount, toggleWatch, watched, firstTrade, withWelcome, setPlan, activePlans, dedupePlans, planRuns, nextPlanRun, runPlan, planOrderId, setAlert, activeAlerts, alertsFor, checkAlerts, alertHitInBars, markAlertHit, marginHistory, pendingDividends, applyIncome, startIncome, applyCashInterest, unsettled, settlesBy, withdrawable, PLAN_MIN, taipeiDay, applyPool, ownCash, mergeDistinct, incomeSummary, loanRateAt, fxSpread, coverPlan, expireOrders, GTC_DAYS
} from './lib/account.mjs';
import { TD_TERMS, TD_MIN, TD_EARLY, tdRate, tdInterest, LEND_CUT, LEND_LOT, LEND_RECALL, lendFee, lendable } from './lib/savings.mjs';
import {
  BASE, CURRENCIES, MARKETS, METALS, collateralRate, MARGIN_CALL, MARGIN_RESTORE, SHORT_FEE, currencyInfo, isOpen, isTradable, isShortable, roundQty, delayOf, tickSize, onTick, priceLimits, marketFill, isOddLot, oddLotOpen, CASH_RATE, lotSize, lunchOf, atLunch, limitShare, settleDays
} from './lib/markets.mjs';
import { BONDS } from './lib/bonds.mjs';
import { nextTradingStart, upcomingHolidays, localDay } from './lib/holidays.mjs';
import { fetchQuotes, fetchChart, fetchBars, fetchCorporateActions, fetchFundamentals, searchSymbols, fxSymbol } from './lib/quotes.mjs';
import { CATEGORIES, COUNTRIES, MARKET_INDEXES, OVERVIEW, PRODUCTS, SUB_FLAGS, SUBS, TRACKERS, catalogInfo, searchCatalog, subPicks } from './lib/catalog.mjs';
import { brandIcon, brandLogo } from './lib/brands.mjs';
import { tvLogos } from './lib/tvlogos.mjs';
import { TV_ROUND } from './lib/tvround.mjs';
import { TW_NAMES } from './lib/twnames.mjs';
import { twHits, twFirst } from './lib/twsearch.mjs';
import { afterHours, marginShares, creditAccount, creditCheck, openCredit, bestTier, creditUsed, terms as creditTerms, extendTerm, closeOutPlan, yearOfTrading, dayTradeSellFirst, CREDIT_TIERS, CREDIT_MIN_TRADES, CREDIT_TURNOVER, CREDIT_PROOF } from './lib/credit.mjs';
import { money, price as fmtPrice, pct, qty as fmtQty, num, compact, dateTime, date as fmtDate, shortDate, clock, weekdayClock, monthYear, setFormatLocale, cleanNumber } from './lib/format.mjs';
import { sparkline, lineChart, attachHover, candleChart, attachCandleHover, donut, miniBars, stackBar, SERIES } from './lib/chart.mjs';
import { movingAverage, pointAt } from './lib/series.mjs';
import { shortRoom, shortCredit, heldQty, tdPreview, tdFull, lendYear, historyRange, dayTradeLeft, dayTradePrice, startPrice, lotSplit, lotParts, lotsEstimate, lotsHold, placeLots, marginRateFor, ticketMax, oddLotNeedsLimit, boardLots, quotaPrice, lotsLoan, lotsDeposit, cashOnly, orderTypes, usSessionOf, extOffered, northboundBlock, usHalt, ticketRound, ticketStepOk } from './lib/preview.mjs';
import { expireAsked, odDeadline } from './lib/orders.mjs';
import { twPhase, afterHoursSend, atLimit, exDayTags, closeMatchOf as twseCloseMatchOf, orderWaitKind } from './lib/twse.mjs';
import { detectLocale, makeT } from './lib/i18n.mjs';
import * as stockAccess from './lib/access.mjs';
import { pack, unpack } from './lib/codec.mjs';
import { forYou, movers, wantedSymbols, MOVER_GROUPS, moverGroupNow } from './lib/foryou.mjs';
import {
  APPS, appUrl, describeEntry, installGate, watchUpdates, orbitSession, tabBar, topActions, recordAffinity, affinity, notify, kindOn, schedulePush, ask, translate, paydayFor, nextPayday as orbitPayday, affinityPatch, workerJson,
  keepOffline, onlineOnly, proxyJson, worthOf, WEALTH_RANKS, moneySides, poolBalance, errorText as passError
} from '#kit/orbit.mjs';
import { RELIEF, reliefCheck } from '#kit/pay.mjs';
import { STOCK, roundTrip, overdraftYear, overdraftPaid } from './lib/truth.mjs';
import { PUNISH_URL, NOTICE_URL, parseAlertList, alertOf } from './lib/alerts.mjs';
import { IPO_FEE, IPO_WIN_FEE, parseIpoList, ipoOpen, ipoDrawn, ipoHold, ipoApplyEvent, ipoBackEvent, ipoWinEvent } from './lib/ipo.mjs';
import * as kitUI from '#kit/ui.mjs';
import * as kitOrbit from '#kit/orbit.mjs';
import * as stockAccount from './lib/account.mjs';
// (Read through the module, with a fallback, for what an older kit lacks.)
import * as stockCredit from './lib/credit.mjs';
import * as stockIpo from './lib/ipo.mjs';
import * as stockSavings from './lib/savings.mjs';
import * as stockMarkets from './lib/markets.mjs';
import * as stockQuotes from './lib/quotes.mjs';

const h = kitUI.escHtml;
const $ = id => document.getElementById(id);
const TABS = ['home', 'markets', 'portfolio', 'fx', 'history'];
const QUOTE_REFRESH_MS = 45_000;
const LIST_REFRESH_MS = 90_000;
const ACTIONS_EVERY_MS = 12 * 3_600_000;
const STORE = {
  account: 'stockStudy.account',
  settings: 'stockStudy.settings',
  actions: 'stockStudy.actionsChecked',
  quotes: 'stockStudy.quotes',
  marginNotice: 'stockStudy.marginNotice',
  divNext: 'stockStudy.divNext'
};

const locale = detectLocale();
const t = makeT(locale);
setFormatLocale(locale);
document.documentElement.lang = locale === 'zh' ? 'zh-Hant' : 'en';

const state = {
  tab: 'home',
  account: null,
  accountReady: false,
  quotes: new Map(),
  // The proxy's fills for open orders (askFills).
  fills: {},
  listAt: new Map(),
  rates: { [BASE]: 1 },
  // Currencies Yahoo has no NT$ pair for (DKK): priced through US$ instead.
  crossFx: new Set(Object.entries(CURRENCIES).filter(([, c]) => c.cross).map(([code]) => code)),
  fxOpen: true,
  loaded: false,
  error: null,
  updated: 0,
  // The 市場 tab's list (a product's list, catalog.mjs SUBS; null: 總覽).
  category: null,
  // How far the open list is shown: {sub, n}.
  shown: null,
  // The tool sheet open (alloc, income, plans, alerts, rates, loans, credit, td, lend).
  tool: null,
  query: '',
  search: { query: '', results: [], loading: false },
  detail: null,
  // mode 'pay': the amount is what you give; 'get': what you want to receive.
  fx: { from: BASE, to: 'USD', amount: '', mode: 'pay', view: 'exchange' },
  loan: { currency: BASE, amount: '', mode: 'borrow' },
  td: { amount: '', months: 12, renew: false },
  // 期貨保證金專戶's 入金 ('in') or 出金 ('out') and the amount typed.
  futx: { dir: 'in', amount: '' },
  // 借券出借's own ask (a yearly %, blank: the going rate) and its renewals.
  lend: { rate: '', renew: false },
  alloc: 'kind',
  historyView: 'activity',
  activityFilter: 'all',
  activityShown: 60,
  bench: null,
  settings: loadSettings(),
  // Which folding cards are open (they survive redraws).
  openFolds: new Set(),
  // The Orbit Pass session (orbit.mjs) and its wallet: the one money pool.
  sync: { busy: false, error: null, at: 0 },
  wallet: null,
  // Company numbers and news per symbol, fetched when its sheet opens.
  about: new Map(),
  plan: { amount: '5000', day: '5' },
  alertPrice: '',
  online: navigator.onLine !== false,
  installPrompt: null
};
// TWSE's list of public subscriptions, kept half an hour; read before the
// loading screen lifts (boot), so the section never arrives after it.
const ipoState = { list: null, at: 0, busy: null };
// A first listing's listing day on its quote (quote.listed, from the list
// above): no daily price limit for its first five trading days (kit's
// stock-ipo.mjs listedOn).
const markListed = q => {
  if (q?.market === 'TW') q.listed = stockIpo.listedOn(ipoState.list, q.symbol);
  return q;
};

// A confirm in the kit's look (a colour tile with a kit icon, points with icons); an ask without a kit icon for its emoji keeps the emoji.
const ASK_ICON = { '🎟': ['ticket', 'indigo'], '📅': ['calendar', 'teal'], '🏦': ['bank', 'indigo'], '⚠️': ['bell', 'red'], '🤝': ['coin', 'orange'], '↩️': ['history', 'blue'], '📈': ['chart', 'green'], '📉': ['chart', 'red'], '💱': ['exchange', 'orange'] };
const POINT_ICON = { '💰': ['wallet', 'orange'], '🎲': ['ticket', 'indigo'], '📈': ['chart', 'green'], '🔒': ['lock', 'gray'], '💸': ['coin', 'red'], '📅': ['calendar', 'teal'] };
function askKit(opts) {
  const named = ASK_ICON[opts.icon];
  if (!named || !kitUI.icons[named[0]]) return ask(opts);
  // Points with a kit icon of their own ({ icon, text } points); the others numbered.
  const iconed = (opts.points || []).every(([mark]) => POINT_ICON[mark] && kitUI.icons[POINT_ICON[mark][0]]);
  const points = (opts.points || []).map(([mark, head, line], i) => (iconed ? { icon: POINT_ICON[mark][0], tint: TINT[POINT_ICON[mark][1]], text: line ? `${head} · ${line}` : head } : [String(i + 1), head, line]));
  return kitUI.confirm({ ...opts, icon: named[0], tint: TINT[named[1]], points });
}

// ---- Settings and storage ------------------------------------------------------

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE.settings) || '{}');
    return { updown: s.updown || (locale === 'zh' ? 'tw' : 'us'), chart: s.chart === 'candle' ? 'candle' : 'line', ma: s.ma !== false };
  } catch {
    return { updown: locale === 'zh' ? 'tw' : 'us', chart: 'line', ma: true };
  }
}
function saveSettings() {
  try {
    localStorage.setItem(STORE.settings, JSON.stringify(state.settings));
  } catch {}
  applySettings();
}
function applySettings() {
  document.documentElement.dataset.updown = state.settings.updown;
}

// The account is kept with the Orbit Pass (synced); this device keeps a
// copy under the pass so the app opens at once, and offline.
const accountKey = () => `${STORE.account}:${q.pass}`;
async function loadAccount() {
  try {
    const saved = await unpack(localStorage.getItem(accountKey()));
    if (isAccount(saved)) return saved;
  } catch {}
  return null;
}

let saveTimer;
let syncTimer;
function commit(account, { sync = true } = {}) {
  // An account that hasn't traded has the welcome offer (its first trade pays no commission).
  state.account = withWelcome(account);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncPush, 3000);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      if (state.account) localStorage.setItem(accountKey(), await pack(state.account));
      else localStorage.removeItem(accountKey());
    } catch {}
  }, 200);
  if (sync && q.pass) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 1200);
  }
}

// What to be told while the app is closed (the Worker watches the prices):
// price alerts and open orders reaching their price, and each monthly plan's
// day. The app catches up on the rest when it's opened.
let pushTimer = 0;
function syncPush() {
  const account = state.account;
  if (!account) return;
  const now = Date.now();
  const items = [];
  for (const a of activeAlerts(account)) {
    if (a.hit || BONDS[a.symbol]) continue;
    items.push({ at: a.since, until: a.since + 30 * 86_400_000, title: t(a.op === 'above' ? 'alertHitAbove' : 'alertHitBelow', { name: nameOf(a.symbol), price: fmtPrice(a.price, state.quotes.get(a.symbol)?.currency) }), body: t('alertNoticeBody'), tag: `alert:${a.id}`, hash: 'portfolio', kind: 'alert', check: { yahoo: a.symbol, op: a.op, price: a.price } });
  }
  for (const o of account.orders.filter(x => x.status === 'open' && !BONDS[x.symbol] && (x.type === 'limit' || x.type === 'stop'))) {
    const price = Number(o.type === 'limit' ? o.limit : o.stop);
    if (!(price > 0)) continue;
    const op = (o.type === 'limit') === (o.side === 'buy') ? 'below' : 'above';
    items.push({ at: o.t, until: o.t + 30 * 86_400_000, title: t('noticeReached', { name: nameOf(o.symbol), price: fmtPrice(price, o.currency) }), body: t('noticeReachedBody', { side: t(o.side).toLowerCase() }), tag: `fill:${o.id}`, hash: 'history', kind: 'fill', check: { yahoo: o.symbol, op, price } });
  }
  for (const p of activePlans(account)) {
    const next = nextPlanRun(p, now);
    if (next) items.push({ at: next + 9 * 3_600_000, title: t('noticePlanTitle', { name: nameOf(p.symbol) }), body: t('noticePlanDay', { amount: money(p.amount, BASE) }), tag: `plan:${p.id}:${next}`, hash: 'portfolio', kind: 'fill' });
  }
  // Dividends on the way: the day each is paid.
  for (const e of pendingDividends(account, now)) {
    items.push({ at: e.t, title: t('noticeDivPayTitle', { name: nameOf(e.symbol), amount: money(e.net, e.currency) }), body: t('noticeDivPayBody'), tag: `div:${e.symbol}:${e.t}`, hash: 'portfolio', kind: 'income' });
  }
  schedulePush(q, items);
}

// ---- Names and labels ------------------------------------------------------------

const L = obj => (obj ? (locale === 'zh' ? obj.zh : obj.en) : '');
// A Taiwan listing's Chinese name: twnames.mjs, else TWSE's subscription list
// (a listing newer than the names file: 6898 程曦資訊, which Yahoo calls ChainSea).
const twZhName = symbol => TW_NAMES[symbol] || ipoState.list?.find(s => s.symbol === symbol)?.name || null;
function nameOf(symbol, quote = state.quotes.get(symbol)) {
  const info = catalogInfo(symbol);
  if (info) return locale === 'zh' ? info.zh : info.en;
  // A Taiwan stock outside the catalogue: its Chinese name, as Yahoo has the English only.
  if (locale === 'zh' && twZhName(symbol)) return twZhName(symbol);
  if (METALS[symbol]) return L(METALS[symbol]);
  if (symbol.endsWith('=X') && symbol.length === 8) return `${symbol.slice(0, 3)}/${symbol.slice(3, 6)}`;
  // Hong Kong's by HKEX's Chinese name; the rest of a market's full list by its exchange's name till Yahoo's comes.
  if (locale === 'zh' && (symbol.endsWith('.HK') || isWarrantSym(symbol)) && listingName.has(symbol)) return listingName.get(symbol);
  if (stockMarkets.isFuture?.(symbol)) {
    const f = stockMarkets.futureOf(symbol);
    return locale === 'zh' ? `${f.zh} ${f.month}月` : `${f.en} ${new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(Date.UTC(f.year, f.month - 1, 1))}`;
  }
  if (stockMarkets.isOption?.(symbol)) {
    const o = stockMarkets.optionOf(symbol);
    return locale === 'zh' ? `${optSeriesName(symbol)} ${o.strike} ${o.right === 'C' ? '買權' : '賣權'}` : `${optSeriesName(symbol)} ${o.strike} ${o.right === 'C' ? 'call' : 'put'}`;
  }
  if (stockMarkets.isTwFund?.(symbol)) return fundParts(quote?.name || listingName.get(symbol) || symbol).base;
  return quote?.shortName || quote?.name || listingName.get(symbol) || symbol;
}
// An option's series (台指選 10/28週, a weekly by its day; 台指選 11月) and
// its contract alone (46,050 買權).
function optSeriesName(symbol) {
  const o = stockMarkets.optionOf(symbol);
  const when = o.week ? (locale === 'zh' ? `${shortDate(expiryOf(symbol))}週` : `wk ${shortDate(expiryOf(symbol))}`) : locale === 'zh' ? `${o.month}月` : new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(Date.UTC(o.year, o.month - 1, 1));
  return locale === 'zh' ? `${o.zh} ${when}` : `TXO ${when}`;
}
function optContract(symbol) {
  const o = stockMarkets.optionOf(symbol);
  return `${num(o.strike, 0, 0)} ${t(o.right === 'C' ? 'optCall' : 'optPut')}`;
}
// (A coin by its own ticker: BTC, not BTC-USD.)
// A Taiwan fund's name and its share class (A類型、美元、後收…): SITCA
// names each class in full, so a row shows the fund and its class below.
function fundParts(name) {
  const at = name.lastIndexOf('基金');
  if (at < 0) return { base: name, cls: '' };
  const cls = name.slice(at + 2).split(/[-－()（）\s]+/).filter(Boolean).join('・');
  return { base: name.slice(0, at + 2), cls };
}
// (A Taiwan fund by its class, else its house (its logo shows that): its 統編 means nothing to a reader.)
const fundLine = s => fundClass(fundParts(state.quotes.get(s)?.name || listingName.get(s) || '').cls) || (fundHouseOf(s) ? houseName(fundHouseOf(s)) : s.slice(0, -4));
// A fund's class in English (A類型・美元 → Class A · USD); a word with no English is left out.
const CLASS_EN = [[/後收/g, ' back-load '], [/避險/g, ' hedged'], [/不配息/g, ' accumulating'], [/累積(類)?型?/g, ' accumulating '], [/月配(息)?(類)?型?/g, ' monthly income '], [/配息(類)?型?/g, ' income '], [/新[臺台]幣|台幣/g, 'NTD '], [/美元|美金/g, 'USD '], [/人民幣/g, 'CNY '], [/南非幣/g, 'ZAR '], [/澳幣/g, 'AUD '], [/日幣|日圓/g, 'JPY '], [/歐元/g, 'EUR '], [/英鎊/g, 'GBP '], [/紐幣/g, 'NZD '], [/計價/g, ''], [/([A-Z][A-Z0-9]*)類型?/g, 'Class $1 '], [/類型|型/g, '']];
function fundClass(cls) {
  if (locale === 'zh' || !cls) return cls;
  const parts = cls.split('・').map(p => CLASS_EN.reduce((x, [re, to]) => x.replace(re, to), p).replace(/\s+/g, ' ').trim()).filter(p => p && !/\p{Script=Han}/u.test(p));
  return parts.join(' · ');
}
// A fund house by its name in English (元大投信 → Yuanta); one the table doesn't know, as SITCA writes it.
const HOUSE_EN = { 大都會: 'MetLife', 東方匯理: 'Amundi', 野村: 'Nomura', 台新: 'Taishin', 群益: 'Capital', 宏利: 'Manulife', 富邦: 'Fubon', 富蘭克林華美: 'Franklin Templeton SinoAm', 路博邁: 'Neuberger Berman', 瀚亞: 'Eastspring', 凱基: 'KGI', 合庫: 'TCB', 國泰: 'Cathay', 元大: 'Yuanta', 第一金: 'First', 安聯: 'Allianz', 滙豐: 'HSBC', 玉山: 'E.SUN', 復華: 'Fuh Hwa', 兆豐: 'Mega', 永豐: 'SinoPac', 聯博: 'AllianceBernstein', 摩根: 'JPMorgan', 聯邦: 'Union', 中國信託: 'CTBC', 富達: 'Fidelity', 統一: 'Uni-President', 大華銀: 'UOB', 瑞銀: 'UBS', 施羅德: 'Schroders', 景順: 'Invesco', 華南永昌: 'Hua Nan', 貝萊德: 'BlackRock', 台中銀: 'Taichung Bank', 街口: 'JKO', 德銀遠東: 'DWS' };
const houseName = house => (locale === 'zh' ? `${house}投信` : HOUSE_EN[house] || `${house}投信`);
const bareSymbol = s => (METALS[s] ? s : stockMarkets.isFuture?.(s) || stockMarkets.isOption?.(s) ? s.slice(0, -3) : stockMarkets.isTwFund?.(s) ? fundLine(s) : s.replace(/\.(TW|TWO)$/, '').replace(/^([A-Z0-9]{2,10})-USD$/, '$1').replace(/^([A-Z]{3})([A-Z]{3})=X$/, '$1/$2'));
const kindLabel = kind => t(`kind_${kind}`);
const marketLabel = id => L(MARKETS[id] || MARKETS.INTL);
// (Taiwan's other products by what they are, not where: a fund, a future, a warrant…)
const productTag = s =>
  stockMarkets.isTwFund?.(s) ? 'kind_fund' : stockMarkets.isFuture?.(s) ? 'kind_fut' : stockMarkets.isOption?.(s) ? 'kind_opt' : isWarrantSym(s) ? 'kind_warrant' : stockMarkets.isCb?.(s) ? 'kind_cb' : stockMarkets.isEmerging?.(s) ? 'tagEmerging' : '';
const flagOf = (symbol, q) => {
  const info = q || state.quotes.get(symbol);
  if (info?.kind === 'index' || info?.kind === 'future' || info?.kind === 'fx') {
    return '';
  }
  const tag = productTag(symbol);
  if (tag) return `<span class="mkt-tag">${h(t(tag))}</span>`;
  // (A Taiwan listing with no quote yet: still 台股.)
  const market = info?.market || (/\.TWO?$/.test(symbol) ? 'TW' : null);
  const id = BONDS[symbol] ? 'US' : MARKETS[market] ? market : 'INTL';
  return `<span class="mkt-tag">${h(marketLabel(id))}</span>`;
};
// A currency's mark on a tile: its country's flag, a picture (no flag emoji, no letters).
// A currency's round flag, bundled (circle-flags 2.7.0, in public/flags: no
// network, no broken image); a currency without one, or a flag that won't
// load, gets the coin icon in its tile.
const FLAGS = { TW: 'tw', US: 'us', JP: 'jp', HK: 'hk', CN: 'cn', KR: 'kr', EU: 'european_union', GB: 'gb', CH: 'ch', DK: 'dk', CA: 'ca', AU: 'au', SG: 'sg', IN: 'in' };
const curMark = c => {
  const f = FLAGS[String(c).slice(0, 2).toUpperCase()];
  return f ? `<img class="cur-flag" src="flags/${f}.svg" alt="${h(c)}" onerror="this.replaceWith(this.nextElementSibling.content.cloneNode(true))"><template>${ico('coin')}</template>` : ico('coin');
};
// A quote's price as shown: a future in whole index points, an option's
// premium in points to its tick (a tenth at most).
// (A stock's future is in NT$ a share, as its stock.)
const isSsf = s => Boolean(stockMarkets.futureOf?.(s)?.stock);
const ptsOf = (kind, symbol = '') => (kind === 'fut' && !isSsf(symbol) ? x => num(x, 0, 0) : kind === 'opt' ? x => num(x, 1, 0) : null);
const qAmt = (q, x) => (ptsOf(q.kind, q.symbol) ? ptsOf(q.kind, q.symbol)(x) : fmtPrice(x, q.currency));
const qPrice = q => qAmt(q, q.price);
// A future's or option's unit is index points, not NT$.
const qUnit = q => (ptsOf(q.kind, q.symbol) ? t('futPoints') : q.currency);
const isTaifex = s => Boolean(stockMarkets.isFuture?.(s) || stockMarkets.isOption?.(s));
const expiryOf = s => (stockMarkets.isOption?.(s) ? stockMarkets.optionExpiry(s) : stockMarkets.futureExpiry(s));
const futLastDay = symbol => t('futLastDay', { date: shortDate(expiryOf(symbol)) });
const dirClass = x => (x > 1e-12 ? 'up' : x < -1e-12 ? 'down' : 'flat');
function unitOf(symbol) {
  if (METALS[symbol]) return L({ zh: METALS[symbol].unitZh, en: METALS[symbol].unitEn });
  if (BONDS[symbol]) return t('bondsUnit');
  // A currency pair is counted in its first currency (EUR/USD: euros).
  if (/^[A-Z]{6}=X$/.test(symbol)) return symbol.slice(0, 3);
  const kind = kindOf(symbol, state.quotes.get(symbol));
  if (kind === 'crypto' || /-USD$/.test(symbol)) return symbol.replace(/-USD$/, '');
  if (kind === 'fut' || kind === 'opt') return t('contracts');
  return kind === 'fund' || kind === 'cb' || kind === 'warrant' ? t('units') : t('shares');
}
// A rate as a percentage with only the digits it has: 0.1425%, 0.3%.
const rateText = x => `${num(x * 100, 4, 0)}%`;
// An exchange rate the readable way round: 1 US$ = 31.69 NT$, not 0.0316.
const rateLine = (from, to, r) => (r >= 1 ? `1 ${from} = ${fmtPrice(r, to)} ${to}` : `1 ${to} = ${fmtPrice(1 / r, from)} ${from}`);

// ---- Data -------------------------------------------------------------------------

const wantedCurrencies = () => {
  const set = new Set(Object.keys(CURRENCIES));
  if (state.account) {
    const s = replay(state.account);
    for (const c of Object.keys(s.cash)) set.add(c);
    for (const p of Object.values(s.positions)) set.add(p.currency);
    for (const c of Object.keys(s.loans)) set.add(c);
  }
  const dq = state.detail && state.quotes.get(state.detail.symbol);
  if (dq?.currency) set.add(dq.currency);
  set.delete(BASE);
  return [...set];
};

function coreSymbols() {
  const set = new Set(OVERVIEW);
  for (const c of wantedCurrencies()) for (const sym of fxSymbolsFor(c)) set.add(sym);
  if (state.account) {
    const s = replay(state.account);
    for (const sym of Object.keys(s.positions)) set.add(sym);
    for (const o of state.account.orders) if (o.status === 'open') set.add(o.symbol);
    for (const sym of watched(state.account)) set.add(sym);
    for (const p of activePlans(state.account)) set.add(p.symbol);
    for (const a of activeAlerts(state.account)) set.add(a.symbol);
  }
  if (state.detail) for (const sym of [state.detail.symbol, ...cbStockSyms(state.detail.symbol)]) set.add(sym);
  return set;
}
// A convertible bond's company's shares (上市 or 上櫃: whichever has a price).
const cbStockSyms = symbol => {
  const code = stockMarkets.cbTerms?.(symbol)?.stock;
  return code ? [`${code}.TW`, `${code}.TWO`] : [];
};
const cbStockQuote = symbol => cbStockSyms(symbol).map(s => state.quotes.get(s)).find(x => x?.price > 0) || null;

function listSymbols() {
  const sub = state.category ? subOf(state.category) : null;
  if (!sub) return [...MARKET_INDEXES];
  return (subSymbols(sub) || []).slice(0, sub.view ? Infinity : shownOf(sub));
}

// Every security each market lists (scripts/listings.mjs): fetched the first
// time a list of it is opened or a search needs it, never at start.
// Rows are [symbol, name, kind letter]. Warrants and 牛熊證 (some 50,000)
// are a list of their own (tww): [symbol, name, kind, last trading day YYMMDD].
const isWarrantSym = s => Boolean(stockMarkets.isWarrant?.(s));
// A warrant's last trading day's 13:30 close, from its list (null till that's read).
function warrantLast(symbol) {
  const row = listings.get('tww')?.find(r => r[0] === symbol);
  const d = row?.[3];
  return d ? Date.parse(`20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}T13:30:00+08:00`) : null;
}
const listings = new Map();
const listingName = new Map();
// Each listing's kind letter by symbol (a list's picks keep to its kinds).
const listingKind = new Map();
const fundHouse = new Map();
const listingLoads = new Map();
function loadListing(market) {
  if (!listingLoads.has(market)) {
    listingLoads.set(
      market,
      fetch(`data/listings-${market}.json`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
        .then(rows => {
          listings.set(market, rows);
          const kinds = new Map();
          listingKind.set(market, kinds);
          for (const [sym, name, kind, house] of rows) {
            listingName.set(sym, name);
            kinds.set(sym, kind);
            if (market === 'fund' && house) fundHouse.set(sym, house);
          }
          return rows;
        })
        .catch(error => {
          listingLoads.delete(market);
          throw error;
        })
    );
  }
  return listingLoads.get(market);
}
// A search in Chinese or Japanese reads Hong Kong's, Japan's and the funds' lists too
// (Yahoo has their names in English only); any list already here is read as well.
const NEEDS_LISTINGS = q => [...(/[^\x20-\x7e]/.test(q) ? ['hk', 'jp', 'fund'] : []), ...(/[購售牛熊]/.test(q) || /^(0[3-8]\d{3}[0-9A-Z]|7\d{4}[0-9A-Z])$/i.test(q) ? ['tww'] : [])];
function listingHits(q, n = 40) {
  const lower = q.toLowerCase();
  const code = q.toUpperCase();
  const out = [];
  for (const rows of listings.values()) {
    for (const [sym, name] of rows) {
      if (sym.split('.')[0] === code || (q.length > 1 && name.toLowerCase().includes(lower))) out.push(sym);
      if (out.length >= n) return out;
    }
  }
  return out;
}

function absorb(quotes) {
  for (const [sym, q] of quotes) {
    const info = catalogInfo(sym);
    if (info?.kind && q.kind !== info.kind && q.kind !== 'index' && q.kind !== 'future') q.kind = info.kind;
    state.quotes.set(sym, markListed(q));
  }
  for (const c of wantedCurrencies()) {
    if (state.crossFx.has(c)) crossRate(c);
    const q = state.quotes.get(fxSymbol(c));
    if (q?.price > 0) state.rates[c] = q.price;
  }
  const usd = state.quotes.get(fxSymbol('USD'));
  state.fxOpen = usd ? isOpen(usd) : true;
}

const crossSymbol = c => `USD${c}=X`;
const fxSymbolsFor = c => (state.crossFx.has(c) ? [fxSymbol('USD'), crossSymbol(c)] : [fxSymbol(c)]);

// NT$ per unit of `c` from US$ per NT$ and `c` per US$, stored as if Yahoo
// had the pair.
function crossRate(c) {
  const usd = state.quotes.get(fxSymbol('USD'));
  const uc = state.quotes.get(crossSymbol(c));
  if (!usd || !uc?.price) return;
  const price = usd.price / uc.price;
  const prev = usd.prev / uc.prev;
  state.quotes.set(fxSymbol(c), {
    ...uc,
    symbol: fxSymbol(c),
    name: `${c}/${BASE}`,
    shortName: `${c}/${BASE}`,
    currency: BASE,
    price,
    prev,
    change: price - prev,
    pct: price / prev - 1,
    line: uc.line.map(([tt, v]) => [tt, usd.price / v])
  });
}

// Rates for these currencies, fetched now if missing (through US$ when
// there's no NT$ pair).
async function ensureRates(currencies) {
  const missing = currencies.filter(c => c && c !== BASE && !state.rates[c]);
  if (!missing.length) return;
  // A batch with a pair Yahoo doesn't have can fail as a whole: the rest
  // are then tried through US$ below.
  absorb(await fetchQuotes(missing.flatMap(fxSymbolsFor)).catch(() => new Map()));
  const still = missing.filter(c => !state.rates[c] && !state.crossFx.has(c));
  if (!still.length) return;
  for (const c of still) state.crossFx.add(c);
  absorb(await fetchQuotes(still.flatMap(fxSymbolsFor)));
}

let refreshing = null;
// (A list asked for while a refresh runs is read straight after it.)
let refreshAgain = false;
async function refresh({ list = false } = {}) {
  if (refreshing) {
    refreshAgain ||= list;
    return refreshing;
  }
  refreshing = (async () => {
    const symbols = coreSymbols();
    const now = Date.now();
    if ((state.tab === 'home' || state.tab === 'markets') && (list || now - (state.listAt.get('home') || 0) > LIST_REFRESH_MS)) {
      for (const sym of homeSymbols()) symbols.add(sym);
      state.listAt.set('home', now);
    }
    if (list || now - (state.listAt.get(state.category) || 0) > LIST_REFRESH_MS) {
      for (const s of listSymbols()) symbols.add(s);
      state.listAt.set(state.category, now);
    }
    setBusy(true);
    try {
      absorb(await fetchQuotes([...symbols]));
      await ensureRates(wantedCurrencies()).catch(() => {});
      state.error = null;
      state.updated = Date.now();
      state.loaded = true;
      state.fromCache = 0;
      state.online = true;
      afterPrices();
      saveQuotes();
    } catch (error) {
      state.error = error;
    } finally {
      setBusy(false);
      refreshing = null;
      render();
      if (refreshAgain) {
        refreshAgain = false;
        refresh({ list: true });
      }
    }
  })();
  return refreshing;
}

// The proxy's fills for the open orders ({ orderId: { quote, t } }), asked
// once at a time; an answer with a new fill runs afterPrices again (it's
// applied there). After a refresh, only when one is due (the kit's
// fillAskDue: one not asked about yet, a session begun, a price at or near
// its trigger; else every 10 minutes): the proxy fills from the bars since
// it last looked, so asking later changes no price, only how soon it shows.
// `now`: at once (opening, placing, a plan due).
const FILL_ASK_MS = 3_000;
let fillAsk = { at: 0, busy: false };
// When each open order was last answered for.
const fillAsked = new Map();
// A monthly plan whose month is due and not bought yet (the proxy buys it).
const plansDue = account => activePlans(account).filter(p => planRuns(p).some(r => !account.orders.some(o => o.id === planOrderId(p, r.month)) && !state.fills[planOrderId(p, r.month)]));
function fillsDue(open, plans, at) {
  const due = stockAccount.fillAskDue;
  if (!due) return true;
  if (open.some(o => due(o, state.quotes.get(o.symbol), fillAsked.get(o.id), at))) return true;
  return plans.length > 0 && at - fillAsk.at >= (stockAccount.FILL_ASK_EVERY || 0);
}
// True once the proxy has answered.
// An order as the proxy is told of it (asking for its fill, or to cancel it).
const spec = o => ({ id: o.id, symbol: o.symbol, side: o.side, type: o.type, qty: o.qty, limit: o.limit, stop: o.stop, t: o.t, after: o.after, expires: o.expires, market: o.market, kind: o.kind, currency: o.currency, ...(o.ext ? { ext: true } : {}) });
async function askFills(account, { now = false } = {}) {
  const open = (account?.orders || []).filter(o => o.status === 'open' && !state.fills[o.id]);
  const plans = account ? plansDue(account) : [];
  const at = Date.now();
  if (!open.length && !plans.length) return true;
  if (!now && (fillAsk.busy || at - fillAsk.at < FILL_ASK_MS || !fillsDue(open, plans, at))) return false;
  fillAsk = { at, busy: true };
  try {
    const planSpec = p => ({ id: p.id, symbol: p.symbol, day: p.day, amount: p.amount, on: p.on, currency: state.quotes.get(p.symbol)?.currency || p.currency, market: p.market, kind: p.kind });
    const sent = open.slice(0, 40);
    const res = await workerJson('/stock', '', { body: JSON.stringify({ op: 'fill', orders: sent.map(spec), plans: plans.slice(0, 20).map(planSpec) }), timeout: 15_000 });
    for (const o of sent) fillAsked.set(o.id, at);
    const fresh = Object.entries(res?.fills || {}).filter(([id]) => !state.fills[id]);
    if (!fresh.length) return true;
    for (const [id, f] of fresh) state.fills[id] = f;
    afterPrices();
    render();
    if (state.detail) renderDetail();
    return true;
  } finally {
    fillAsk.busy = false;
  }
}

// Every order waits for the proxy's fill (none at the phone's own quote):
// placed as one waiting for a fresh price, which only the proxy's answers
// fill. An older kit: as before.
const place = (account, req, opts) => placeOrder(account, stockAccount.applyFills ? { ...req, fresh: true } : req, opts);
// The US market-wide halt now (a circuit breaker on the S&P 500, the kit's marketHalt), or null.
const haltNow = (now = Date.now()) => usHalt(state.quotes.get(stockMarkets.SPX ?? '^GSPC'), now);
// A US stock or ETF's halt (null for anything else).
const haltOf = (q, now = Date.now()) => (usSessionOf(q, now) !== undefined ? haltNow(now) : null);

// Once new prices are in: fill waiting orders, force-sell if the loans call
// for it, record today's value.
function afterPrices() {
  // Orders left open while the page was closed are settled from the price
  // history first (backfillOrders), not at today's price.
  if (!state.account || !state.backfilled) return;
  const now = Date.now();
  // Deposits that matured and lending contracts that ran their term.
  // (And old 融資 loans tied to what they bought, once.)
  loadLendCloses(state.account, now);
  let account = matureDeposits(state.account, now);
  if (lendClosesReady(account, now)) account = matureLending(account, now, { closesOf: lendClosesOf });
  for (const e of account.events.filter(e => e.type === 'tdend' && !state.account.events.some(x => x.id === e.id))) accountNotice('income', t('tdMatured', { v: money(e.amount + e.net, BASE) }), { tag: e.id, hash: 'fx' });
  // Filled by the proxy at its own quote (Orbit-Core stock-fill.js; the
  // owner, 2026-10-14): its fills applied here (one from a session the page
  // wasn't open for, dated then, before its order could lapse), the open
  // orders asked about (askFills). An older kit without it: filled here.
  const r = stockAccount.applyFills ? stockAccount.applyFills(account, state.fills, state.rates, now) : processOrders(account, state.quotes, state.rates, now, { halt: haltNow(now) });
  account = r.account;
  // Day orders past their session end (and month-old GTC ones) lapse, once
  // the proxy has been asked after their end (lib/orders.mjs: one that met
  // its price just before it fills instead); those still to ask, asked now.
  const ex = stockAccount.applyFills ? expireAsked(account, id => fillAsked.get(id), now) : { ...expireOrders(account, now), waiting: [] };
  account = ex.account;
  for (const o of ex.expired) accountNotice('order', t('toastExpired', { name: nameOf(o.symbol) }), { tag: `order:${o.id}`, hash: 'history' });
  if (stockAccount.applyFills) askFills(account, { now: ex.waiting.length > 0 && !fillAsk.busy && Date.now() - fillAsk.at >= FILL_ASK_MS }).catch(() => {});
  for (const f of r.filled) filledNotice(t('toastFilled', { side: t(f.side), qty: fmtQty(f.qty), name: nameOf(f.symbol), price: fmtPrice(f.price, f.currency) }), f);
  for (const o of r.rejected) accountNotice('order', t('toastRejected', { name: nameOf(o.symbol), why: t(`err_${o.reason}`) }), { tone: 'bad', tag: `order:${o.id}`, hash: 'history' });
  if (r.filled.some(f => f.forced && !f.cover)) account = repayAll(account, state.rates, state.fxOpen, now);
  let v = valuate(replay(account, now), state.quotes, state.rates);
  // Below the line the broker needs every share: lent ones are called back.
  if (v.margin === 'liquidate') account = recallAll(account, now);
  for (const plan of liquidationPlan(account, v)) {
    const placed = place(account, plan, { quote: state.quotes.get(plan.symbol), rates: state.rates, now });
    if (placed.account) {
      account = placed.account;
      accountNotice('margin', t('toastForced', { name: nameOf(plan.symbol) }), { tone: 'bad', tag: `forced:${plan.symbol}:${now}`, hash: 'fx' });
    }
  }
  // 融資 and 融券 past their six months (not extended), any of them without
  // a credit account, and day trades sold first and not bought back by the
  // close: closed for the account.
  for (const plan of closeOutPlan(account, v, now)) {
    const placed = place(account, plan, { quote: state.quotes.get(plan.symbol), rates: state.rates, valuation: v, now });
    if (placed.account) {
      account = placed.account;
      accountNotice('margin', t({ due: 'toastTermDue', noCredit: 'toastNoCredit' }[plan.reason] || 'toastDayCover', { name: nameOf(plan.symbol) }), { tone: 'bad', tag: `closeout:${plan.symbol}:${now}`, hash: 'fx' });
    }
  }
  if (account !== state.account) {
    if (account.orders.some(o => o.forced && !o.cover && o.status === 'filled' && o.done === now)) account = repayAll(account, state.rates, state.fxOpen, now);
    v = valuate(replay(account, now), state.quotes, state.rates);
  }
  // An overdraft (NT$ cash below zero) is collected like an unpaid
  // settlement (違約交割): until T+2 (odDeadline) to cover it, then the broker sells
  // holdings for it (coverPlan's sales, at market, one order each).
  if (!v.missingRates.length && !v.stale.length) {
    const owed = overdrawnBy(v);
    if (owed >= 1) {
      if (!account.od) {
        account = { ...account, od: { since: now } };
        accountNotice('margin', t('odWarn', { v: money(owed, BASE), date: fmtDate(odDeadline(now)) }), { tone: 'bad', tag: `od:${now}`, hash: 'portfolio' });
      } else if (now >= odDeadline(account.od.since) && !account.orders.some(o => o.status === 'open' && o.cover) && !coverPending(v, account)) {
        // A default: 違約金 on what's owed (it's sold for too), on the record;
        // time deposits are broken against it (the bank's set-off, at the
        // early rate) and lent shares called back to be sold. Once per
        // overdraft: later rounds only sell what's still needed.
        if (!(account.defaultAt >= account.od.since)) {
          const fine = penaltyEvent(owed, now);
          account = { ...account, events: [...account.events, fine], defaultAt: now };
          accountNotice('margin', t('odDefault', { v: money(fine.amount, BASE) }), { tone: 'bad', tag: `default:${now}`, hash: 'portfolio' });
          for (const id of Object.keys(replay(account, now).tds)) account = breakDeposit(account, id, now).account || account;
          account = recallAll(account, now);
        }
        v = valuate(replay(account, now), state.quotes, state.rates);
        for (const x of coverPlan(v, overdrawnBy(v)).plan) {
          const placed = place(account, { symbol: x.symbol, side: 'sell', type: 'market', qty: x.qty, forced: true, cover: true }, { quote: state.quotes.get(x.symbol), rates: state.rates, valuation: v, now });
          if (placed.account) {
            account = placed.account;
            accountNotice('margin', t('odForced', { name: nameOf(x.symbol) }), { tone: 'bad', tag: `odsell:${x.symbol}:${now}`, hash: 'portfolio' });
          }
        }
      }
    } else if (account.od) {
      const { od, ...rest } = account;
      account = rest;
    }
  }
  // A margin call, Taiwan's way (callState in account.mjs): judged after the
  // close, two business days to pay it back to 166% (補繳), then what was
  // bought on margin is sold if the ratio is still under 130% (處分).
  if (!v.missingRates.length && !v.stale.length) {
    // (Also met once the 差額 called is paid in full: callPaid.)
    const c = callState(account.call || null, v, now, stockAccount.callPaid(account, account.call || null, state.rates));
    if (c.event === 'issued') {
      accountNotice('margin', t('callIssued', { ratio: `${Math.floor(v.ratio * 100)}%`, v: money(c.call.need, BASE), date: dateTime(c.call.due) }), { tone: 'bad', tag: `call:${now}`, hash: 'fx' });
    } else if (c.event === 'met') accountNotice('margin', t(c.paid ? 'callMetPaid' : 'callMet'), { tag: `callmet:${now}`, hash: 'fx' });
    if (c.sell) {
      account = recallAll(account, now);
      for (const plan of callPlan(account, v)) {
        const placed = place(account, plan, { quote: state.quotes.get(plan.symbol), rates: state.rates, now });
        if (placed.account) {
          account = placed.account;
          accountNotice('margin', t('toastCalledSale', { name: nameOf(plan.symbol) }), { tone: 'bad', tag: `called:${plan.symbol}:${now}`, hash: 'fx' });
        }
      }
    }
    if (c.call) {
      if (JSON.stringify(c.call) !== JSON.stringify(account.call)) account = { ...account, call: c.call };
      marginCallNotice(account, v);
    } else if (account.call) {
      const { call, ...rest } = account;
      account = rest;
    }
  }
  if (!v.missingRates.length && !v.stale.length) account = recordSnapshot(account, now, v.netWorth, v.deposits);
  const alerts = checkAlerts(account, state.quotes, now);
  account = alerts.account;
  for (const a of alerts.hits) alertFired(a);
  if (account !== state.account) commit(account);
}

// ---- Offline: the last prices are kept, so the page opens with them ------------

function saveQuotes() {
  try {
    const keep = coreSymbols();
    const quotes = [...state.quotes].filter(([sym]) => keep.has(sym) || sym.endsWith('=X'));
    localStorage.setItem(STORE.quotes, JSON.stringify({ at: state.updated, rates: state.rates, crossFx: [...state.crossFx], quotes }));
  } catch {}
}
function loadQuotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE.quotes) || 'null');
    if (!saved?.quotes?.length) return;
    for (const [sym, q] of saved.quotes) if (!state.quotes.has(sym)) state.quotes.set(sym, markListed(q));
    Object.assign(state.rates, saved.rates || {});
    for (const c of saved.crossFx || []) state.crossFx.add(c);
    state.fromCache = saved.at;
    state.updated = saved.at;
    state.loaded = true;
  } catch {}
}
// Trading and exchanging wait for live prices (not the saved ones).
const pricesLive = () => state.loaded && !state.fromCache;

// ---- Price alerts: notifications -----------------------------------------------

function alertText(a) {
  return t(a.op === 'above' ? 'alertHitAbove' : 'alertHitBelow', { name: nameOf(a.symbol), price: fmtPrice(a.hit?.price ?? a.price, state.quotes.get(a.symbol)?.currency) });
}
// The kit's notices (orbit.mjs): a banner while the app is on screen, a
// system notice when it isn't (once turned on in the account sheet).
function alertFired(a, { late = false } = {}) {
  notify(q, { title: alertText(a), body: [t('alertNoticeBody'), late ? dateTime(a.hit.t) : ''].filter(Boolean).join(' · '), tag: `alert:${a.id}:${a.hit?.t || ''}`, hash: 'portfolio', kind: 'alert' });
}
// An order filled: a toast on screen, a notice when the app is in the background.
function filledNotice(text, fill) {
  if (!kindOn('stock', 'fill')) return;
  if (document.visibilityState === 'visible') return toast(text, 'good', 'history');
  notify(q, { title: t('noticeFilledTitle', { side: t(fill.side), name: nameOf(fill.symbol) }), body: t('noticeFilledBody', { qty: fmtQty(fill.qty), price: fmtPrice(fill.price, fill.currency) }), tag: `fill:${fill.id}`, hash: 'history', kind: 'fill' });
}
// What happened in the account (an order lapsed, a forced sale, a dividend
// in): a toast while the app is on screen (tap: where it happened), a
// system notice when it isn't. Each has its kind of notice in the account
// sheet (kit NOTICE_KINDS.stock); a kind turned off there shows neither.
const NOTICE_TITLE = { fill: 'noticeFilled', order: 'noticeOrderTitle', margin: 'noticeMarginTitle', income: 'noticeIncomeTitle' };
function accountNotice(kind, text, { tone = 'good', tag = '', hash = '' } = {}) {
  if (!kindOn('stock', kind)) return;
  if (document.visibilityState === 'visible') return toast(text, tone, hash);
  notify(q, { title: t(NOTICE_TITLE[kind]), body: text, tag, hash, kind });
}
// Margin below 130%: told once a day (the fx tab's badge stays until it's fixed).
function marginCallNotice(account, v) {
  const mark = `${account.id}:${taipeiDay(Date.now())}`;
  try {
    if (localStorage.getItem(STORE.marginNotice) === mark) return;
    localStorage.setItem(STORE.marginNotice, mark);
  } catch {}
  const key = account.call?.need > 0 ? 'noticeMarginBodyOrPaid' : 'noticeMarginBody';
  accountNotice('margin', t(key, { ratio: `${Math.floor(v.ratio * 100)}%` }), { tone: 'bad', tag: `margin:${mark}`, hash: 'fx' });
}

// Alerts set before the page was closed: checked against the price bars
// since, so one that went off meanwhile is reported (with when).
async function checkAlertHistory() {
  const list = activeAlerts(state.account).filter(a => !BONDS[a.symbol]);
  for (const a of list) {
    try {
      const hit = alertHitInBars(a, await fetchBars(a.symbol, Math.max(a.since, Date.now() - 700 * 86_400_000)));
      if (!hit || !state.account.alerts?.[a.id]?.on) continue;
      commit(markAlertHit(state.account, a.id, hit, Date.now()));
      alertFired(state.account.alerts[a.id], { late: true });
    } catch {}
  }
}

// ---- Payday: new money on the 1st of every month -------------------------------------

function checkIncome() {
  if (!state.account) return;
  const r = applyIncome(startIncome(state.account));
  const i = applyCashInterest(r.account);
  if (i.account === state.account) return;
  commit(i.account);
  for (const e of i.added) accountNotice('income', t('toastInterest', { amount: money(e.net, BASE) }), { tag: `interest:${e.id || e.t}`, hash: 'portfolio' });
  if (!r.added.length) return render();
  const total = r.added.reduce((sum, e) => sum + e.amount, 0);
  toast(r.added.length > 1 ? t('toastPaydays', { n: r.added.length, amount: money(total, BASE) }) : t('toastPayday', { amount: money(total, BASE) }), 'good');
  render();
}

// ---- Monthly plans (定期定額) ----------------------------------------------------

// Every month's buy that is due and not done: bought at the proxy's fill
// (stock-fill.js: the first price on or after its day, that moment's rate),
// asked for with the orders (askFills).
let plansRunning = false;
async function checkPlans() {
  if (!state.account || plansRunning || !state.backfilled) return;
  plansRunning = true;
  try {
    // The copies a repeated tap left: one plan a symbol.
    const once = dedupePlans(state.account);
    if (once !== state.account) commit(once);
    if (plansDue(state.account).length) await askFills(state.account, { now: true });
    for (const plan of activePlans(state.account)) {
      const quote = state.quotes.get(plan.symbol);
      for (const run of planRuns(plan)) {
        const f = state.fills[planOrderId(plan, run.month)];
        if (!f || state.account.orders.some(o => o.id === planOrderId(plan, run.month))) continue;
        const r = runPlan(state.account, plan, run, { price: f.quote, twd: f.twd, at: f.t, quote }, Date.now());
        if (r.account === state.account) continue;
        commit(r.account);
        if (r.fill) accountNotice('fill', t('toastPlan', { name: nameOf(plan.symbol), qty: fmtQty(r.fill.qty), price: fmtPrice(r.fill.price, r.fill.currency), time: fmtDate(r.fill.t) }), { tag: `plan:${plan.id}:${run.month}`, hash: 'history' });
        else if (r.order?.status === 'rejected') accountNotice('order', t('toastPlanSkipped', { name: nameOf(plan.symbol), why: planReason(r.order.reason) }), { tone: 'bad', tag: `plan:${plan.id}:${run.month}`, hash: 'portfolio' });
        // Months running without the cash ended it (the kit's PLAN_FAIL_LIMIT): no later month runs.
        if (r.ended) {
          accountNotice('order', t('toastPlanEnded', { name: nameOf(plan.symbol), n: stockAccount.PLAN_FAIL_LIMIT ?? 3 }), { tone: 'bad', tag: `plan:${plan.id}:ended`, hash: 'portfolio' });
          break;
        }
      }
    }
  } finally {
    plansRunning = false;
  }
  render();
}

// Coupons and repayments of the government bonds held.
function checkBonds() {
  if (!state.account) return;
  settleWarrants();
  settleFutures();
  settleOptions();
  const s = snap();
  for (const symbol of Object.keys(s.held)) {
    // (A Taiwan convertible bond: repaid at face on its maturity.)
    const cb = stockAccount.applyCbMaturity && stockMarkets.cbMaturity?.(symbol);
    if (!BONDS[symbol] && !cb) continue;
    const r = cb ? stockAccount.applyCbMaturity(state.account, symbol, { now: Date.now() }) : applyBondCashflows(state.account, symbol, { rates: state.rates, now: Date.now() });
    if (!r.added.length) continue;
    commit(r.account);
    for (const e of r.added)
      accountNotice('income', e.coupon ? t('toastCoupon', { name: nameOf(symbol), amount: money(e.net, e.currency) }) : t('toastMatured', { name: nameOf(symbol), amount: money(e.total, e.currency) }), { tag: `bond:${symbol}:${e.t}`, hash: 'portfolio' });
  }
}

// A warrant held on its last trading day (or found after it) is sold at
// that day's close, as its expiry settles it: an order for that match, once.
// Futures held past their expiry: settled at TAIFEX's final price once it's
// out. And with the account's NT$ (their open gain or loss in) under a quarter
// of their initial margin (風險指標 25%), the broker closes them at market.
async function settleFutures() {
  // (Written options are closed with them when it comes to that.)
  const all = Object.values(snap()?.positions || {});
  const futs = all.filter(p => p.kind === 'fut');
  const written = all.filter(p => p.kind === 'opt' && p.qty < 0);
  if ((!futs.length && !written.length) || !stockAccount.applyFutExpiry) return;
  const now = Date.now();
  let account = state.account;
  if (futs.some(p => now >= stockMarkets.futureExpiry(p.symbol))) {
    const table = await stockQuotes.fetchFutTable().catch(() => null);
    for (const p of futs) {
      const final = stockMarkets.futFinal ? stockMarkets.futFinal(p.symbol, table) : table?.final?.[p.symbol.slice(-9, -3)];
      const r = stockAccount.applyFutExpiry(account, p.symbol, final, { now });
      if (!r.added.length) continue;
      account = r.account;
      accountNotice('income', t('toastFutExpiry', { name: nameOf(p.symbol), price: fmtPrice(final, BASE) }), { tag: `futexp:${p.symbol}`, hash: 'portfolio' });
    }
  }
  const v = valuate(replay(account, now), state.quotes, state.rates);
  if (v.futRisk) {
    for (const p of [...futs, ...written]) {
      const q = state.quotes.get(p.symbol);
      if (!q || !isOpen(q, now) || now >= expiryOf(p.symbol) || account.orders.some(o => o.status === 'open' && o.symbol === p.symbol && o.forced)) continue;
      const r = place(account, { symbol: p.symbol, side: p.qty > 0 ? 'sell' : 'buy', type: 'market', qty: Math.abs(p.qty), forced: true }, { quote: q, rates: state.rates, valuation: v, now, id: `futrisk:${p.symbol}:${now}` });
      if (!r.account) continue;
      account = r.account;
      accountNotice('margin', t('toastFutRisk', { name: nameOf(p.symbol) }), { tone: 'bad', tag: `futrisk:${p.symbol}:${now}`, hash: 'portfolio' });
    }
  }
  if (account !== state.account) {
    commit(account);
    askFills(state.account, { now: true }).catch(() => {});
    render();
  }
}

// Options held past their expiry: settled in cash at what they're worth at
// TAIFEX's final price once it's out (nothing, for one out of the money).
async function settleOptions() {
  const now = Date.now();
  const due = Object.values(snap()?.positions || {}).filter(p => p.kind === 'opt' && now >= expiryOf(p.symbol));
  if (!due.length || !stockAccount.applyOptExpiry) return;
  const table = await stockQuotes.fetchFutTable().catch(() => null);
  let account = state.account;
  for (const p of due) {
    const o = stockMarkets.optionOf(p.symbol);
    const final = table?.final?.[o.series || `${o.year}${String(o.month).padStart(2, '0')}`];
    const r = stockAccount.applyOptExpiry(account, p.symbol, final, { now });
    if (!r.added.length) continue;
    account = r.account;
    const e = r.added[0];
    accountNotice('income', e.total > 0 ? t('toastOptExpiry', { name: nameOf(p.symbol), price: num(final, 0, 0), amount: money(e.total, BASE) }) : t('toastOptWorthless', { name: nameOf(p.symbol), price: num(final, 0, 0) }), { tag: `optexp:${p.symbol}`, hash: 'portfolio' });
  }
  if (account !== state.account) {
    commit(account);
    askFills(state.account, { now: true }).catch(() => {});
    render();
  }
}

async function settleWarrants() {
  const s = snap();
  const held = Object.keys(s?.held || {}).filter(isWarrantSym);
  if (!held.length || !stockAccount.applyFills) return;
  try {
    await loadListing('tww');
  } catch {
    return;
  }
  const now = Date.now();
  let account = state.account;
  for (const symbol of held) {
    const last = warrantLast(symbol);
    const qty = Math.max(0, available(account, replay(account, now)).qty[symbol] || 0);
    // (From that day's opening; one already placed holds the rest.)
    if (!last || now < last - 4.5 * 3_600_000 || !(qty > 0)) continue;
    const quote = state.quotes.get(symbol) || (absorb(await fetchQuotes([symbol]).catch(() => new Map())), state.quotes.get(symbol));
    if (!quote) continue;
    const r = place(account, { symbol, side: 'sell', type: 'market', qty, expiry: last }, { quote, rates: state.rates, valuation: valuate(replay(account, now), state.quotes, state.rates), now, id: `expiry:${symbol}:${now}` });
    if (!r.account) continue;
    account = r.account;
    accountNotice('order', t('toastWarrantExpiry', { name: nameOf(symbol), date: fmtDate(last) }), { tag: `expiry:${symbol}:${last}`, hash: 'portfolio' });
  }
  if (account !== state.account) {
    commit(account);
    askFills(state.account, { now: true }).catch(() => {});
    render();
  }
}

// Orders that stayed open while the page was closed: the proxy fills each
// from the price bars since it first saw it (stock-fill.js), dated then;
// asked for before anything lapses.
async function backfillOrders() {
  if (stockAccount.applyFills) await askFills(state.account, { now: true });
}

// A loan or short that broke the liquidation line while the page was closed
// is sold at that moment, from the price history since the last visit.
async function checkMarginHistory() {
  const account = state.account;
  if (!account) return;
  const s = replay(account);
  const owes = Object.values(s.loans).some(l => l.balance > 1e-9) || Object.values(s.positions).some(p => p.qty < 0);
  if (!owes) return;
  const seen = Math.max(account.created, ...Object.values(account.snapshots || {}).map(x => x.t), ...account.events.map(e => (e.t <= Date.now() ? e.t : 0)));
  if (Date.now() - seen < 30 * 60_000) return;
  const symbols = Object.keys(s.positions).filter(sym => !BONDS[sym]);
  const currencies = [...new Set([...Object.values(s.positions).map(p => p.currency), ...Object.keys(s.loans), ...Object.keys(s.cash)])].filter(c => c !== BASE);
  try {
    const [bars, fx] = await Promise.all([
      Promise.all(symbols.map(sym => fetchBars(sym, seen).catch(() => []))),
      Promise.all(currencies.map(c => fetchBars(fxSymbol(c), seen - 5 * 86_400_000).catch(() => [])))
    ]);
    // Each one's closes ([t, c], oldest first): the last at or before a moment (pointAt).
    const closes = list => (list || []).map(b => [b.t, b.c]);
    const series = new Map(symbols.map((sym, i) => [sym, closes(bars[i])]));
    const rates = new Map(currencies.map((c, i) => [c, closes(fx[i])]));
    const last = (list, t) => pointAt(list || [], t);
    const times = [...new Set(bars.flat().map(b => b.t))].filter(t => t > seen && t < Date.now()).sort((a, b) => a - b);
    const r = marginHistory(state.account, { times, priceAt: (sym, t) => last(series.get(sym), t), rateAt: (c, t) => last(rates.get(c), t) ?? state.rates[c] });
    if (!r.forced.length) return;
    commit(r.account);
    for (const f of r.forced) accountNotice('margin', t('toastForcedAt', { name: nameOf(f.symbol), qty: fmtQty(f.qty), price: fmtPrice(f.price, f.currency), time: dateTime(f.t) }), { tone: 'bad', tag: `forced:${f.symbol}:${f.t}`, hash: 'history' });
    render();
  } catch {}
}

// Dividends and splits of everything held since the account opened, checked
// twice a day per symbol.
async function checkCorporateActions() {
  if (!state.account) return;
  let checked = {};
  try {
    checked = JSON.parse(localStorage.getItem(STORE.actions) || '{}');
  } catch {}
  const s = replay(state.account);
  const now = Date.now();
  const credited = [];
  for (const [symbol, held] of Object.entries(s.held)) {
    if (METALS[symbol] || BONDS[symbol] || (now - (checked[`${state.account.id}:${symbol}`] || 0) < ACTIONS_EVERY_MS && symbol in divNext())) continue;
    const kind = state.account.events.find(e => e.symbol === symbol)?.kind;
    if (kind === 'crypto' || kind === 'fx') continue;
    try {
      const actions = await fetchCorporateActions(symbol, held.first);
      // Yahoo's pay date for its latest dividend (fundamentals' dividendDate, for
      // the one that went ex on their exDividendDate), where it has one: a kit
      // that reads it pays on it, else on the market's usual delay.
      const facts = actions.dividends?.length ? state.about.get(symbol)?.facts || (await fetchFundamentals(symbol).catch(() => null)) : null;
      const r = applyCorporateActions(state.account, symbol, { ...actions, exDividendDate: facts?.exDividendDate ?? null, dividendDate: facts?.dividendDate ?? null }, { rates: state.rates, now: Date.now() });
      saveDivNext(symbol, divForecast(symbol, actions.dividends || [], facts, now));
      if (r.added.length) {
        commit(r.account);
        credited.push(...r.added);
      }
      checked[`${state.account.id}:${symbol}`] = now;
    } catch {}
  }
  try {
    localStorage.setItem(STORE.actions, JSON.stringify(checked));
  } catch {}
  for (const e of credited) {
    if (e.type === 'div' && e.t > Date.now()) accountNotice('income', t('toastDividendPending', { name: nameOf(e.symbol), amount: money(e.net, e.currency), date: fmtDate(e.t) }), { tag: `div:${e.symbol}:${e.t}:ex`, hash: 'portfolio' });
    else if (e.type === 'div') accountNotice('income', t('toastDividend', { name: nameOf(e.symbol), amount: money(e.net, e.currency) }), { tag: `div:${e.symbol}:${e.t}`, hash: 'portfolio' });
    else toast(t('toastSplit', { name: nameOf(e.symbol), ratio: num(e.ratio, 4) }), 'good', 'portfolio');
  }
  if (credited.length) render();
}

function setBusy(busy) {
  if ($('refresh')) $('refresh').disabled = busy;
}

// ---- Toasts -------------------------------------------------------------------------

// The kit's toast. Toasts that come together (catching up on fills, plans,
// interest after a while away) show as one: the first, with a button for how
// many more (it lists them). `hash`: the tab a button on a single one opens.
let toastBatch = null;
function toast(text, kind = '', hash = '') {
  if (toastBatch) return void toastBatch.push([text, kind, hash]);
  toastBatch = [[text, kind, hash]];
  setTimeout(() => {
    const list = toastBatch;
    toastBatch = null;
    if (list.length === 1) return showToast(list[0][0], list[0][1], list[0][2]);
    const rest = list.slice(1);
    showToast(list[0][0], list[0][1], '', {
      label: `+${rest.length}`,
      onTap: () => {
        const body = document.createElement('ul');
        body.className = 'toast-list';
        for (const [x] of list) body.append(Object.assign(document.createElement('li'), { textContent: x }));
        kitUI.sheet({ title: t('toastMore', { n: list.length }), body });
      }
    });
  }, 500);
}
function showToast(text, kind = '', hash = '', action = null) {
  const go = hash && TABS.includes(hash) && state.tab !== hash ? { label: t('toastGo'), onTap: () => showTab(hash) } : null;
  const act = action || go;
  kitUI.toast(text, { tone: kind, ms: act ? 6000 : 4200, ...(act ? { action: act } : {}) });
}

// ---- Shared bits of markup --------------------------------------------------------

// A price at 漲停 or 跌停, filled red or green as Taiwan's brokers show it.
const limitClass = q => (atLimit(q) ? ` at-limit ${atLimit(q)}` : '');
function changeHtml(q, { big = false } = {}) {
  if (!q) return '<span class="chg flat">—</span>';
  const d = dirClass(q.change);
  return `<span class="chg ${d}${big ? ' big' : ''}">${q.change > 0 ? '▲' : q.change < 0 ? '▼' : ''}${qAmt(q, Math.abs(q.change))} (${pct(q.pct)})</span>`;
}
// Today's move as a tinted tag (red or green as the person has it).
const pctTag = q => `<span class="chg num ${q ? dirClass(q.pct) : 'flat'}">${q && Number.isFinite(q.pct) ? pct(q.pct) : '—'}</span>`;
function statusDot(q) {
  if (!q) return '';
  const open = isOpen(q);
  return `<span class="mkt-dot ${open ? 'open' : ''}" title="${h(open ? t('marketOpen') : t('marketClosed'))}"></span>`;
}
// A colour tile with a glyph (the kit's icons, or this app's own below).
const tileHtml = (glyph, color, cls = '') => `<span class="q-tile${cls ? ` ${cls}` : ''}" style="--t:${color}" aria-hidden="true">${glyph}</span>`;
// A section: its title, an optional link or tag on the right, its body.
const sectionHtml = (title, body, { more = '', moreAction = '', side = '', cls = '', count = '' } = {}) => {
  if (!body) return '';
  const own = moreAction.match(/class="([^"]*)"/)?.[1] || '';
  const act = moreAction.replace(/class="[^"]*"/, '').trim();
  const head = kitUI
    .sectionHead(title, { more, count, onMore: null })
    .outerHTML.replace('class="q-sh-more"', `${act} class="q-sh-more${own ? ` ${own}` : ''}"`)
    .replace('</h2>', `</h2>${side}`);
  return `<section class="q-section${cls ? ` ${cls}` : ''}">${head}${body}</section>`;
};
const ico = name => kitUI.icons[name] ?? '';
const TINT = { teal: 'var(--q-accent)', indigo: 'var(--q-indigo)', orange: 'var(--q-orange)', red: 'var(--q-red)', green: 'var(--q-green)', blue: 'var(--q-blue)', purple: 'var(--q-purple)', pink: 'var(--q-pink)', gray: 'var(--q-gray)', brown: 'var(--q-brown)', cyan: 'var(--q-cyan)', mint: 'var(--q-mint)' };
// When a closed market opens next: Yahoo's session moved past weekends and
// the market's holidays (holidays.mjs) to the next trading day.
// The market's own rules for this security, in a line: its lot, daily
// limit, lunch break, settlement, and anything special.
function marketRules(q) {
  if (q.kind === 'opt') return [t('ruleOpt', { mult: money(stockMarkets.OPTION.mult, BASE) }), t('ruleOptExpiry', { date: fmtDate(expiryOf(q.symbol)) }), t('ruleDayOrder')].join(' · ');
  if (q.kind === 'fut') {
    const f = stockMarkets.futureOf(q.symbol);
    const [im, mm] = stockAccount.futMargin(q.symbol, q);
    return [f.stock ? t('ruleSsf', { n: fmtQty(f.mult), unit: t(f.etf ? 'units' : 'shares'), im: money(im, BASE), mm: money(mm, BASE) }) : t('ruleFut', { mult: money(f.mult, BASE), im: money(im, BASE), mm: money(mm, BASE) }), t('ruleFutExpiry', { date: fmtDate(stockMarkets.futureExpiry(q.symbol)) }), t('ruleDayOrder')].join(' · ');
  }
  const parts = [];
  const lot = lotSize(q.market, q.symbol, q.kind);
  if (lot > 1) parts.push(t('ruleLot', { n: fmtQty(lot) }));
  else if (q.market === 'TW' && ['stock', 'etf', 'bond'].includes(q.kind)) parts.push(t('ruleTwLot'));
  const share = limitShare(q);
  if (share) parts.push(t('ruleLimit', { p: Math.round(share * 100) }));
  else if (q.market === 'JP' && (q.kind === 'stock' || (q.kind === 'etf' && stockMarkets.jpEtfUnit))) parts.push(t('ruleLimitJp'));
  else if (q.market === 'TW' && q.listed && ['stock', 'etf', 'bond'].includes(q.kind)) parts.push(t('ruleNoLimitNew'));
  const lunch = lunchOf(q.market);
  if (lunch) {
    const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    parts.push(t('ruleLunch', { from: hm(lunch[0]), to: hm(lunch[1]) }));
  }
  const n = settleDays(q.market);
  parts.push(n ? t('ruleSettle', { n }) : t('ruleInstant'));
  if (q.market === 'CN') parts.push(t('ruleCn'));
  const board = northboundBlock(q);
  if (board) parts.push(t('ruleNorthbound', { board: t(`cnBoard_${board}`) }));
  const emerging = stockMarkets.isEmerging?.(q.symbol);
  const full = q.market === 'TW' && stockMarkets.isFullDelivery?.(q.symbol);
  if (full) parts.push(t('ruleFull'));
  if (q.market === 'TW' && stockMarkets.isInnovation?.(q.symbol)) parts.push(t('ruleInnovation'));
  if (q.market === 'TW' && stockMarkets.isLiFutures?.(q.symbol)) parts.push(t('ruleLiFutures'));
  if (emerging) parts.push(t('ruleEmerging'));
  else if (q.kind === 'warrant') {
    const last = warrantLast(q.symbol);
    parts.push(t('ruleWarrant', { date: last ? fmtDate(last) : '—' }));
    if (!last) loadListing('tww').then(() => state.detail?.symbol === q.symbol && redrawDetail()).catch(() => {});
  } else if (q.kind === 'cb') parts.push(t('ruleCb', { date: stockMarkets.cbMaturity?.(q.symbol) ? fmtDate(stockMarkets.cbMaturity(q.symbol)) : '—' }));
  else if (q.market === 'TWFUND') parts.push(t('ruleFund', { cutoff: stockMarkets.FUND_CUTOFF || '15:30', fee: rateText(stockMarkets.FUND_FEE ?? 0.01) }));
  else if (orderTypes(q).length === 1) parts.push(t('ruleLimitOnly'));
  if (cashOnly(q) && ['stock', 'etf', 'bond'].includes(q.kind)) parts.push(t('ruleCashOnly'));
  if (q.market === 'TW' && q.kind === 'stock' && !emerging && !full) {
    // 0.15% to the date the law sets (the kit's DAY_TRADE_TAX_UNTIL), then the full tax.
    const until = stockMarkets.DAY_TRADE_TAX_UNTIL;
    if (!until) parts.push(t('ruleDayTrade'));
    else if (Date.now() < until) parts.push(t('ruleDayTradeUntil', { date: fmtDate(until - 1) }));
  }
  if (q.kind !== 'crypto' && q.kind !== 'fx' && q.market !== 'TWFUND') parts.push(t('ruleDayOrder'));
  return parts.join(' · ');
}

// Whose holidays a quote keeps: a government bond its issuer's.
const calendarOf = q => (q.market === 'BOND' ? BONDS[q.symbol]?.issuer : q.market);
function nextOpen(q, now) {
  if (!q.session) return null;
  return nextTradingStart(calendarOf(q), q.session.start, q.tz, now);
}
// The market's next holidays, for the detail sheet.
function holidayLine(q) {
  if (!q || q.kind === 'crypto' || q.market === 'FX') return '';
  const days = upcomingHolidays(calendarOf(q), localDay(Date.now(), q.tz), 3);
  if (!days.length) return '';
  const wd = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-TW' : 'en-US', { weekday: 'short', timeZone: 'UTC' });
  return days.map(d => `${+d.slice(5, 7)}/${+d.slice(8, 10)} ${wd.format(new Date(`${d}T00:00:00Z`))}`).join(locale === 'zh' ? '、' : ', ');
}

// A holding's 融資 shares (the loan's collateral, sold first by the broker
// and only through 融資賣出); the rest of it is 現股.
const heldMargin = symbol => {
  const p = replay(state.account).positions[symbol];
  return p && !p.short ? marginShares(p) : 0;
};
// When today's session ends: its close, or a half day's early close.
// (興櫃's runs to 15:00: the kit's sessionEnd.)
const closeOf = (q, now = Date.now()) => Math.min(stockMarkets.sessionEnd?.(q) ?? q.session?.end ?? Infinity, stockMarkets.earlyCloseAt(q.market, now) ?? Infinity);
function marketStatus(q) {
  if (!q) return '';
  if (q.kind === 'crypto') return `<span class="mkt-status open">${statusDot(q)}${h(t('always'))}</span>`;
  const now = Date.now();
  if (q.session && now >= q.session.start && now < q.session.end && atLunch(q.market, now)) return `<span class="mkt-status">${statusDot(q)}${h(t('atLunch'))} <small>(${h(t('localTime'))} ${h(clock(now, q.tz))})</small></span>`;
  // Taiwan's own phases: 試撮 before the opening auction, the closing
  // auction, and (for what trades after hours) the 盤後 sessions to 14:30.
  const ph = q.market === 'TW' ? twPhase(now) : null;
  if (ph && ph.id !== 'continuous' && (ph.id !== 'after' || isTradable(q.kind))) {
    const time = clock(ph.until, q.tz);
    const text = { preopen: t('phasePreopen', { time }), closing: t('phaseClosing', { time }), after: t('phaseAfter', { time }) }[ph.id];
    return `<span class="mkt-status${ph.id === 'closing' ? ' open' : ''}">${statusDot(q)}${h(text)} <small>(${h(t('localTime'))} ${h(clock(now, q.tz))})</small></span>`;
  }
  const local = `<small>(${h(t('localTime'))} ${h(clock(now, q.tz))})</small>`;
  // The US: a market-wide halt (circuit breaker), and the pre- and post-market.
  const halt = haltOf(q, now);
  if (halt && now < halt.until) return `<span class="mkt-status halt">${statusDot(q)}${h(halt.level === 3 ? t('haltDay') : t('haltUntil', { time: clock(halt.until, q.tz) }))} ${local}</span>`;
  const us = usSessionOf(q, now);
  if (us === 'pre' || us === 'post') {
    const until = us === 'pre' ? (q.session?.start > now ? q.session.start : nextOpen(q, now)) : stockMarkets.usExtendedEnd(now);
    return `<span class="mkt-status ext">${statusDot(q)}${h(t(us === 'pre' ? 'statusPre' : 'statusPost', { time: until ? clock(until, q.tz) : '—' }))} ${local}</span>`;
  }
  // A half day closes early (the kit's earlyCloseAt).
  if (isOpen(q, now)) {
    const early = closeOf(q, now) < (stockMarkets.sessionEnd?.(q) ?? q.session.end);
    return `<span class="mkt-status open">${statusDot(q)}${h(t(early ? 'marketOpenUntilEarly' : 'marketOpenUntil', { time: clock(closeOf(q, now), q.tz) }))} ${local}</span>`;
  }
  const opens = nextOpen(q, now);
  const next = opens ? t('opensAt', { time: weekdayClock(opens) }) : t('marketClosed');
  return `<span class="mkt-status">${statusDot(q)}${h(next)} <small>(${h(t('localTime'))} ${h(clock(now, q.tz))})</small></span>`;
}
// A symbol's picture, in order: TradingView's round icon (two for a
// currency pair), the company's own icon or else its official logo
// (Wikidata's), and outside Taiwan Financial Modeling Prep's image by ticker
// (its Taiwan ones are often photos: a T-shirt for Foxconn). An icon fills
// the round badge; a logo sits on white inside it.
const twSymbol = symbol => /\.TWO?$/.test(symbol);
// Round icons for the companies whose TradingView icon is out of date and
// whose official logo doesn't sit well in a circle (7-ELEVEN's tall sign,
// Roblox's wide wordmark, Uber's 2016 square) or wrong (abrdn's for a Fidelity
// fund): drawn here, from the current logos.
const OWN_ICONS = { '2912.TW': 'logos/7-eleven.svg', RBLX: 'logos/roblox.svg', UBER: 'logos/uber.svg', FXAIX: 'logos/fidelity.svg', MCD: brandIcon('MCD') };
// A Taiwan fund wears its fund house's group logo (元大投信 元大金's).
const FUND_HOUSE_LOGO = {
  中國信託: '2891.TW', 元大: '2885.TW', 兆豐: '2886.TW', 凱基: '2883.TW', 台中銀: '2812.TW', 台新: '2887.TW', 合庫: '5880.TW', 國泰: '2882.TW',
  大華銀: 'U11.SI', 大都會: 'MET', 安聯: 'ALV.DE', 宏利: 'MFC', 富蘭克林華美: 'BEN', 富達: 'FXAIX', 富邦: '2881.TW', 德銀遠東: 'DWS.DE', 摩根: 'JPM',
  施羅德: 'SDR.L', 景順: 'IVZ', 東方匯理: 'AMUN.PA', 永豐: '2890.TW', 滙豐: 'HSBA.L', 瀚亞: 'PUK', 玉山: '2884.TW', 瑞銀: 'UBSG.SW', 第一金: '2892.TW',
  統一: '2855.TW', 群益: '6005.TW', 聯博: 'AB', 聯邦: '2838.TW', 華南永昌: '2880.TW', 貝萊德: 'BLK', 野村: 'NMR'
};
const fundHouseOf = symbol => fundHouse.get(symbol) || state.quotes.get(symbol)?.exchange?.replace(/投信$/, '') || null;
function logoChoices(symbol, kind) {
  if (BONDS[symbol]) return [];
  if (stockMarkets.isTwFund?.(symbol)) {
    const parent = FUND_HOUSE_LOGO[fundHouseOf(symbol)];
    return parent ? logoChoices(parent, 'stock') : [];
  }
  if (OWN_ICONS[symbol]) return [{ urls: [OWN_ICONS[symbol]], fit: 'icon' }];
  const tv = tvLogos(symbol);
  return [
    tv && { urls: tv, fit: 'icon' },
    ...[brandIcon(symbol), brandLogo(symbol)].filter(Boolean).map(url => ({ urls: [url], fit: 'logo' })),
    !twSymbol(symbol) && (kind === 'stock' || kind === 'etf') && { urls: [`https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`], fit: 'logo', guess: true }
  ].filter(Boolean);
}
// Every picture a symbol may have, in the order to try them (the kit's logoTile takes the list and
// falls to the name's letter); a currency pair keeps its two icons for its own badge.
function logoUrls(symbol, kind) {
  const ok = logoChoices(symbol, kind).filter(c => c.urls.every(u => !logoBad.has(u) && !logoMiss.has(u)));
  return ok[0]?.urls.length > 1 ? ok[0].urls : ok.flatMap(c => c.urls);
}
// Pictures seen to load (kept on the device: drawn at once next time, with
// no fade) and ones that failed twice (this visit; a guessed FMP picture
// that isn't there, for good).
const LOGO_OK_KEY = 'stock.logoOk.v1';
const LOGO_MISS_KEY = 'stock.logoMiss.v3';
const stored = key => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
};
const logoOk = stored(LOGO_OK_KEY);
const logoMiss = stored(LOGO_MISS_KEY);
const logoBad = new Set();
let logoSave = 0;
const saveLogos = () => {
  clearTimeout(logoSave);
  logoSave = setTimeout(() => {
    try {
      localStorage.setItem(LOGO_OK_KEY, JSON.stringify([...logoOk].slice(-800)));
      localStorage.setItem(LOGO_MISS_KEY, JSON.stringify([...logoMiss].slice(-400)));
    } catch {}
  }, 1000);
};
// What a symbol is, before its quote has come: the catalogue's word, else its code's (a fund, a warrant…).
const SYM_KIND = { kind_fund: 'fund', kind_fut: 'fut', kind_opt: 'opt', kind_warrant: 'warrant', kind_cb: 'cb' };
const kindOf = (symbol, q) => q?.kind || catalogInfo(symbol)?.kind || SYM_KIND[productTag(symbol)] || 'stock';
const SYM_MARK = { stock: 'bank', etf: 'grid', bond: 'bank', fund: 'wallet', crypto: 'coin', metal: 'coin', index: 'chart', fut: 'chart', opt: 'target', warrant: 'ticket', cb: 'shield', fx: 'exchange' };
function symbolBadge(symbol, q) {
  const kind = kindOf(symbol, q);
  const zh = twSymbol(symbol) ? catalogInfo(symbol)?.zh || twZhName(symbol) : null;
  const zhShort = zh ? zh.replace(kind === 'etf' ? /^(元大|富邦|國泰|群益|復華|統一|凱基|大華|中信|永豐|兆豐)/ : /[-*].*$/, '').slice(0, 2) : '';
  const text = BONDS[symbol] ? symbol.split('-')[1] : /^[A-Z]{6}=X$/.test(symbol) ? symbol.slice(0, 3) : zhShort || bareSymbol(symbol).replace(/-USD$/, '').replace(/^\^/, '').slice(0, 4);
  // No picture: a drawing of its kind on its kind's colour, never letters (an older kit without the icons: the letters).
  const mark = kitUI.icons?.[SYM_MARK[kind] || 'bank'];
  const plain = mark ? `<span class="sym-badge mark k-${h(kind)}" role="img" aria-label="${h(text)}">${mark}</span>` : `<span class="sym-badge k-${h(kind)}${text === zhShort && zhShort ? ' zh' : ''}">${h(text)}</span>`;
  const choice = logoChoices(symbol, kind).find(c => c.urls.every(u => !logoBad.has(u) && !logoMiss.has(u)));
  if (!choice) return plain;
  const imgs = choice.urls
    .map(u => (logoOk.has(u) ? `<img class="sym-logo" src="${h(u)}" alt="" referrerpolicy="no-referrer">` : `<img class="sym-logo fresh" src="${h(u)}" alt="" referrerpolicy="no-referrer"${choice.guess ? ' data-guess' : ''}>`))
    .join('');
  return `<span class="sym-badge has-logo ${choice.fit}${choice.urls.length > 1 ? ' pair' : ''}" data-symbol="${h(symbol)}" data-kind="${h(kind)}">${imgs}</span>`;
}
// A symbol's picture for a sheet's hero: the kit's logo tile with the whole list of pictures
// (and the name's letter at the end); this app's round badge where the kit has no such tile.
function heroLogo(symbol, q) {
  const kind = kindOf(symbol, q);
  const urls = logoUrls(symbol, kind);
  const name = nameOf(symbol, q);
  if (!kitUI.logoTileHtml || !urls.length || /^[A-Z]{6}=X$/.test(symbol)) return symbolBadge(symbol, q);
  return discTile(kitUI.logoTileHtml(urls, { size: 56, alt: '', fallbackText: name || bareSymbol(symbol) }), urls);
}
// A TradingView icon that is a disc on a clear square fills its tile: the tile takes the disc's colour (lib/tvround.mjs).
function discTile(html, urls) {
  const fill = html && TV_ROUND[urls?.[0]?.match(/^https:\/\/s3-symbol-logo\.tradingview\.com\/(.+)\.svg$/)?.[1]];
  return fill ? html.replace('class="q-logo" style="', `class="q-logo disc" style="--disc:${fill};`) : html;
}
document.addEventListener(
  'load',
  e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('sym-logo')) return;
    // A guessed picture that loads as a speck (an empty placeholder) isn't there.
    if (img.hasAttribute('data-guess') && img.naturalWidth < 24 && img.naturalHeight < 24) return void img.dispatchEvent(new Event('error'));
    img.classList.add('in');
    const url = img.getAttribute('src');
    if (!logoOk.has(url)) {
      logoOk.add(url);
      saveLogos();
    }
  },
  true
);
// A picture that fails is asked for once more; failing again, the badge
// draws the next one (or the symbol's name).
document.addEventListener(
  'error',
  e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('sym-logo')) return;
    const url = img.getAttribute('src');
    if (!img.dataset.retried && !img.hasAttribute('data-guess')) {
      img.dataset.retried = '1';
      return void setTimeout(() => img.isConnected && img.setAttribute('src', url), 1500);
    }
    logoOk.delete(url);
    if (img.hasAttribute('data-guess')) logoMiss.add(url);
    else logoBad.add(url);
    saveLogos();
    const badge = img.closest('.sym-badge');
    if (badge?.isConnected) badge.outerHTML = symbolBadge(badge.dataset.symbol, { kind: badge.dataset.kind });
  },
  true
);

// A security as a row: its picture, name and where it trades, the price over today's move.
function quoteRow(symbol, { note = '' } = {}) {
  const q = state.quotes.get(symbol);
  const info = catalogInfo(symbol);
  const held = snap()?.positions[symbol];
  // A bond's maturity (its name's last bracket) goes under it, in its symbol's place: the name fits one line.
  const due = BONDS[symbol] ? /^(.+?)\s*[（(]([^（(]+)[)）]$/.exec(nameOf(symbol, q)) : null;
  const sub = [due ? due[2] : bareSymbol(symbol), note].filter(Boolean).join(' · ');
  return `<button class="q-ritem quote" type="button" data-action="open" data-symbol="${h(symbol)}">
    ${symbolBadge(symbol, q || info)}
    <span class="q-ritem-text"><span class="q-ritem-title">${h(due ? due[1] : nameOf(symbol, q))}</span><small>${held ? `<b class="held">${h(t('heldTag'))}</b>` : ''}${flagOf(symbol, q)} ${h(sub)}</small></span>
    <span class="q-ritem-end"><strong class="num${limitClass(q)}" data-q-live="row:${h(symbol)}">${q ? qPrice(q) : '…'}</strong>${pctTag(q)}</span>
  </button>`;
}
// Replaying the log is cheap but not free: one replay per account version,
// refreshed every few seconds for loan interest.
let memo = { account: null, at: 0, s: null };
function snap() {
  if (!state.account) return null;
  const now = Date.now();
  if (memo.account !== state.account || now - memo.at > 5000) memo = { account: state.account, at: now, s: replay(state.account, now) };
  return memo.s;
}
function valuation() {
  const s = snap();
  return s ? valuate(s, state.quotes, state.rates) : null;
}

// ---- 首頁: the day at a glance ----------------------------------------------------------

// What the home and the market tab read besides the lists: for you, and the
// first of the popular lists (today's movers come from these).
const homeSymbols = () => {
  const out = new Set(forYouSymbols());
  for (const [id, n] of [['tw', 24], ['us', 24], ['twetf', 8], ['usetf', 8], ['crypto', 10], ['jp', 8], ['hk', 8], ['kr', 6], ['eu', 8]]) for (const [sym] of (CATEGORIES.find(c => c.id === id)?.items || []).slice(0, n)) out.add(sym);
  return out;
};
const forYouSymbols = () =>
  wantedSymbols({ aff: affinityMap(), held: Object.keys(snap()?.positions || {}), watched: watched(state.account) });
let affMemo = { at: 0, map: {} };
function affinityMap() {
  if (Date.now() - affMemo.at > 30_000) affMemo = { at: Date.now(), map: affinity(state.wallet) };
  return affMemo.map;
}
const kindOrCat = id => {
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? L(cat) : t(`kind_${id}`);
};
// The account's day change, named for its day: 今日 while a market held
// trades today, else that last day (週五 on a weekend; a date past a week).
function dayWord(v, now = Date.now()) {
  const d = dayOfChange(v, now);
  if (d.today) return t('today');
  const loc = locale === 'zh' ? 'zh-TW' : 'en-US';
  return now - d.at < 6 * 86_400_000 ? new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: d.tz }).format(d.at) : new Intl.DateTimeFormat(loc, { month: 'numeric', day: 'numeric', timeZone: d.tz }).format(d.at);
}
const arrow = x => (x > 1e-9 ? '▲ ' : x < -1e-9 ? '▼ ' : '');

// What's trading now (a weekday evening has the US and crypto open): each
// market by its index's session. One tag on the overview.
const OPEN_MARKETS = [['tw', '^TWII'], ['us', '^GSPC'], ['jp', '^N225'], ['hk', '^HSI'], ['crypto', 'BTC-USD']];
const openMarkets = (now = Date.now()) => OPEN_MARKETS.filter(([, sym]) => state.quotes.get(sym) && isOpen(state.quotes.get(sym), now)).map(([id]) => id);
function homeOpenChip() {
  const open = openMarkets();
  return open.length ? `<button class="open-now" type="button" data-action="movers-go" data-v="${h(open[0] === 'jp' || open[0] === 'hk' ? 'world' : open[0])}"><i class="open-dot" aria-hidden="true"></i>${h(open.slice(0, 2).map(id => t(`openMkt_${id}`)).join('・'))}${open.length > 2 ? '…' : ''} ${h(t('openNow'))}</button>` : '';
}

// ---- Kit pieces for the home (each an element of the kit as HTML, its taps by data-action: this app's one click handler) ----
// A bare empty state: the kit's, one line.
const plainEmpty = text => kitUI.emptyHtml({ title: text });
// The kit's empty state, with an icon, and a button of the app's own under it.
const emptyHtml = ({ icon, tint = TINT.gray, title, body = '', go = '', attrs = '' }) => {
  const btn = go ? `<button class="q-btn primary small" type="button" ${attrs}>${h(go)}</button>` : '';
  const node = kitUI.empty({ icon, tint, title, body }).outerHTML;
  return `<div class="q-rowcard empty-card">${node.replace(/<\/div>$/, `${btn}</div>`)}</div>`;
};
// The day's move as Apple Stocks draws it: a solid pill, white on red or green.
// The day's move as the kit's solid pill (percent in, ours is a fraction).
const movePill = q => kitUI.movePillHtml(q && Number.isFinite(q.pct) ? q.pct * 100 : null);
// A watchlist row, Apple Stocks style, the kit's stockRow: logo, name and code, spark, the price over the pill.
function stockRow(symbol, { sub = '' } = {}) {
  const q = state.quotes.get(symbol);
  const info = catalogInfo(symbol);
  const kind = kindOf(symbol, q);
  const held = snap()?.positions[symbol];
  const due = BONDS[symbol] ? /^(.+?)\s*[（(]([^（(]+)[)）]$/.exec(nameOf(symbol, q)) : null;
  const logo = logoUrls(symbol, kind);
  const line = [held ? t('heldTag') : '', due ? due[2] : bareSymbol(symbol), sub].filter(Boolean).join(' · ');
  return (
    discTile(kitUI.stockRowHtml({ logo, name: due ? due[1] : nameOf(symbol, q), sub: line, spark: q?.line?.length > 1 ? q.line : [], price: q ? qPrice(q) : '…', changePct: q && Number.isFinite(q.pct) ? q.pct * 100 : null, open: symbol, data: { action: 'open', symbol } }), logo)
  );
}
// What's coming that matters to this account: orders waiting, an ex-date today, a held stock on TWSE's lists, the next market holidays.
function eventRows(v) {
  const rows = [];
  const row = (glyph, color, title, small, attrs, end = '') =>
    `<button class="q-ritem chevron" type="button" ${attrs}>${tileHtml(glyph, color)}<span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span><small>${h(small)}</small></span>${end}</button>`;
  const open = state.account.orders.filter(o => o.status === 'open').length;
  if (open) rows.push(row(ico('list'), TINT.blue, t('evOrders', { n: open }), t('evOrdersSub'), 'data-action="hview-go" data-view="orders"'));
  const ex = exDayTags(state.account.events);
  for (const p of v.positions) {
    if (ex.get(p.symbol)) rows.push(row(ico('coin'), TINT.orange, t('evExDay', { name: nameOf(p.symbol, p.quote) }), exTagHtml(p.symbol).replace(/<[^>]+>/g, ''), `data-action="open" data-symbol="${h(p.symbol)}"`));
    const a = alertOf(p.symbol, alertState);
    if (a) rows.push(row(ico('bell'), TINT.red, t('evAlertHeld', { name: nameOf(p.symbol, p.quote), kind: t(`${a}Tag`) }), t(`${a}Help`), `data-action="open" data-symbol="${h(p.symbol)}"`));
  }
  for (const [id, sym] of [['tw', '^TWII'], ['us', '^GSPC']]) {
    const days = holidayLine(state.quotes.get(sym)).split(/[、,] ?/).slice(0, 2).join(locale === 'zh' ? '、' : ', ');
    if (days) rows.push(row(ico('calendar'), TINT.gray, t('evHoliday', { m: t(`openMkt_${id}`) }), days, 'data-action="goto" data-tab="markets"'));
  }
  return rows.slice(0, 5);
}

// What 為你推薦 showed and what was opened from it (kit feedback.mjs, on the
// device). (Loaded on the side: an older kit without it ranks as before.)
let feedback = null;
import('#kit/feedback.mjs').then(m => (feedback = m)).catch(() => {});
function renderHome() {
  const box = $('home-body');
  const v = state.account ? valuation() : null;
  const held = Object.keys(snap()?.positions || {});
  const recs = forYou({ quotes: state.quotes, held, watched: watched(state.account), wallet: state.wallet, aff: affinityMap(), n: 10, lift: feedback?.lifter('stock') });
  state.recs = recs;
  // (The first few are what's in view on the rail.)
  feedback?.shown('stock', recs.slice(0, 4));
  // No balance here: it's 資產's (Jay 2026-10-21). Home is the market; an
  // overdraft still says so, as it needs doing.
  const hero = v && overdrawnBy(v) >= 1 && !coverPending(v) ? `<button class="callout bad" type="button" data-action="goto" data-tab="portfolio">${h(t('odStrip', { v: money(overdrawnBy(v), BASE) }))}</button>` : '';
  // 商品: every product, the same tiles and order as 市場's bar; a tap opens it there.
  const quick = `<div class="q-actions-grid prod-grid">${PRODUCTS.map(p => `<button class="q-action q-press" type="button" data-action="go-product" data-id="${h(p.id)}">${productTile(p.id)}<span>${h(L(p.short))}</span></button>`).join('')}</div>`;
  // 我的持股: a rail, each holding's picture, name, price and today's move.
  const positions = v ? [...v.positions].sort((a, b) => Math.abs(b.valueTWD) - Math.abs(a.valueTWD)).slice(0, 12) : [];
  const holdCard = p => {
    const q = p.quote;
    return `<button class="q-rail-card hold-card q-press" type="button" data-action="open" data-symbol="${h(p.symbol)}">
      <span class="hold-top">${symbolBadge(p.symbol, q)}${movePill(q)}</span>
      <span class="rec-name q-fit">${h(nameOf(p.symbol, q))}</span>
      <small class="num">${h(fmtQty(Math.abs(p.qty)))} ${h(unitOf(p.symbol))}</small>
      <strong class="num hold-val">${q ? qPrice(q) : '…'}</strong>
      ${q?.line?.length > 1 ? `<span class="card-spark">${sparkline(q.line, q.kind === 'crypto' ? null : q.prev, { width: 128, height: 28 })}</span>` : ''}
    </button>`;
  };
  const holdings = v
    ? sectionHtml(t('homeHoldings'), positions.length ? `<div class="q-rail small hold-rail">${positions.map(holdCard).join('')}</div>` : emptyHtml({ icon: 'chart', tint: TINT.blue, title: t('emptyHoldTitle'), body: t('emptyHoldBody'), go: t('emptyHoldGo'), attrs: 'data-action="goto" data-tab="markets"' }), {
        count: positions.length || '',
        more: positions.length ? t('seeAll') : '',
        moreAction: 'data-action="goto" data-tab="portfolio"'
      })
    : '';
  // 自選股: under the holdings, one slim strip (name and today's move); gone while empty
  // (Jay 2026-10-22: people look at their holdings far more than their stars).
  const watch = state.account ? watched(state.account) : [];
  const watchChip = s => {
    const q = state.quotes.get(s);
    return `<button class="q-rail-card watch-chip q-press" type="button" data-action="open" data-symbol="${h(s)}">${symbolBadge(s, q)}<span class="watch-name">${h(nameOf(s, q))}</span>${pctTag(q)}</button>`;
  };
  const watchlist = watch.length
    ? sectionHtml(t('homeWatch'), `<div class="q-rail small watch-rail">${watch.slice(0, 12).map(watchChip).join('')}</div>`, {
        count: watch.length,
        more: t('seeAll'),
        moreAction: 'data-action="open-watch"',
        cls: 'home-watch'
      })
    : '';
  const index = OVERVIEW.map(sym => {
    const q = state.quotes.get(sym);
    return `<button class="q-rail-card idx-card q-press" type="button" data-action="open" data-symbol="${h(sym)}">
      <small>${h(nameOf(sym, q))}</small>
      <strong class="num" data-q-live="tile:${h(sym)}">${q ? qPrice(q) : '…'}</strong>
      ${pctTag(q)}${q ? `<span class="card-spark">${sparkline(q.line, q.kind === 'crypto' ? null : q.prev, { width: 128, height: 28 })}</span>` : ''}
    </button>`;
  }).join('');
  // 今日漲跌幅: the market that's trading now, its biggest risers and fallers.
  const { groups, group } = moverGroups();
  const up = group ? movers(state.quotes, { up: true, n: 4, group }) : [];
  const down = group ? movers(state.quotes, { up: false, n: 4, group }) : [];
  const moversBody = up.length || down.length
    ? `${moverSeg(groups, group)}
      <div class="q-rowcard">${[...up, ...down].map(q => stockRow(q.symbol)).join('')}</div>`
    : emptyHtml({ icon: 'chart', tint: TINT.orange, title: t('moversNone'), body: t('moversNoneSub') });
  const events = v ? eventRows(v) : [];
  const eventsHtml = v
    ? sectionHtml(t('homeEvents'), events.length ? `<div class="q-rowcard">${events.join('')}</div>` : emptyHtml({ icon: 'calendar', tint: TINT.gray, title: t('evNone'), body: t('evNoneSub') }))
    : '';
  morph(
    box,
    `${hero}
    ${sectionHtml(t('overviewTitle'), `<div class="q-rail small idx-rail">${index}</div>`, { side: homeOpenChip() })}
    ${quick}
    ${holdings}
    ${watchlist}
    ${sectionHtml(t('homeMovers'), moversBody, { more: t('seeAll'), moreAction: 'data-action="movers-go" data-v="' + h(group || '') + '"', cls: 'home-movers' })}
    ${sectionHtml(t('forYou'), recs.length ? `<div class="q-rail rec-rail">${recs.map(r => recCard(r.symbol, r.why)).join('')}</div>` : emptyHtml({ icon: 'star', tint: TINT.indigo, title: t('forYouNone'), body: t('forYouNoneSub'), go: t('goTrade'), attrs: 'data-action="goto" data-tab="markets"' }), { more: t('seeAll'), moreAction: 'data-action="goto" data-tab="markets"' })}
    ${ipoHtml()}
    ${eventsHtml}`
  );
}

function recCard(symbol, why) {
  const q = state.quotes.get(symbol);
  const info = catalogInfo(symbol);
  let whyText = why ? t(why.key, { what: why.what ? (why.key === 'whyPeer' ? nameOf(why.what, state.quotes.get(why.what)) : kindOrCat(why.what)) : '' }) : '';
  // A closed market's big move was its last day's (週五波動大 on a weekend).
  if (why?.key === 'whyMover' && q && !dayOfChange({ positions: [{ quote: q }] }).today) whyText = t('whyMoverOn', { day: dayWord({ positions: [{ quote: q }] }) });
  return `<button class="q-rail-card rec-card q-press" type="button" data-action="open" data-symbol="${h(symbol)}">
    <span class="rec-top">${symbolBadge(symbol, q || info)}${pctTag(q)}</span>
    <span class="rec-name q-fit">${h(nameOf(symbol, q))}</span>
    <small>${flagOf(symbol, q)} ${h(bareSymbol(symbol))}</small>
    ${whyText ? `<small class="rec-why">${h(whyText)}</small>` : ''}
    <strong class="num rec-price">${q ? fmtPrice(q.price, q.currency, { short: true }) : '…'}</strong>
  </button>`;
}
// ---- 新股申購 (lib/ipo.mjs) ----
// (TWSE's list of public subscriptions: ipoState, by the state above.)
// TWSE's 處置 and 注意 lists (lib/alerts.mjs), flagged on a stock as brokers' apps do.
const alertState = { punish: null, notice: null, at: 0, busy: null };
function loadAlerts() {
  if (alertState.busy) return alertState.busy;
  if (alertState.at && Date.now() - alertState.at < 30 * 60_000) return Promise.resolve();
  alertState.busy = (async () => {
    const [punish, notice] = await Promise.all([PUNISH_URL, NOTICE_URL].map(u => proxyJson(u, { ttl: 30 * 60_000 }).then(x => (typeof x === 'string' ? JSON.parse(x) : x)).catch(() => null)));
    if (punish) alertState.punish = parseAlertList(punish, 'punish');
    if (notice) alertState.notice = parseAlertList(notice, 'notice');
    alertState.at = Date.now();
    alertState.busy = null;
  })();
  return alertState.busy;
}
const alertTag = symbol => {
  const a = alertOf(symbol, alertState);
  return a ? `<span class="q-tag ${a === 'punish' ? 'solid red' : 'orange'}" title="${h(t(`${a}Help`))}">${h(t(`${a}Tag`))}</span>` : '';
};
const ipoKey = s => `${s.code}:${s.draw}`;
function loadIpo() {
  if (ipoState.busy) return ipoState.busy;
  if (ipoState.list && Date.now() - ipoState.at < 30 * 60_000) return Promise.resolve();
  ipoState.busy = (async () => {
    try {
      // This year's list, and early in a year last year's too (kit ipoUrls): a
      // December draw still resolves, and its listing keeps its five days without a limit.
      const urls = stockIpo.ipoUrls(Date.now());
      const lists = await Promise.all(urls.map((u, i) => proxyJson(u, { ttl: 30 * 60_000 }).then(parseIpoList, e => (i ? [] : Promise.reject(e)))));
      ipoState.list = [...new Map(lists.flat().map(s => [ipoKey(s), s])).values()];
      ipoState.at = Date.now();
      for (const q of state.quotes.values()) markListed(q);
      // A listed company's offer: its price now, for the gap.
      const want = ipoState.list.filter(s => !s.ipo && ipoOpen(s) && !state.quotes.has(s.symbol)).map(s => s.symbol);
      if (want.length) absorb(await fetchQuotes(want).catch(() => new Map()));
      await checkIpoResults();
    } catch {
    } finally {
      ipoState.busy = null;
    }
  })();
  return ipoState.busy;
}
// The applications on the account (its events: the result's dated the day it lands).
const ipoApplied = () => (state.account?.events || []).filter(e => e.type === 'ipo');
const ipoOutcome = a => state.account.events.find(e => (e.type === 'ipowin' || e.type === 'ipoback') && e.code === a.code && e.draw === a.draw) || null;
function ipoHtml() {
  const list = ipoState.list;
  if (!state.account) return '';
  if (!list) return sectionHtml(t('ipoTitle'), emptyHtml({ icon: 'calendar', tint: TINT.purple, title: t('ipoNone'), body: t('ipoNoneSub') }));
  const now = Date.now();
  const applied = new Set(ipoApplied().map(a => `${a.code}:${a.draw}`));
  const open = list.filter(s => ipoOpen(s, now) && !applied.has(ipoKey(s))).sort((a, b) => a.to - b.to);
  // Mine: still drawing, or settled within the last two weeks.
  const mine = ipoApplied()
    .map(a => ({ a, out: ipoOutcome(a) }))
    .filter(({ a, out }) => !out || now - out.t < 14 * 86_400_000 || out.t > now)
    .sort((x, y) => y.a.draw - x.a.draw);
  if (!open.length && !mine.length) return sectionHtml(t('ipoTitle'), emptyHtml({ icon: 'calendar', tint: TINT.purple, title: t('ipoNone'), body: t('ipoNoneSub') }));
  // A listed company's offer: what a win is worth at today's price (the gap on the shares).
  const gainOf = s => {
    const q = state.quotes.get(s.symbol);
    return !s.ipo && q?.price > 0 ? Math.round((q.price - s.price) * s.qty) : null;
  };
  const openRow = s => {
    const gain = gainOf(s);
    return `<div class="q-ritem ipo-item">
      ${tileHtml(ico('ticket'), TINT.indigo)}
      <span class="q-ritem-text"><span class="q-ritem-title">${h(s.name)} <em class="code num">${h(s.code)}</em></span>
        <small class="num">${h(t('ipoPrice', { p: money(s.price, BASE), v: money(ipoHold(s), BASE) }))}</small>
        <small>${h(t(s.ipo ? (/櫃/.test(s.kind) ? 'ipoNewOtc' : 'ipoNew') : 'ipoMore'))} · ${h(t('ipoDrawOn', { date: shortDate(s.draw) }))}</small>${gain != null ? `<small class="num ${gain >= 0 ? 'up-ink' : 'down-ink'}">${h(t('ipoGain'))} ${h(money(gain, BASE, { sign: true }))}</small>` : ''}</span>
      <button class="q-btn small primary" type="button" data-action="ipo-apply" data-key="${h(ipoKey(s))}">${h(t('ipoApply'))}</button>
    </div>`;
  };
  const mineRow = ({ a, out }) => {
    const won = out?.type === 'ipowin';
    const line = !out ? t('ipoDrawing', { date: shortDate(a.draw) }) : won ? (out.t > now ? t('ipoWonOn', { date: shortDate(out.t) }) : t('ipoWonIn')) : t('ipoLost');
    return `<button class="q-ritem" type="button" data-action="open" data-symbol="${h(a.symbol)}">
      ${tileHtml(ico(won ? 'trophy' : out ? 'check' : 'clock'), won ? 'var(--up)' : out ? TINT.gray : TINT.orange)}
      <span class="q-ritem-text"><span class="q-ritem-title">${h(a.name)} <em class="code num">${h(a.code)}</em></span><small>${h(line)}</small></span>
      <span class="q-tag ${won ? 'up' : out ? '' : 'orange'}">${h(won ? t('ipoWonTag') : !out ? t('ipoDrawingTag') : t('ipoLostTag'))}</span>
    </button>`;
  };
  return sectionHtml(t('ipoTitle'), `<div class="q-rowcard">${[...mine.map(mineRow), ...open.map(openRow)].join('')}</div>`);
}
// One application: the money there, the Worker told first (only one it saw
// in the window counts), then the account's event at that moment.
async function applyIpo(key) {
  const s = ipoState.list?.find(x => ipoKey(x) === key);
  if (!s || !ipoOpen(s) || !state.account) return;
  const hold = ipoHold(s);
  const cash = withdrawable(state.account, snap())[BASE] || 0;
  if (cash < hold) return toast(t('ipoNoCash', { v: money(hold, BASE) }), 'bad');
  const ok = await askKit({
    lang: locale,
    icon: '🎟',
    title: t('ipoAsk', { name: s.name, code: s.code }),
    points: [
      ['💰', t('ipoAskHold', { v: money(hold, BASE) }), t('ipoAskHoldSub', { qty: fmtQty(s.qty), p: fmtPrice(s.price, BASE), fee: money(IPO_FEE, BASE) })],
      ['🎲', t('ipoAskDraw', { date: shortDate(s.draw) }), t('ipoAskDrawSub')],
      ['📈', t('ipoAskWin', { date: shortDate(s.list ?? s.draw) }), t('ipoAskWinSub', { fee: money(IPO_WIN_FEE, BASE) })]
    ],
    ok: t('ipoApply'),
    cancel: t('orderAskCancel')
  });
  if (!ok) return;
  const res = await workerJson('/stock', '', { body: JSON.stringify({ op: 'ipo', apps: [key] }), timeout: 15_000 }).catch(() => null);
  const seen = res?.seen?.[key];
  if (!seen) return toast(t('ipoNotSent'), 'bad');
  if (state.account.events.some(e => e.type === 'ipo' && e.code === s.code && e.draw === s.draw)) return;
  commit({ ...state.account, events: [...state.account.events, ipoApplyEvent(s, Math.min(seen, Date.now()))] });
  toast(t('ipoDone', { name: s.name }), 'good');
  render();
}
// After a draw: its outcome from the Worker, as the account's event (a
// loss's money back the next day, a win's shares on the listing day).
async function checkIpoResults() {
  const list = ipoState.list;
  if (!list || !state.account) return;
  const now = Date.now();
  const due = ipoApplied()
    .filter(a => !ipoOutcome(a))
    .map(a => ({ a, s: list.find(x => x.code === a.code && x.draw === a.draw) }))
    .filter(({ s }) => s && ipoDrawn(s, now));
  if (!due.length) return;
  const res = await workerJson('/stock', '', { body: JSON.stringify({ op: 'ipo', apps: due.map(({ s }) => ipoKey(s)) }), timeout: 15_000 }).catch(() => null);
  let account = state.account;
  for (const { a, s } of due) {
    const d = res?.drawn?.[ipoKey(s)];
    if (!d) continue;
    const ev = d.won ? ipoWinEvent(a) : ipoBackEvent(a);
    if (account.events.some(x => x.id === ev.id)) continue;
    account = { ...account, events: [...account.events, ev] };
    accountNotice('income', d.won ? t('ipoWonNote', { name: a.name, date: shortDate(ev.t) }) : t('ipoLostNote', { name: a.name }), { tone: d.won ? 'good' : '', tag: ev.id, hash: 'home' });
  }
  if (account !== state.account) {
    commit(account);
    render();
  }
}

// ---- 市場: a product at a time (catalog.mjs PRODUCTS), its lists, search, today's movers ----

// Each product's tile, on home and 市場 alike: Taiwan by its flag, the rest by a glyph.
// Gold (two bars) and bitcoin's ₿ in the kit's icon style (its icons have only one coin).
const glyph = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const GOLD_BARS = glyph('<path d="M3 19.5h8l-1.6-5.5H4.6zM13 19.5h8l-1.6-5.5h-4.8zM8 12.5h8L14.4 7H9.6z"/>');
const BITCOIN = glyph('<path d="M8 5.5h5.5a3 3 0 0 1 0 6H8zM8 11.5h6.5a3 3 0 0 1 0 6H8zM8 5.5v12M10 3.5v2M13 3.5v2M10 17.5v2M13 17.5v2"/>');
const PRODUCT_LOOK = {
  all: [ico('grid'), TINT.gray],
  watch: [ico('star'), TINT.orange],
  tw: [curMark('TW'), TINT.red],
  deriv: [ico('target'), TINT.purple],
  intl: [ico('map'), TINT.blue],
  fund: [ico('wallet'), TINT.indigo],
  bonds: [ico('bank'), TINT.brown],
  fx: [ico('swap'), TINT.teal],
  gold: [GOLD_BARS, '#c9a227'],
  crypto: [BITCOIN, TINT.orange]
};
const productTile = id => tileHtml(...(PRODUCT_LOOK[id] || [ico('list'), TINT.gray]), 'prod-tile');
const WATCH = { id: 'watch', zh: '自選', en: 'Watchlist', subs: [{ id: 'watch', zh: '自選', en: 'Watchlist', product: 'watch' }] };
const subOf = id => (id === 'watch' ? WATCH.subs[0] : SUBS.get(id) || null);
const productOf = id => (id === 'watch' ? WATCH : PRODUCTS.find(p => p.id === id) || null);
// The list each product last showed (its first till another is picked).
const lastSub = new Map();
// Open a product (its last list) or one of its lists; '' is 總覽.
function goMarket(id, { sub = false } = {}) {
  const s = sub ? subOf(id) : null;
  const p = sub ? productOf(s?.product) : productOf(id);
  state.category = s ? s.id : p ? lastSub.get(p.id) || p.subs[0].id : null;
  if (p && state.category) lastSub.set(p.id, state.category);
  // (Reopening the chain centres it on the money again.)
  state.optCentred = null;
  state.query = '';
  $('search').value = '';
  const now = subOf(state.category);
  if (now?.listing) ensureListing(now);
}
const PAGE = 50;
const shownOf = sub => (state.shown?.sub === sub.id ? state.shown.n : PAGE);
const listFailed = new Set();
function ensureListing(sub) {
  if (listings.has(sub.listing)) return;
  listFailed.delete(sub.listing);
  loadListing(sub.listing)
    .then(() => {
      if (subOf(state.category)?.listing !== sub.listing) return;
      renderMarkets();
      refresh({ list: true });
    })
    .catch(() => {
      listFailed.add(sub.listing);
      if (subOf(state.category)?.listing === sub.listing) renderMarkets();
    });
}
// A list's symbols: its picks, then the rest its market lists, by code (null:
// a fund list till its listing is read, as its picks are sorted by it).
function subSymbols(sub) {
  if (sub.id === 'watch') return watched(state.account);
  if (sub.view === 'opt') return optSymbols();
  const rows = sub.listing ? listings.get(sub.listing) : null;
  if (sub.listing && !rows && sub.product === 'fund') return null;
  const kinds = rows ? listingKind.get(sub.listing) : null;
  const picks = subPicks(sub).filter(s => !kinds?.has(s) || sub.kinds.includes(kinds.get(s)));
  const rest = rows ? rows.filter(r => sub.kinds.includes(r[2]) && (!sub.only || sub.only(r[0]))).map(r => r[0]) : [];
  return [...new Set([...picks, ...rest])];
}

// The product bar: 總覽, 自選 (when there are stars), then every product; the
// open one's lists under it. The one way between them, on every 市場 screen.
function productBar(on) {
  const products = [{ id: '', zh: '總覽', en: 'Overview' }, ...(watched(state.account).length ? [WATCH] : []), ...PRODUCTS];
  return `<div class="prod-bar" role="tablist">${products
    .map(p => `<button class="prod q-press" type="button" role="tab" data-action="product" data-id="${h(p.id)}" aria-selected="${(on || '') === p.id}">${productTile(p.id || 'all')}<span>${h(L(p.short || p))}</span></button>`)
    .join('')}</div>`;
}
function renderMarkets() {
  const box = $('markets-body');
  if (state.query) return renderSearch();
  if (state.category === 'watch' && !watched(state.account).length) state.category = null;
  const sub = state.category ? subOf(state.category) : null;
  if (!sub) return morph(box, `${productBar('')}${overviewHtml()}`);
  const product = productOf(sub.product);
  const subs =
    product.subs.length > 1
      ? `<div class="q-chips bleed sub-chips">${product.subs.map(s => `<button class="q-chip" type="button" data-action="sub" data-id="${h(s.id)}" aria-pressed="${s.id === sub.id}">${SUB_FLAGS[s.id] ? `<img class="chip-flag" src="flags/${FLAGS[SUB_FLAGS[s.id]]}.svg" alt="" onerror="this.remove()">` : ''}${h(L(s))}</button>`).join('')}</div>`
      : '';
  morph(box, `${productBar(product.id)}${subs}${sub.view === 'opt' ? optChainHtml() : listHtml(sub)}`);
}
// A list, the same for every product: its rows fifty at a time, its count by its title.
function listHtml(sub) {
  const all = subSymbols(sub);
  const failed = sub.listing && listFailed.has(sub.listing) && !listings.has(sub.listing);
  if (!all) return `<section class="q-section list-section">${plainEmpty(failed ? t('browseFailed') : t('browseLoading'))}</section>`;
  const shown = all.slice(0, shownOf(sub));
  const left = all.length - shown.length;
  const whole = !sub.listing || listings.has(sub.listing);
  const tail =
    left > 0
      ? `<button class="list-more" type="button" data-action="list-more">${h(t('browseMore', { n: Math.min(left, PAGE), left: left.toLocaleString() }))}</button>`
      : whole
        ? ''
        : `<p class="list-more list-wait">${h(failed ? t('browseFailed') : t('browseLoading'))}</p>`;
  const note = sub.id === 'commodity' ? `<p class="foot-note">${h(t('watchOnlyNote'))}</p>` : '';
  return sectionHtml(L(sub), `<div class="q-rowcard quotes">${shown.map(s => quoteRow(s)).join('') || (whole ? plainEmpty(t('nothingHere')) : '')}${tail}</div>${note}`, {
    cls: 'list-section',
    count: whole && all.length ? all.length.toLocaleString() : ''
  });
}
// 總覽: the indexes, every product with what it holds, and today's movers.
function overviewHtml() {
  const idx = MARKET_INDEXES.map(sym => {
    const q = state.quotes.get(sym);
    return `<button class="q-rail-card idx-card q-press" type="button" data-action="open" data-symbol="${h(sym)}">
      <small>${h(nameOf(sym, q))}</small>
      <strong class="num" data-q-live="tile:${h(sym)}">${q ? qPrice(q) : '…'}</strong>
      ${pctTag(q)}
    </button>`;
  }).join('');
  const dir = PRODUCTS.map(
    p =>
      `<button class="q-ritem chevron" type="button" data-action="product" data-id="${h(p.id)}">${productTile(p.id)}<span class="q-ritem-text"><span class="q-ritem-title">${h(L(p))}</span><small>${h(t(`prodSub_${p.id}`))}</small></span></button>`
  ).join('');
  // Every country's market, a tap each, with its index's day under its name.
  const countries = COUNTRIES.map(c => {
    const q = state.quotes.get(c.index);
    return `<button class="country q-press" type="button" data-action="${c.sub ? 'sub' : 'product'}" data-id="${h(c.sub || c.product)}">${tileHtml(curMark(c.flag), TINT.gray, 'prod-tile')}<span>${h(L(c))}</span>${pctTag(q)}</button>`;
  }).join('');
  const mv = moversHtml();
  return `${sectionHtml(t('countriesTitle'), `<div class="country-row">${countries}</div>`)}
    ${sectionHtml(t('indexesTitle'), `<div class="q-rail small idx-rail">${idx}</div>`)}
    ${sectionHtml(t('productsTitle'), `<div class="q-rowcard prod-dir">${dir}</div>`)}
    ${mv ? sectionHtml(t('moversTitle'), mv) : ''}`;
}

// ---- 選擇權 (TXO): a series' chain (a weekly or a month), calls and puts by strike ----
// Strikes every 100 points within OPT_SPAN of the index, and every 50 within
// OPT_SPAN_50 of it; at-the-money first in view. The weeklies shown are the
// ones TAIFEX's table lists (read once the chain is open).
const OPT_SPAN = 1500;
const OPT_SPAN_50 = 500;
const optSeries = () => {
  if (!stockMarkets.optionExpiries) return stockMarkets.optionMonths?.() || [];
  if (state.optTable === undefined) {
    state.optTable = null;
    // (A table without options' prices, or none, is asked for again in 30 s:
    // the weeklies and the prices come from it.)
    const again = () => setTimeout(() => (state.optTable = undefined), 30_000);
    stockQuotes
      .fetchFutTable()
      .then(table => {
        state.optTable = table;
        if (!Object.keys(table?.opt || {}).length) again();
        if (state.category === 'opt') renderMarkets();
        if ($('trade')?.open) renderTicket();
      })
      .catch(again);
  }
  return stockMarkets.optionExpiries(Date.now(), state.optTable);
};
const optMonth = () => {
  const months = optSeries();
  return months.includes(state.optMonth) ? state.optMonth : months[0];
};
// (Only the strikes TAIFEX's table lists for the series once it's read: a
// strike it doesn't list has no price, and was a row of dashes.)
function optStrikes(series = optMonth()) {
  const index = state.quotes.get('^TWII')?.price;
  if (!(index > 0)) return [];
  const step = stockMarkets.OPT_STEP;
  const atm = Math.round(index / step) * step;
  const listed = state.optTable?.opt?.[series];
  const has = k => !listed || listed.C?.[k] > 0 || listed.P?.[k] > 0;
  const out = [];
  for (let k = atm - OPT_SPAN; k <= atm + OPT_SPAN; k += step / 2) if ((k % step === 0 || (stockMarkets.OPT_FINE && Math.abs(k - index) <= OPT_SPAN_50)) && has(k)) out.push(k);
  return out;
}
const optSymbols = () => (optMonth() ? optStrikes().flatMap(k => ['C', 'P'].map(r => stockMarkets.optionSymbol(optMonth(), r, k))) : []);
function optChainHtml() {
  const months = optSeries();
  const month = optMonth();
  const index = state.quotes.get('^TWII')?.price;
  // (Each series by its last day: a weekly 10/28 週三, a month 11月 11/18.)
  const label = m => {
    const due = expiryOf(stockMarkets.optionSymbol(m, 'C', 10000));
    return /[WF]/.test(m) ? t('optWeek', { date: shortDate(due), day: t(m.includes('W') ? 'optWed' : 'optFri') }) : t('optMonth', { m: Number(m.slice(4, 6)), date: shortDate(due) });
  };
  const seg = `<div class="q-chips bleed opt-months" role="group">${months.map(m => `<button class="q-chip" type="button" data-action="opt-month" data-v="${m}" aria-pressed="${m === month}">${h(label(m))}</button>`).join('')}</div>`;
  const strikes = optStrikes();
  // Only strikes with a price on either side: never a row of dashes (none yet: the note, till they come).
  const priced = k => ['C', 'P'].some(r => state.quotes.has(stockMarkets.optionSymbol(month, r, k)));
  const shown = strikes.filter(priced);
  if (!shown.length) return `${seg}<section class="q-section list-section">${plainEmpty(t('loadingQuote'))}</section>`;
  const atm = shown.reduce((a, k) => (Math.abs(k - index) < Math.abs(a - index) ? k : a), shown[0]);
  // At-the-money in the middle of the screen when a series first shows.
  if (state.optCentred !== month) {
    state.optCentred = month;
    requestAnimationFrame(() => {
      const row = document.querySelector('.opt-row.atm');
      if (row) window.scrollTo({ top: Math.max(0, row.getBoundingClientRect().top + window.scrollY - (window.innerHeight - row.offsetHeight) / 2), behavior: 'instant' });
    });
  }
  const cell = (k, r) => {
    const sym = stockMarkets.optionSymbol(month, r, k);
    const q = state.quotes.get(sym);
    // (In the money against the futures it's priced on, as its ticket says; the index till it's read.)
    const at = Number.isFinite(q?.underlying) ? q.underlying : index;
    const itm = r === 'C' ? k < at : k > at;
    return `<button class="opt-cell${itm ? ' itm' : ''}" type="button" data-action="open" data-symbol="${h(sym)}"><b class="num" data-q-live="opt:${h(sym)}">${q ? qPrice(q) : '—'}</b>${q ? `<small class="num ${dirClass(q.change)}">${q.change > 0 ? '+' : q.change < 0 ? '−' : ''}${num(Math.abs(q.change), 1, 0)}</small>` : ''}</button>`;
  };
  const rows = shown.map(k => `<div class="opt-row${k === atm ? ' atm' : ''}">${cell(k, 'C')}<span class="opt-k num">${num(k, 0, 0)}</span>${cell(k, 'P')}</div>`).join('');
  return `${seg}${sectionHtml(
    t('optChainTitle', { index: num(index, 0, 0) }),
    `<div class="opt-chain q-rowcard"><div class="opt-row opt-head"><span>${h(t('optCall'))}</span><span>${h(t('optStrike'))}</span><span>${h(t('optPut'))}</span></div>${rows}</div><p class="foot-note">${h(t('optChainNote'))}</p>`,
    { cls: 'list-section' }
  )}`;
}

// The markets with movers to show (three or more), and the one shown: the picked one,
// else the one trading now. Home and 市場 share it, so a pick on one holds on the other.
function moverGroups() {
  const groups = MOVER_GROUPS.filter(g => movers(state.quotes, { up: true, n: 99, group: g }).length + movers(state.quotes, { up: false, n: 99, group: g }).length >= 3);
  const group = groups.includes(state.moverGroup) ? state.moverGroup : groups.includes(moverGroupNow()) ? moverGroupNow() : groups[0];
  return { groups, group };
}
const moverSeg = (groups, group) =>
  groups.length > 1 ? seg(groups.map(g => [g, t(`moverGroup_${g}`)]), 'mover-group', 'v', g => g === group, 'mover-groups') : '';

// 今日漲跌 a market at a time: the one trading now unless another was picked;
// named for their day (a closed market's moves are its last day's: 週五 on a weekend).
function moversHtml() {
  const { groups, group } = moverGroups();
  const up = movers(state.quotes, { up: true, group }).slice(0, 5);
  const down = movers(state.quotes, { up: false, group }).slice(0, 5);
  if (!up.length && !down.length) return '';
  const all = { positions: [...up, ...down].map(quote => ({ quote })) };
  const day = dayOfChange(all).today ? null : dayWord(all);
  const mt = (key, onKey) => (day ? t(onKey, { day }) : t(key));
  const row = q => `<button class="q-ritem quote" type="button" data-action="open" data-symbol="${h(q.symbol)}">${symbolBadge(q.symbol, q)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(q.symbol, q))}</span><small class="num" data-q-live="mover:${h(q.symbol)}">${qPrice(q)}</small></span>${pctTag(q)}</button>`;
  return `${moverSeg(groups, group)}
    <div class="mv-pair">${up.length ? `<div><p class="sub-head">${h(mt('moversUp', 'moversUpOn'))}</p><div class="q-rowcard">${up.map(row).join('')}</div></div>` : ''}
    ${down.length ? `<div><p class="sub-head">${h(mt('moversDown', 'moversDownOn'))}</p><div class="q-rowcard">${down.map(row).join('')}</div></div>` : ''}</div>`;
}

// The catalogue's matches, then Taiwan's listings by code or Chinese name (lib/twsearch.mjs).
const localHits = q => [...new Set([...searchCatalog(q, 40).map(i => i.symbol), ...twHits(q, TW_NAMES, ipoState.list), ...listingHits(q)])].slice(0, 40);
let searchTimer;
function onSearchInput(value) {
  state.query = value.trim();
  clearTimeout(searchTimer);
  renderMarkets();
  if (!state.query) return;
  searchTimer = setTimeout(async () => {
    const q = state.query;
    state.search = { query: q, results: [], loading: true };
    renderSearch();
    await Promise.all(NEEDS_LISTINGS(q).map(m => loadListing(m).catch(() => {})));
    if (state.query !== q) return;
    const local = localHits(q);
    let remote = [];
    try {
      remote = await searchSymbols(q);
    } catch {}
    if (state.query !== q) return;
    const extra = twFirst(remote.filter(r => !local.includes(r.symbol)));
    state.search = { query: q, results: extra, loading: false };
    const missing = [...local, ...extra.map(r => r.symbol)].filter(s => !state.quotes.has(s)).slice(0, 40);
    if (missing.length) {
      try {
        absorb(await fetchQuotes(missing));
      } catch {}
    }
    if (state.query === q) renderSearch();
  }, 350);
}

function renderSearch() {
  const q = state.query;
  const local = localHits(q);
  const extra = state.search.query === q ? state.search.results : [];
  const rows = [...local.map(s => quoteRow(s)), ...extra.map(r => quoteRow(r.symbol, { note: r.exchange }))];
  const empty = state.search.loading && state.search.query === q ? t('searching') : t('noResults');
  morph(
    $('markets-body'),
    `<section class="q-section list-section">${rows.length ? `<div class="q-rowcard quotes">${rows.join('')}</div>` : `${plainEmpty(empty)}`}${/[^\x20-\x7e]/.test(q) || state.search.loading ? '' : `<p class="foot-note">${h(t('searchNote'))}</p>`}</section>`
  );
}
// ---- Detail sheet: chart, facts, trade ticket ------------------------------------------

async function openDetail(symbol) {
  track(symbolKeys(symbol), 1);
  const q0 = state.quotes.get(symbol);
  const held = snap()?.positions[symbol];
  state.detail = {
    symbol,
    // (A fund, a NAV a day, opens on its year.)
    range: kindOf(symbol, q0) === 'fund' ? '1y' : '1d',
    chart: null,
    chartError: false,
    side: 'buy',
    type: 'market',
    qty: '',
    limit: startPrice(q0),
    stop: startPrice(q0),
    msg: null,
    held: Boolean(held)
  };
  const star = document.createElement('button');
  star.className = 'icon-button star';
  star.type = 'button';
  star.dataset.action = 'star';
  star.setAttribute('aria-label', t('watchToggle'));
  star.innerHTML = ico('star');
  const dialog = kitSheet('detail', {
    cls: 'q-full detail-sheet',
    lead: star,
    onClose: () => {
      state.detail = null;
      closeTrade();
    }
  });
  dialog.scrollTop = 0;
  renderDetail();
  // The chart and the company's numbers start at once, beside the quote;
  // a quote read in the last 25 seconds (the list's) isn't read again.
  loadChart();
  loadAbout(symbol);
  // (A convertible bond's shares too, for its 轉換價值.)
  const also = cbStockSyms(symbol).filter(s => !state.quotes.has(s));
  const fresh = q0?.got > Date.now() - QUOTE_FRESH_MS && !also.length;
  try {
    if (!fresh) absorb(await fetchQuotes([symbol, ...also]));
    const q = state.quotes.get(symbol);
    if (q) await ensureRates([q.currency]);
    if (q && state.detail?.symbol === symbol && !state.detail.limit) state.detail.limit = state.detail.stop = startPrice(q);
  } catch {}
  if (state.detail?.symbol !== symbol || (fresh && q0 === state.quotes.get(symbol))) return;
  renderDetail();
  // (Its kind known only now: the line drawn from the quote, the numbers asked.)
  if (state.detail.range === '1d' && !state.detail.chart) loadChart();
  loadAbout(symbol);
}
const QUOTE_FRESH_MS = 25_000;

// Kinds with a company or fund behind them (P/E, holdings).
const ABOUT_KINDS = new Set(['stock', 'etf', 'bond', 'fund']);
async function loadAbout(symbol) {
  const q = state.quotes.get(symbol);
  if (!q || !ABOUT_KINDS.has(q.kind) || BONDS[symbol]) return;
  const have = state.about.get(symbol);
  if (have && (have.loading || Date.now() - have.at < 30 * 60_000)) return;
  state.about.set(symbol, { loading: true, at: Date.now() });
  const facts = await fetchFundamentals(symbol).catch(() => null);
  state.about.set(symbol, { loading: false, at: Date.now(), facts });
  if (state.detail?.symbol === symbol) refreshDetailLive();
  // What it does, in the reader's language (Yahoo writes it in English).
  if (facts?.summary && locale !== 'en') {
    const text = await translate(facts.summary, 'zh-TW', 'en');
    if (text !== facts.summary) {
      state.about.set(symbol, { ...state.about.get(symbol), summaryLocal: text });
      if (state.detail?.symbol === symbol) refreshDetailLive();
    }
  }
  // Its industry, city and a fund's category too (Yahoo's English: Semiconductors, Hsinchu City, Taiwan; Large Blend), one line each.
  const words = { industryLocal: facts?.industry, placeLocal: [facts?.city, facts?.country].filter(Boolean).join(', '), categoryLocal: facts?.category };
  if (Object.values(words).some(Boolean) && locale !== 'en') {
    const lines = (await translate(Object.values(words).map(x => x || '-').join('\n'), 'zh-TW', 'en')).split('\n').map(x => x.trim());
    if (lines.length === 3) {
      state.about.set(symbol, { ...state.about.get(symbol), ...Object.fromEntries(Object.entries(words).map(([k, x], i) => [k, x && lines[i] !== '-' ? lines[i] : ''])) });
      if (state.detail?.symbol === symbol) refreshDetailLive();
    }
  }
}

// A chart that failed (Yahoo turning the proxy away now and then) is asked
// again while its sheet stays open on it, quietly: once the kit's hold on
// the failure is over (15 s), three times.
const CHART_RETRY_MS = 16_000;
// The last day a market traded, as a day's chart: its 5-minute bars (the kit's fetchBars).
async function lastDayChart(symbol) {
  const q = state.quotes.get(symbol);
  const bars = (await fetchBars(symbol, Date.now() - 4 * 86_400_000)).filter(b => b.c > 0);
  if (bars.length < 2) return null;
  const tz = q?.tz;
  const dayOf = tt => localDay(tt, tz);
  const day = dayOf(bars.at(-1).t);
  const its = bars.filter(b => dayOf(b.t) === day);
  if (its.length < 2) return null;
  const points = its.map(b => [b.t, b.c]);
  // (Its close as the quote has it: the closing auction comes after the last bar.)
  if (q?.price > 0 && q.marketTime > points.at(-1)[0] && dayOf(q.marketTime) === day) points.push([q.marketTime, q.price]);
  return { day: its.at(-1).t, chart: { points, bars: its } };
}
async function loadChart(retry = 0) {
  const d = state.detail;
  if (!d) return;
  const { symbol, range } = d;
  if (!retry) {
    d.chart = null;
    d.chartError = false;
    renderChart();
  }
  // A day's line is the quote's own (the same 5-minute closes, kept fresh by
  // every refresh): no chart read, except for candles.
  if (dayLineOf(d) && state.settings.chart !== 'candle') return;
  try {
    let chart = await fetchChart(symbol, range);
    // A day with no trading yet (a holiday, a typhoon day, before the open):
    // the last trading day's line instead, said so over the chart.
    d.lastDay = null;
    if (range === '1d' && !(chart?.points?.length > 1)) {
      const last = await lastDayChart(symbol).catch(() => null);
      if (last) [chart, d.lastDay] = [{ ...chart, ...last.chart }, last.day];
    }
    if (state.detail !== d || d.range !== range) return;
    d.chart = chart;
    d.chartError = false;
  } catch {
    if (state.detail !== d || d.range !== range) return;
    d.chartError = true;
    if (retry < 3) setTimeout(() => state.detail === d && d.range === range && d.chartError && loadChart(retry + 1), CHART_RETRY_MS);
  }
  renderChart();
}

// A sheet of the kit's, kept under the id the app addresses it by (#detail, #trade, #tool); its head is the kit's, filled by setHead.
function kitSheet(id, { cls = '', detent = 'large', lead = null, onClose = () => {} } = {}) {
  const old = document.getElementById(id);
  if (old?.open) return old;
  old?.remove();
  const body = document.createElement('div');
  body.id = `${id}-body`;
  const s = kitUI.sheet({ title: '', body: [body], cls, detent, lead, closeLabel: t('close'), onClose });
  s.el.id = id;
  return s.el;
}
// A sheet's head: its title, and under it the kit's subtitle line.
function setHead(dialog, titleHtml, subtitle = '') {
  const head = dialog?.querySelector('.q-sheet-head');
  const h2 = head?.querySelector('h2');
  if (!h2) return;
  const key = `${titleHtml}|${subtitle}`;
  if (h2.dataset.k === key) return;
  h2.dataset.k = key;
  if (!subtitle) return void (h2.innerHTML = titleHtml);
  h2.innerHTML = titleHtml;
  let sub = head.querySelector(':scope > .q-sheet-sub');
  if (!sub) h2.after((sub = Object.assign(document.createElement('small'), { className: 'q-sheet-sub' })));
  sub.textContent = subtitle;
}
function closeDetail() {
  state.detail = null;
  if ($('detail')?.open) $('detail').close();
}

// A symbol's sheet opens on the app's focus card (DESIGN.md: the app's colour, one big number,
// calm content), as 資產's: its picture beside its name, the price, the day's move in its
// up/down colour, and the market's state as one plain line (`tagsHtml`: no capsules but a
// real exception, 漲停/跌停). `compact`: the order ticket's, a size down; `innerHtml`: what
// else sits on the card (the detail's chart).
function sheetHeroHtml({ badge, eyebrow, big, unit = '', move = '', dir = '', tagsHtml = '', bigAttr = '', compact = false, innerHtml = '' }) {
  return `<div class="q-focus sym-hero${compact ? ' compact q-kb-hide' : ''}">
    <div class="sym-hero-name">${badge}<span class="q-focus-label">${h(eyebrow)}</span></div>
    <strong class="q-focus-value num" ${bigAttr}>${h(big)}</strong>
    <span class="q-focus-sub num">${unit ? `${h(unit)} · ` : ''}<span class="${dir}">${h(move)}</span></span>
    ${tagsHtml ? `<p class="sym-hero-status">${tagsHtml}</p>` : ''}${innerHtml}
  </div>`;
}
// The day's move as the hero writes it: ▲3.50 (+2.21%).
const heroMove = (q, amt = qAmt(q, Math.abs(q.change))) => `${q.change > 0 ? '▲' : q.change < 0 ? '▼' : ''}${amt} (${pct(q.pct)})`;
function renderDetail() {
  const d = state.detail;
  if (!d) return;
  const q = state.quotes.get(d.symbol);
  const info = catalogInfo(d.symbol);
  const starred = watched(state.account).includes(d.symbol);
  const kind = q?.kind || info?.kind;
  // (A Taiwan fund under its house, unless its title is that already.)
  const house = q?.market === 'TWFUND' ? houseName(String(q.exchange || '').replace(/投信$/, '')) : '';
  const sub =
    kind === 'fut' || kind === 'opt'
      ? `${kindLabel(kind)} · ${futLastDay(d.symbol)}`
      : [house ? (bareSymbol(d.symbol) === house ? '' : house) : q?.market ? marketLabel(q.market) : q?.exchange, kind === 'stock' && stockMarkets.isEmerging?.(d.symbol) ? t('tagEmerging') : kind ? kindLabel(kind) : ''].filter((x, i, all) => x && all.indexOf(x) === i).join(' · ');
  const tradable = q && isTradable(q.kind);
  const tags = q
    ? [
        atLimit(q) ? `<span class="q-tag solid ${atLimit(q)}">${h(atLimit(q) === 'up' ? t('limitUpTag') : t('limitDownTag'))}</span>` : '',
        alertTag(d.symbol),
        q.market === 'TWFUND' ? `<span class="q-tag">${h(t('navAsOf', { date: fmtDate(q.marketTime) }))}</span>` : delayOf(q.market) ? `<span class="q-tag orange" title="${h(t('delayHelp'))}">${h(t('delayed', { n: delayOf(q.market) }))}</span>` : `<span class="q-tag green" title="${h(t('liveHelp'))}">${h(t('livePrice'))}</span>`
      ].join('')
    : '';
  const opt = stockMarkets.isOption?.(d.symbol);
  // A government bond by its name (美國公債 2 年 4.5%), its due date over the price; never its id.
  const due = BONDS[d.symbol] ? /^(.+?)\s*[（(]([^（(]+)[)）]$/.exec(nameOf(d.symbol, q)) : null;
  // The chart sits on the hero, as 資產's does: white on the app's colour.
  const chartHtml = `<section class="chart-area">
      <div class="range-bar" role="group" style="--n:${rangesOf(kind).length}">${rangesOf(kind)
        .map(r => `<button type="button" data-action="range" data-range="${r}" aria-pressed="${d.range === r}">${h(t(`range_${r}`))}</button>`)
        .join('')}</div>
      <div id="detail-chart" class="chart-box" data-own></div>
      <div class="chart-top">
        <p id="detail-chart-head" class="chart-change" data-own></p>
        <div class="chart-tools" role="group">
          <button class="tool" type="button" data-action="chart-style" data-v="line" aria-pressed="${state.settings.chart === 'line'}" aria-label="${h(t('chartLine'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l5-6 4 3 4-7 5 5"/></svg></button>
          <button class="tool" type="button" data-action="chart-style" data-v="candle" aria-pressed="${state.settings.chart === 'candle'}" aria-label="${h(t('chartCandle'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v4M8 15v6M16 3v7M16 17v4"/><rect x="5.5" y="7" width="5" height="8" rx="1"/><rect x="13.5" y="10" width="5" height="7" rx="1"/></svg></button>
          <button class="tool text" type="button" data-action="chart-ma" aria-pressed="${state.settings.ma}">${h(t('chartMa'))}</button>
        </div>
      </div>
    </section>`;
  const hero = q
    ? sheetHeroHtml({
        badge: heroLogo(d.symbol, q || info),
        eyebrow: opt ? optSeriesName(d.symbol) : due ? due[2] : nameOf(d.symbol, q),
        big: qPrice(q),
        unit: `${qUnit(q)}${METALS[d.symbol] ? ` / ${unitOf(d.symbol)}` : ''}`,
        move: heroMove(q),
        dir: dirClass(q.change),
        tagsHtml: `${marketStatus(q)}${tags}`,
        bigAttr: `data-q-live="big:${h(d.symbol)}"`,
        innerHtml: chartHtml
      })
    : '';
  // (A future or an option by its name, never its TAIFEX code; an option's series under its contract.)
  const title = opt ? optContract(d.symbol) : due ? due[1] : stockMarkets.isFuture?.(d.symbol) ? nameOf(d.symbol, q) : bareSymbol(d.symbol);
  const optSub = opt ? (stockMarkets.optionOf(d.symbol).week ? `${kindLabel('opt')} · ${optSeriesName(d.symbol)}` : `${optSeriesName(d.symbol)} · ${futLastDay(d.symbol)}`) : '';
  setHead($('detail'), h(title), optSub || sub);
  $('detail')?.querySelector('.q-sheet-head .star')?.classList.toggle('on', starred);
  morph(
    $('detail-body'),
    `
    ${
      hero ||
      (q
        ? `<div class="quote-head">
      <div class="qh-price"><strong class="big-price num${limitClass(q)}" data-q-live="big:${h(d.symbol)}">${qPrice(q)}</strong><span class="cur">${h(q.currency)}${METALS[d.symbol] ? ` / ${h(unitOf(d.symbol))}` : ''}</span></div>
      <div class="qh-change">${changeHtml(q, { big: true })}</div>
      <div class="q-tags qh-tags">${marketStatus(q)}${tags}</div>
    </div>`
        : `${plainEmpty(t('loadingQuote'))}`)
    }
    ${hero ? '' : chartHtml}
    ${positionHtml(d.symbol)}
    ${q && !tradable ? trackersHtml(d.symbol) : ''}
    ${q ? sectionHtml(t('factsTitle'), factsHtml(q)) : ''}
    ${q ? sectionHtml(t('guideTitle'), guideHtml(q)) : ''}
    ${q ? toolsHtml(d.symbol, q) : ''}
    ${q ? aboutHtml(d.symbol, q) : ''}
    ${ownTradesHtml(d.symbol)}
    ${
      // 買進/賣出 docked along the sheet's foot (not floating over it): two even buttons, the width
      // between them (the price is the hero's, not said twice).
      tradable
        ? `<div class="trade-bar q-sheet-foot q-sf"><button class="q-btn trade buy" type="button" data-action="trade" data-side="buy">${h(t('buy'))}</button><button class="q-btn trade sell" type="button" data-action="trade" data-side="sell">${h(t('sell'))}</button></div>`
        : ''
    }
  `
  );
  renderChart();
  if (tradable && $('trade')?.open) renderTicket();
}
// A chart's ranges: a TAIFEX contract lives months, not years (an option's
// history is only an estimate along the index).
// (A fund has one NAV a day: no day or week; it opens on its year.)
const rangesOf = kind => (kind === 'opt' ? ['1d', '5d', '1mo'] : kind === 'fut' ? ['1d', '5d', '1mo', '6mo'] : kind === 'fund' ? ['1mo', '6mo', 'ytd', '1y', '5y', 'max'] : ['1d', '5d', '1mo', '6mo', 'ytd', '1y', '5y', 'max']);
const dayLineOf = d => {
  const line = d.range === '1d' ? state.quotes.get(d.symbol)?.line : null;
  return line?.length > 1 ? line : null;
};
function renderChart() {
  const d = state.detail;
  const box = $('detail-chart');
  if (!d || !box) return;
  const q = state.quotes.get(d.symbol);
  // (Its line kept the row's height while there's nothing to say: nothing moves when the chart comes.)
  // A day's line chart is the quote's own line (and a day's candles that can't be read).
  const dayLine = dayLineOf(d);
  const said = $('detail-chart-head');
  if (said && !(d.chart?.points || dayLine)) said.textContent = '';
  if (d.chartError && !dayLine) {
    box.innerHTML = `${plainEmpty(t('chartError'))}`;
    return;
  }
  let points = d.chart?.points;
  if (!points && dayLine) points = dayLine;
  if (!points || points.length < 2) {
    box.innerHTML = `${plainEmpty(d.chart ? t('chartEmpty') : t('loadingChart'))}`;
    return;
  }
  const cur = q?.currency || d.chart?.quote?.currency;
  const pts = ptsOf(isTaifex(d.symbol) ? (stockMarkets.isOption?.(d.symbol) ? 'opt' : 'fut') : '', d.symbol);
  const intraday = d.range === '1d' || d.range === '5d';
  const base = d.range === '1d' && q && q.kind !== 'crypto' ? q.prev : points[0][1];
  const dir = dirClass(points.at(-1)[1] - base);
  const width = Math.max(320, Math.round(box.clientWidth || 640));
  const tz = q?.tz;
  const xFormat = tt => (d.range === '1d' ? clock(tt, tz) : intraday ? shortDate(tt, tz) : d.range === '5y' || d.range === 'max' ? monthYear(tt, tz) : shortDate(tt, tz));
  const when = tt => (intraday ? dateTime(tt, tz) : fmtDate(tt, tz));
  const change = points.at(-1)[1] / base - 1;
  const bars = d.chart?.bars?.length > 1 ? d.chart.bars : null;
  // Moving averages over the bars (or points) shown: 5, 20 and 60 of them.
  const closes = bars ? bars.map(b => [b.t, b.c]) : points;
  const mas = state.settings.ma ? MA_PERIODS.filter(n => closes.length > n + 2).map((n, i) => ({ n, points: movingAverage(closes, n), cls: `ma${i + 1}` })) : [];
  const legend = mas.length ? `<ul class="legend-inline">${mas.map(m => `<li><i class="sw ${m.cls}"></i>MA${m.n}</li>`).join('')}</ul>` : '';
  const headBox = $('detail-chart-head');
  // (Under the chart beside its tools, with the averages' key; not a live day's change: the hero's move says it already.)
  if (headBox) headBox.innerHTML = `${d.range === '1d' && !d.lastDay ? '' : `<span>${h(d.lastDay && d.range === '1d' ? t('lastDayChange', { date: shortDate(d.lastDay, tz) }) : t('rangeChange', { range: t(`range_${d.range}`) }))} <span class="chg ${dir}">${pct(change)}</span></span>`}${legend}`;
  const head = '';
  const height = width < 480 ? 220 : 260;
  if (state.settings.chart === 'candle' && bars) {
    const { svg, frame } = candleChart(bars, { width, height, lines: mas, yFormat: v => (pts ? pts(v) : fmtPrice(v, cur)), xFormat });
    box.innerHTML = `${head}${svg}`;
    delete box.dataset.drawn;
    attachCandleHover(box, bars, frame, b => {
      const ma = mas.map(m => {
        const p = m.points.find(x => x[0] === b.t);
        return p ? `<span>MA${m.n} ${fmtPrice(p[1], cur)}</span>` : '';
      });
      return `<span>${h(when(b.t))}</span><span class="ohlc num">${h(t('ohlcOpen'))} ${fmtPrice(b.o, cur)} · ${h(t('ohlcHigh'))} ${fmtPrice(b.h, cur)}</span><span class="ohlc num">${h(t('ohlcLow'))} ${fmtPrice(b.l, cur)} · ${h(t('ohlcClose'))} <strong>${fmtPrice(b.c, cur)}</strong></span><span class="chg ${dirClass(b.c - b.o)}">${pct(b.c / b.o - 1)}</span>${b.v ? `<span>${h(t('volume'))} ${compact(b.v)}</span>` : ''}${ma.join('')}`;
    });
    return;
  }
  // Drawn again only when what it shows changed (a sheet redraws with every refresh).
  const drawn = [d.symbol, d.range, state.settings.chart, state.settings.ma, width, points.length, points.at(-1).join(), base, cur, bars?.length].join('|');
  if (box.dataset.drawn === drawn && box.querySelector('svg')) return;
  const series = [{ points }, ...mas.map(m => ({ points: m.points, cls: m.cls }))];
  const { svg, frame } = lineChart(series, { width, height, base: d.range === '1d' ? base : null, dir, yFormat: v => (pts ? pts(v) : fmtPrice(v, cur)), xFormat });
  box.innerHTML = `${head}${svg}${state.settings.chart === 'candle' && !bars ? `<p class="foot-note">${h(t('noCandles'))}</p>` : ''}`;
  box.dataset.drawn = drawn;
  attachHover(box, series, frame, (i, tt, [v, ...ma]) => `<strong class="num">${fmtPrice(v, cur)}</strong><span>${h(when(tt))}</span><span class="chg ${dirClass(v - base)}">${pct(v / base - 1)}</span>${ma.map((x, k) => (x != null ? `<span>MA${mas[k].n} ${fmtPrice(x, cur)}</span>` : '')).join('')}`);
}
const MA_PERIODS = [5, 20, 60];

function feeSummary(q) {
  // A future or an option: the broker's fee a contract and the 期交稅.
  if (q.kind === 'fut' || q.kind === 'opt') {
    const fee = q.kind === 'opt' ? stockMarkets.OPTION.fee : stockMarkets.futureOf(q.symbol).fee;
    return t('feeTaifex', { fee: money(fee, BASE), tax: rateText(q.kind === 'opt' ? stockMarkets.OPT_TAX : stockMarkets.FUT_TAX) });
  }
  // A fund: the platform's 申購手續費 on the amount, free to redeem (the kit's FUND_FEE).
  if (q.market === 'TWFUND') return t('feeFund', { fee: rateText(stockMarkets.FUND_FEE ?? 0.01) });
  const m = MARKETS[q.market] || MARKETS.INTL;
  const parts = [];
  const cur = m.currency || q.currency;
  // A kind's own price while it runs (the kit's commission.kinds, to `until`: 國泰's 2026 US price).
  const promo = m.commission.kinds?.[q.kind];
  const price = c => (c.flat != null ? t('feeFlat', { fee: money(c.flat, cur) }) : c.min ? t('feeRateMin', { rate: rateText(c.rate), min: money(c.min, cur) }) : rateText(c.rate));
  if (promo && Date.now() < m.commission.until) parts.push(t('feePromo', { fee: price(promo), until: fmtDate(m.commission.until - 1), after: price(m.commission) }));
  else if (m.commission.rate) parts.push(m.commission.min ? t('feeCommission', { rate: rateText(m.commission.rate), min: money(m.commission.min, cur) }) : t('feeCommissionNoMin', { rate: rateText(m.commission.rate) }));
  if (m.spread) parts.push(t('feeSpread', { rate: rateText(m.spread) }));
  for (const side of ['buy', 'sell']) {
    const rules = m[side];
    if (!rules) continue;
    const r = rules[q.kind] || rules.all;
    // A rate with an end in law (a bond ETF's exemption, the kit's until/after).
    if (r?.until != null) {
      const key = side === 'buy' ? 'feeBuyTax' : 'feeSellTax';
      if (Date.now() >= r.until) {
        if (r.after) parts.push(t(key, { rate: rateText(r.after) }));
      } else parts.push(t(r.tax ? 'feeTaxUntil' : 'feeTaxFreeUntil', { tax: t(key, { rate: rateText(r.tax || 0) }), date: fmtDate(r.until - 1), after: rateText(r.after || 0) }));
    } else if (r?.tax) parts.push(t(side === 'buy' ? 'feeBuyTax' : 'feeSellTax', { rate: rateText(r.tax) }));
  }
  if (!parts.length) parts.push(t('feeNone'));
  return parts.join(' · ');
}

function bondFacts(q) {
  const bond = BONDS[q.symbol];
  const b = q.bond;
  const perYear = { 1: t('annual'), 2: t('semiannual') }[bond.freq];
  return [
    [t('bondYield'), `${num(b.yield, 3)}%${b.live ? '' : ` (${t('referenceYield')})`}`],
    [t('cleanPrice'), `${num(b.clean, 3)} / 100`],
    [t('accrued'), `${money((b.accrued * bond.face) / 100, bond.currency, { digits: 2 })} ${t('perBond')}`],
    [t('coupon'), bond.coupon ? `${num(bond.coupon, 3)}% · ${perYear}` : t('zeroCoupon')],
    [t('maturity'), `${fmtDate(bond.maturity, 'UTC')} (${t('yearsLeft', { n: num(b.years, 1) })})`],
    [t('faceValue'), `${money(bond.face, bond.currency, { digits: 0 })} ${t('perBond')}`],
    [t('couponTax'), rateText(bond.tax)],
    [t('currency'), `${q.currency} · ${L(currencyInfo(q.currency))}`],
    ...(state.rates[q.currency] && q.currency !== BASE ? [[t('inTwd'), `${money(q.price * state.rates[q.currency], BASE)} ${t('perBond')}`]] : [])
  ];
}

// A convertible bond against its shares, as a broker's CB page: the shares'
// price, the 轉換價格 (at issue), what the bond is worth converted (轉換價值,
// a 100 face's shares at today's price), its premium over that, and the put.
function cbFacts(q) {
  const terms = q.kind === 'cb' ? stockMarkets.cbTerms?.(q.symbol) : null;
  if (!terms) return [];
  const sq = cbStockQuote(q.symbol);
  const parity = sq && terms.conversion ? (100 * sq.price) / terms.conversion : null;
  return [
    ...(sq ? [[t('cbStock'), nameOf(sq.symbol, sq)], [t('cbStockPrice'), fmtPrice(sq.price, 'TWD')]] : []),
    ...(terms.conversion ? [[t('cbConversion'), fmtPrice(terms.conversion, 'TWD')]] : []),
    ...(parity ? [[t('cbParity'), num(parity, 2, 2)], [t('cbPremium'), pct(q.price / parity - 1, { digits: 1 })]] : []),
    [t('maturity'), fmtDate(terms.maturity)],
    ...(terms.put && terms.put > Date.now() ? [[t('cbPutDay'), fmtDate(terms.put)], [t('cbPutPrice'), num(terms.putPrice, 2, 2)]] : [])
  ];
}

function factsHtml(q) {
  return factsGrid(BONDS[q.symbol] && q.bond ? bondFacts(q) : stockFacts(q));
}
function stockFacts(q) {
  return [
    [t('prevClose'), qAmt(q, q.prev)],
    ...(priceLimits(q) ? [[t('limitPrices'), `${fmtPrice(priceLimits(q).up, q.currency)} / ${fmtPrice(priceLimits(q).down, q.currency)}`]] : []),
    // (A fund has a NAV a day: no range or volume.)
    ...(q.kind === 'fut' && Number.isFinite(q.basis) ? [[t(isSsf(q.symbol) ? 'futBasisStock' : 'futBasis'), `${q.basis > 0 ? '+' : q.basis < 0 ? '−' : ''}${qAmt(q, Math.abs(q.basis))}`], [t('futValue1'), money(q.price * stockMarkets.futMult(q.symbol), BASE)], [t('futExpiryFact'), fmtDate(stockMarkets.futureExpiry(q.symbol))]] : []),
    ...(q.kind === 'opt'
      ? [
          [t('optUnderlying'), num(q.underlying, 0, 0)],
          [t('optStrike'), `${num(q.strike, 0, 0)} ${t(q.right === 'C' ? 'optCall' : 'optPut')}`],
          [t('optIntrinsic'), num(stockMarkets.optionIntrinsic(q.symbol, q.underlying), 0, 0)],
          [t('optTimeValue'), num(Math.max(0, q.price - stockMarkets.optionIntrinsic(q.symbol, q.underlying)), 1, 0)],
          [t('optValue1'), money(q.price * stockMarkets.OPTION.mult, BASE)],
          [t('futExpiryFact'), fmtDate(expiryOf(q.symbol))]
        ]
      : []),
    ...cbFacts(q),
    ...(q.market === 'TWFUND' || q.kind === 'fut' || q.kind === 'opt'
      ? []
      : [
          [t('dayRange'), q.dayLow != null ? `${fmtPrice(q.dayLow, q.currency)} – ${fmtPrice(q.dayHigh, q.currency)}` : '—'],
          [t('range52'), q.low52 != null ? `${fmtPrice(q.low52, q.currency)} – ${fmtPrice(q.high52, q.currency)}` : '—'],
          [t('volume'), q.volume ? compact(q.volume) : '—']
        ]),
    [t('currency'), `${q.currency} · ${L(currencyInfo(q.currency))}`],
    [t('market'), q.market === 'TAIFEX' ? t('taifexName') : marketLabel(q.market)],
    ...(state.rates[q.currency] && q.currency !== BASE ? [[t('inTwd'), `${money(q.price * state.rates[q.currency], BASE, { digits: q.price * state.rates[q.currency] < 100 ? 2 : 0 })} ${t('perUnit', { unit: unitOf(q.symbol) })}`]] : [])
  ];
}
function factsGrid(rows) {
  // Short facts two a row; a long one (hours, holidays, costs) the row's
  // width, and one too long for even that each of its parts (` · `) a line
  // of its own, never wrapped (a currency, "TWD · Taiwan dollar", one line).
  // A short fact left alone at the end of its run (before a wide one, or last) takes the row: no hole.
  // (Measured as shown: a Chinese character is two letters wide.)
  const isWide = v => [...String(v)].reduce((w, ch) => w + (ch.codePointAt(0) > 0x2e80 ? 2 : 1), 0) > 16;
  let run = 0;
  const lone = rows.map(([, v], i) => {
    if (isWide(v)) return (run = 0), false;
    run++;
    return run % 2 === 1 && (i === rows.length - 1 || isWide(rows[i + 1][1]));
  });
  return `<dl class="facts-grid">${rows
    .map(([k, v], i) => (isWide(v) || lone[i] ? `<div class="wide"><dt>${h(k)}</dt><dd>${(String(v).length > 34 ? String(v).split(' · ') : [String(v)]).map(x => `<span>${h(x)}</span>`).join('')}</dd></div>` : String(v).includes(' – ') ? `<div class="range"><dt>${h(k)}</dt><dd>${String(v).split(' – ').map((x, i, all) => `<span class="keep">${h(i < all.length - 1 ? `${x} –` : x)}</span>`).join(' ')}</dd></div>` : `<div><dt>${h(k)}</dt><dd class="q-fit">${h(v)}</dd></div>`))
    .join('')}</dl>`;
}

// 交易須知: when, which days, what it costs and the rules, as pictures and
// chips rather than lines (Jay 2026-10-23: "too much text"). Each rule here is
// one the app keeps (the kit's account: auction, after-hours, odd lots, T+2…).
const minClock = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const minsOf = (ts, tz) => {
  const [a, b] = clock(ts, tz).split(':');
  return (+a % 24) * 60 + +b;
};
// A day's sessions in the market's own time, [from, to, kind, label] in minutes.
function sessionParts(q) {
  if (!q.session || q.kind === 'crypto' || q.market === 'TWFUND') return null;
  const from = minsOf(q.session.start, q.tz);
  let to = minsOf(stockMarkets.sessionEnd?.(q) ?? q.session.end, q.tz);
  if (to <= from) to += 1440;
  if (to - from >= 23 * 60) return [];
  if (q.market === 'TW' && isTradable(q.kind) && !stockMarkets.isEmerging?.(q.symbol)) {
    return [
      [510, from, 'pre', t('segPre')],
      [from, 805, 'open', t('segOpen')],
      [805, 810, 'auction', t('segAuction')],
      [820, 870, 'after', t('segOddAfter')],
      [840, 870, 'after', t('segFixedAfter'), true]
    ];
  }
  const parts = [];
  const ext = stockMarkets.US_EXTENDED;
  const us = ext && usSessionOf(q) !== undefined;
  if (us) parts.push([ext.pre[0], ext.pre[1], 'pre', t('segExtPre')]);
  const lunch = lunchOf(q.market);
  if (lunch && lunch[0] > from && lunch[1] < to) parts.push([from, lunch[0], 'open', t('segAm')], [lunch[1], to, 'open', t('segPm')]);
  else parts.push([from, to, 'open', t('segOpen')]);
  if (us) parts.push([ext.post[0], ext.post[1], 'after', t('segExtPost')]);
  return parts;
}
function hoursGuide(q) {
  const parts = sessionParts(q);
  if (!parts) return '';
  if (!parts.length) return `<div class="guide-chips"><span class="q-tag">${h(t('allDay'))}</span></div>`;
  const bar = parts.filter(p => !p[4]);
  const lo = Math.min(...bar.map(p => p[0]));
  const hi = Math.max(...bar.map(p => p[1]));
  const at = m => `${(((m - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  // Now, on a day it trades (the quote's session is today's).
  const now = Date.now();
  const nowM = minsOf(now, q.tz);
  const today = localDay(q.session.start, q.tz) === localDay(now, q.tz);
  const mark = today && nowM >= lo && nowM <= hi ? `<i class="gt-now" style="left:${at(nowM)}"></i>` : '';
  const tw = minsOf(q.session.start) !== minsOf(q.session.start, q.tz) ? `<p class="gt-tw">${h(t('taipeiTime'))} <b class="num">${clock(q.session.start)}–${clock(q.session.end)}</b></p>` : '';
  return `<div class="gt"><div class="gt-bar">${bar.map(p => `<i class="gt-${p[2]}" style="left:${at(p[0])};width:${at(p[1] - p[0] + lo)}"></i>`).join('')}${mark}</div>
    <div class="gt-ends num"><span>${minClock(lo)}</span><span>${minClock(hi)}</span></div>
    <ul class="gt-key">${parts.map(p => `<li><i class="gt-${p[2]}"></i><span>${h(p[3])}</span><b class="num">${minClock(p[0])}–${minClock(p[1])}</b></li>`).join('')}</ul>${tw}</div>`;
}
// A rule line's parts, each a chip: split at its commas, without its "權證：" head.
// (Never inside brackets: "減半 0.15%（至 2027/12/31，零股不適用）" is one chip.)
const ruleChips = line => {
  const out = [''];
  let depth = 0;
  for (const part of String(line).split(/( · |[，；;、]\s*|[（(]|[）)])/)) {
    if (/^[（(]$/.test(part)) depth++;
    else if (/^[）)]$/.test(part)) depth = Math.max(0, depth - 1);
    if (!depth && /^( · |[，；;、]\s*)$/.test(part)) out.push('');
    else out[out.length - 1] += part;
  }
  return out
    .map(x => x.replace(/^[^：\d]{1,8}：\s*|^[A-Za-z ]{1,16}:\s+/, '').trim())
    .filter(Boolean);
};
function costChips(q) {
  const chips = feeSummary(q).split(' · ');
  const m = MARKETS[q.market];
  if (q.market === 'TW' && m?.commission?.oddMin != null && isTradable(q.kind) && q.kind !== 'fut' && q.kind !== 'opt') chips.splice(1, 0, t('feeOddMin', { min: money(m.commission.oddMin, BASE) }));
  return chips;
}
function guideHtml(q) {
  const block = (icon, title, body) => (body ? `<div class="guide-part"><h4>${ico(icon)}${h(title)}</h4>${body}</div>` : '');
  const chips = (list, cls = '') => (list.length ? `<div class="guide-chips">${list.map(x => `<span class="q-tag ${cls}">${h(x)}</span>`).join('')}</div>` : '');
  const days = q.session ? holidayLine(q) : '';
  const tradable = isTradable(q.kind);
  const body = [
    block('clock', t('hours'), hoursGuide(q)),
    block('calendar', t('holidaysNext'), days ? chips(days.split(/[、,] ?/), 'num') : ''),
    block('coin', t('costs'), tradable || BONDS[q.symbol] ? chips(costChips(q), 'num') : ''),
    block('list', t('rulesFact'), tradable && !BONDS[q.symbol] ? chips(ruleChips(marketRules(q))) : '')
  ].join('');
  return body ? `<div class="guide">${body}</div>` : '';
}

function positionHtml(symbol) {
  const v = valuation();
  const p = v?.positions.find(x => x.symbol === symbol);
  if (!p) return '';
  return sectionHtml(
    t('yourPosition'),
    `<div class="q-stats pos-stats">
      ${stat(p.short ? t('shortHolding') : t('holding'), `${fmtQty(Math.abs(p.qty))} ${unitOf(symbol)}`, p.short ? t('borrowFeeSoFar', { amount: money(p.borrowFee || 0, p.currency, { digits: 2 }) }) : '')}
      ${stat(t('avgCost'), fmtPrice(p.avg, p.currency), p.currency)}
      ${stat(t('marketValue'), money(p.valueTWD, BASE), p.currency !== BASE ? money(p.value, p.currency) : '')}
      ${stat(t('unrealized'), money(netPl(p).pl, BASE, { sign: true }), pct(netPl(p).pct), dirClass(netPl(p).pl))}
    </div>${(() => {
      const d = upcomingIncome(400).find(x => x.kind === 'div' && x.symbol === symbol);
      return d ? `<div class="q-tags pos-income"><span class="q-tag up num">${ico('coin')}${h(t('nextDivTag', { date: shortDate(d.t), est: d.est ? `${t('estTag')} ` : '', v: money(d.net, BASE) }))}</span></div>` : '';
    })()}`
  );
}

// A figure with its name (the kit's .q-stat), and a line under it.
const stat = (label, value, sub = '', dir = '') => `<div class="q-stat"><small>${h(label)}</small><strong class="num ${dir}">${h(value)}</strong>${sub ? `<span class="stat-sub num ${dir}">${h(sub)}</span>` : ''}</div>`;

// An index or a future can't be bought: the funds that track it can.
function trackersHtml(symbol) {
  const list = TRACKERS[symbol] || [];
  return sectionHtml(t('trackWithTitle'), list.length ? `<div class="q-rowcard">${list.map(s => quoteRow(s)).join('')}</div>` : `<p class="foot-note">${h(t('watchOnly'))}</p>`, { side: `<span class="q-tag">${h(t('watchOnlyTag'))}</span>` });
}
// ---- Detail sheet: alerts, monthly plan, time machine ---------------------------

// Taiwan brokers sell 定期定額 of shares in Taiwan and the US only (the
// kit's planAllowed; an older kit: no other market's either). A plan saved
// before this rule keeps its card so it can still be stopped.
const planAllowed = q => (stockAccount.planAllowed ? stockAccount.planAllowed(q) && q.kind !== 'fx' : (stockAccount.PLAN_MARKETS ?? ['TW', 'US']).includes(q.market));
const canPlan = (q, symbol) => isTradable(q.kind) && !BONDS[q.symbol]
  && (planAllowed(q) || activePlans(state.account).some(p => p.symbol === symbol));
// The least a buy can be: NT$100, a US one what exchanges for US$10 (the kit's planMinTWD).
const planMin = q => stockAccount.planMinTWD(q?.market, state.rates[q?.currency]);

function toolsHtml(symbol, q) {
  const folds = [alertCardHtml(symbol, q), canPlan(q, symbol) ? planCardHtml(symbol, q) : ''].join('');
  return `<div class="fold-group">${folds}</div>`;
}

function alertCardHtml(symbol, q) {
  const list = alertsFor(state.account, symbol);
  const price = Number(state.alertPrice);
  const op = price > q.price ? 'above' : 'below';
  const presets = [-0.1, -0.05, 0.05, 0.1].map(k => [pct(k, { digits: 0 }), +(q.price * (1 + k)).toPrecision(5)]);
  const on = list.filter(a => a.on);
  const rows = list
    .map(a =>
      a.on
        ? `<li><span>${h(t(a.op === 'above' ? 'alertWhenAbove' : 'alertWhenBelow', { price: qAmt(q, a.price) }))}</span><button class="q-btn small" type="button" data-action="alert-off" data-id="${h(a.id)}">${h(t('remove'))}</button></li>`
        : `<li class="done"><span>${h(t('alertWentOff', { price: qAmt(q, a.hit.price), time: dateTime(a.hit.t) }))}</span></li>`
    )
    .join('');
  return fold(
    tileHtml(ico('bell'), TINT.red, 'sm'),
    t('alertTitle'),
    `${rows ? `<ul class="tool-list">${rows}</ul>` : ''}
    <label class="field"><span>${h(t('alertPriceLabel'))} (${h(q.currency)})</span><input id="alert-price" class="q-field num" inputmode="decimal" autocomplete="off" value="${h(state.alertPrice)}" placeholder="${h(qPrice(q))}" /></label>
    <div class="chip-row">${presets.map(([label, v]) => `<button class="q-chip" type="button" data-action="alert-preset" data-v="${v}">${h(label)}</button>`).join('')}</div>
    <button class="q-btn primary block" type="button" data-action="alert-add" ${price > 0 && Math.abs(price / q.price - 1) > 1e-6 ? '' : 'disabled'}>${h(price > 0 ? t(op === 'above' ? 'alertAddAbove' : 'alertAddBelow', { price: qAmt(q, price) }) : t('alertAdd'))}</button>`,
    on.length > 0,
    'tool:alert',
    on.length ? `<span class="q-tag red">${on.length}</span>` : ''
  );
}
// 定期定額's terms, the kit's (read through the module: an older kit has
// days 1-28, no fee or session of its own, and no end).
const planDayMax = () => stockAccount.PLAN_DAY_MAX ?? 28;
// The day picker: 29-31 fall on a shorter month's last day.
const planDayOptions = selected =>
  Array.from({ length: planDayMax() }, (_, i) => i + 1)
    .map(n => `<option value="${n}" ${String(n) === selected ? 'selected' : ''}>${h(t(n > 28 ? 'dayOfMonthEnd' : 'dayOfMonth', { n }))}</option>`)
    .join('');
const hhmm = ({ h: hh, m }) => `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
// The odd-lot session's first match today (09:10; 09:00 from 2026-12-07, the kit's oddLotOpenAt).
const oddLotFirst = (at = Date.now()) => hhmm(stockMarkets.oddLotOpenAt(at));
// How a plan buys and what a buy costs, as the kit does it: a Taiwan stock
// or ETF a limit order at the odd-lot session's first match (09:10, 09:00
// from 2026-12-07), any whole lots a trade of their own; NT$1 a buy to the
// end of the brokers' offer, then 0.1425% with a NT$1 minimum. A US one at
// the first price on its day, at the 複委託 commission.
function planTermsHtml(q, at = Date.now()) {
  const lines = [];
  if (q.market === 'TW' && stockAccount.planOrderType) {
    const nine = stockMarkets.ODD_LOT_NINE;
    const open = hhmm(stockMarkets.oddLotOpenAt(at));
    lines.push(t('planTimeTw', { time: nine && at < nine ? t('planTimeNine', { time: open, date: fmtDate(nine) }) : open }));
  } else lines.push(t('planTimeOpen'));
  const m = MARKETS[q.market] || MARKETS.INTL;
  const fee = m.plan;
  const cur = m.currency || BASE;
  if (fee) lines.push(at < fee.flatUntil ? t('planFeeFlat', { fee: money(fee.flat, cur, { digits: fee.flat < 1 ? 2 : undefined }), until: fmtDate(fee.flatUntil - 1), rate: rateText(fee.rate), min: money(fee.min, cur) }) : t('planFeeRate', { rate: rateText(fee.rate), min: money(fee.min, cur) }));
  else if (q.market !== 'TW' && m.commission?.rate) lines.push(t('feeCommission', { rate: rateText(m.commission.rate), min: money(m.commission.min, m.currency || q.currency) }));
  // A US one from US$10, in fractional shares (the kit's PLAN_MIN_LOCAL, fractional).
  if (stockAccount.PLAN_MIN_LOCAL?.[q.market] && stockMarkets.fractional(q.market, q.kind)) lines.push(t('planMinUs', { min: money(planMin(q), BASE) }));
  return lines.map(x => `<p class="foot-note">${h(x)}</p>`).join('');
}
// The plan of `symbol` that ended by itself (three months running without
// the cash: the kit's plan.ended), shown until another is set.
const endedPlan = symbol => Object.values(state.account?.plans || {}).filter(p => !p.on && p.ended && p.symbol === symbol).sort((a, b) => b.t - a.t)[0] || null;
// Why a month's buy didn't happen, in a few words (err_funds needs figures a plan's month doesn't keep).
const planReason = reason => (reason === 'funds' ? t('planNoCash') : t(`err_${reason}`));
const planEndedText = p => t('planEnded', { date: fmtDate(p.t), n: stockAccount.PLAN_FAIL_LIMIT ?? 3 });

function planCardHtml(symbol, q) {
  const plan = activePlans(state.account).find(p => p.symbol === symbol);
  const editing = plan && state.planEdit === plan.id;
  if (plan && !editing) {
    const next = nextPlanRun(plan);
    return fold(
      tileHtml(ico('calendar'), TINT.teal, 'sm'),
      t('planTitle'),
      `<p class="fold-lead">${h(t('planActive', { amount: money(plan.amount, BASE), day: plan.day }))} · ${h(t('planNext', { date: next ? fmtDate(next) : '—' }))}</p>
      ${planHistoryHtml(plan)}
      ${planTermsHtml(q, next || Date.now())}
      <div class="button-row"><button class="q-btn small" type="button" data-action="plan-edit" data-id="${h(plan.id)}">${h(t('planEdit'))}</button><button class="q-btn small danger tinted" type="button" data-action="plan-off" data-id="${h(plan.id)}">${h(t('planStop'))}</button></div>`,
      true,
      'tool:plan',
      `<span class="q-tag tint">${h(money(plan.amount, BASE))}</span>`
    );
  }
  const ended = plan ? null : endedPlan(symbol);
  const amount = Number(state.plan.amount);
  const perUnit = q.price * (state.rates[q.currency] || 0);
  const units = perUnit > 0 ? amount / perUnit : 0;
  return fold(
    tileHtml(ico('calendar'), TINT.teal, 'sm'),
    t('planTitle'),
    `
    ${ended ? `<p class="warn">${h(planEndedText(ended))}</p>${planHistoryHtml(ended)}` : ''}
    <div class="field-row">
      <label class="field grow"><span>${h(t('planAmount'))} (NT$)</span><input id="plan-amount" class="q-field num" inputmode="numeric" autocomplete="off" value="${h(state.plan.amount)}" /></label>
      <label class="field"><span>${h(t('planDay'))}</span><select id="plan-day" class="q-field">${planDayOptions(state.plan.day)}</select></label>
    </div>
    ${perUnit > 0 && amount > 0 ? `<p class="foot-note">${h(t('planBuys', { units: num(units, stockMarkets.fractional(q.market, q.kind) && units < 1 ? 4 : units < 10 ? 2 : 0), unit: unitOf(symbol) }))}${q.currency !== BASE ? ` · ${h(t('planFx', { cur: q.currency }))}` : ''}</p>` : ''}
    <button class="q-btn primary block" type="button" data-action="plan-add" ${amount >= planMin(q) && state.account ? '' : 'disabled'}>${h(t(editing ? 'planSave' : 'planStart'))}</button>
    ${editing ? `<button class="q-btn small block" type="button" data-action="plan-edit-cancel">${h(t('orderAskCancel'))}</button>` : ''}
    <p class="foot-note">${h(stockAccount.PLAN_FAIL_LIMIT ? t('planNoteEnd', { min: money(planMin(q), BASE), n: stockAccount.PLAN_FAIL_LIMIT }) : t('planNote', { min: money(planMin(q), BASE) }))}</p>
    ${planTermsHtml(q)}`,
    Boolean(editing) || Boolean(ended),
    'tool:plan'
  );
}

function planHistoryHtml(plan) {
  const runs = state.account.orders.filter(o => o.plan === plan.id).slice(-4).reverse();
  if (!runs.length) return '';
  return `<ul class="tool-list">${runs
    .map(o => `<li><span>${h(fmtDate(o.done || o.t))}</span><span class="num">${o.status === 'filled' ? h(`${fmtQty(o.qty)} ${unitOf(o.symbol)} @ ${fmtPrice(o.price, o.currency)}`) : h(planReason(o.reason))}</span></li>`)
    .join('')}</ul>`;
}
function addAlert() {
  const d = state.detail;
  const q = state.quotes.get(d.symbol);
  if (!state.account) return;
  const price = Number(state.alertPrice);
  const r = setAlert(state.account, { symbol: d.symbol, op: price > q.price ? 'above' : 'below', price });
  if (r.error) return toast(t(`err_${r.error}`), 'bad');
  commit(r.account);
  state.alertPrice = '';
  toast(t('alertSet'), 'good');
  refreshDetailLive();
}

let planAddedAt = 0;
async function addPlan() {
  const d = state.detail;
  const q = state.quotes.get(d.symbol);
  if (!state.account || Date.now() - planAddedAt < 2000) return;
  // A purchase every month: asked first.
  const editing = Boolean(state.planEdit) && state.account.plans?.[state.planEdit]?.symbol === d.symbol;
  if (!(await askKit({ lang: locale, icon: '📅', title: t(editing ? 'planEditAsk' : 'planAsk', { name: nameOf(d.symbol, q), amount: money(Number(state.plan.amount) || 0, BASE) }), body: t('planAskBody', { day: state.plan.day }), ok: t(editing ? 'planSave' : 'planAskOk'), cancel: t('orderAskCancel') }))) return;
  planAddedAt = Date.now();
  // The keyboard away, so the sheet redraws with the plan in place.
  document.activeElement?.blur?.();
  const r = setPlan(state.account, { symbol: d.symbol, amount: state.plan.amount, day: state.plan.day, name: q.name, kind: q.kind, market: q.market, currency: q.currency, twd: state.rates[q.currency] });
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  state.planEdit = null;
  track(symbolKeys(d.symbol), 2);
  toast(t('planSet', { date: fmtDate(nextPlanRun(r.plan)) }), 'good');
  redrawDetail();
}

// A plan changed in its row of the plans list.
async function savePlanRow(id) {
  const plan = state.account?.plans?.[id];
  if (!plan || Date.now() - planAddedAt < 2000) return;
  const amount = Number(state.plan.amount) || 0;
  const min = planMin(state.quotes.get(plan.symbol) || plan);
  if (amount < min) return toast(t('planNote', { min: money(min, BASE) }), 'bad');
  if (!(await askKit({ lang: locale, icon: '📅', title: t('planEditAsk', { name: nameOf(plan.symbol), amount: money(amount, BASE) }), body: t('planAskBody', { day: state.plan.day }), ok: t('planSave'), cancel: t('orderAskCancel') }))) return;
  planAddedAt = Date.now();
  document.activeElement?.blur?.();
  const q = state.quotes.get(plan.symbol) || {};
  const r = setPlan(state.account, { id: plan.id, symbol: plan.symbol, amount: state.plan.amount, day: state.plan.day, name: q.name || plan.name, kind: q.kind || plan.kind, market: q.market || plan.market, currency: q.currency || plan.currency, twd: state.rates[q.currency || plan.currency] });
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  state.planEdit = null;
  recordAffinity('stock', symbolKeys(plan.symbol), 2);
  toast(t('planSet', { date: fmtDate(nextPlanRun(r.plan)) }), 'good');
  render();
}

// ---- Detail sheet: what the company does, its numbers, news ------------------------

// Yahoo's sectors, in Chinese (by name and by fund-weighting id).
const SECTORS_ZH = {
  Technology: '科技', 'Financial Services': '金融', Healthcare: '醫療保健', 'Consumer Cyclical': '非必需消費', 'Consumer Defensive': '必需消費',
  'Communication Services': '通訊服務', Industrials: '工業', Energy: '能源', Utilities: '公用事業', 'Real Estate': '不動產', 'Basic Materials': '原物料'
};
const SECTOR_IDS = {
  technology: 'Technology', financial_services: 'Financial Services', healthcare: 'Healthcare', consumer_cyclical: 'Consumer Cyclical',
  consumer_defensive: 'Consumer Defensive', communication_services: 'Communication Services', industrials: 'Industrials', energy: 'Energy',
  utilities: 'Utilities', realestate: 'Real Estate', basic_materials: 'Basic Materials'
};
const sectorName = name => (locale === 'zh' ? SECTORS_ZH[name] || name : name);
const RATINGS = ['strong_buy', 'buy', 'hold', 'underperform', 'sell'];

// Big amounts, short: NT$64.18兆 / US$4.98T.
const compactMoney = (x, cur) => `${currencyInfo(cur).symbol || `${cur} `}${compact(x)}`;

function aboutHtml(symbol, q) {
  if (!ABOUT_KINDS.has(q.kind) || BONDS[symbol]) return '';
  const a = state.about.get(symbol);
  // (A Taiwan fund not found where its profile comes from: no empty fold.)
  if (q.market === 'TWFUND' && a && !a.loading && !a.facts) return '';
  const fund = q.kind !== 'stock';
  const icon = fund ? tileHtml(ico('grid'), TINT.indigo, 'sm') : tileHtml(ico('chart'), TINT.blue, 'sm');
  const title = q.market === 'TWFUND' ? t('aboutTwFund') : fund ? t('aboutFund') : t('aboutCompany');
  if (!a || a.loading) return fold(icon, title, `<p class="foot-note">${h(t('aboutLoading'))}</p>`, true, 'about');
  const f = a.facts;
  const body = !f ? `<p class="foot-note">${h(t('aboutNone'))}</p>` : fund ? fundAboutHtml(f, q, a) : stockAboutHtml(f, q, a);
  // In the reader's language once translated; the English original a tap away.
  const local = a.summaryLocal && locale !== 'en';
  const summary = f?.summary
    ? `<details class="summary-text"><summary>${h(t('whatItDoes'))}</summary>${local ? `<p>${h(a.summaryLocal)}</p><details class="summary-orig"><summary>${h(t('originalText'))}</summary><p lang="en">${h(f.summary)}</p></details>` : `<p lang="en">${h(f.summary)}</p>`}${f.website ? `<p><a href="${h(f.website)}" target="_blank" rel="noopener">${h(f.website.replace(/^https?:\/\//, ''))}</a></p>` : ''}</details>`
    : '';
  return fold(icon, title, `${body}${summary}`, true, 'about');
}

// One quick read: a label, a verdict and the number behind it.
const verdict = (label, word, tone, detail) => `<div class="verdict ${tone}"><span>${h(label)}</span><strong>${h(word)}</strong><small class="num">${h(detail)}</small></div>`;
const band = (x, lo, hi) => (x < lo ? 0 : x <= hi ? 1 : 2);

// A group of numbers, each with a line on what it means.
function factGroup(title, rows) {
  const list = rows.filter(([, v]) => v != null && v !== '');
  if (!list.length) return '';
  return `<h3 class="about-h">${h(title)}</h3><dl class="about-grid">${list.map(([k, v, e]) => `<div><dt>${h(t(k))}</dt><dd class="num">${h(v)}</dd>${e ? `<p>${h(t(e))}</p>` : ''}</div>`).join('')}</dl>`;
}

function stockAboutHtml(f, q, a) {
  const cur = f.currency || q.currency;
  const rc = f.reportCurrency || cur;
  const inTwd = (x, c) => (x != null && c !== BASE && state.rates[c] ? ` (≈ ${compactMoney(x * state.rates[c], BASE)})` : '');
  const pctOf = (x, digits = 1) => (x != null ? pct(x, { sign: false, digits }) : null);
  const profile = [
    f.sector ? `${sectorName(f.sector)}${f.industry ? ` · ${(locale !== 'en' && a?.industryLocal) || f.industry}` : ''}` : '',
    (locale !== 'en' && a?.placeLocal) || [f.city, f.country].filter(Boolean).join(', '),
    f.ceo ? t('ceoIs', { name: f.ceo }) : '',
    f.employees ? t('employeesN', { n: num(f.employees) }) : ''
  ].filter(Boolean);
  // The quick read.
  const v = [];
  if (f.pe > 0) v.push(verdict(t('vValue'), [t('vCheap'), t('vFair'), t('vPricey')][band(f.pe, 15, 30)], ['good', 'mid', 'warn'][band(f.pe, 15, 30)], `${t('peRatio')} ${num(f.pe, 1)}`));
  else if (f.eps != null && f.eps < 0) v.push(verdict(t('vValue'), t('vLoss'), 'warn', `EPS ${fmtPrice(f.eps, cur)}`));
  if (f.margin != null) v.push(verdict(t('vProfit'), f.margin < 0 ? t('vLoss') : [t('vThin'), t('vOk'), t('vStrong')][band(f.margin, 0.05, 0.2)], f.margin < 0 ? 'warn' : ['warn', 'mid', 'good'][band(f.margin, 0.05, 0.2)], `${t('profitMargin')} ${pctOf(f.margin)}`));
  if (f.growth != null) v.push(verdict(t('vGrowth'), f.growth < 0 ? t('vShrinking') : f.growth > 0.15 ? t('vFast') : t('vSteady'), f.growth < 0 ? 'warn' : f.growth > 0.15 ? 'good' : 'mid', `${t('revenueGrowth')} ${pct(f.growth, { digits: 1 })}`));
  v.push(verdict(t('vDividend'), !f.dividendYield ? t('vNoDiv') : [t('vSmallDiv'), t('vSomeDiv'), t('vHighDiv')][band(f.dividendYield, 0.01, 0.04)], !f.dividendYield ? 'info' : ['info', 'mid', 'good'][band(f.dividendYield, 0.01, 0.04)], `${t('divYield')} ${pctOf(f.dividendYield || 0, 2)}`));
  if (f.debtToEquity != null || (f.cash != null && f.debt != null)) {
    const netCash = f.cash != null && f.debt != null && f.cash >= f.debt;
    const b = f.debtToEquity != null ? band(f.debtToEquity, 50, 150) : 1;
    v.push(verdict(t('vBalance'), netCash ? t('vNetCash') : [t('vSolid'), t('vOk'), t('vHeavy')][b], netCash || b === 0 ? 'good' : b === 1 ? 'mid' : 'warn', f.debtToEquity != null ? `${t('debtToEquity')} ${num(f.debtToEquity, 0)}%` : ''));
  }
  if (f.beta != null) v.push(verdict(t('vRisk'), [t('vCalm'), t('vMarket'), t('vWild')][band(f.beta, 0.8, 1.3)], ['good', 'mid', 'warn'][band(f.beta, 0.8, 1.3)], `Beta ${num(f.beta, 2)}`));
  const quick = v.length ? `<div class="verdicts">${v.join('')}</div><p class="foot-note">${h(t('verdictNote'))}</p>` : '';
  // Coming up.
  const now = Date.now();
  const soon = [
    f.earningsDate > now - 86_400_000 ? `${t('nextEarnings', { date: fmtDate(f.earningsDate) })}` : '',
    f.exDividendDate > now - 86_400_000 ? `${t('nextExDiv', { date: fmtDate(f.exDividendDate) })}` : ''
  ].filter(Boolean);
  return `
    ${profile.length ? `<p class="about-profile">${profile.map(x => `<span>${h(x)}</span>`).join('')}</p>` : ''}
    ${quick}
    ${soon.length ? `<div class="q-tags about-soon">${soon.map(x => `<span class="q-tag orange">${h(x)}</span>`).join('')}</div>` : ''}
    ${financialsHtml(f, rc)}
    ${targetHtml(f, q)}
    ${factGroup(t('gValue'), [
      ['marketCap', f.marketCap != null ? compactMoney(f.marketCap, cur) + inTwd(f.marketCap, cur) : null, 'marketCapHelp'],
      ['peRatio', f.pe != null ? num(f.pe, 1) : null, 'peHelp'],
      ['forwardPe', f.forwardPe != null ? num(f.forwardPe, 1) : null, 'forwardPeHelp'],
      ['eps', f.eps != null ? `${fmtPrice(f.eps, cur)} ${cur}` : null, 'epsHelp'],
      ['pbRatio', f.pb != null ? num(f.pb, 2) : null, 'pbHelp']
    ])}
    ${factGroup(t('gProfit'), [
      ['grossMargin', pctOf(f.grossMargin), 'grossMarginHelp'],
      ['operatingMargin', pctOf(f.operatingMargin), 'operatingMarginHelp'],
      ['profitMargin', pctOf(f.margin), 'profitMarginHelp'],
      ['roe', pctOf(f.roe), 'roeHelp'],
      ['revenueGrowth', f.growth != null ? pct(f.growth, { digits: 1 }) : null, 'revenueGrowthHelp'],
      ['earningsGrowth', f.earningsGrowth != null ? pct(f.earningsGrowth, { digits: 1 }) : null, 'earningsGrowthHelp']
    ])}
    ${factGroup(t('gDividend'), [
      ['divYield', f.dividendYield != null ? pctOf(f.dividendYield, 2) : null, 'divYieldHelp'],
      ['dividendRate', f.dividendRate ? `${fmtPrice(f.dividendRate, cur)} ${cur}` : null, 'dividendRateHelp'],
      ['payoutRatio', f.payoutRatio ? pctOf(f.payoutRatio, 0) : null, 'payoutRatioHelp'],
      ['avgYield5', f.avgYield5 ? pctOf(f.avgYield5, 2) : null, 'avgYield5Help']
    ])}
    ${factGroup(t('gBalance'), [
      ['cashHeld', f.cash != null ? compactMoney(f.cash, rc) : null, 'cashHeldHelp'],
      ['debtOwed', f.debt != null ? compactMoney(f.debt, rc) : null, 'debtOwedHelp'],
      ['debtToEquity', f.debtToEquity != null ? `${num(f.debtToEquity, 0)}%` : null, 'debtToEquityHelp'],
      ['freeCashflow', f.freeCashflow != null ? compactMoney(f.freeCashflow, rc) : null, 'freeCashflowHelp']
    ])}
    ${factGroup(t('gRisk'), [
      ['change52', f.change52 != null ? `${pct(f.change52, { digits: 1 })}${f.sp52 != null ? ` · ${t('vsSp', { pct: pct(f.sp52, { digits: 1 }) })}` : ''}` : null, 'change52Help'],
      ['beta', f.beta != null ? num(f.beta, 2) : null, 'betaHelp']
    ])}`;
}

// Revenue and profit over the last four years (or quarters).
function financialsHtml(f, rc) {
  const quarterly = state.aboutPeriod === 'quarter' && f.quarterly.length;
  const rows = quarterly ? f.quarterly : f.yearly;
  if (rows.length < 2) return '';
  const W = 560;
  const H = 180;
  const pad = { l: 8, r: 8, t: 22, b: 26 };
  const max = Math.max(...rows.flatMap(r => [r.revenue, r.earnings || 0]), 1);
  const min = Math.min(0, ...rows.map(r => r.earnings || 0));
  const Y = x => pad.t + ((max - x) / (max - min)) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / rows.length;
  const bw = Math.min(40, slot * 0.32);
  const bars = rows
    .map((r, i) => {
      const x = pad.l + slot * i + slot / 2;
      const rev = `<rect class="fin-rev" x="${x - bw - 2}" y="${Y(r.revenue)}" width="${bw}" height="${Y(0) - Y(r.revenue)}" rx="3"/><text class="fin-label" x="${x - bw / 2 - 2}" y="${Y(r.revenue) - 5}" text-anchor="middle">${h(compact(r.revenue))}</text>`;
      const e = r.earnings || 0;
      const earn = `<rect class="fin-earn${e < 0 ? ' neg' : ''}" x="${x + 2}" y="${Math.min(Y(e), Y(0))}" width="${bw}" height="${Math.abs(Y(0) - Y(e))}" rx="3"/><text class="fin-label" x="${x + bw / 2 + 2}" y="${(e < 0 ? Y(e) + 12 : Y(e) - 5)}" text-anchor="middle">${h(compact(e))}</text>`;
      return `${rev}${earn}<text class="axis-label" x="${x}" y="${H - 8}" text-anchor="middle">${h(r.label)}</text>`;
    })
    .join('');
  const first = rows[0];
  const last = rows.at(-1);
  const growth = first.revenue > 0 ? last.revenue / first.revenue - 1 : null;
  return `<div class="about-fin">
    <div class="card-head"><h3 class="about-h">${h(t('finTitle'))} <small>(${h(rc)})</small></h3>
      ${f.quarterly.length ? seg([['year', t('finYear')], ['quarter', t('finQuarter')]], 'about-period', 'v', v => v === (quarterly ? 'quarter' : 'year'), 'small') : ''}
    </div>
    <ul class="legend-inline"><li><i class="sw fin-rev"></i>${h(t('finRevenue'))}</li><li><i class="sw fin-earn"></i>${h(t('finEarnings'))}</li></ul>
    <svg class="chart-svg fin-chart" viewBox="0 0 ${W} ${H}" role="img"><line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(0)}" y2="${Y(0)}"/>${bars}</svg>
    ${growth != null ? `<p class="foot-note">${h(t(quarterly ? 'finGrowthQ' : 'finGrowthY', { from: first.label, to: last.label, pct: pct(growth, { digits: 0 }) }))}</p>` : ''}
  </div>`;
}

// What analysts expect the price to be in a year, against today's.
function targetHtml(f, q) {
  const tg = f.target;
  if (!tg?.mean || !tg.low || !tg.high || !(q.price > 0)) return '';
  const lo = Math.min(tg.low, q.price);
  const hi = Math.max(tg.high, q.price);
  const x = v => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  const cur = q.currency;
  // A target is a round figure: to the cent at most (an average of 814.512 read as a quote).
  const tp = v => fmtPrice(Math.round(v * 100) / 100, cur);
  const rating = RATINGS.includes(tg.rating) ? t(`rating_${tg.rating}`) : null;
  return `<div class="about-target">
    <h3 class="about-h">${h(t('targetTitle'))}</h3>
    <p>${h(t('targetLine', { n: tg.analysts || '?', mean: tp(tg.mean), pct: pct(tg.mean / q.price - 1, { digits: 0 }) }))}${rating ? ` · ${h(t('ratingIs', { rating }))}` : ''}</p>
    <div class="target-bar"><span class="target-range" style="left:${x(tg.low)};right:calc(100% - ${x(tg.high)})"></span><i class="target-mean" style="left:${x(tg.mean)}" title="${h(t('targetMean'))}"></i><i class="target-now" style="left:${x(q.price)}" title="${h(t('targetNow'))}"></i></div>
    <div class="target-scale num"><span>${h(t('targetLow'))} ${h(tp(tg.low))}</span><span>${h(t('targetNow'))} ${h(fmtPrice(q.price, cur))}</span><span>${h(t('targetHigh'))} ${h(tp(tg.high))}</span></div>
  </div>`;
}

function fundAboutHtml(f, q, a) {
  const cur = f.currency || q.currency;
  const sizeTwd = f.totalAssets != null ? f.totalAssets * (cur === BASE ? 1 : state.rates[cur] || 0) : null;
  const top = f.holdings?.[0]?.weight || 0;
  const top10 = (f.holdings || []).reduce((sum, x) => sum + x.weight, 0);
  const v = [];
  // A Taiwan fund's 風險收益等級 (RR1–RR5), as its prospectus and every platform show it.
  if (f.risk) v.push(verdict(t('vRisk'), t(f.risk <= 2 ? 'vRiskLow' : f.risk === 3 ? 'vRiskMid' : 'vRiskHigh'), f.risk <= 2 ? 'good' : f.risk === 3 ? 'mid' : 'warn', t('vRiskLine', { n: f.risk })));
  if (f.expenseRatio != null) v.push(verdict(t('vCost'), f.expenseRatio < 0.002 ? t('vVeryCheap') : f.expenseRatio < 0.006 ? t('vOk') : t('vPricey'), f.expenseRatio < 0.002 ? 'good' : f.expenseRatio < 0.006 ? 'mid' : 'warn', t('vCostYear', { v: pct(f.expenseRatio, { sign: false, digits: 2 }) })));
  if (sizeTwd) v.push(verdict(t('vSize'), sizeTwd > 3e10 ? t('vBig') : sizeTwd > 3e9 ? t('vMid') : t('vSmall'), sizeTwd > 3e10 ? 'good' : sizeTwd > 3e9 ? 'mid' : 'warn', compactMoney(sizeTwd, BASE)));
  if (f.holdings?.length) v.push(verdict(t('vSpread'), top > 0.3 || top10 > 0.65 ? t('vConcentrated') : t('vDiversified'), top > 0.3 || top10 > 0.65 ? 'warn' : 'good', t('top10Share', { pct: pct(top10, { sign: false, digits: 0 }) })));
  // (A Taiwan fund: whether it pays is its 收益分配 below; no yield is known.)
  if (q.market !== 'TWFUND') v.push(verdict(t('vDividend'), !f.dividendYield ? t('vNoDiv') : [t('vSmallDiv'), t('vSomeDiv'), t('vHighDiv')][band(f.dividendYield, 0.01, 0.04)], !f.dividendYield ? 'info' : ['info', 'mid', 'good'][band(f.dividendYield, 0.01, 0.04)], `${t('divYield')} ${pct(f.dividendYield || 0, { sign: false })}`));
  const returns = [
    ['retYtd', f.ytd],
    ['ret1y', f.return1y],
    ['ret3y', f.return3y],
    ['ret5y', f.return5y]
  ]
    .filter(([, x]) => x != null)
    .slice(-3); // three across at most (a phone's width): the longest spans
  const sectors = f.sectors?.length
    ? `<h3 class="about-h">${h(t('sectorMix'))}</h3>${stackBar(
        (f.sectors.length > 8 ? [...f.sectors.slice(0, 7), { id: 'others', weight: f.sectors.slice(7).reduce((sum, x) => sum + x.weight, 0) }] : f.sectors).map((x, i) => ({
          label: x.id === 'others' ? t('others') : sectorName(SECTOR_IDS[x.id] || x.id),
          value: x.weight,
          color: SERIES[i]
        })),
        { format: () => '' }
      )}`
    : '';
  const mix = f.mix && (f.mix.bond > 0.02 || f.mix.cash > 0.02) ? `<p class="foot-note">${h(t('assetMix', { stock: pct(f.mix.stock, { sign: false, digits: 0 }), bond: pct(f.mix.bond, { sign: false, digits: 0 }), cash: pct(f.mix.cash, { sign: false, digits: 0 }) }))}</p>` : '';
  const holdings = f.holdings?.length
    ? `<h3 class="about-h">${h(t('topHoldings'))}</h3><ul class="bars-list holdings">${f.holdings
        .map(x => `<li><button class="link bar-label" type="button" data-action="open" data-symbol="${h(x.symbol)}">${h(catalogInfo(x.symbol) ? nameOf(x.symbol) : x.name)}</button><span class="bar-track"><span class="bar flat" style="width:${Math.min(100, (x.weight / f.holdings[0].weight) * 100)}%"></span></span><strong class="num">${h(pct(x.weight, { sign: false, digits: 1 }))}</strong></li>`)
        .join('')}</ul><p class="foot-note">${h(t('topHoldingsNote', { pct: pct(top10, { sign: false, digits: 0 }) }))}</p>`
    : '';
  const profile = [f.family, (locale !== 'en' && a?.categoryLocal) || f.category, f.inception ? t('fundSince', { date: fmtDate(f.inception) }) : ''].filter(Boolean);
  return `
    ${profile.length ? `<p class="about-profile">${profile.map(x => `<span>${h(x)}</span>`).join('')}</p>` : ''}
    ${v.length ? `<div class="verdicts">${v.join('')}</div><p class="foot-note">${h(t('verdictNote'))}</p>` : ''}
    ${returns.length ? `<div class="q-stats about-returns" style="--n:${returns.length}">${returns.map(([k, x]) => stat(t(k), pct(x, { digits: 1 }), k === 'retYtd' || k === 'ret1y' ? '' : t('retYearly'), dirClass(x))).join('')}</div>` : ''}
    ${sectors}${mix}${holdings}
    ${factGroup(t('gFund'), [
      ['expenseRatio', f.expenseRatio != null ? pct(f.expenseRatio, { sign: false, digits: 2 }) : null, 'expenseRatioHelp'],
      ['fundRisk', f.risk ? `RR${f.risk}` : null, 'fundRiskHelp'],
      ['frontLoadMax', f.frontLoadMax ? pct(f.frontLoadMax, { sign: false, digits: 1 }) : null, 'frontLoadHelp'],
      ['fundPays', f.distribution ? (f.distribution === 'income' ? t('fundPaysIncome') : t('fundPaysAcc')) : null],
      ['fundCustodian', f.custodian],
      ['fundSize', f.totalAssets != null ? compactMoney(f.totalAssets, cur) + (sizeTwd && cur !== BASE ? ` (≈ ${compactMoney(sizeTwd, BASE)})` : '') : null, 'fundSizeHelp'],
      ['divYield', f.dividendYield != null ? pct(f.dividendYield, { sign: false }) : null, 'divYieldHelp'],
      ['peRatio', f.pe != null ? num(f.pe, 1) : null, 'peFundHelp'],
      ['beta', f.beta != null ? num(f.beta, 2) : null, 'betaHelp']
    ])}`;
}

function ownTradesHtml(symbol) {
  if (!state.account) return '';
  const fills = state.account.events.filter(e => e.symbol === symbol && (e.type === 'fill' || e.type === 'div' || e.type === 'split')).slice(-6).reverse();
  const open = state.account.orders.filter(o => o.symbol === symbol && o.status === 'open');
  if (!fills.length && !open.length) return '';
  return sectionHtml(t('yourActivity'), `<div class="q-rowcard">${open.map(orderRow).join('')}${fills.map(activityRow).join('')}</div>`);
}
// What the ticket would do: the estimate, cash and shares at hand, the most
// that can be bought.
function ticketInfo() {
  const d = state.detail;
  const q = state.quotes.get(d.symbol);
  // Only the order types the market takes (Hong Kong: limit), at the last price.
  if (!orderTypes(q).includes(d.type)) {
    d.type = orderTypes(q)[0];
    d.limit = d.stop = startPrice(q);
  }
  const s = snap();
  const avail = s ? available(state.account, s) : { cash: {}, qty: {} };
  const qty = Number(d.qty);
  // What it fills at: a limit at its price; a market (or triggered stop)
  // order at the ask to buy or the bid to sell.
  const last = d.type === 'stop' ? (d.side === 'buy' ? Math.max(Number(d.stop), q.price) : Number(d.stop)) || q.price : q.price;
  const ref = d.type === 'limit' ? Number(d.limit) : marketFill(q.market, q.kind, d.side, last);
  const welcome = firstTrade(state.account);
  const cash = Math.max(0, avail.cash[q.currency] || 0);
  const shares = Math.max(0, avail.qty[d.symbol] || 0);
  // Taiwan: selling more than is held is 融券 (with the credit account) or a
  // day trade sold first; the estimate as the fill will be (the day-trade
  // tax, 融券's handling: lib/preview.mjs).
  const now = Date.now();
  const shorting = d.side === 'sell' && qty > shares + 1e-9;
  const twCredit = q.market === 'TW' && creditAccount(state.account, now).open;
  const twDayShort = q.market === 'TW' && !twCredit && dayTradeSellFirst(state.account, now);
  const est = qty > 0 && ref > 0 ? lotsEstimate(state.account, { quote: q, side: d.side, qty, price: ref, first: welcome, credit: shorting && twCredit, dayShort: shorting && twDayShort, held: heldQty(state.account, d.symbol, now), now }) : null;
  // The other currencies held and settled (what an exchange can take), NT$
  // first then the largest: what could be exchanged into this one.
  const free = s ? withdrawable(state.account, s) : {};
  const spare = c => Math.max(0, Math.min(avail.cash[c] || 0, free[c] || 0));
  const sources = Object.keys(avail.cash)
    .filter(c => c !== q.currency && spare(c) > 0 && state.rates[c] && state.rates[q.currency])
    .sort((a, b) => (b === BASE) - (a === BASE) || spare(b) * state.rates[b] - spare(a) * state.rates[a]);
  // Largest quantity whose held amount fits the cash, every other currency
  // that could be exchanged for it included.
  const fromOthers = sources.reduce((sum, c) => sum + (quoteExchange(c, q.currency, spare(c), state.rates, state.fxOpen)?.received || 0), 0);
  const spendable = cash + fromOthers;
  // 融資: a buy of what the broker lends against, lent its share as it fills
  // (only one's own part is needed now); 最大 within the credit limit left
  // (lib/preview.mjs marginRateFor, ticketMax).
  const hasCredit = creditAccount(state.account, now).open;
  const marginRate = marginRateFor(state.account, q, d.side, now);
  const credit = Boolean(d.credit) && marginRate > 0;
  const max = ticketMax(state.account, { quote: q, order: d, ref, spendable, margin: credit ? marginRate : 0, valuation: credit ? valuation() : null, now });
  // Exactly what the order will hold (placeOrder checks the same figure):
  // the estimate, plus a 3% buffer when it has to wait for its market.
  const req = d.side === 'buy' && est ? lotsHold({ type: d.type, qty, limit: Number(d.limit), stop: Number(d.stop), waitFresh: 1, margin: credit ? marginRate : 0 }, q, Date.now()) : null;
  const need = req ? req.reserve : 0;
  const short = d.side === 'buy' && est ? Math.max(0, need - cash) : 0;
  // Short of this currency: each currency held that covers it (spread
  // included), NT$ first. The first is done with the order in one tap; any
  // of them on its own, from its chip.
  const covers = short > 0 ? sources.map(from => ({ from, need: amountFor(from, q.currency, short, state.rates, state.fxOpen), get: short })).filter(c => c.need && spare(c.from) >= c.need) : [];
  const topUp = covers.length ? { ...covers[0], enough: true } : short > 0 ? { enough: false } : null;
  // 融資 is chosen on the ticket (a buy the broker lends part of); there's
  // no borrowing cash to cover a shortfall.
  const v0 = credit ? valuation() : null;
  const marginOk = !credit || v0?.margin === 'ok';
  // What 融資 lends: each order's trade value × 成數, the part under NT$1,000 not lent (the kit's rule).
  const lent = credit && est ? lotsLoan(q, qty, ref, marginRate) : 0;
  // How much can be sold short on top of what's held.
  let room = 0;
  // A day trade sold first: within the day's day-trade limit (當沖額度) left.
  const dayRoom = twDayShort && d.side === 'sell' ? dayTradeLeft(state.account, valuation()?.netWorth ?? 0, now) : null;
  // (Borrowing shares needs the credit account; in Taiwan a day trade sold first doesn't.)
  // (Never abroad: 複委託 is cash only.)
  if (d.side === 'sell' && isShortable(q.kind, q.symbol) && !cashOnly(q) && state.rates[q.currency] && (hasCredit || q.market === 'TW' || q.kind === 'fx'))
    room = shortRoom(valuation(), { unit: q.price * state.rates[q.currency], price: quotaPrice(q, d, now), kind: q.kind, credit: shortCredit(state.account, q.market, now), cash, dayLeft: dayRoom?.left ?? null, dayUnit: dayTradePrice(q, d, now) * state.rates[q.currency], held: shares, market: q.market });
  return { q, est, cash, shares, max, short, topUp, covers, sources, qty, ref, last, shortRoom: room, req, need, welcome, marginRate, credit, lent, marginOk, shorting, twCredit, twDayShort, dayRoom };
}

// The ticket's one floating button: what it does, and under it what it comes to (總共付出
// NT$162,500), so the total rides with the button instead of a second capsule beside it.
const placeLabel = (label, sum) => `<span class="place-do">${h(label)}</span>${sum ? `<small class="place-sum num">${h(sum[0])} ${h(sum[1])}</small>` : ''}`;
// The order ticket: a sheet of its own over the stock's, opened by 買進 / 賣出.
function openTrade(side) {
  const d = state.detail;
  if (!d) return;
  d.side = side;
  d.qty = '';
  d.msg = null;
  const dialog = kitSheet('trade', { cls: 'trade-sheet', detent: '' });
  dialog.scrollTop = 0;
  renderTicket();
}
function closeTrade() {
  const dialog = $('trade');
  if (!dialog?.open) return;
  (globalThis.orbitCloseSheet || (x => x.close()))(dialog);
}

// A segmented choice drawn as HTML: data-action and data-<attr> on each button, on(v) the one on.
const seg = (items, action, attr, on, cls = '') => kitUI.segHtml(items, items.find(([v]) => on(v))?.[0], { pressed: true, cls, attr: v => `data-action="${action}" data-${attr}="${h(v)}"` });
function renderTicket() {
  const box = $('trade-body');
  const d = state.detail;
  if (!box || !d || !$('trade')?.open) return;
  const q0 = state.quotes.get(d.symbol);
  const head = '';
  // (An option by its contract: its series is on the card below.)
  setHead($('trade'), `${h(t(d.side === 'buy' ? 'buy' : 'sell'))} ${h(stockMarkets.isOption?.(d.symbol) ? optContract(d.symbol) : nameOf(d.symbol, q0))}`);
  if (!state.account || !q0) {
    morph(box, `${head}<div class="empty"><div class="spinner"></div></div>`);
    return;
  }
  if (q0.kind === 'fut') return renderFutTicket(box, d, q0);
  if (q0.kind === 'opt') return renderOptTicket(box, d, q0);
  const { q, est, cash, shares, max, short, topUp, covers, sources, qty, ref, last, shortRoom, req, need, welcome, marginRate, credit, lent, marginOk, shorting, twCredit, twDayShort, dayRoom } = ticketInfo();
  const open = isOpen(q);
  const unit = unitOf(d.symbol);
  // A Taiwan market or stop order sells whole lots only (an odd lot takes limit orders), as ticketMax buys.
  const sellable = n => (oddLotNeedsLimit(q.market, q.kind, n, d.type) ? Math.floor(n / 1000) * 1000 : n);
  const presets =
    d.side === 'sell'
      ? [[t('pct25'), shares * 0.25], [t('pct50'), shares * 0.5], [t('all'), shares], ...(shortRoom > 0 ? [[t('maxShort'), shares + shortRoom]] : [])].map(([k, n]) => [k, sellable(ticketRound(q, 'sell', n))])
      : q.kind === 'govbond'
        ? [[t('max'), max], ['1', 1], ['10', 10], ['100', 100]]
        : q.kind === 'fx'
          ? [[t('max'), max], ['1,000', 1000], ['10,000', 10_000], ['100,000', 100_000]]
          : q.kind === 'crypto'
            ? [[t('max'), max], ['0.001', 0.001], ['0.01', 0.01], ['0.1', 0.1], ['1', 1]]
            : q.market === 'TW'
              ? [[t('max'), max], ['1', 1], ['100', 100], [t('oneLot'), 1000]]
              : [[t('max'), max], ['1', 1], ['10', 10], ['100', 100]];
  // Board-lot markets: sizes in whole lots.
  const lot = lotSize(q.market, q.symbol, q.kind);
  if (lot > 1) {
    // (Taiwan's lot is a 張: a warrant's 1,000 units.)
    const lots = n => [t(q.market === 'TW' ? 'lotsTw' : 'lotsN', { n }), n * lot];
    presets.splice(0, presets.length, ...(d.side === 'sell' ? [[t('all'), roundQty(shares, q.kind)], lots(1)] : [[t('max'), Math.floor(max / lot) * lot], lots(1), lots(5), lots(10)]));
  }
  const lines = est
    ? [
        [t('estPrice'), fmtPrice(est.price, q.currency)],
        [t('gross'), money(est.gross, q.currency)],
        ...(est.commission ? [[t('commission'), money(est.commission, q.currency)]] : []),
        ...(est.tax ? [[t(d.side === 'buy' ? 'buyTax' : 'sellTax'), money(est.tax, q.currency)]] : []),
        ...(est.fee ? [[t(est.handling ? 'shortFees' : 'exchangeFee'), money(est.fee, q.currency)]] : [])
      ]
    : [];
  const problems = [];
  // What the product needs opened or signed first (開戶與交易資格): said, with a button there.
  const fundRR = q.market === 'TWFUND' ? (state.about.get(d.symbol)?.facts?.risk ?? null) : null;
  const gate = accessGate(q, d, { rr: fundRR });
  if (gate) problems.push(errorText(gate));
  else if (q.market === 'TWFUND' && d.side === 'buy' && state.about.get(d.symbol)?.loading) problems.push(t('fundRiskWait'));
  if (shorting && !isShortable(q.kind, q.symbol)) problems.push(t('notEnoughShares', { have: fmtQty(shares) }));
  else if (shorting && cashOnly(q)) problems.push(t('err_cashOnlyHave', { have: fmtQty(shares) }));
  else if (shorting && !twCredit && !twDayShort && (q.market === 'TW' || (q.kind !== 'fx' && !creditAccount(state.account, Date.now()).open))) problems.push(t('err_creditNeeded'));
  else if (shorting && qty > shares + shortRoom + 1e-9) problems.push(t('shortTooBig', { max: fmtQty(shares + shortRoom) }));
  if (credit && !marginOk) problems.push(t('err_margin'));
  if (short > 0 && !topUp?.enough) problems.push(t('notEnoughCash', { cur: q.currency, have: money(cash, q.currency), short: money(short, q.currency) }));
  if (d.qty && !ticketStepOk(q, d.side, qty)) problems.push(t('err_qtyStep'));
  // Stock Connect: a STAR or ChiNext share is sold, never bought.
  const board = d.side === 'buy' ? northboundBlock(q) : null;
  if (board) problems.push(t('err_northboundBoard', { board: t(`cnBoard_${board}`) }));
  if (qty > 0 && oddLotNeedsLimit(q.market, q.kind, qty, d.type)) problems.push(t('err_oddLotLimit'));
  // A Hong Kong security not on HKEX's list of board lots can't be sized (the kit refuses it: lotUnknown).
  if (q.market === 'HK' && stockMarkets.hkLot && ['stock', 'etf', 'bond'].includes(q.kind) && !stockMarkets.hkLot(q.symbol)) problems.push(t('err_lotUnknown'));
  // Taiwan: whole lots and odd lots go in as two orders, placed in one tap (整零合併).
  const split = lotSplit(q.market, q.kind, qty);
  // The exchange's rules for the price typed.
  const typed = d.type === 'limit' ? Number(d.limit) : d.type === 'stop' ? Number(d.stop) : null;
  const band = priceLimits(q);
  if (typed > 0) {
    const tick = tickSize(q.market, q.kind, typed, q.symbol);
    if (!onTick(typed, tick)) problems.push(t('err_tick', { tick: num(tick, 4, 0) }));
    else if (band && d.type === 'limit' && (typed > band.up + 1e-9 || typed < band.down - 1e-9)) problems.push(t('err_priceLimit', { down: fmtPrice(band.down, q.currency), up: fmtPrice(band.up, q.currency) }));
  }
  // After Taiwan's close (to 14:30), what the order goes to: 盤後定價 for
  // whole lots at today's close, 盤後零股 for an odd lot, each matched once
  // at 14:30. One placed before its session takes orders (13:40 盤後零股,
  // 14:00 盤後定價) is refused on a kit that has TWSE's closing auction
  // (afterHoursWait), as brokers do; an older kit holds it until then.
  const afterLines = [];
  const twseSessions = typeof stockCredit.closingAuction === 'function';
  if (q.market === 'TW' && d.type !== 'stop' && afterHours(Date.now())) {
    const odd = qty > 0 && isOddLot(q.market, q.kind, qty);
    const parts = [[qty === 0 || qty >= 1000 || !odd, false], [odd, true]];
    for (const [has, isOdd] of parts) {
      if (!has) continue;
      const send = afterHoursSend(Date.now(), isOdd);
      const line = isOdd ? t('afterOddNote') : t('afterBoardNote', { close: qPrice(q) });
      if (send?.waits && twseSessions) {
        afterLines.push(line);
        if (qty > 0) problems.push(t('err_afterHoursWait', { from: clock(send.sends) }));
      } else afterLines.push(send?.waits ? `${line} ${t('afterSends', { time: clock(send.sends) })}` : line);
    }
  }
  // TWSE's closing call auction (13:25-13:30) takes whole lots at a limit only.
  const closing = twseSessions && q.market === 'TW' && d.type === 'market' && ['stock', 'etf', 'bond'].includes(q.kind) ? stockCredit.closingAuction(Date.now()) : null;
  if (closing && Date.now() < closing.match && lotParts(q.market, q.kind, qty).some(n => !isOddLot(q.market, q.kind, n))) problems.push(t('err_closingAuction', { match: clock(closing.match) }));
  // US pre- and post-market: a day limit order may go to it (盤前／盤後, `ext`).
  const extOk = extOffered(q, d);
  const usSession = usSessionOf(q);
  const halt = haltOf(q);
  const canPlace = est && !problems.length && !(short > 0) && marginOk;
  const rate = state.rates[q.currency];
  // Rule notes: only what applies to this order now.
  const notes = [
    shorting && isShortable(q.kind, q.symbol) && !problems.length
      ? (q.market !== 'TW' ? t('shortNote', { qty: fmtQty(qty - shares), unit, fee: rateText(SHORT_FEE) }) : twCredit ? t('shortNoteTw', { qty: fmtQty(qty - shares), unit, deposit: money(lotsDeposit(q.market, q.kind, shares, qty - shares, quotaPrice(q, d)), q.currency) }) : t('dayShortNote', { qty: fmtQty(qty - shares), unit })) +
        (!twCredit && q.market === 'TW' && dayRoom ? ` ${t('dayTradeLeft', { left: money(dayRoom.left, BASE), limit: money(dayRoom.limit, BASE) })}` : '')
      : '',
    ...afterLines,
    extOk && d.ext ? t('extNote') : '',
    alertOf(d.symbol, alertState) === 'punish' ? t('punishHelp') : '',
    split ? t(afterLines.length ? 'lotSplitNoteAfter' : 'lotSplitNote', { board: fmtQty(split.board), odd: fmtQty(split.odd) }) : '',
    topUp?.enough ? t('autoFxLine', { pay: money(topUp.need, BASE), get: money(topUp.get, q.currency) }) : '',
    credit && est ? t('creditNote', { rate: pct(loanRateAt(q.currency), { digits: 2, sign: false }) }) : '',
    q.market === 'TWFUND' ? t('fundNavNote', { date: fmtDate(stockMarkets.fundCutoff(Date.now())) }) : !open && !afterLines.length && !(extOk && d.ext) ? (q.kind === 'metal' ? t('closedMetal') : t('closedQueue')) : '',
    qty > 0 && isOddLot(q.market, q.kind, qty) && !afterLines.length ? t(open && !oddLotOpen(Date.now()) ? 'oddLotWait' : 'oddLotNote', { time: oddLotFirst() }) : '',
    d.side === 'sell' && heldMargin(d.symbol) > 0 ? t('sellSplit', { cash: fmtQty(Math.max(0, shares - heldMargin(d.symbol))), margin: fmtQty(heldMargin(d.symbol)), unit }) : ''
  ].filter(Boolean);
  const tick = tickSize(q.market, q.kind, q.price, q.symbol);
  morph(
    box,
    `${head}
    <div class="ticket">
      ${
        sheetHeroHtml({
          badge: heroLogo(d.symbol, q),
          eyebrow: bareSymbol(d.symbol),
          big: qPrice(q),
          unit: qUnit(q),
          move: heroMove(q),
          dir: dirClass(q.change),
          compact: true
        })
      }
      <div class="q-seg side-toggle" role="group">
        <button type="button" data-action="side" data-side="buy" class="buy" aria-pressed="${d.side === 'buy'}">${h(t('buy'))}</button>
        <button type="button" data-action="side" data-side="sell" class="sell" aria-pressed="${d.side === 'sell'}">${h(t('sell'))}</button>
      </div>
      ${orderTypes(q).length > 1 ? seg(orderTypes(q).map(x => [x, t(`otype_${x}`)]), 'otype', 'otype', v => d.type === v) : ''}
      ${d.type !== 'market' && q.kind !== 'crypto' && q.kind !== 'fx' ? seg(['day', 'gtc'].map(x => [x, t(`tif_${x}`, { n: GTC_DAYS })]), 'tif', 'tif', v => (d.tif || 'day') === v) : ''}
      ${extOk ? seg([['', t('session_regular')], ['1', t(`session_${usSession}`)]], 'ext', 'ext', v => Boolean(v) === Boolean(d.ext)) : ''}
      ${marginRate > 0 ? seg([['', t('cashBuy')], ['1', t('creditBuy', { n: Math.round(marginRate * 10) })]], 'credit', 'credit', v => Boolean(v) === credit) : ''}
      <div class="ticket-fields">
        <div class="q-stake ticket-stake" style="--n:${presets.filter(([, v]) => v > 0).length || 1}"><label class="q-stake-amt"><small>${h(t('quantity'))} · ${h(unit)}</small><input id="t-qty" class="num" inputmode="decimal" autocomplete="off" value="${h(d.qty)}" placeholder="0" /></label>${presets.filter(([, v]) => v > 0).length ? `<div class="q-stake-presets">${presets.filter(([, v]) => v > 0).map(([label, v]) => `<button type="button" data-action="qty" data-qty="${v}" title="${h(fmtQty(v))}" aria-pressed="${Number(d.qty) === v}">${h(label)}</button>`).join('')}</div>` : ''}</div>
        ${d.type === 'limit' ? `<label class="big-field"><span>${h(t('limitPrice'))}<em>${h(q.currency)}</em></span><input id="t-limit" class="num" inputmode="decimal" autocomplete="off" value="${h(d.limit)}" /></label>` : ''}
        ${d.type === 'stop' ? `<label class="big-field"><span>${h(t('stopPrice'))}<em>${h(q.currency)}</em></span><input id="t-stop" class="num" inputmode="decimal" autocomplete="off" value="${h(d.stop)}" /></label>` : ''}
      </div>
      <div class="q-tags ticket-tags">
        <span class="q-tag">${h(d.side === 'buy' ? t('cashAvail', { amount: money(cash, q.currency) }) : t('sharesAvail', { qty: fmtQty(shares), unit }))}</span>
        ${d.type !== 'market' && band ? `<span class="q-tag">${h(t('limitBand', { down: fmtPrice(band.down, q.currency), up: fmtPrice(band.up, q.currency) }))}</span>` : ''}
        ${d.type !== 'market' && tick ? `<span class="q-tag">${h(t('tickIs', { tick: num(tick, 4, 0) }))}</span>` : ''}
        ${d.side === 'buy' && sources.length ? `<button class="q-tag tint" type="button" data-action="ticket-fx" data-from="${h(sources[0])}" data-to="${h(q.currency)}">${h(t('fxOpen'))}</button>` : ''}
      </div>
      ${covers.length ? `<div class="chip-row">${covers.slice(0, 3).map(c => `<button class="q-chip" type="button" data-action="topup" data-from="${h(c.from)}" data-cur="${h(q.currency)}" data-need="${c.need}">${h(t('fxCover', { pay: money(c.need, c.from), get: money(c.get, q.currency) }))}</button>`).join('')}</div>` : ''}
      ${
        est
          ? `<dl class="preview">${lines.map(([k, v]) => `<div><dt>${h(k)}</dt><dd class="num">${h(v)}</dd></div>`).join('')}
          <div class="preview-total"><dt>${h(d.side === 'buy' ? t('totalCost') : t('totalProceeds'))}</dt><dd class="num"><strong>${h(money(est.total, q.currency))}</strong>${rate && q.currency !== BASE ? `<small>≈ ${h(money(est.total * rate, BASE))}</small>` : ''}</dd></div>
          ${credit ? `<div><dt>${h(t('creditLent', { n: Math.round(marginRate * 10) }))}</dt><dd class="num">${h(money(lent, q.currency))}</dd></div><div><dt>${h(t('creditOwn'))}</dt><dd class="num"><strong>${h(money(est.total - lent, q.currency))}</strong></dd></div>` : ''}
          ${req && req.buffer > 0 ? `<div class="preview-held"><dt>${h(t('heldUntilFill'))}<small>${h(d.type !== 'limit' && quotaPrice(q, d) > q.price ? t('bufferNoteUp', { up: fmtPrice(quotaPrice(q, d), q.currency) }) : t('bufferNote'))}</small></dt><dd class="num"><strong>${h(money(need, q.currency))}</strong></dd></div>` : ''}
          ${d.side === 'buy' ? `<div class="preview-have ${short > 0 ? 'short' : ''}"><dt>${h(t('youHave', { amount: '' }).trim())}</dt><dd class="num">${h(money(cash, q.currency))}</dd></div>` : ''}</dl>
          ${welcome ? `<p class="fee-welcome">${h(t('feeWelcome'))}</p>` : ''}`
          : ''
      }
      ${halt && Date.now() < halt.until ? `<p class="warn">${h(halt.level === 3 ? t('haltNoteDay') : t('haltNote', { level: halt.level, time: clock(halt.until) }))}</p>` : ''}
      ${problems.map(p => `<p class="warn">${h(p)}</p>`).join('')}${gateButton(gate)}
      ${notes.length ? `<ul class="rule-notes">${notes.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
      ${d.type !== 'limit' && est && !afterLines.length ? `<p class="foot-note">${h(t('spreadNote', { price: fmtPrice(ref, q.currency), last: fmtPrice(last, q.currency) }))}</p>` : ''}
      ${pricesLive() ? '' : `<p class="warn">${h(t('waitLive'))}</p>`}
      ${d.msg ? `<p class="${d.msg.kind === 'bad' ? 'warn' : 'ok-msg'}">${h(d.msg.text)}</p>` : ''}
      <div class="place-bar q-sheet-foot q-sf">${
        topUp?.enough && est && !problems.length
          ? `<button class="q-btn primary place ${d.side}" type="button" data-action="place-fx" data-from="${h(topUp.from)}" data-need="${topUp.need}" ${pricesLive() ? '' : 'disabled'}>${placeLabel(t('autoFx'), est && [d.side === 'buy' ? t('totalCost') : t('totalProceeds'), money(est.total, q.currency)])}</button>`
          : `<button class="q-btn primary place ${d.side}" type="button" data-action="place" ${canPlace && pricesLive() ? '' : 'disabled'}>${placeLabel(d.side === 'buy' ? t('placeBuy') : t('placeSell'), est && [d.side === 'buy' ? t('totalCost') : t('totalProceeds'), money(est.total, q.currency)])}</button>`
      }</div>
    </div>`
  );
}
// A future's ticket (期貨): contracts (口), long or short, margin not the
// contract's value: what it opens holds TAIFEX's initial margin, what it
// closes frees it.
// What a TAIFEX order has to trade with: the futures account's money free
// once it's its own (futSplit), else the NT$ cash.
function futFree(s) {
  if (!s) return 0;
  const a = available(state.account, s);
  return Math.max(0, s.futSplit ? a.fut || 0 : a.cash[BASE] || 0);
}
function futTicket(d, q) {
  if (!['market', 'limit'].includes(d.type)) {
    d.type = 'market';
    d.limit = String(q.price);
  }
  const s = snap();
  const cash = futFree(s);
  const held = s?.positions[d.symbol]?.qty || 0;
  const f = stockMarkets.futureOf(d.symbol);
  const [im, mm] = stockAccount.futMargin(d.symbol, q);
  const qty = Number(d.qty);
  const ref = d.type === 'limit' ? Number(d.limit) : marketFill(q.market, q.kind, d.side, q.price);
  const closable = held * (d.side === 'buy' ? 1 : -1) < 0 ? Math.abs(held) : 0;
  const opening = qty > 0 ? stockAccount.futOpening(held, d.side, qty) : 0;
  const est = qty > 0 && ref > 0 ? stockAccount.estimate({ market: q.market, kind: 'fut', currency: BASE, side: d.side, qty, price: ref, symbol: d.symbol, first: firstTrade(state.account) }) : null;
  const need = est ? Math.round(opening * im + est.costs) : 0;
  const perOpen = im + f.fee + Math.round(ref * f.mult * stockMarkets.FUT_TAX);
  const max = closable + Math.max(0, Math.floor(cash / perOpen));
  const expiry = stockMarkets.futureExpiry(d.symbol);
  return { s, cash, held, f, im, mm, qty, ref, closable, opening, est, need, max, expiry };
}
function renderFutTicket(box, d, q) {
  const { cash, held, f, im, mm, qty, closable, opening, est, need, max, expiry } = futTicket(d, q);
  const unit = unitOf(d.symbol);
  const problems = [];
  const gate = accessGate(q, d, { opening });
  if (gate) problems.push(errorText(gate));
  if (Date.now() >= expiry) problems.push(t('err_futExpired'));
  if (d.qty && !(Number.isInteger(qty) && qty > 0)) problems.push(t('err_qtyStep'));
  if (est && need > cash + 1e-9) problems.push(t('futMarginShort', { need: money(need, BASE), have: money(cash, BASE) }));
  const presets = [...(closable ? [[t('futCloseAll'), closable]] : []), [t('max'), max], ['1', 1], ['2', 2], ['5', 5]].filter(([, v]) => v > 0);
  const lines = est
    ? [
        [t('estPrice'), qAmt(q, est.price)],
        [t('futValue'), money(est.price * f.mult * qty, BASE)],
        ...(opening ? [[t('futMarginLine', { n: fmtQty(opening) }), money(opening * im, BASE)], [t('futMmLine'), money(opening * mm, BASE)]] : []),
        ...(est.commission ? [[t('commission'), money(est.commission, BASE)]] : []),
        ...(est.tax ? [[t('futTax'), money(est.tax, BASE)]] : [])
      ]
    : [];
  // (The contract's terms are tags; a note only for what this order does.)
  const notes = [
    closable && qty > 0 ? t(qty > closable ? 'futFlipNote' : 'futCloseNote', { n: fmtQty(Math.min(qty, closable)), more: fmtQty(Math.max(0, qty - closable)) }) : '',
    !isOpen(q) ? t('closedQueue') : ''
  ].filter(Boolean);
  const canPlace = est && !problems.length;
  morph(
    box,
    `<div class="ticket">
      ${sheetHeroHtml({ badge: heroLogo(d.symbol, q), eyebrow: bareSymbol(d.symbol), big: qPrice(q), unit: qUnit(q), move: heroMove(q), dir: dirClass(q.change), compact: true })}
      <div class="q-seg side-toggle" role="group">
        <button type="button" data-action="side" data-side="buy" class="buy" aria-pressed="${d.side === 'buy'}">${h(futSide('buy', held))}</button>
        <button type="button" data-action="side" data-side="sell" class="sell" aria-pressed="${d.side === 'sell'}">${h(futSide('sell', held))}</button>
      </div>
      ${seg(['market', 'limit'].map(x => [x, t(`otype_${x}`)]), 'otype', 'otype', v => d.type === v)}
      <div class="ticket-fields">
        <div class="q-stake ticket-stake" style="--n:${presets.length || 1}"><label class="q-stake-amt"><small>${h(t('quantity'))} · ${h(unit)}</small><input id="t-qty" class="num" inputmode="numeric" autocomplete="off" value="${h(d.qty)}" placeholder="0" /></label>${presets.length ? `<div class="q-stake-presets">${presets.map(([label, v]) => `<button type="button" data-action="qty" data-qty="${v}" aria-pressed="${Number(d.qty) === v}">${h(label)}</button>`).join('')}</div>` : ''}</div>
        ${d.type === 'limit' ? `<label class="big-field"><span>${h(t('limitPrice'))}<em>${h(qUnit(q))}</em></span><input id="t-limit" class="num" inputmode="${f.stock ? 'decimal' : 'numeric'}" autocomplete="off" value="${h(d.limit)}" /></label>` : ''}
      </div>
      <div class="q-tags ticket-tags">
        <span class="q-tag">${h(t(snap()?.futSplit ? 'futAvail' : 'cashAvail', { amount: money(cash, BASE) }))}</span>
        <span class="q-tag">${h(t('optDueTag', { date: shortDate(expiry) }))}</span>
        <span class="q-tag">${h(f.stock ? t('perContract', { n: fmtQty(f.mult), unit: t(f.etf ? 'units' : 'shares') }) : t('perPoint', { mult: money(f.mult, BASE) }))}</span>
        ${held ? `<span class="q-tag">${h(t(held > 0 ? 'futHeldLong' : 'futHeldShort', { n: fmtQty(Math.abs(held)) }))}</span>` : ''}
      </div>
      ${
        est
          ? `<dl class="preview">${lines.map(([k, v]) => `<div><dt>${h(k)}</dt><dd class="num">${h(v)}</dd></div>`).join('')}
          <div class="preview-total"><dt>${h(t('futNeed'))}</dt><dd class="num"><strong>${h(money(need, BASE))}</strong></dd></div>
          <div class="preview-have ${need > cash + 1e-9 ? 'short' : ''}"><dt>${h(t('youHave', { amount: '' }).trim())}</dt><dd class="num">${h(money(cash, BASE))}</dd></div></dl>`
          : ''
      }
      ${problems.map(p => `<p class="warn">${h(p)}</p>`).join('')}${gateButton(gate)}${futInButton(need > cash + 1e-9 && !gate)}
      ${notes.length ? `<ul class="rule-notes">${notes.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
      ${pricesLive() ? '' : `<p class="warn">${h(t('waitLive'))}</p>`}
      ${d.msg ? `<p class="${d.msg.kind === 'bad' ? 'warn' : 'ok-msg'}">${h(d.msg.text)}</p>` : ''}
      <div class="place-bar q-sheet-foot q-sf"><button class="q-btn primary place ${d.side}" type="button" data-action="place" ${canPlace && pricesLive() ? '' : 'disabled'}>${placeLabel(futSide(d.side, held), est && [t('futNeed'), money(need, BASE)])}</button></div>
    </div>`
  );
}

// An option's ticket figures (選擇權): contracts (口) bought paid in full
// (the premium, NT$50 a point), or sold: what's held closed first, the rest
// written on TAIFEX's margin.
function optTicket(d, q) {
  if (!['market', 'limit'].includes(d.type)) {
    d.type = 'market';
    d.limit = String(q.price);
  }
  const s = snap();
  const cash = futFree(s);
  // Held (bought) or written (sold first): a sale past what's held writes the rest.
  const pos = s?.positions[d.symbol]?.qty || 0;
  const held = Math.max(0, pos);
  const written = Math.max(0, -pos);
  const mult = stockMarkets.OPTION.mult;
  const qty = Number(d.qty);
  const ref = d.type === 'limit' ? Number(d.limit) : marketFill(q.market, q.kind, d.side, q.price);
  const est = qty > 0 && ref > 0 ? stockAccount.estimate({ market: q.market, kind: 'opt', currency: BASE, side: d.side, qty, price: ref, symbol: d.symbol, first: firstTrade(state.account) }) : null;
  const costs1 = ref > 0 ? stockMarkets.OPTION.fee + Math.round(ref * mult * stockMarkets.OPT_TAX) : 0;
  const per = ref > 0 ? ref * mult + costs1 : 0;
  // Writing one: TAIFEX's margin a contract, of which the premium coming in pays part.
  const im = ref > 0 ? stockMarkets.optWriteMargin(d.symbol, ref, q.index, q.optMargin) : 0;
  const perWrite = im - ref * mult + costs1;
  const write = d.side === 'sell' ? Math.max(0, qty - held) : 0;
  const writeNeed = est && write > 0 ? Math.max(0, Math.round(write * (im - ref * mult) + est.costs)) : 0;
  // (Buying back what's written frees its margin.)
  const freedAll = written * (s?.positions[d.symbol]?.im || 0);
  const freed = d.side === 'buy' ? Math.min(qty || 0, written) * (s?.positions[d.symbol]?.im || 0) : 0;
  const max = d.side === 'sell' ? held + (perWrite > 0 ? Math.max(0, Math.floor(cash / perWrite)) : 0) : per > 0 ? Math.max(written, Math.floor((cash + freedAll) / per)) : 0;
  const side = d.side === 'buy' ? t(written ? 'optBuyClose' : 'optBuy') : t(held ? 'optSell' : 'optSellOpen');
  // The figure the order turns on: paid, received, or (writing) the margin it needs.
  const sum = !est ? null : write > 0 ? [t('optWriteNeed'), writeNeed] : [t(d.side === 'buy' ? 'optPay' : 'optGet'), est.total];
  return { cash, held, written, mult, qty, ref, est, im, write, writeNeed, freed, max, side, sum, expiry: expiryOf(d.symbol) };
}
// A future's side as its ticket names it: opening, or closing what's held.
const futSide = (side, held) => t(side === 'buy' ? (held < 0 ? 'futBuyClose' : 'futLong') : held > 0 ? 'futSellClose' : 'futShort');
// The option's own row on its ticket: 買權 / 賣權, and its strike a step
// either way (the strikes the chain lists for its series).
function optContractHtml(d) {
  const o = stockMarkets.optionOf(d.symbol);
  const other = r => stockMarkets.optionSymbol(o.series, r, o.strike);
  const strikes = optStrikes(o.series);
  const lower = strikes.filter(k => k < o.strike).at(-1);
  const higher = strikes.find(k => k > o.strike);
  const step = (k, label, aria) => `<button class="q-press" type="button" ${k ? `data-action="opt-to" data-symbol="${h(stockMarkets.optionSymbol(o.series, o.right, k))}"` : 'disabled'} aria-label="${h(aria)}">${label}</button>`;
  return `<div class="opt-contract">
    ${seg([[other('C'), t('optCall')], [other('P'), t('optPut')]], 'opt-to', 'symbol', v => v === d.symbol, 'opt-right')}
    <div class="opt-step" role="group">${step(lower, '−', t('optLower'))}<span><small>${h(t('optStrike'))}</small><b class="num">${h(num(o.strike, 0, 0))}</b></span>${step(higher, '+', t('optHigher'))}</div>
  </div>`;
}
// (The contracts a tap away read ahead, once each: a switch shows its price at once.)
const optAsked = new Set();
function optNeighbours(symbol) {
  const o = stockMarkets.optionOf(symbol);
  const strikes = optStrikes(o.series);
  const near = [strikes.filter(k => k < o.strike).at(-1), o.strike, strikes.find(k => k > o.strike)].filter(Boolean);
  const want = near.flatMap(k => ['C', 'P'].map(r => stockMarkets.optionSymbol(o.series, r, k))).filter(x => !state.quotes.has(x) && !optAsked.has(x));
  if (!want.length) return;
  want.forEach(x => optAsked.add(x));
  fetchQuotes(want)
    .then(quotes => {
      absorb(quotes);
      if ($('trade')?.open) renderTicket();
    })
    .catch(() => {});
}
// Another contract from the option's ticket (its other right, the next
// strike): the sheet and the ticket move to it, side and size kept.
async function retargetOption(symbol) {
  const d = state.detail;
  if (!d || d.symbol === symbol || !stockMarkets.isOption?.(symbol)) return;
  const q0 = state.quotes.get(symbol);
  Object.assign(d, { symbol, chart: null, chartError: false, msg: null, held: Boolean(snap()?.positions[symbol]), limit: startPrice(q0), stop: startPrice(q0) });
  track(symbolKeys(symbol), 1);
  renderDetail();
  loadChart();
  if (q0?.got > Date.now() - QUOTE_FRESH_MS) return;
  try {
    absorb(await fetchQuotes([symbol]));
  } catch {}
  if (state.detail?.symbol !== symbol) return;
  if (!d.limit) d.limit = d.stop = startPrice(state.quotes.get(symbol));
  renderDetail();
  if (d.range === '1d' && !d.chart) loadChart();
}
// An option's ticket: the stock ticket's layout, with the contract's own row.
function renderOptTicket(box, d, q) {
  const { cash, held, written, mult, qty, est, im, write, writeNeed, freed, max, side, sum, expiry } = optTicket(d, q);
  optSeries();
  optNeighbours(d.symbol);
  const unit = unitOf(d.symbol);
  const problems = [];
  // (What it opens, long or written: a 期貨帳戶 first.)
  const gate = accessGate(q, d, { opening: qty > 0 ? stockAccount.futOpening(held || -written || 0, d.side, qty) : 0 });
  if (gate) problems.push(errorText(gate));
  if (Date.now() >= expiry) problems.push(t('err_futExpired'));
  if (d.qty && !(Number.isInteger(qty) && qty > 0)) problems.push(t('err_qtyStep'));
  if (writeNeed > cash + 1e-9) problems.push(t('err_optNoWrite', { need: money(writeNeed, BASE), have: money(cash, BASE) }));
  if (est && d.side === 'buy' && est.total > cash + freed + 1e-9) problems.push(t('err_funds', { need: money(est.total, BASE), have: money(cash + freed, BASE) }));
  const allLabel = d.side === 'sell' ? (held ? t('optSellAll') : t('max')) : written ? t('optSellAll') : t('max');
  // (Always 1, 2 and 5 beside 全部 / 最多: an even row, a size too big said below it.)
  const presets = [[allLabel, d.side === 'sell' && held ? held : d.side === 'buy' && written ? written : max], ['1', 1], ['2', 2], ['5', 5]].filter(([, v]) => v > 0);
  const lines = est
    ? [
        [t('estPrice'), num(est.price, 1, 0)],
        [t('optPremium'), money(est.gross, BASE)],
        ...(est.commission ? [[t('commission'), money(est.commission, BASE)]] : []),
        ...(est.tax ? [[t('futTax'), money(est.tax, BASE)]] : []),
        ...(write > 0 ? [[t('optWriteMargin', { n: fmtQty(write) }), money(write * im, BASE)]] : [])
      ]
    : [];
  // In or out of the money, against the futures it's priced on (its 內含價值).
  const gap = Number.isFinite(q.underlying) ? (q.right === 'C' ? 1 : -1) * (q.underlying - q.strike) : null;
  const money1 = gap == null ? '' : Math.abs(gap) < 1 ? t('optAtm') : t(gap > 0 ? 'optItm' : 'optOtm', { n: num(Math.abs(gap), 0, 0) });
  const notes = [d.side === 'sell' && (write > 0 || written) ? t('optWriteNote') : t('optBuyNote'), !isOpen(q) ? t('closedQueue') : ''].filter(Boolean);
  const canPlace = est && !problems.length;
  morph(
    box,
    `<div class="ticket">
      ${sheetHeroHtml({ badge: heroLogo(d.symbol, q), eyebrow: optSeriesName(d.symbol), big: qPrice(q), unit: t('futPoints'), move: heroMove(q, num(Math.abs(q.change), 1, 0)), dir: dirClass(q.change), compact: true })}
      ${optContractHtml(d)}
      <div class="q-seg side-toggle" role="group">
        <button type="button" data-action="side" data-side="buy" class="buy" aria-pressed="${d.side === 'buy'}">${h(t(written ? 'optBuyClose' : 'optBuy'))}</button>
        <button type="button" data-action="side" data-side="sell" class="sell" aria-pressed="${d.side === 'sell'}">${h(t(held ? 'optSell' : 'optSellOpen'))}</button>
      </div>
      ${seg(['market', 'limit'].map(x => [x, t(`otype_${x}`)]), 'otype', 'otype', v => d.type === v)}
      <div class="ticket-fields">
        <div class="q-stake ticket-stake" style="--n:${presets.length || 1}"><label class="q-stake-amt"><small>${h(t('quantity'))} · ${h(unit)}</small><input id="t-qty" class="num" inputmode="numeric" autocomplete="off" value="${h(d.qty)}" placeholder="0" /></label>${presets.length ? `<div class="q-stake-presets">${presets.map(([label, v]) => `<button type="button" data-action="qty" data-qty="${v}" aria-pressed="${Number(d.qty) === v}">${h(label)}</button>`).join('')}</div>` : ''}</div>
        ${d.type === 'limit' ? `<label class="big-field"><span>${h(t('limitPrice'))}<em>${h(t('futPoints'))}</em></span><input id="t-limit" class="num" inputmode="decimal" autocomplete="off" value="${h(d.limit)}" /></label>` : ''}
      </div>
      <div class="q-tags ticket-tags">
        <span class="q-tag">${h(t(snap()?.futSplit ? 'futAvail' : 'cashAvail', { amount: money(cash, BASE) }))}</span>
        ${money1 ? `<span class="q-tag">${h(money1)}</span>` : ''}
        <span class="q-tag">${h(t('optDueTag', { date: shortDate(expiry) }))}</span>
        <span class="q-tag">${h(t('perPoint', { mult: money(mult, BASE) }))}</span>
        ${held ? `<span class="q-tag">${h(t('optHeld', { n: fmtQty(held) }))}</span>` : ''}
        ${written ? `<span class="q-tag">${h(t('optShortHeld', { n: fmtQty(written) }))}</span>` : ''}
      </div>
      ${
        est
          ? `<dl class="preview">${lines.map(([k, v]) => `<div><dt>${h(k)}</dt><dd class="num">${h(v)}</dd></div>`).join('')}
          <div class="preview-total"><dt>${h(sum[0])}</dt><dd class="num"><strong>${h(money(sum[1], BASE))}</strong></dd></div>
          ${d.side === 'buy' || write > 0 ? `<div class="preview-have ${problems.length ? 'short' : ''}"><dt>${h(t('youHave', { amount: '' }).trim())}</dt><dd class="num">${h(money(cash, BASE))}</dd></div>` : ''}</dl>`
          : ''
      }
      ${problems.map(p => `<p class="warn">${h(p)}</p>`).join('')}${gateButton(gate)}${futInButton(!gate && (writeNeed > cash + 1e-9 || Boolean(est && d.side === 'buy' && est.total > cash + freed + 1e-9)))}
      <ul class="rule-notes">${notes.map(x => `<li>${h(x)}</li>`).join('')}</ul>
      ${pricesLive() ? '' : `<p class="warn">${h(t('waitLive'))}</p>`}
      ${d.msg ? `<p class="${d.msg.kind === 'bad' ? 'warn' : 'ok-msg'}">${h(d.msg.text)}</p>` : ''}
      <div class="place-bar q-sheet-foot q-sf"><button class="q-btn primary place ${d.side}" type="button" data-action="place" ${canPlace && pricesLive() ? '' : 'disabled'}>${placeLabel(side, sum && [sum[0], money(sum[1], BASE)])}</button></div>
    </div>`
  );
}

function placeFromTicket() {
  const d = state.detail;
  const q = state.quotes.get(d.symbol);
  if (!q || !state.account || !pricesLive()) return;
  const req = { symbol: d.symbol, side: d.side, type: d.type, qty: Number(d.qty), fresh: true, ...(d.side === 'buy' && d.credit && !cashOnly(q) && collateralRate(q.kind, q.market, q.symbol) > 0 ? { margin: true } : {}) };
  if (d.type === 'limit') req.limit = Number(d.limit);
  if (d.type === 'stop') req.stop = Number(d.stop);
  if (d.type !== 'market' && d.tif === 'gtc') req.tif = 'gtc';
  if (d.ext && extOffered(q, d)) req.ext = true;
  // A Taiwan fund's 風險收益等級, checked against your KYC (stock-access).
  if (q.market === 'TWFUND' && d.side === 'buy') req.rr = state.about.get(d.symbol)?.facts?.risk ?? null;
  // A mixed Taiwan quantity goes in as two orders (lib/preview.mjs placeLots).
  const { account, parts, failed } = placeLots(state.account, req, { quote: q, rates: state.rates, valuation: valuation(), now: Date.now(), halt: haltNow() }, place);
  if (account) {
    commit(account);
    track(symbolKeys(d.symbol), 3);
  }
  const r = parts[0]?.r;
  if (failed && parts.length === 2) {
    // The 整股 order went in and stays; the 零股 one didn't: said so, its quantity left on the ticket to try again.
    d.msg = { kind: 'bad', text: t('lotOddFailed', { board: fmtQty(parts[0].qty), odd: fmtQty(failed.qty), why: errorText(failed.r) }) };
    toast(d.msg.text, 'bad');
    d.qty = String(failed.qty);
  } else if (failed && !account) {
    d.msg = { kind: 'bad', text: errorText(failed.r) };
  } else {
    if (parts.length === 2) {
      d.msg = { kind: 'good', text: t('lotsPlaced', { board: fmtQty(parts[0].qty), odd: fmtQty(parts[1].qty) }) };
      toast(d.msg.text, 'good');
    } else if (r.fill?.kind === 'opt') {
      d.msg = { kind: 'good', text: t('optFilledMsg', { side: t(r.fill.side), qty: fmtQty(r.fill.qty), price: num(r.fill.price, 1, 0), total: money(r.fill.total, BASE) }) };
      toast(d.msg.text, 'good');
    } else if (r.fill?.kind === 'fut') {
      d.msg = { kind: 'good', text: t('futFilledMsg', { side: t(r.fill.side), qty: fmtQty(r.fill.qty), price: num(r.fill.price, 0, 0) }) };
      toast(d.msg.text, 'good');
    } else if (r.fill) {
      d.msg = { kind: 'good', text: t('filledMsg', { side: t(r.fill.side), qty: fmtQty(r.fill.qty), price: fmtPrice(r.fill.price, r.fill.currency), total: money(r.fill.total, r.fill.currency) }) };
      toast(d.msg.text, 'good');
    } else if (r.order.status === 'rejected') {
      d.msg = { kind: 'bad', text: errorText(r) };
    } else {
      d.msg = { kind: 'good', text: t('queuedMsg') };
      toast(t('queuedMsg'), 'good');
    }
    d.qty = '';
    // Placed: the ticket goes, the stock's sheet shows the order under it.
    if (d.msg.kind === 'good') closeTrade();
  }
  renderDetail();
  render();
}

// Every order goes in at once and is held as a 委託單 until the proxy fills
// it at its own fresh price (placeOrder's `fresh`), never at the figure the
// screen showed: the proxy is asked at once, with the quote read beside it,
// again a few times if either fails; after that the usual asks (askFills).
// (An older kit without the proxy's fills: filled at the fresh quote.)
async function atFreshPrice(place) {
  const symbol = state.detail?.symbol;
  if (!symbol) return;
  place();
  const waiting = () => (state.account?.orders || []).filter(o => o.status === 'open' && o.waitFresh && o.symbol === symbol).map(o => `${o.id}:${o.rev}`).join();
  for (let i = 0; i < 6; i++) {
    const before = waiting();
    const [quotes, asked] = await Promise.all([fetchQuotes([symbol]).catch(() => null), stockAccount.applyFills ? askFills(state.account, { now: true }).catch(() => false) : true]);
    if (quotes) {
      absorb(quotes);
      afterPrices();
    }
    // Redrawn when the quote came or an order changed (a fill already redrew).
    if (quotes || waiting() !== before) {
      render();
      if (state.detail?.symbol === symbol) renderDetail();
    }
    if (!waiting() || (quotes && asked && stockAccount.applyFills)) return;
    await new Promise(ok => setTimeout(ok, 5_000));
  }
}

// Every order asks first: what it is and about what it costs, all in.
function confirmOrder() {
  const d = state.detail;
  if (!d) return Promise.resolve(false);
  if (isTaifex(d.symbol)) return confirmContracts(d);
  const { q, est, qty, credit, lent } = ticketInfo();
  if (!q || !(qty > 0)) return Promise.resolve(false);
  const total = est ? money(est.total, q.currency) : '';
  const split = lotSplit(q.market, q.kind, qty);
  return askKit({
    lang: locale,
    icon: d.side === 'buy' ? '📈' : '📉',
    title: t(d.side === 'buy' ? 'orderAskBuy' : 'orderAskSell', { name: nameOf(d.symbol, q) }),
    body: [credit && est ? t('orderAskBodyCredit', { qty: fmtQty(qty), total, lent: money(lent, q.currency), own: money(est.total - lent, q.currency) }) : t(!total ? 'orderAskQty' : d.side === 'buy' ? 'orderAskBody' : 'orderAskBodySell', { qty: fmtQty(qty), total }), split ? t('orderAskSplit', { board: fmtQty(split.board), odd: fmtQty(split.odd) }) : ''].filter(Boolean).join(' '),
    ok: t(d.side === 'buy' ? 'placeBuy' : 'placeSell'),
    cancel: t('orderAskCancel')
  });
}
// A future's or option's order asks in contracts (口) and the figure it turns
// on: what's paid or received, or the margin it holds.
function confirmContracts(d) {
  const q = state.quotes.get(d.symbol);
  const qty = Number(d.qty);
  if (!q || !(qty > 0)) return Promise.resolve(false);
  const opt = q.kind === 'opt';
  const f = opt ? optTicket(d, q) : futTicket(d, q);
  const side = opt ? f.side : futSide(d.side, f.held);
  const [what, total] = opt ? f.sum || [t('optPay'), 0] : [t('futNeed'), f.need];
  return askKit({
    lang: locale,
    icon: d.side === 'buy' ? '📈' : '📉',
    title: t('orderAskSide', { side, name: opt ? optContract(d.symbol) : nameOf(d.symbol, q) }),
    body: `${opt ? `${optSeriesName(d.symbol)} · ` : ''}${t('orderAskContracts', { qty: fmtQty(qty), what, total: money(total, BASE) })}`,
    ok: side,
    cancel: t('orderAskCancel')
  });
}
// Short of the currency: exchanged first (from NT$, or the currency that
// covers it), then the order.
async function placeWithFx(need, from = BASE) {
  const d = state.detail;
  if (!d) return;
  const cur = state.quotes.get(d.symbol)?.currency;
  const fq = quoteExchange(from, cur, need, state.rates, state.fxOpen);
  if (fq && fxDeclare(from, cur, need, fq.received) && !(await askKit({ lang: locale, icon: '🧾', title: t('fxAsk', { from: money(need, from), to: money(fq.received, cur) }), body: t('fxDeclareBody'), ok: t('fxDeclareOk'), cancel: t('orderAskCancel') }))) return;
  const r = exchange(state.account, { from, to: cur, amount: need }, { rates: state.rates, fxOpen: state.fxOpen, now: Date.now() });
  if (r.error) {
    d.msg = { kind: 'bad', text: errorText(r) };
    return renderTicket();
  }
  commit(r.account);
  toast(t('autoFxDone', { pay: money(r.event.amount, r.event.from), get: money(r.event.received, r.event.to) }), 'good');
  placeFromTicket();
}

function errorText(r) {
  switch (r.error) {
    case 'funds':
      return t('err_funds', { need: money(r.need, r.currency || state.quotes.get(state.detail?.symbol)?.currency || BASE), have: money(r.have ?? 0, r.currency || BASE) });
    case 'shares':
      return t('err_shares');
    case 'capacity':
      return t('err_capacity', { cap: money(r.capacity, BASE) });
    case 'shortMargin':
      return t('err_shortMargin', { max: fmtQty(r.max) });
    case 'dayTradeNeeded':
      return t('err_dayTradeNeeded', { have: fmtQty(r.have ?? 0) });
    case 'noDayTrade':
      return t('err_noDayTrade', { have: fmtQty(r.have ?? 0) });
    case 'navOnly':
      return t('err_navOnly');
    case 'futExpired':
      return t('err_futExpired');
    case 'optNoWrite':
      return t('err_optNoWrite', { need: money(r.need ?? 0, BASE), have: money(r.have ?? 0, BASE) });
    case 'dayTradeLimit':
      return t('err_dayTradeLimit', { room: money(r.room ?? 0, BASE), limit: money(r.limit ?? 0, BASE) });
    case 'creditLimit':
      return t('err_creditLimit', { room: money(r.room ?? 0, BASE), limit: money(r.limit ?? 0, BASE) });
    case 'termEarly':
      return t('err_termEarly', { date: fmtDate(r.from) });
    case 'unsettled':
      return t('err_unsettled', { have: money(r.have ?? 0, r.currency || BASE) });
    case 'tick':
      return t('err_tick', { tick: num(r.tick, 4, 0) });
    case 'priceLimit': {
      const cur = state.quotes.get(state.detail?.symbol)?.currency || BASE;
      return t('err_priceLimit', { down: fmtPrice(r.down, cur), up: fmtPrice(r.up, cur) });
    }
    case 'lot':
      return t('err_lot', { lot: fmtQty(r.lot) });
    case 'mixedLot':
      return t('err_mixedLot', { lots: fmtQty(r.lots), odd: fmtQty(r.odd) });
    case 'tPlus1':
      return t('err_tPlus1', { can: fmtQty(r.can) });
    case 'tdMin':
      return t('err_tdMin', { min: money(r.min, BASE) });
    case 'lendLot':
      return t('err_lendLot', { lot: fmtQty(r.lot) });
    case 'lendQty':
      return t('err_lendQty', { can: fmtQty(r.can) });
    case 'closingAuction':
      return t('err_closingAuction', { match: clock(r.match) });
    case 'afterHoursWait':
      return t('err_afterHoursWait', { from: clock(r.from) });
    case 'planAmount':
      return t('err_planAmount', { min: money(r.min ?? PLAN_MIN, BASE) });
    case 'cashOnly':
      return r.have != null ? t('err_cashOnlyHave', { have: fmtQty(r.have) }) : t('err_cashOnly');
    case 'northboundBoard': {
      const board = r.board === 'chinext' ? 'chinext' : 'star';
      return t('err_northboundBoard', { board: t(`cnBoard_${board}`) });
    }
    case 'planDay':
      return t('err_planDay', { max: planDayMax() });
    case 'lendRate':
      return t('err_lendRate', { min: rateText(r.min), max: rateText(r.max) });
    case 'lendNoTaker':
      return t('err_lendNoTaker', { rate: lendPct(r.rate) });
    case 'accessNeeded':
      return r.pending ? t('err_accessPending', { what: t(`acc_${r.key}`), date: shortDate(r.pending) }) : t(`err_access_${r.key}`);
    case 'fundRisk':
      return t('err_fundRisk', { rr: r.rr, max: r.max ?? 0, level: r.level ? t(`kyc_${r.level}`) : '' });
    case 'proOnly':
      return r.etn ? t('err_proOnlyEtn') : t('err_proOnly', { x: `${r.inverse ? '−' : ''}${r.mult}` });
    case 'fxYearCap':
      return t('err_fxYearCap', { left: money(r.leftUSD ?? 0, 'USD'), cap: money(r.capUSD ?? 5_000_000, 'USD') });
    case 'fullDelivery':
      return t(`err_fullDelivery_${r.part}`, { have: fmtQty(r.have ?? 0), need: money(r.need ?? 0, BASE), cash: money(r.have ?? 0, BASE) });
    case 'futOut':
      return t('err_futOut', { have: money(r.have ?? 0, BASE) });
    case 'liCheck':
      return t('err_liCheck', { n: (r.wrong || []).length + (r.missing || []).length });
    case 'accessDocs':
      return t('err_accessDocs');
    case 'accessNeeds':
      return (r.needs || []).map(accessNeedText).join(t('listSep'));
    default:
      return t(`err_${r.error}`);
  }
}

// ---- Portfolio tab ----------------------------------------------------------------------

// NT$ cash below zero: the Orbit pool is overdrawn (1% a month, charged by
// the Worker). What it takes to cover it, and the sales that would.
const overdrawnBy = v => Math.max(0, -(v.cash.find(c => c.currency === BASE)?.amount ?? 0));
// What the open sell orders of holdings would bring in (NT$, at today's
// prices): an overdraft they cover is being dealt with (placed while the
// market is shut, say), so it isn't asked for again.
function pendingSales(v, account = state.account) {
  const unit = new Map(v.positions.filter(p => !p.short && p.qty > 0).map(p => [p.symbol, p.valueTWD / p.qty]));
  return (account?.orders || []).filter(o => o.status === 'open' && o.side === 'sell' && !o.short).reduce((sum, o) => sum + (unit.get(o.symbol) || 0) * (o.qty || 0), 0);
}
const coverPending = (v, account) => overdrawnBy(v) >= 1 && pendingSales(v, account) >= overdrawnBy(v) * 0.99;
function overdraftHtml(v) {
  const owed = overdrawnBy(v);
  if (owed < 1) return '';
  const { plan, covered } = coverPlan(v, owed);
  const rows = plan
    .map(x => `<div class="q-ritem">${symbolBadge(x.symbol)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(x.symbol))}</span><small class="num">${h(t('coverSell', { qty: fmtQty(x.qty) }))}${x.all ? ` · ${h(t('coverAll'))}` : ''}</small></span><span class="q-ritem-value num">≈ ${h(money(x.twd, BASE))}</span></div>`)
    .join('');
  return `<section class="callout-card bad">
    <div class="cc-head">${tileHtml(ico('wallet'), TINT.red, 'sm')}<span class="cc-text"><strong class="num">${h(t('odTitle', { v: money(owed, BASE) }))}</strong><small>${h(state.account.od ? t('odDeadline', { date: fmtDate(odDeadline(state.account.od.since)) }) : t('odSub'))}</small></span></div>
    ${coverPending(v) ? `<p class="foot-note">${h(t('odPending'))}</p>` : plan.length ? `<div class="q-rowcard inset">${rows}</div><button class="q-btn primary block" type="button" data-action="cover" ${pricesLive() ? '' : 'disabled'}>${h(t(covered ? 'coverGo' : 'coverGoPart'))}</button>` : `<p class="foot-note">${h(t('odNothing'))}</p>`}
  </section>`;
}

// ---- 資產: what the account is worth and what it holds ------------------------------------

function renderPortfolio() {
  const box = $('portfolio-body');
  if (!state.account) return morph(box, `<div class="empty"><div class="spinner"></div></div>`);
  const v = valuation();
  const s = snap();
  const view = state.nwView || 'pl';
  const incomplete = v.missingRates.length || !state.loaded;
  const sort = state.posSort || 'value';
  const positions = [...v.positions].sort((x, y) => (sort === 'pl' ? netPl(y).pl - netPl(x).pl : sort === 'day' ? y.dayTWD - x.dayTWD : Math.abs(y.valueTWD) - Math.abs(x.valueTWD)));
  // The hero's figure follows its chart: what the money put in has made, or the total.
  const hero = `<div class="q-focus pf-hero">
    <span class="q-focus-label">${h(view === 'pl' ? t('totalReturn') : t('netWorth'))}${incomplete ? ` <span class="hc-note">${h(t('pricesLoading'))}</span>` : ''}</span>
    <strong class="q-focus-value num" data-q-live="pf:${view}">${h(view === 'pl' ? money(v.totalReturn, BASE, { sign: true }) : money(v.netWorth, BASE))}</strong>
    <span class="q-focus-sub num"><span class="${dirClass(v.totalReturn)}">${h(arrow(v.totalReturn))}${h(pct(v.totalReturnPct))}</span> · ${h(t('putIn'))} ${h(money(v.deposits, BASE))}</span>
    <div id="nw-chart" class="hc-chart" data-own></div>
    <div class="q-seg" role="group">${['pl', 'nw'].map(k => `<button type="button" data-action="nw-view" data-v="${k}" aria-pressed="${view === k}">${h(t(`nwView_${k}`))}</button>`).join('')}</div>
  </div>`;
  // 未實現 over every holding (after selling costs) and 已實現 so far, in NT$, over the list.
  const unreal = v.positions.reduce((a, p) => a + netPl(p).pl, 0);
  const costBase = v.positions.reduce((a, p) => a + Math.abs(p.valueTWD - p.pl), 0);
  const plStats = `<div class="q-stats pl-stats">
      ${stat(t('unrealized'), money(unreal, BASE, { sign: true }), costBase ? pct(unreal / costBase) : '', dirClass(unreal))}
      ${stat(t('realizedPl'), money(v.realized || 0, BASE, { sign: true }), '', dirClass(v.realized || 0))}
    </div>`;
  const held = v.positions.length
    ? sectionHtml(t('positions'), `${plStats}<div class="q-rowcard positions">${positions.map(p => positionRow(p, sort)).join('')}</div>`, {
        more: v.positions.length > 1 ? t(`posSort_${sort}`) : '',
        moreAction: 'data-action="pos-sort" class="sort-btn"'
      })
    : sectionHtml(t('positions'), emptyHtml({ icon: 'chart', tint: TINT.gray, title: t('noPositions'), go: t('goTrade'), attrs: 'data-action="goto" data-tab="markets"' }));
  morph(
    box,
    `${hero}
    ${overdraftHtml(v)}
    ${marginCardHtml(v)}
    ${held}
    ${cashHtml(v)}
    ${moreHtml(v)}`
  );
  renderNetWorthChart(v, s);
}

// Cash: each currency's wallet (what's spendable; held for orders and still
// settling as tags), the loans, and the next pay. The NT$ wallet is the Orbit balance itself.
function cashHtml(v) {
  const avail = available(state.account, snap());
  const unsettledNow = unsettled(state.account);
  const settleAt = settlesBy(state.account);
  // (The futures account's money is a pocket of the NT$: its own row, not held for orders.)
  const fut = snap()?.futSplit ? Math.max(0, snap().futCash || 0) : 0;
  const cash = v.cash.map(c => (fut && c.currency === BASE ? { ...c, amount: c.amount - fut, twd: c.twd - fut } : c));
  const heldFor = c => Math.max(0, c.amount - (avail.cash[c.currency] ?? c.amount));
  const heldTWD = cash.reduce((sum, c) => sum + (c.amount ? (heldFor(c) / c.amount) * c.twd : 0), 0);
  const futRow = fut || v.futMarginTWD > 0 ? `<button class="q-ritem chevron wallet" type="button" data-action="tool" data-tool="futacct">${tileHtml(ico('chart'), TINT.indigo, 'soft flag')}<span class="q-ritem-text"><span class="q-ritem-title">${h(t('futWallet'))}</span><small class="q-fit">${h(t('futWalletSub'))}</small></span><span class="q-ritem-end"><strong class="num">${h(money(fut, BASE))}</strong></span></button>` : '';
  const rows = cash.map(c => walletRow(c, heldFor(c), unsettledNow[c.currency] || 0, settleAt[c.currency])).join('') + futRow;
  const pay = `<div class="q-ritem">${tileHtml(ico('calendar'), TINT.green)}<span class="q-ritem-text"><span class="q-ritem-title">${h(t('weeklyPay'))}</span><small>${h(shortDate(orbitPayday(Date.now())))}</small></span><span class="q-ritem-end"><strong class="num">+${h(money(paydayFor(state.wallet), BASE))}</strong></span></div>`;
  return sectionHtml(t('cash'), `<div class="q-rowcard wallets">${rows}${v.loans.map(loanWalletRow).join('')}${pay}</div>`, {
    side: `<strong class="sec-value num">${h(money(v.cashTWD - heldTWD, BASE))}</strong>`,
    cls: 'pf-cash'
  });
}

// The rest, a tap away each in a sheet of its own: what it's made of, what it pays, the plans and alerts, the orders waiting.
function moreHtml(v) {
  const inc = incomeSummary(state.account);
  const soon = upcomingIncome();
  const plans = activePlans(state.account);
  const alerts = Object.values(state.account.alerts || {}).filter(a => a.on);
  const open = state.account.orders.filter(o => o.status === 'open').length;
  const top = topGroup(v);
  const row = (tool, glyph, color, title, value, small = '') =>
    `<button class="q-ritem chevron" type="button" data-action="tool" data-tool="${tool}">${tileHtml(glyph, color)}<span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span>${small ? `<small>${h(small)}</small>` : ''}</span>${value}</button>`;
  const rows = [
    row('alloc', ico('grid'), TINT.indigo, t('allocation'), '', top ? `${top[0]} ${pct(top[1], { digits: 0, sign: false })}` : ''),
    inc.total || soon.length ? row('income', ico('coin'), TINT.orange, t('incomeTitle'), inc.last12 >= 0.5 || !soon.length ? `<span class="q-ritem-end"><strong class="num">${h(money(inc.last12, BASE))}</strong></span>` : `<span class="q-ritem-end"><strong class="num">+${h(money(soon.reduce((a, x) => a + x.net, 0), BASE))}</strong></span>`, soon.length ? t('incomeNextOn', { date: shortDate(soon[0].t) }) : t('income12')) : '',
    plans.length || plansEnded().length ? row('plans', ico('calendar'), TINT.teal, t('plansTitle'), `<span class="q-tag">${plans.length}</span>`) : '',
    alerts.length || alertsShown().length ? row('alerts', ico('bell'), TINT.red, t('alertsTitle'), `<span class="q-tag">${alerts.length}</span>`) : '',
    open ? `<button class="q-ritem chevron" type="button" data-action="hview-go" data-view="orders">${tileHtml(ico('list'), TINT.blue)}<span class="q-ritem-text"><span class="q-ritem-title">${h(t('openOrders'))}</span></span><span class="q-tag orange">${open}</span></button>` : ''
  ].join('');
  return sectionHtml(t('moreTitle'), `<div class="q-rowcard">${rows}</div>`, { cls: 'pf-more' });
}
// The biggest part of the account by kind, and its share.
function topGroup(v) {
  const list = Object.entries(v.byKind).filter(([, x]) => x > 0);
  const total = list.reduce((a, [, x]) => a + x, 0);
  if (!total) return null;
  const [k, x] = list.sort((a, b) => b[1] - a[1])[0];
  return [kindLabel(k), x / total];
}

// Each holding's next dividend, kept between visits (checked with its
// dividends, twice a day): the ex-date Yahoo announces where it's ahead,
// else the last one's plus the usual gap; the last amount a share.
const DAY_MS = 86_400_000;
let divNextMemo = null;
function divNext() {
  if (!divNextMemo) {
    try {
      divNextMemo = JSON.parse(localStorage.getItem(STORE.divNext) || '{}');
    } catch {
      divNextMemo = {};
    }
  }
  return divNextMemo;
}
function saveDivNext(symbol, f) {
  divNext()[symbol] = f;
  try {
    localStorage.setItem(STORE.divNext, JSON.stringify(divNextMemo));
  } catch {}
}
function divForecast(symbol, dividends, facts, now = Date.now()) {
  const year = dividends.filter(d => d.date > now - 370 * DAY_MS && d.amount > 0).sort((a, b) => a.date - b.date);
  if (!year.length) return null;
  const market = state.account.events.find(e => e.symbol === symbol)?.market;
  const announced = facts?.exDividendDate > now - DAY_MS ? facts.exDividendDate : null;
  let ex = announced;
  if (!ex) {
    const gap = (365 / Math.min(12, year.length)) * DAY_MS;
    for (ex = year.at(-1).date + gap; ex <= now; ex += gap);
  }
  const pay = stockMarkets.divPayDate?.(market, ex, announced && facts.dividendDate >= announced ? facts.dividendDate : null) ?? ex + 28 * DAY_MS;
  return { ex, pay, per: year.at(-1).amount, est: !announced };
}

// What's coming in, soonest first, in NT$ after tax and fees: dividends
// owed (exact), each holding's next one (estimated from its last), time
// deposits ending and the half-yearly cash interest; to `days` ahead.
function upcomingIncome(days = 120) {
  const now = Date.now();
  const until = now + days * DAY_MS;
  const s = snap();
  const v = valuation();
  if (!s || !v) return [];
  const twd = c => (c === BASE ? 1 : state.rates[c] || 0);
  const out = [];
  const pending = pendingDividends(state.account);
  for (const e of pending) out.push({ kind: 'div', symbol: e.symbol, t: e.t, ex: e.ex, net: e.net * twd(e.currency), est: false });
  for (const p of v.positions) {
    const f = divNext()[p.symbol];
    if (!f || p.short || !(p.qty > 0) || f.pay <= now || f.pay > until || f.ex <= now - DAY_MS) continue;
    if (pending.some(e => e.symbol === p.symbol && Math.abs(e.ex - f.ex) < 10 * DAY_MS)) continue;
    const taxes = stockMarkets.dividendTaxes(p.market, p.qty * f.per, p.symbol);
    out.push({ kind: 'div', symbol: p.symbol, t: f.pay, ex: f.ex, net: taxes.net * twd(p.currency), est: f.est });
  }
  for (const td of Object.values(s.tds || {})) {
    if (td.ends > until) continue;
    out.push({ kind: 'td', t: Math.max(td.ends, now), net: stockSavings.incomeTaxes?.(tdInterest(td, td.ends).gross)?.net ?? tdInterest(td, td.ends).gross, est: false });
  }
  // NT$ cash interest: June 21 and December 21; what's earned so far plus
  // today's cash to then.
  const y = new Date(now + 8 * 3_600_000).getUTCFullYear();
  const payDay = [Date.UTC(y, 5, 21), Date.UTC(y, 11, 21), Date.UTC(y + 1, 5, 21)].map(x => x - 8 * 3_600_000).find(x => x > now);
  if (payDay <= until) {
    const paid = state.account.events.filter(e => e.type === 'interest').reduce((a, e) => a + e.gross, 0);
    const gross = Math.floor(Math.max(0, s.cashInterest - paid) + (Math.max(0, s.cash?.[BASE] || 0) * CASH_RATE * (payDay - now)) / (365 * DAY_MS));
    const net = stockSavings.incomeTaxes?.(gross)?.net ?? gross;
    if (net >= 1) out.push({ kind: 'cash', t: payDay, net, est: true });
  }
  return out.filter(x => x.net >= 0.5).sort((a, b) => a.t - b.t);
}
function upcomingRow(x) {
  // The figures alone on the right, lined up; an estimate says 預估 in its line.
  const value = `<span class="q-ritem-value num up-ink">+${h(money(x.net, BASE))}</span>`;
  const td = x.kind === 'td';
  const date = shortDate(x.t);
  const line = x.est ? t('upcomingEst', { date }) : x.kind === 'div' ? t('upcomingDiv', { ex: shortDate(x.ex), pay: date }) : t(td ? 'upcomingTd' : 'upcomingCash', { date });
  if (x.kind === 'div')
    return `<button class="q-ritem" type="button" data-action="open" data-symbol="${h(x.symbol)}">${symbolBadge(x.symbol)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(x.symbol))}</span><small>${keepParts(line)}</small></span>${value}</button>`;
  const title = td ? 'tdTitle' : 'incomeInterest';
  return `<div class="q-ritem">${tileHtml(ico(td ? 'lock' : 'coin'), td ? TINT.green : TINT.orange)}<span class="q-ritem-text"><span class="q-ritem-title">${h(t(title))}</span><small>${keepParts(line)}</small></span>${value}</div>`;
}

// Income: dividends, coupons and cash interest over the last year, month by
// month, and what's on the way (a sheet).
function incomeHtml(v) {
  const inc = incomeSummary(state.account);
  const list = pendingDividends(state.account);
  const soon = upcomingIncome();
  const yieldPct = v.longTWD > 0 ? inc.last12 / v.longTWD : 0;
  const top = Object.entries(inc.payers).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const parts = [['incomeDiv', inc.div], ['incomeCoupon', inc.coupon], ['incomeInterest', inc.interest], ['incomeLending', inc.lending]].filter(([, x]) => x >= 0.5);
  const soonSum = soon.reduce((a, x) => a + x.net, 0);
  const soonBody = soon.length ? `<div class="q-rowcard">${soon.map(upcomingRow).join('')}</div>${soon.some(x => x.est) ? `<p class="foot-note">${h(t('upcomingNote'))}</p>` : ''}${list.length ? `<p class="foot-note">${h(t('pendingDivNote'))}</p>` : ''}` : '';
  // (Nothing paid yet: the hero says what's coming in, and the year's chart waits.)
  return `${inc.last12 >= 0.5
      ? `<div class="q-stats">
      ${stat(t('incomeYtd'), money(inc.ytd, BASE), yieldPct ? t('incomeYield', { pct: pct(yieldPct, { digits: 2, sign: false }) }) : '')}
      ${stat(t('upcomingTitle'), `+${money(soonSum, BASE)}`, '', soonSum ? 'up' : '')}
    </div>
    <section class="q-section"><div class="card-box">${miniBars(inc.months, { format: x => money(x, BASE) })}
    <div class="mini-bars-scale"><span>${h(monthYear(Date.parse(`${inc.months[0][0]}-15`)))}</span><span>${h(monthYear(Date.now()))}</span></div>
    ${parts.length ? `<div class="q-tags">${parts.map(([k, x]) => `<span class="q-tag">${h(t(k))} ${h(money(x, BASE))}</span>`).join('')}</div>` : ''}</div></section>`
      : ''}
    ${sectionHtml(t('incomeTop'), top.length ? `<div class="q-rowcard">${top.map(([sym, x]) => `<button class="q-ritem" type="button" data-action="open" data-symbol="${h(sym)}">${symbolBadge(sym)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(sym))}</span></span><span class="q-ritem-value num up-ink">+${h(money(x, BASE))}</span></button>`).join('')}</div>` : '')}
    ${inc.last12 >= 0.5 ? sectionHtml(t('upcomingTitle'), soonBody, { side: soon.length ? `<span class="q-tag up num">${h(money(soonSum, BASE))}</span>` : '' }) : soonBody ? `<section class="q-section">${soonBody}</section>` : ''}`;
}

// A plan that ended by itself stays in the list for a quarter (its card in
// the stock's sheet keeps saying so until another is set).
const ENDED_SHOWN = 92 * 86_400_000;
function plansEnded() {
  const live = new Set(activePlans(state.account).map(p => p.symbol));
  return Object.values(state.account?.plans || {}).filter(p => !p.on && p.ended && !live.has(p.symbol) && Date.now() - (p.t || 0) < ENDED_SHOWN && endedPlan(p.symbol) === p);
}
function plansHtml() {
  const plans = activePlans(state.account);
  const endedRows = plansEnded()
    .map(p => `<button class="q-ritem" type="button" data-action="open" data-symbol="${h(p.symbol)}">${symbolBadge(p.symbol)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(p.symbol))}</span><small>${h(planEndedText(p))}</small></span><span class="q-tag">${h(t('planEndedTag'))}</span></button>`)
    .join('');
  const rows = plans
    .map(p => {
      const next = nextPlanRun(p);
      const last = state.account.orders.filter(o => o.plan === p.id).at(-1);
      // 修改 opens the plan's amount and day right in its row.
      if (state.planEdit === p.id && !$('detail')?.open) {
        return `<div class="q-ritem plan-edit-row">${symbolBadge(p.symbol)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(p.symbol))}</span>
          <span class="field-row">
            <label class="field grow"><span>${h(t('planAmount'))} (NT$)</span><input id="plan-row-amount" class="q-field num" inputmode="numeric" autocomplete="off" value="${h(state.plan.amount)}" /></label>
            <label class="field"><span>${h(t('planDay'))}</span><select id="plan-row-day" class="q-field">${planDayOptions(state.plan.day)}</select></label>
          </span>
          <span class="button-row"><button class="q-btn primary small" type="button" data-action="plan-row-save" data-id="${h(p.id)}">${h(t('planSave'))}</button><button class="q-btn small" type="button" data-action="plan-edit-cancel">${h(t('orderAskCancel'))}</button></span></span></div>`;
      }
      return `<div class="q-ritem plan-row">${symbolBadge(p.symbol)}
        <button class="q-ritem-text link-text" type="button" data-action="open" data-symbol="${h(p.symbol)}"><span class="q-ritem-title">${h(nameOf(p.symbol))}</span>
        <small>${h(t('planNext', { date: next ? fmtDate(next) : '—' }))}${last ? ` · ${h(last.status === 'filled' ? t('planLast', { qty: fmtQty(last.qty), unit: unitOf(p.symbol) }) : planReason(last.reason))}` : ''}</small>
        <span class="q-tags"><span class="q-tag tint num">${h(money(p.amount, BASE))}</span><span class="q-tag">${h(t(Number(p.day) > 28 ? 'dayOfMonthEnd' : 'dayOfMonth', { n: p.day }))}</span></span></button>
        <span class="row-actions"><button class="q-btn small" type="button" data-action="plan-edit" data-id="${h(p.id)}" data-row="1">${h(t('planEdit'))}</button><button class="q-btn small danger tinted" type="button" data-action="plan-off" data-id="${h(p.id)}">${h(t('planStop'))}</button></span></div>`;
    })
    .join('');
  return rows || endedRows ? `<div class="q-rowcard">${endedRows}${rows}</div>` : emptyHtml({ icon: 'calendar', tint: TINT.teal, title: t('nothingYet') });
}

const alertsShown = () => Object.values(state.account?.alerts || {}).filter(a => a.on || (a.hit && Date.now() - a.hit.t < 7 * 86_400_000)).sort((a, b) => b.t - a.t);
function alertsHtml() {
  const list = alertsShown();
  if (!list.length) return emptyHtml({ icon: 'bell', tint: TINT.red, title: t('nothingYet') });
  return `<div class="q-rowcard">${list
    .map(a => {
      const q = state.quotes.get(a.symbol);
      const gap = q && a.on ? pct(a.price / q.price - 1) : '';
      return `<div class="q-ritem">${symbolBadge(a.symbol)}
        <button class="q-ritem-text link-text" type="button" data-action="open" data-symbol="${h(a.symbol)}"><span class="q-ritem-title">${h(nameOf(a.symbol))}</span>
        <small>${h(a.on ? t(a.op === 'above' ? 'alertWhenAbove' : 'alertWhenBelow', { price: fmtPrice(a.price, q?.currency) }) : t('alertWentOff', { price: fmtPrice(a.hit.price, q?.currency), time: dateTime(a.hit.t) }))}</small>
        ${gap ? `<span class="q-tags"><span class="q-tag">${h(t('alertGap', { pct: gap }))}</span></span>` : ''}</button>
        ${a.on ? `<button class="q-btn small" type="button" data-action="alert-off" data-id="${h(a.id)}">${h(t('remove'))}</button>` : `<span class="q-tag green">${ico('check')}</span>`}</div>`;
    })
    .join('')}</div>`;
}

// A ' · ' line that wraps between its parts, never inside one (an amount left
// alone on a line), each '·' kept with the part before it (no line starts with one).
const keepParts = text => text.split(' · ').map((x, i, all) => `<span class="keep">${h(i < all.length - 1 ? `${x} ·` : x)}</span>`).join(' ');
// How many held: 1 張 500 股 for Taiwan's stocks and ETFs a lot or more (as
// brokers write it, and one line with the worth beside it), else 1,500 股.
function heldQtyText(p, q) {
  const kind = kindOf(p.symbol, q);
  const lots = (q?.market || p.market) === 'TW' && (kind === 'stock' || kind === 'etf') ? boardLots(p.qty) : null;
  if (!lots) return `${fmtQty(Math.abs(p.qty))} ${unitOf(p.symbol)}`;
  return lots.odd ? t('lotsOdd', { lots: fmtQty(lots.lots), odd: fmtQty(lots.odd) }) : t('lotsWhole', { lots: fmtQty(lots.lots) });
}
// 除息 / 除權 / 除權息 on a holding on its ex-date, as brokers mark it.
function exTagHtml(symbol) {
  const tag = exDayTags(state.account?.events).get(symbol);
  const text = tag && { div: t('exDivTag'), split: t('exRightTag'), both: t('exBothTag') }[tag];
  return text ? `<span class="q-tag orange">${h(text)}</span>` : '';
}
// A holding: its picture and name, how much at what cost, its worth and its
// return (today's, sorted by today).
// 未實現損益 as a broker shows it: the holding's worth less what selling it now would
// cost (commission and tax), less what it cost; a short's as the ledger has it.
function netPl(p) {
  if (p.short || !(p.qty > 0) || !p.value) return { pl: p.pl, pct: p.plPct };
  const costs = stockAccount.estimate({ market: p.market, kind: p.kind, currency: p.currency, side: 'sell', qty: p.qty, price: p.price }).costs || 0;
  const pl = p.pl - costs * (p.valueTWD / p.value);
  const base = p.valueTWD - p.pl;
  return { pl, pct: base ? pl / Math.abs(base) : 0 };
}
function positionRow(p, sort = 'value') {
  const q = p.quote;
  const tags = [
    p.short ? `<span class="q-tag solid down">${h(t('shortTag'))}</span>` : '',
    p.financed > 0 ? `<span class="q-tag indigo">${h(t('marginTag'))}</span>` : '',
    p.lent ? `<span class="q-tag blue">${h(t('lentTag', { qty: fmtQty(p.lent) }))}</span>` : '',
    exTagHtml(p.symbol),
    alertTag(p.symbol)
  ].join('');
  const qty = p.short && p.credit ? t('shortShares', { n: fmtQty(Math.abs(p.qty)), unit: unitOf(p.symbol) }) : marginShares(p) > 0 ? t('splitShares', { cash: fmtQty(p.qty - marginShares(p)), margin: fmtQty(marginShares(p)), unit: unitOf(p.symbol) }) : heldQtyText(p, q);
  // Money made or lost in NT$ (today's under 今日, since bought otherwise), its % as the tag; the worth goes left.
  const net = netPl(p);
  const [x, xPct] = sort === 'day' ? [p.dayTWD, p.dayPct] : [net.pl, net.pct];
  const end = `<strong class="num ${dirClass(x)}">${h(money(x, BASE, { sign: true }))}</strong><span class="chg num ${dirClass(x)}">${h(pct(xPct))}</span>`;
  // (A future's English name without "futures" here: "Mini-TAIEX futures Nov" was cut at 320 px, and the line under it says contracts.)
  const rowName = locale === 'en' && stockMarkets.isFuture?.(p.symbol) ? nameOf(p.symbol, q).replace(/ futures\b/, '') : nameOf(p.symbol, q);
  return `<button class="q-ritem position-row" type="button" data-action="open" data-symbol="${h(p.symbol)}">
    ${symbolBadge(p.symbol, p)}
    <span class="q-ritem-text"><span class="q-ritem-title">${h(rowName)}</span><small class="num q-fit">${h(`${qty} · ${t('marketValue')} ${compactMoney(p.valueTWD, BASE)}`)}</small>${tags ? `<span class="q-tags">${tags}</span>` : ''}</span>
    <span class="q-ritem-end">${end}</span>
  </button>`;
}

// A currency's wallet: its flag, what's spendable, and what's held or settling as tags.
function walletRow(c, reserved = 0, settling = 0, settleAt = 0) {
  const info = currencyInfo(c.currency);
  if (reserved > 1e-9 && c.amount) c = { ...c, amount: c.amount - reserved, twd: c.twd * (1 - reserved / c.amount) };
  const twd = c.currency === BASE;
  // One short line under the name: what's settling (and when), else what's held for orders, else the month's interest.
  const small =
    settling > 1e-9
      ? `<span class="blue-ink">${h(t('settlingShort', { amount: money(settling, c.currency), date: settleAt ? shortDate(settleAt) : '' }).trim())}</span>`
      : reserved > 1e-9
        ? `<span class="orange-ink">${h(t('reservedShort', { amount: money(reserved, c.currency) }))}</span>`
        : h(twd ? t('cashMonthly', { amount: money((Math.max(0, c.amount) * CASH_RATE) / 12, BASE) }) : locale === 'en' ? L(info) : c.currency);
  // (English names are long: "Taiwan dollar" was cut beside NT$117,000 at 320 px. The code there, the name under it.)
  const title = locale === 'en' ? c.currency : L(info);
  return `<button class="q-ritem chevron wallet" type="button" data-action="fx-from" data-cur="${h(c.currency)}">
    ${tileHtml(curMark(c.currency), TINT.teal, 'soft flag')}
    <span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span><small class="num q-fit">${small}</small></span>
    <span class="q-ritem-end"><strong class="num${c.amount < 0 ? ' down-ink' : ''}">${h(money(c.amount, c.currency))}</strong>${twd ? '' : `<small class="num">≈ ${h(money(c.twd, BASE))}</small>`}</span>
  </button>`;
}

function loanWalletRow(l) {
  return `<button class="q-ritem chevron wallet" type="button" data-action="tool" data-tool="loans">
    ${tileHtml(curMark(l.currency), TINT.red, 'soft flag')}
    <span class="q-ritem-text"><span class="q-ritem-title">${h(t('loanIn', { cur: l.currency }))}</span><small class="num">${h(t('loanRate', { rate: pct(l.rate, { digits: 2, sign: false }) }))}</small></span>
    <span class="q-ritem-end"><strong class="num down-ink">−${h(money(l.balance, l.currency))}</strong>${l.currency !== BASE ? `<small class="num">≈ −${h(money(l.twd, BASE))}</small>` : ''}</span>
  </button>`;
}

// 融資's maintenance ratio while anything is owed: a card with its gauge, red on a call.
function marginCardHtml(v) {
  if (!(v.owed > 0)) return '';
  const call = state.account.call;
  const bad = v.margin !== 'ok' || call;
  const text = v.margin === 'liquidate' ? t('marginLiquidate') : '';
  return `<section class="callout-card margin-card${bad ? ' bad' : ''}">
    <button class="cc-head" type="button" data-action="tool" data-tool="loans">${tileHtml(ico('bars'), bad ? TINT.red : TINT.indigo, 'sm')}<span class="cc-text"><small>${h(t('maintenance'))}</small><strong class="num">${h(pct(v.ratio, { digits: 0, sign: false }))}</strong></span><span class="q-tag ${bad ? 'red' : 'green'}">${h(t(`margin_${v.margin}`))}</span></button>
    ${gauge(v.ratio)}
    ${text ? `<p class="foot-note">${h(text)}</p>` : ''}
    ${callPanelHtml(v)}
  </section>`;
}

// A margin call (or a dip under 130% while Taiwan trades): what's owed, by
// when, and the ways to meet it, as a broker's notice puts them.
function callPanelHtml(v) {
  const call = state.account.call;
  if (!call && v.margin !== 'call') return '';
  const need = callNeed(v);
  const avail = available(state.account, snap()).cash;
  const cashTWD = Object.entries(avail).reduce((sum, [c, x]) => sum + Math.max(0, x) * (state.rates[c] || 0), 0);
  const pay = Math.min(need, Math.max(0, Math.floor(cashTWD)), Math.ceil(v.debtTWD));
  const after = v.owed - pay > 0 ? (v.assets - pay) / (v.owed - pay) : Infinity;
  const financed = v.positions.filter(p => !p.short && p.financed > 0);
  const lines = [];
  if (!call) lines.push(`<p class="foot-note">${h(t('callIntraday'))}</p>`);
  else {
    lines.push(`<p class="warn">${h(t('callDue', { v: money(need, BASE), date: dateTime(call.due) }))}</p>`);
    // It is also cancelled once the 差額 called is paid in full (callPaid): what's paid and left.
    const paidKit = call.need > 0;
    if (paidKit) {
      const paid = stockAccount.callPaid(state.account, call, state.rates);
      lines.push(`<p class="foot-note">${h(t('callPaidLeft', { need: money(call.need, BASE), paid: money(paid, BASE), left: money(Math.max(0, call.need - paid), BASE) }))}</p>`);
    }
    if (v.ratio >= MARGIN_CALL) lines.push(`<p class="foot-note">${h(t(Date.now() >= call.due ? (paidKit ? 'callStandsLateOrPaid' : 'callStandsLate') : paidKit ? 'callStandsOrPaid' : 'callStands'))}</p>`);
    else lines.push(`<p class="foot-note">${h(t('callSale'))}</p>`);
  }
  const way = (n, title, sub) => `<div class="q-ritem"><span class="q-tile sm soft" style="--t:var(--q-red)">${n}</span><span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span><small>${h(sub)}</small></span></div>`;
  const ways = `<div class="q-rowcard inset call-ways">${way(1, t('callWayPay'), t('callWayPaySub'))}${way(2, t('callWaySell'), t('callWaySellSub'))}${way(3, t('callWayPledge'), t('callWayPledgeSub'))}</div>`;
  const buttons = `<div class="button-row">
    ${pay >= 1 ? `<button class="q-btn primary grow" type="button" data-action="call-pay" data-v="${pay}">${h(t('callPay', { v: money(pay, BASE) }))}</button>` : ''}
    ${financed.length ? `<button class="q-btn small" type="button" data-action="open" data-symbol="${h(financed[0].symbol)}">${h(t('callSellGo', { name: nameOf(financed[0].symbol) }))}</button>` : ''}
  </div>
  ${pay >= 1 && pay < need ? `<p class="foot-note">${h(t('callPayShort', { v: money(pay, BASE), ratio: pct(after, { digits: 0, sign: false }) }))}</p>` : ''}
  ${need >= 1 && pay < 1 ? `<p class="foot-note">${h(t('callNoCash'))}</p>` : ''}`;
  return `<div class="call-panel">${lines.join('')}${ways}${buttons}</div>`;
}

function gauge(ratio) {
  const max = 3;
  const x = r => `${Math.min(100, (Math.min(r, max) / max) * 100)}%`;
  return `<div class="gauge"><span class="gauge-fill ${ratio < MARGIN_CALL ? 'bad' : ratio < MARGIN_RESTORE ? 'warn' : 'ok'}" style="width:${x(ratio)}"></span>
    <i style="left:${x(MARGIN_CALL)}" title="${h(t('callLine'))}"></i><i style="left:${x(MARGIN_RESTORE)}" title="${h(t('restoreLine'))}"></i></div>
    <div class="gauge-scale"><span class="to-left" style="left:${x(MARGIN_CALL)}">${h(t('callShort'))} ${pct(MARGIN_CALL, { digits: 0, sign: false })}</span><span class="to-right" style="left:${x(MARGIN_RESTORE)}">${h(t('restoreShort'))} ${pct(MARGIN_RESTORE, { digits: 0, sign: false })}</span></div>`;
}

// What the account is made of, by kind, currency or market (a sheet).
function allocationHtml(v) {
  let groups;
  if (state.alloc === 'currency') groups = Object.entries(v.byCurrency).filter(([, x]) => x > 0).map(([k, x]) => [k, x]);
  else if (state.alloc === 'market') {
    const m = {};
    for (const p of v.positions) m[p.market] = (m[p.market] || 0) + p.valueTWD;
    if (v.cashTWD > 0) m.cash = v.cashTWD;
    groups = Object.entries(m).map(([k, x]) => [k === 'cash' ? t('kind_cash') : marketLabel(k), x]);
  } else groups = Object.entries(v.byKind).map(([k, x]) => [kindLabel(k), x]);
  groups.sort((a, b) => b[1] - a[1]);
  // Past eight, the rest fold into one.
  if (groups.length > 8) groups = [...groups.slice(0, 7), [t('others'), groups.slice(7).reduce((s, g) => s + g[1], 0)]];
  const parts = groups.map(([label, value], i) => ({ label, value, color: SERIES[i] }));
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0);
  return `<div class="q-seg" role="group">${['kind', 'currency', 'market'].map(k => `<button type="button" data-action="alloc" data-alloc="${k}" aria-pressed="${state.alloc === k}">${h(t(`alloc_${k}`))}</button>`).join('')}</div>
    <div class="card-box alloc-box">${donut(parts, { format: x => money(x, BASE), center: compactMoney(total, BASE), sub: t('allocTotal') }) || `${plainEmpty(t('nothingYet'))}`}</div>`;
}
// Net worth at the end of every day since the account opened, rebuilt from
// the log and each day's closing prices and rates (so the chart needs no
// visits). Loaded when the portfolio shows, again once the log changes: the
// rebuild is one pass over the log (the kit's netWorthSeries), and the past
// days' charts are read once a day (only a symbol or currency new to the
// log is read again).
const nwCharts = { key: '', points: new Map() };
async function loadNetWorthHistory() {
  const account = state.account;
  if (!account || Date.now() - account.created < 86_400_000) return;
  const today = taipeiDay(Date.now());
  const key = `${account.id}:${account.events.length}:${today}`;
  if (state.nwHistory?.key === key || state.nwHistory?.loading === key) return;
  state.nwHistory = { ...(state.nwHistory || {}), loading: key };
  const s = replay(account);
  const age = Date.now() - account.created;
  const range = historyRange(age);
  if (nwCharts.key !== `${account.id}:${today}:${range}`) Object.assign(nwCharts, { key: `${account.id}:${today}:${range}`, points: new Map() });
  const currencies = new Set();
  for (const e of account.events) for (const c of [e.currency, e.from, e.to]) if (c && c !== BASE) currencies.add(c);
  const wanted = [...Object.keys(s.held), ...[...currencies].map(fxSymbol)].filter(sym => !nwCharts.points.has(sym));
  const got = await Promise.all(wanted.map(sym => fetchChart(sym, range).catch(() => null)));
  // (A failed read is asked again next time, not kept as empty.)
  wanted.forEach((sym, i) => got[i] && nwCharts.points.set(sym, got[i].points || []));
  const days = [];
  for (let d = Date.parse(`${taipeiDay(account.created)}T23:59:59+08:00`); d < Date.now(); d += 86_400_000) days.push(d);
  const history = netWorthSeries(
    account,
    days,
    (sym, t) => pointAt(nwCharts.points.get(sym) || [], t),
    (cur, t) => (cur === BASE ? 1 : pointAt(nwCharts.points.get(fxSymbol(cur)) || [], t) ?? state.rates[cur] ?? null)
  );
  state.nwHistory = { key, history };
  if (state.tab === 'portfolio') renderNetWorthChart(valuation(), snap());
  else if (state.tab === 'home') renderHome();
}

// The hero's chart, in white on the app's colour: 損益 or 總資產 since the account opened.
function renderNetWorthChart(v, s) {
  const box = $('nw-chart');
  if (!box) return;
  loadNetWorthHistory();
  const rebuilt = state.nwHistory?.history?.length ? state.nwHistory.history.map(([tt, nw]) => ({ t: tt, nw })) : null;
  const snaps = rebuilt || Object.values(state.account.snapshots || {}).sort((a, b) => a.t - b.t);
  if (snaps.length < 2 && Date.now() - state.account.created < 86_400_000 * 2) {
    box.innerHTML = `<p class="first-day">${h(t('historyFirstDay'))}</p>`;
    return;
  }
  const points = snaps.map(x => [x.t, x.nw]);
  const now = Date.now();
  if (!points.length || points.at(-1)[0] < now - 60_000) points.push([now, v.netWorth]);
  if (points.length < 2) points.unshift([state.account.created, s.deposits]);
  const deposits = [];
  let total = 0;
  for (const e of state.account.events.filter(e => e.type === 'deposit').sort((a, b) => a.t - b.t)) {
    if (deposits.length) deposits.push([e.t, total]);
    total += e.amount;
    deposits.push([e.t, total]);
  }
  deposits.push([now, total]);
  const width = Math.max(280, Math.round(box.clientWidth || 340));
  const dir = dirClass(v.totalReturn);
  // 損益 (the default): what the money put in has made, around zero; a
  // deposit is no rise (the total, with the salary in it, was a flat line
  // high on an axis from the first deposit). 總資產: the total and what was
  // put in, the axis on their own range.
  if ((state.nwView || 'pl') === 'pl') {
    const putInAt = tt => {
      let at = deposits[0]?.[1] ?? 0;
      for (const [dt, x] of deposits) {
        if (dt > tt) break;
        at = x;
      }
      return at;
    };
    const pl = points.map(([tt, nw]) => [tt, nw - putInAt(tt)]);
    const span = Math.max(...pl.map(p => Math.abs(p[1])));
    const { svg, frame } = lineChart([{ points: pl }], { width, height: 150, dir, base: 0, yFormat: x => (Math.abs(x) < 0.5 ? '0' : `${x > 0 ? '+' : '−'}${span < 10_000 ? num(Math.abs(x)) : compact(Math.abs(x))}`), xFormat: tt => shortDate(tt) });
    box.innerHTML = svg;
    attachHover(box, [{ points: pl }], frame, (i, tt, [x]) => `<strong class="num">${money(x, BASE, { sign: true })}</strong><span>${h(fmtDate(tt))}</span><span class="num">${h(money(x + putInAt(tt), BASE))}</span>`);
    return;
  }
  const values = [...points, ...deposits].map(p => p[1]);
  const fine = Math.max(...values) - Math.min(...values) < Math.max(...values) * 0.05;
  // The axis from where the total has been: not from a first deposit's small amount before the rest came in.
  const shownDeposits = deposits.filter(([dt], i) => i === deposits.length - 1 || deposits[i + 1][0] - dt > 3_600_000 || dt >= points[0][0]);
  const { svg, frame } = lineChart([{ points }, { points: shownDeposits, cls: 'ref' }], {
    width,
    height: 150,
    dir,
    // A narrow range needs the full number (萬 would round it all alike).
    yFormat: x => (fine ? num(x) : compact(x)),
    xFormat: tt => shortDate(tt)
  });
  box.innerHTML = `${svg}<ul class="legend-inline"><li><i class="sw"></i>${h(t('netWorth'))}</li><li><i class="sw ref"></i>${h(t('putIn'))}</li></ul>`;
  attachHover(box, [{ points }, { points: shownDeposits }], frame, (i, tt, [nw, dep]) => `<strong class="num">${money(nw, BASE)}</strong><span>${h(fmtDate(tt))}</span><span class="num">${money(nw - dep, BASE, { sign: true })}</span>`);
}
// (lib/twse.mjs closeMatchOf: a whole-lot day order's 13:30 closing match.)
const closeMatchOf = o => twseCloseMatchOf(o, stockCredit.closingAuction);
function orderRow(o) {
  const q = state.quotes.get(o.symbol);
  const price = o.type === 'limit' ? t('atLimit', { p: fmtPrice(o.limit, o.currency) }) : o.type === 'stop' ? t('atStop', { p: fmtPrice(o.stop, o.currency) }) : t('atMarket');
  const closeAt = o.status === 'open' ? closeMatchOf(o) : null;
  const ends = closeAt ?? o.expires;
  const wait = orderWaitKind(o, closeAt, Date.now());
  const status =
    wait === 'after'
      ? t('afterWait', { time: clock(o.after) })
      : wait === 'closeMatch'
        ? t('closeMatchWait', { time: clock(closeAt) })
        : o.status === 'open'
          ? (q && !isOpen(q) && !(o.ext && ['pre', 'post'].includes(usSessionOf(q))) ? t('waitingOpen') : t('waitingPrice')) + (ends ? ` · ${t(o.tif === 'gtc' ? 'tifUntil' : 'tifDayUntil', { time: o.tif === 'gtc' ? fmtDate(ends) : weekdayClock(ends) })}` : '')
          : t(`status_${o.status}`);
  const tags = [o.ext ? t('extTag') : '', o.forced ? t('forcedTag') : ''].filter(Boolean);
  return `<div class="q-ritem order-row${o.status === 'open' ? '' : ' done'}">
    <span class="side-tile ${o.side}">${h(o.side === 'buy' ? t('buyShort') : t('sellShort'))}</span>
    <button class="q-ritem-text link-text" type="button" data-action="open" data-symbol="${h(o.symbol)}"><span class="q-ritem-title">${h(nameOf(o.symbol, q))}</span>
      <small class="num">${h(fmtQty(o.qty))} ${h(unitOf(o.symbol))} ${h(price)}</small>
      <small class="${o.status === 'open' ? 'wait' : ''}">${h(status)} · ${h(dateTime(o.t))}${o.reason ? ` · ${h(t(`err_${o.reason}`))}` : ''}</small>
      ${tags.length ? `<span class="q-tags">${tags.map(x => `<span class="q-tag">${h(x)}</span>`).join('')}</span>` : ''}</button>
    ${o.status === 'open' && !o.forced ? `<button class="q-btn small" type="button" data-action="cancel" data-id="${h(o.id)}">${h(t('cancel'))}</button>` : ''}
  </div>`;
}
// ---- FX & loans tab ----------------------------------------------------------------------

function currencyOptions(selected, list = [BASE, ...Object.keys(CURRENCIES).filter(c => c !== BASE)]) {
  const all = [...new Set([...list, ...Object.keys(snap()?.cash || {})])];
  return all.map(c => `<option value="${h(c)}" ${c === selected ? 'selected' : ''}>${h(c)} · ${h(L(currencyInfo(c)))}</option>`).join('');
}
// A currency picker: its face the flag and code (never cut), the system's own
// list over it (each with its name) when tapped.
const currencySelect = (id, selected) => `<span class="fx-cur"><span class="fx-cur-face">${h(selected)}</span><select id="${id}" aria-label="${h(L(currencyInfo(selected)))}">${currencyOptions(selected)}</select></span>`;

// ---- 資金: exchange, the rates, 融資 and 理財 --------------------------------------------------
// The exchange leads (the hero, on the app's colour); the rates and the
// money tools below it, each tool a sheet of its own.
function renderFx() {
  const box = $('fx-body');
  const over = `<span class="q-tag ${state.fxOpen ? 'green' : 'orange'}">${h(state.fxOpen ? t('fxOpenTag') : t('fxClosedTag'))}</span>`;
  if (!state.account || !snap()) return morph(box, `<div class="empty"><div class="spinner"></div></div>`);
  const v = valuation();
  const rates = Object.keys(CURRENCIES).filter(c => c !== BASE);
  morph(
    box,
    `${exchangeHtml()}
    ${v.margin !== 'ok' || state.account.call ? `<button class="callout bad" type="button" data-action="tool" data-tool="loans">${h(t('maintenance'))} ${h(pct(v.ratio, { digits: 0, sign: false }))} · ${h(t(`margin_${v.margin}`))}</button>` : ''}
    ${sectionHtml(t('fxViewRates'), `<div class="q-rowcard rates">${rates.slice(0, 6).map(c => rateRow(c)).join('')}</div>`, { more: t('seeAll'), moreAction: 'data-action="tool" data-tool="rates"', side: over, cls: 'fx-rates' })}
    ${sectionHtml(t('moneyTools'), moneyToolsHtml(v))}
    ${sectionHtml(t('acctTitle'), acctHtml())}`
  );
}

// 融資・信用帳戶・定存・借券出借: a row each, its figure on the right.
function moneyToolsHtml(v) {
  const credit = creditAccount(state.account, Date.now());
  const nLend = v.positions.filter(p => !p.short && lendable(p.market, p.kind)).length;
  const best = Math.max(...TD_TERMS.map(x => tdRate(x.months)));
  const row = (tool, glyph, color, title, small, end) => `<button class="q-ritem chevron" type="button" data-action="tool" data-tool="${tool}">${tileHtml(glyph, color)}<span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span><small class="num">${h(small)}</small></span>${end}</button>`;
  return `<div class="q-rowcard">
    ${row('loans', svgIcon('bank'), TINT.indigo, t('fxViewLoans'), v.debtTWD > 0 ? `${t('borrowed')} ${money(v.debtTWD, BASE)}` : t('noLoans'), v.debtTWD > 0 ? `<span class="q-tag ${v.margin === 'ok' ? 'green' : 'red'} num">${h(t('ratioShort'))} ${h(pct(v.ratio, { digits: 0, sign: false }))}</span>` : '')}
    ${stockAccess.ACCESS_KEYS ? row('access', ico('shield'), TINT.blue, t('accessTitle'), t('accessOpenN', { n: stockAccess.ACCESS_KEYS.filter(k => stockAccess.accessState(state.account, k, Date.now()).open).length, of: stockAccess.ACCESS_KEYS.length }), '') : ''}
    ${row('credit', ico('key'), TINT.purple, t('creditTitle'), credit.open ? t('creditLimitIs', { v: compactMoney(credit.limit, BASE) }) : t('creditClosed'), credit.open ? `<span class="q-tag green">${h(t('creditOpenTag'))}</span>` : '')}
    ${snap()?.futSplit && stockAccount.futTransfer ? row('futacct', ico('chart'), TINT.indigo, t('futAcctTitle'), v.futCash > 0 || v.futMarginTWD > 0 ? t('futEquityIs', { v: money(v.futEquity, BASE) }) : t('futAcctEmpty'), v.futCall ? `<span class="q-tag red">${h(t('futCallTag'))}</span>` : '') : ''}
    ${row('td', svgIcon('lock'), TINT.green, t('tdTitle'), v.savedTWD > 0 ? money(v.savedTWD, BASE) : t('tdBestRate', { rate: pct(best, { digits: 2, sign: false }) }), (v.tds || []).length ? `<span class="q-tag">${(v.tds || []).length}</span>` : '')}
    ${row('lend', svgIcon('hand'), TINT.orange, t('lendTitle'), v.lendIncome > 0 ? `+${money(v.lendIncome, BASE)}` : t('lendableN', { n: nLend }), (v.lent || []).filter(l => !l.back).length ? `<span class="q-tag">${(v.lent || []).filter(l => !l.back).length}</span>` : '')}
  </div>`;
}

// ---- The account's money (the Pass holds none: it's all here) -------------------------
//
// The Worker pays the weekly pay, helps (急難紓困) and rewards wealth levels,
// all into the pass's wallet, whose NT$ is this account's cash (applyPool).
// The rules are the kit's pay.mjs, shared with the Worker; relief is asked
// for through the Pass session (q.relief). No personal loan: a broker
// doesn't make one (the only borrowing is 融資).
const passWallet = () => state.wallet || q.wallet || {};
const rankName = r => (locale === 'en' ? r.en : r.zh);
function rankOf(w) {
  const worth = worthOf(w);
  let at = 0;
  while (at + 1 < WEALTH_RANKS.length && worth >= WEALTH_RANKS[at + 1].min) at++;
  return { worth, at, next: WEALTH_RANKS[at + 1] || null };
}
// Relief is asked on what's owned, at cost (the Worker's own count, eco.js).
const reliefWorth = w => poolBalance(w) + (Number(w?.snap?.stock?.held) || 0);

// 你的帳戶 on 資金: relief when it's needed, wealth levels, 真相.
function acctHtml() {
  const w = passWallet();
  const { worth, at, next } = rankOf(w);
  const row = (tool, glyph, color, title, small, end = '') => `<button class="q-ritem chevron" type="button" data-action="tool" data-tool="${tool}">${tileHtml(glyph, color)}<span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span><small class="num">${h(small)}</small></span>${end}</button>`;
  const relief = reliefWorth(w) < RELIEF.under ? `<button class="callout" type="button" data-action="tool" data-tool="relief">${h(t('reliefCallout', { v: money(RELIEF.under, BASE) }))}</button>` : '';
  return `${relief}<div class="q-rowcard">
    ${row('ranks', ico('trophy'), TINT.orange, t('ranksTitle'), `${WEALTH_RANKS[at].icon} ${rankName(WEALTH_RANKS[at])}${next ? ` · ${t('rankToGo', { v: money(next.min - worth, BASE) })}` : ''}`)}
    ${row('truth', ico('spark'), TINT.teal, t('truthTitle'), t('truthSub'))}
  </div>`;
}

// 急難紓困 (a sheet, its hero the amount): ask for it, or why not now, and the rules.
function reliefSheetHtml() {
  const w = passWallet();
  const worth = reliefWorth(w);
  const check = reliefCheck(w, worth, Date.now());
  const main = check.ok
    ? `<button class="q-btn primary block" type="button" data-action="relief">${h(t('reliefApply', { v: money(RELIEF.amount, BASE) }))}</button>`
    : `<p class="foot-note">${h(t(`reliefWhy_${check.why}`, { v: money(RELIEF.under, BASE), d: check.until ? shortDate(check.until) : '' }))}</p>`;
  return `${main}<p class="foot-note">${h(t('reliefRules', { under: money(RELIEF.under, BASE), weeks: RELIEF.everyWeeks, year: RELIEF.perYear }))}</p>`;
}
// A row of facts: a title over a line, its figure on the right.
const factRow = (title, value, small = '', dir = '') => `<div class="q-ritem"><span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span>${small ? `<small>${h(small)}</small>` : ''}</span><span class="q-ritem-end"><strong class="num ${dir}">${h(value)}</strong></span></div>`;
async function doRelief() {
  if (!(await askKit({ lang: locale, icon: '🤝', title: t('reliefAsk', { v: money(RELIEF.amount, BASE) }), body: t('reliefBody'), ok: t('reliefOk'), cancel: t('orderAskCancel') }))) return;
  try {
    await q.relief();
    toast(t('reliefDone', { v: money(RELIEF.amount, BASE) }), 'good');
  } catch (e) {
    toast(passRefusal(e), 'bad');
  }
  render();
}
// The Worker's no to relief, in the app's words.
const passRefusal = e =>
  e?.code === 'ECO_RELIEF_REFUSED' && e.why
    ? t(`reliefWhy_${e.why}`, { v: money(RELIEF.under, BASE), d: e.until ? shortDate(e.until) : '' })
    : passError(e, locale);

// 財富等級 (a sheet): every level, its one-time reward, and where the account is.
function ranksHtml() {
  const w = passWallet();
  const { at } = rankOf(w);
  const paidOf = id => (w.entries || []).find(e => e.app === 'eco' && e.id === `eco:rank:${id}`)?.amount;
  return `<div class="q-rowcard">${WEALTH_RANKS.map((r, i) => {
    const paid = paidOf(r.id);
    const end = i === at ? `<span class="q-tag tint">${h(t('rankNow'))}</span>` : r.reward ? `<span class="q-tag${paid != null ? '' : ' orange'} num">${h(paid != null ? t('rankPaid', { v: money(paid, BASE) }) : `+${money(r.reward, BASE)}`)}</span>` : '';
    return `<div class="q-ritem${i < at ? ' passed' : ''}">${tileHtml(r.icon, i <= at ? TINT.orange : TINT.gray)}<span class="q-ritem-text"><span class="q-ritem-title">${h(rankName(r))}</span><small class="num">${h(r.min ? money(r.min, BASE) : '—')}</small></span><span class="q-ritem-end">${end}</span></div>`;
  }).join('')}</div><p class="foot-note">${h(t('ranksSub'))}</p>`;
}

// 真相 (a sheet): where the money came from (the system, interest and fees,
// the government, the account's own result: together its worth), the government's side tax by tax, and what
// trading really costs.
function truthHtml() {
  const w = passWallet();
  const s = moneySides(w);
  const g = s.gov;
  const dir = x => (x > 0 ? 'up-ink' : x < 0 ? 'down-ink' : '');
  const sides = [
    factRow(t('sideGod'), money(s.given, BASE), [t('sideGodStart', { v: money(s.gave.start, BASE) }), t('sideGodPay', { v: money(s.gave.pay, BASE) }), s.gave.rank ? t('sideGodRank', { v: money(s.gave.rank, BASE) }) : '', s.gave.other ? t('sideGodOther', { v: money(s.gave.other, BASE) }) : ''].filter(Boolean).join(' · ')),
    Math.round(s.fees) ? factRow(t('sideFees'), money(-s.fees, BASE, { sign: true }), t('sideFeesSub'), 'down-ink') : '',
    factRow(t('sideGov'), money(g.net, BASE, { sign: true }), t('sideGovSub', { paid: money(g.paidTotal, BASE), got: money(g.gotTotal, BASE) }), dir(g.net)),
    factRow(t('sideYou'), money(s.own, BASE, { sign: true }), t('sideYouSub'), dir(s.own))
  ].join('');
  const govSub = { under: money(RELIEF.under, BASE), amount: money(RELIEF.amount, BASE), weeks: RELIEF.everyWeeks, year: RELIEF.perYear };
  const govRows = [
    ...Object.keys(g.paid).map(k => factRow(t(`gov_${k}`), g.paid[k] ? `−${money(g.paid[k], BASE)}` : money(0, BASE), t(`govSub_${k}`, govSub), g.paid[k] ? 'down-ink' : '')),
    ...Object.entries(g.got).map(([k, v]) => factRow(t(`gov_${k}`), v ? `+${money(v, BASE)}` : money(0, BASE), t(`govSub_${k}`, govSub), v ? 'up-ink' : ''))
  ].join('');
  const trip = roundTrip(100_000);
  const day = roundTrip(100_000, { dayTrade: true });
  const od = overdraftPaid(w);
  const p2 = x => pct(x, { digits: 2, sign: false });
  return `${sectionHtml(t('sidesTitle'), `<div class="q-rowcard">${sides}</div>`)}
    ${sectionHtml(t('govTitle'), `<div class="q-stats">${stat(t('govPaid'), money(g.paidTotal, BASE))}${stat(t('govGot'), money(g.gotTotal, BASE))}</div><div class="q-rowcard">${govRows}</div>`)}
    ${sectionHtml(
      t('tripTitle'),
      `<div class="q-rowcard">
        ${factRow(t('tripCost'), money(trip.total, BASE), t('tripCostSub', { fee: money(trip.fee, BASE), tax: money(trip.tax, BASE), share: p2(trip.share) }))}
        ${factRow(t('tripDay'), money(day.total, BASE), t('tripDaySub', { tax: p2(STOCK.dayTradeTax), share: p2(day.share) }))}
        ${factRow(t('tripWeek'), money(trip.total * 52, BASE), t('tripWeekSub'))}
        ${factRow(t('tripMargin'), rateText(STOCK.loanRate), t('tripMarginSub'))}
        ${factRow(t('tripOd'), rateText(overdraftYear()), t('tripOdSub', { month: rateText(0.01), penalty: rateText(STOCK.penalty) }))}
        ${od > 0 ? factRow(t('tripOdPaid'), money(od, BASE)) : ''}
      </div><p class="foot-note">${h(t('tripFoot'))}</p>`
    )}`;
}

// The exchange, as the tab's hero: what you pay over what you get, the rate
// and its cost as tags, one button.
function exchangeHtml() {
  const f = state.fx;
  const s = snap();
  const amount = fxPayAmount();
  const q = amount > 0 ? quoteExchange(f.from, f.to, amount, state.rates, state.fxOpen) : null;
  // Unsettled sale proceeds can't be exchanged yet.
  const have = Math.max(0, withdrawable(state.account, s)[f.from] || 0);
  const haveTo = Math.max(0, withdrawable(state.account, s)[f.to] || 0);
  const waiting = unsettled(state.account)[f.from] || 0;
  const mid = state.rates[f.from] && state.rates[f.to] ? state.rates[f.from] / state.rates[f.to] : null;
  const spread = fxSpread(f.from, f.to, state.fxOpen);
  const tooMuch = amount > have + 1e-9;
  const pay = f.mode === 'get';
  const input = label => `<input id="fx-amount" class="fx-input num" inputmode="decimal" autocomplete="off" value="${h(f.amount)}" placeholder="0" aria-label="${h(label)}" />`;
  // The side you type in is an input; the other shows the result.
  const payBox = pay ? `<strong class="fx-result num">${q ? h(money(amount, f.from)) : '—'}</strong>` : input(t('amount'));
  const getBox = pay ? input(t('fxWantAmount')) : `<strong class="fx-result num">${q ? h(money(q.received, f.to)) : '—'}</strong>`;
  return `<div class="q-hero-card fx-hero">
      <div class="fx-side">
        <div class="fx-side-top"><span>${h(t('fxYouPayLabel'))}</span><button class="fx-mode" type="button" data-action="fx-mode" data-mode="${pay ? 'pay' : 'get'}">${h(pay ? t('fxTypePay') : t('fxTypeGet'))}</button></div>
        <div class="fx-side-row">${currencySelect('fx-from', f.from)}${payBox}</div>
        <div class="fx-side-foot"><span class="num">${h(t('fxAvailable', { amount: money(have, f.from) }))}</span>
          ${pay ? '' : `<span class="fx-quick">${[0.25, 0.5, 1].map(x => `<button type="button" data-action="fx-pct" data-pct="${x}">${x === 1 ? h(t('all')) : `${x * 100}%`}</button>`).join('')}</span>`}</div>
      </div>
      <button class="fx-swap q-press" type="button" data-action="fx-swap" aria-label="${h(t('swap'))}">${ico('swap')}</button>
      <div class="fx-side">
        <div class="fx-side-top"><span>${h(t('fxYouGetLabel'))}</span></div>
        <div class="fx-side-row">${currencySelect('fx-to', f.to)}${getBox}</div>
        <div class="fx-side-foot"><span class="num">${h(t('fxYouHave', { amount: money(haveTo, f.to) }))}</span></div>
      </div>
      <span class="hc-tags fx-tags">
        <span class="hc-fact num">${q ? h(rateLine(f.from, f.to, q.rate)) : mid ? h(rateLine(f.from, f.to, mid)) : '—'}</span>
        <span class="hc-fact num">${h(t('spread'))} ${h(pct(spread, { digits: 2, sign: false }))}${state.fxOpen ? '' : ` ${h(t('closedDouble'))}`}</span>
        ${q ? `<span class="hc-fact num">${h(t('fxCost'))} ${h(money(q.spreadTWD, BASE, { digits: q.spreadTWD < 10 ? 2 : 0 }))}</span>` : ''}
      </span>
      <button class="q-hc-btn q-press" type="button" data-action="fx-go" ${q && q.received > 0 && !tooMuch && f.from !== f.to && pricesLive() ? '' : 'disabled'}>${h(q && !tooMuch ? t('fxConfirm', { from: money(amount, f.from), to: money(q.received, f.to) }) : t('doExchange'))}</button>
    </div>
    ${tooMuch ? `<p class="warn">${h(t('notEnoughCur', { cur: f.from, have: money(have, f.from) }))}</p>` : ''}
    ${fxYearLine(f, q)}
    ${waiting > 0 ? `<p class="foot-note">${h(t('unsettledNote', { amount: money(waiting, f.from), date: shortDate(settlesBy(state.account)[f.from]) }))}</p>` : ''}
    ${pricesLive() ? '' : `<p class="warn">${h(t('waitLive'))}</p>`}`;
}
// 結匯: a NT$ conversion counts toward the year's US$5,000,000 each way
// (stock-access fxYear): what's left, said once it matters (a tenth used);
// past it, why it can't go.
function fxYearLine(f, q) {
  if (!stockAccess.fxYear || (f.from !== BASE && f.to !== BASE)) return '';
  const y = stockAccess.fxYear(state.account, state.rates, Date.now());
  const left = f.from === BASE ? y.leftBuy : y.leftSell;
  const cap = stockAccess.FX_YEAR_CAP_USD;
  const over = q && stockAccess.fxCapProblem(state.account, { from: f.from, to: f.to, amount: fxPayAmount(), received: q.received }, state.rates, Date.now());
  if (over) return `<p class="warn">${h(errorText(over))}</p>`;
  return left < cap * 0.9 ? `<p class="foot-note num">${h(t('fxYearLeft', { left: money(Math.floor(left), 'USD'), cap: money(cap, 'USD') }))}</p>` : '';
}
// 結匯 of NT$500,000 or more: the 申報書 confirmed in the same ask.
const fxDeclare = (from, to, amount, received) => Boolean(stockAccess.fxNeedsDeclare?.({ from, to, amount, received }));
// The rates board, as a bank shows it: what it buys and sells each currency
// for (per unit, or per 100 for the small ones), and today's move. A row
// opens the exchange for that currency. (No USD chart over it: the board
// already has USD, and a day's line said nothing to act on.)
// The rates board, as a bank shows it (a sheet): what it buys and sells each
// currency for (per unit, or per 100 for the small ones), and today's move.
// A row opens the exchange for that currency.
function ratesHtml() {
  return `<div class="rates-board">
    <div class="rates-head"><span>${h(t('ratesCurrency'))}</span><span>${h(t('bankBuys'))}</span><span>${h(t('bankSells'))}</span><span>${h(t('ratesChange'))}</span></div>
    <div class="q-rowcard">${Object.keys(CURRENCIES).filter(c => c !== BASE).map(c => rateRow(c, true)).join('')}</div>
  </div>
  <button class="q-btn tinted block" type="button" data-action="fx-trade">${h(t('fxTradeButton'))}</button>`;
}
// Today's move as coloured text (up / down in the person's colours).
function pctText(q) {
  if (!q || !Number.isFinite(q.pct)) return '<span class="num muted">—</span>';
  const cls = q.pct > 0 ? 'up-ink' : q.pct < 0 ? 'down-ink' : 'muted';
  return `<span class="num ${cls}">${h(pct(q.pct, { digits: 2 }))}</span>`;
}

// What leaves the `from` wallet: the typed amount, or (typing what you want
// to receive) what it takes to get that much after the spread.
function fxPayAmount() {
  const f = state.fx;
  const typed = Number(f.amount);
  if (!(typed > 0)) return 0;
  if (f.mode !== 'get') return typed;
  return amountFor(f.from, f.to, typed, state.rates, state.fxOpen) || 0;
}

// A currency's rate: its flag, what the bank sells it for, today's move
// (the board's four columns in the sheet).
function rateRow(c, board = false) {
  const q = state.quotes.get(fxSymbol(c));
  const info = currencyInfo(c);
  const sp = fxSpread(c, BASE, state.fxOpen);
  const unit = info.digits === 0 && q?.price < 1 ? 100 : 1;
  const digits = q && q.price * unit < 1 ? 4 : 3;
  const sells = q ? h(num(q.price * unit * (1 + sp), digits)) : '…';
  const name = board
    ? `<span class="q-ritem-text"><span class="q-ritem-title">${h(c)}</span><small>${h(L(info))}${unit > 1 ? ` ×${unit}` : ''}</small></span>`
    : `<span class="q-ritem-text"><span class="q-ritem-title">${h(c)}${unit > 1 ? ` <em class="unit">×${unit}</em>` : ''}</span><small>${h(L(info))}</small></span>`;
  if (board)
    return `<button class="q-ritem rate-row board" type="button" data-action="fx-to" data-cur="${h(c)}">${name}
      <span class="num">${q ? h(num(q.price * unit * (1 - sp), digits)) : '…'}</span><span class="num">${sells}</span>${pctText(q)}</button>`;
  return `<button class="q-ritem rate-row" type="button" data-action="fx-to" data-cur="${h(c)}">${tileHtml(curMark(c), TINT.teal, 'soft flag')}${name}
    <span class="q-ritem-end"><strong class="num">${sells}</strong>${pctTag(q)}</span></button>`;
}

// 定存 (a sheet): the terms, the amount, what it will earn; the deposits held.
function tdHtml() {
  const v = valuation();
  const s = snap();
  const d = state.td;
  const free = Math.max(0, withdrawable(state.account, s)[BASE] || 0);
  const amount = Math.round(Number(d.amount) || 0);
  const term = TD_TERMS.find(x => x.months === d.months) || TD_TERMS.at(-1);
  const ok = amount >= TD_MIN && amount <= free;
  const tds = v.tds || [];
  return `<div class="term-grid" role="group">${TD_TERMS.map(x => `<button class="term q-press" type="button" data-action="td-term" data-months="${x.months}" aria-pressed="${x.months === term.months}"><strong class="num">${x.months}</strong><small>${h(t('monthsUnit'))}</small><span class="num">${h(pct(tdRate(x.months), { digits: 2, sign: false }))}</span></button>`).join('')}</div>
    <label class="big-field"><span>${h(t('amount'))}<em class="num">${h(t('tdHave', { v: money(free, BASE) }))}${free >= TD_MIN ? `<button class="q-tag tint" type="button" data-action="td-max">${h(t('tdAll'))}</button>` : ''}</em></span><input id="td-amount" class="num" inputmode="numeric" enterkeyhint="done" autocomplete="off" value="${h(amount > 0 ? num(amount) : '')}" placeholder="${h(num(TD_MIN))}" />${ok ? `<em class="big-field-end num">${h(t('tdEarnTag', { v: money(tdPreview(amount, term.months, Date.now()).gross, BASE) }))}</em>` : ''}</label>
    <label class="check-row kb-hide"><input id="td-renew" type="checkbox" class="sw" ${d.renew ? 'checked' : ''} /><i class="q-switch" aria-hidden="true"></i> <span><b>${h(t('tdRenew'))}</b><small>${h(t('tdRenewSub'))}</small></span></label>
    ${amount > 0 && !ok ? `<p class="warn">${h(amount < TD_MIN ? t('err_tdMin', { min: money(TD_MIN, BASE) }) : t('tdTooMuch'))}</p>` : ''}
    <button class="q-btn primary block" type="button" data-action="td-open" ${ok ? '' : 'disabled'}>${h(t('tdOpen'))}</button>
    ${sectionHtml(
      t('tdYours'),
      tds.length
        ? `<div class="q-rowcard">${tds
            .map(td => `<div class="q-ritem">${tileHtml(svgIcon('lock'), TINT.green)}<span class="q-ritem-text"><span class="q-ritem-title num">${h(money(td.amount, BASE))}</span><small class="num">${h(t('tdEnds', { date: fmtDate(td.ends), v: money(tdFull(td), BASE) }))}</small><span class="q-tags"><span class="q-tag">${h(t('tdMonths', { n: td.months }))} ${h(pct(td.rate, { digits: 3, sign: false }))}</span>${td.renew ? `<span class="q-tag tint">${h(t('tdRenewTag'))}</span>` : ''}</span></span><button class="q-btn small" type="button" data-action="td-break" data-id="${h(td.id)}">${h(t('tdBreak'))}</button></div>`)
            .join('')}</div>`
        : '',
      { side: v.savedTWD > 0 ? `<strong class="sec-value num">${h(money(v.savedTWD, BASE))}</strong>` : '' }
    )}`;
}

// 期貨保證金專戶 (a sheet): what's in the futures account and what it holds,
// and 入金 from the settled NT$ cash or 出金 of what the margins leave.
const futxRoom = () =>
  state.futx.dir === 'in' ? Math.floor(Math.max(0, withdrawable(state.account, snap())[BASE] || 0)) : stockAccount.futWithdrawable(state.account, valuation(), Date.now());
function futAcctHtml() {
  const v = valuation();
  const d = state.futx;
  const isIn = d.dir !== 'out';
  const open = stockAccess.accessState(state.account, 'futures', Date.now());
  const room = futxRoom();
  const amount = Math.round(Number(d.amount) || 0);
  const ok = open.open && amount >= 1 && amount <= room;
  const free = futFree(snap());
  const stat2 = (label, value) => `<div class="q-ritem"><span class="q-ritem-text"><span class="q-ritem-title">${h(label)}</span></span><strong class="num">${h(value)}</strong></div>`;
  return `<div class="q-rowcard">${stat2(t('futCashWord'), money(v.futCash || 0, BASE))}${stat2(t('futOpenPl'), money(v.futTWD || 0, BASE))}${stat2(t('futMarginWord'), money(v.futMarginTWD || 0, BASE))}${stat2(t('futFreeWord'), money(free, BASE))}</div>
    <p class="foot-note">${h(t('futAcctFoot'))}</p>
    ${open.open ? '' : `${open.pending ? `<p class="foot-note">${h(t('accessPendingLine', { date: dateTime(open.pending) }))}</p>` : ''}<button class="q-btn primary block" type="button" data-action="access-open" data-key="futures">${h(t(open.pending ? 'accessSee' : 'futAcctOpen'))}</button>`}
    ${open.open ? `${seg([['in', t('futIn')], ['out', t('futOut')]], 'futx-dir', 'dir', x => d.dir === x)}
    <label class="big-field"><span>${h(t('amount'))}<em class="num">${h(t(isIn ? 'futInHave' : 'futOutHave', { v: money(room, BASE) }))}${room >= 1 ? `<button class="q-tag tint" type="button" data-action="futx-max">${h(t('tdAll'))}</button>` : ''}</em></span><input id="futx-amount" class="num" inputmode="numeric" enterkeyhint="done" autocomplete="off" value="${h(amount > 0 ? num(amount) : '')}" placeholder="0" /></label>
    ${amount > room ? `<p class="warn">${h(t(isIn ? 'tdTooMuch' : 'err_futOut', { have: money(room, BASE) }))}</p>` : ''}
    <button class="q-btn primary block" type="button" data-action="futx-go" ${ok ? '' : 'disabled'}>${h(t(isIn ? 'futIn' : 'futOut'))}</button>` : ''}`;
}
function doFutTransfer() {
  const d = state.futx;
  const amount = Math.round(Number(d.amount) || 0) * (d.dir === 'out' ? -1 : 1);
  const r = stockAccount.futTransfer(state.account, amount, { valuation: valuation(), now: Date.now() });
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  toast(t(amount > 0 ? 'futInDone' : 'futOutDone', { v: money(Math.abs(amount), BASE) }), 'good');
  d.amount = '';
  render();
}
// The futures ticket's 入金 button, when what it opens needs more than the futures account has.
const futInButton = short => (short && snap()?.futSplit && stockAccount.futTransfer ? `<button class="q-btn tinted block acc-go" type="button" data-action="futx-open">${h(t('futInGo'))}</button>` : '');

// 借券出借 (a sheet): what can be lent and for about how much, the ask, what's out.
function lendHtml() {
  const v = valuation();
  const now = Date.now();
  const lendRows = v.positions.filter(p => !p.short && lendable(p.market, p.kind));
  const lent = v.lent || [];
  return `${lendRows.length ? `<div class="q-rowcard">${lendRows.map(p => lendRowHtml(p, now)).join('')}</div>` : emptyHtml({ icon: 'lock', tint: TINT.orange, title: t('lendNoneTitle'), body: t('lendNone') })}
    ${lendAsks() && lendRows.some(p => lendableQty(state.account, p.symbol, now) > 0) ? lendFormHtml() : ''}
    ${sectionHtml(t('lendOut'), lent.length ? `<div class="q-rowcard">${lent.map(l => lentRowHtml(l, now)).join('')}</div>` : '')}`;
}
// 借券出借 as the kit has it (read through the module: an older kit lends at
// the going rate only, for 180 days): the lender's own yearly ask, 0.01% to
// 16%, lent only at or under the going rate a borrower pays (LEND_RATE);
// six months, renewed twice where the lender agrees; the fee accrued day by
// day on each day's close and paid when the shares come back.
const lendPct = x => pct(x, { digits: 2, sign: false });
const lendAsks = () => stockSavings.LEND_RATE_MAX != null;
// The ask typed (a yearly %, as a share), or null for the going rate.
const lendAsk = () => (lendAsks() && state.lend.rate !== '' && Number.isFinite(Number(state.lend.rate)) ? Number(state.lend.rate) / 100 : null);
// Why an ask won't lend `kind`: out of the range, or above the going rate.
function lendAskProblem(kind, ask = lendAsk()) {
  if (ask == null) return '';
  const min = stockSavings.LEND_RATE_MIN;
  const max = stockSavings.LEND_RATE_MAX;
  if (!(ask >= min - 1e-9 && ask <= max + 1e-9)) return t('err_lendRate', { min: rateText(min), max: rateText(max) });
  const going = stockSavings.LEND_RATE?.[kind] ?? 0;
  return ask > going + 1e-9 ? t('lendTooHigh', { rate: lendPct(going) }) : '';
}
// When a contract ends by itself (lendEnds: six months, or 18 with its renewals).
const lendEndsAt = l => stockSavings.lendEnds(l);

// The daily closes of what's lent (lendFee charges each day at its close),
// read once a session per symbol: a Promise while loading, the closes, or
// null when the read failed (the lending price stands in).
const lendCloses = new Map();
const lendClosesOf = symbol => (Array.isArray(lendCloses.get(symbol)) ? lendCloses.get(symbol) : null);
function loadLendCloses(account, now = Date.now()) {
  if (!lendAsks() || !account) return;
  for (const l of Object.values(replay(account, now).lent || {})) {
    if (l.back || lendCloses.has(l.symbol)) continue;
    const read = fetchChart(l.symbol, historyRange(now - l.t))
      .then(c => (c?.points?.length ? c.points.filter(([, c]) => c > 0).map(([t, c]) => ({ t, c })) : null))
      .catch(() => null)
      .then(closes => {
        lendCloses.set(l.symbol, closes);
        if (state.tool === 'lend') renderTool();
        return closes;
      });
    lendCloses.set(l.symbol, read);
  }
}
// Whether every contract due to end has its closes read (or failed): it ends then, its fee day by day.
const lendClosesReady = (account, now) => !lendAsks() || Object.values(replay(account, now).lent || {}).every(l => l.back || lendEndsAt(l) > now || !(lendCloses.get(l.symbol) instanceof Promise || !lendCloses.has(l.symbol)));

function lendFormHtml() {
  const going = stockSavings.LEND_RATE || {};
  return `<label class="field"><span>${h(t('lendRateLabel'))} (%)</span><input id="lend-rate" class="q-field num" inputmode="decimal" autocomplete="off" value="${h(state.lend.rate)}" placeholder="${h(t('lendRateGoing'))}" /></label>
    <label class="check-row"><input id="lend-renew" type="checkbox" class="sw" ${state.lend.renew ? 'checked' : ''} /><i class="q-switch" aria-hidden="true"></i> <span>${h(t('lendRenew', { n: stockSavings.LEND_RENEWALS, months: stockSavings.LEND_TERM_MONTHS }))}</span></label>
    <p class="foot-note">${h(t('lendRateHelp', { min: rateText(stockSavings.LEND_RATE_MIN), max: rateText(stockSavings.LEND_RATE_MAX), stock: rateText(going.stock || 0), etf: rateText(going.etf || 0) }))}</p>`;
}

function lendRowHtml(p, now) {
  const can = lendableQty(state.account, p.symbol, now);
  const { rate, net: yearNet } = lendYear(p.kind, can, p.price, lendAsk());
  const why = p.financed > 0 ? t('lendWhyMargin') : can ? lendAskProblem(p.kind) : p.lent > 0 && p.qty - p.lent <= 0 ? t('lendWhyAllLent') : p.qty - (p.lent || 0) < LEND_LOT ? t('lendWhyLot') : t('lendWhySettle');
  return `<div class="q-ritem">${symbolBadge(p.symbol)}<button class="q-ritem-text link-text" type="button" data-action="open" data-symbol="${h(p.symbol)}"><span class="q-ritem-title">${h(nameOf(p.symbol))}</span><small class="num">${h(can && !why ? t('lendCan', { qty: fmtQty(can), rate: pct(rate * (1 - LEND_CUT), { digits: 2, sign: false }), v: money(yearNet, BASE) }) : why)}</small></button>${can ? `<button class="q-btn small primary" type="button" data-action="lend" data-symbol="${h(p.symbol)}" data-qty="${can}">${h(t('lendGo'))}</button>` : ''}</div>`;
}

function lentRowHtml(l, now) {
  const so = lendFee(l, l.back || now, lendClosesOf(l.symbol)).net;
  const terms = lendAsks() ? ` · ${t('lendAt', { rate: lendPct(l.rate) })}${l.back ? '' : ` · ${t(l.renew ? 'lendEndsRenew' : 'lendEnds', { date: fmtDate(lendEndsAt(l)) })}`}` : '';
  return `<div class="q-ritem">${symbolBadge(l.symbol)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(l.symbol))} · ${h(fmtQty(l.qty))} ${h(unitOf(l.symbol))}</span><small class="num">${h(l.back ? t('lendBack', { date: fmtDate(l.back) }) : t('lendSince', { date: fmtDate(l.t) }))}${h(terms)}</small><span class="q-tags"><span class="q-tag green num">${h(t('lendSoFar', { v: money(so, BASE) }))}</span></span></span>${l.back ? '' : `<button class="q-btn small" type="button" data-action="recall" data-id="${h(l.id)}">${h(t('lendRecall'))}</button>`}</div>`;
}
async function doOpenDeposit() {
  const d = state.td;
  const amount = Math.round(Number(d.amount) || 0);
  const term = TD_TERMS.find(x => x.months === d.months);
  if (!term) return;
  const { rate, gross, ends } = tdPreview(amount, term.months, Date.now());
  if (!(await askKit({ lang: locale, icon: '🏦', title: t('tdAsk', { v: money(amount, BASE), n: term.months }), points: [['📈', t('tdAskRate', { rate: pct(rate, { digits: 3, sign: false }) }), t('tdAskEarn', { v: money(gross, BASE) })], ['🔒', t('tdAskLock', { date: fmtDate(ends) }), t('tdAskEarly', { early: pct(TD_EARLY, { digits: 0, sign: false }) })]], ok: t('tdOpen'), cancel: t('orderAskCancel') }))) return;
  const r = openDeposit(state.account, { amount, months: term.months, renew: d.renew }, Date.now());
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  d.amount = '';
  toast(t('tdDone', { v: money(amount, BASE) }), 'good');
  render();
}

async function doBreakDeposit(id) {
  const now = Date.now();
  const td = snap().tds[id];
  if (!td) return;
  const full = tdFull(td);
  const got = tdInterest(td, now).gross;
  if (!(await askKit({ lang: locale, icon: '⚠️', title: t('tdBreakAsk'), points: [['💸', t('tdBreakGet', { v: money(got, BASE) }), t('tdBreakLose', { v: money(Math.max(0, full - got), BASE) })]], ok: t('tdBreak'), cancel: t('orderAskCancel'), danger: true }))) return;
  const r = breakDeposit(state.account, id, now);
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  toast(t('tdBroken', { v: money(r.event.amount + r.event.net, BASE) }), 'good');
  render();
}

async function doLend(symbol, qty) {
  const q = state.quotes.get(symbol);
  if (!q?.price) return toast(t('err_noQuote'), 'bad');
  const v = valuation();
  const p = v.positions.find(x => x.symbol === symbol);
  const mine = lendAsk();
  const renew = lendAsks() && state.lend.renew;
  const req = { symbol, qty, price: q.price, ...(mine != null ? { rate: mine } : {}), ...(renew ? { renew: true } : {}) };
  // The kit's checks first (the ask's range, a borrower at that rate), before asking.
  const tried = lendShares(state.account, req, Date.now());
  if (tried.error) return toast(errorText(tried), 'bad');
  const { net: yearNet } = lendYear(p?.kind || 'stock', qty, q.price, mine);
  const term = lendAsks()
    ? [['📅', t('lendAskTerm', { rate: lendPct(tried.event.rate), date: fmtDate(lendEndsAt(tried.event)) }), t(renew ? 'lendAskRenew' : 'lendAskNoRenew', { n: stockSavings.LEND_RENEWALS, months: stockSavings.LEND_TERM_MONTHS })]]
    : [];
  if (!(await askKit({ lang: locale, icon: '🤝', title: t('lendAsk', { qty: fmtQty(qty), name: nameOf(symbol) }), points: [['💰', t('lendAskEarn', { v: money(yearNet, BASE) }), t('lendAskCut', { cut: pct(LEND_CUT, { digits: 0, sign: false }) })], ...term, ['🔒', t('lendAskLock'), t('lendAskRecall', { days: LEND_RECALL })], ['🧾', t('lendAskTax'), t('lendAskNhi')]], ok: t('lendGo'), cancel: t('orderAskCancel') }))) return;
  const r = lendShares(state.account, req, Date.now());
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  toast(t('lendDone', { qty: fmtQty(qty), name: nameOf(symbol) }), 'good');
  render();
}

async function doRecall(id) {
  if (!(await askKit({ lang: locale, icon: '↩️', title: t('lendRecallAsk'), body: t('lendRecallBody', { days: LEND_RECALL }), ok: t('lendRecall'), cancel: t('orderAskCancel') }))) return;
  // The fee day by day at each day's close (read now if it isn't yet).
  const l = replay(state.account, Date.now()).lent?.[id];
  if (l && lendAsks()) {
    loadLendCloses(state.account);
    await lendCloses.get(l.symbol);
  }
  const r = recallShares(state.account, id, Date.now(), { closes: l ? lendClosesOf(l.symbol) : null });
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  toast(t('lendRecalled', { date: fmtDate(r.back) }), 'good');
  render();
}

// 融資 (a sheet): what's borrowed, the maintenance ratio and its gauge, a
// call's ways to meet it, and repaying.
function loansHtml() {
  const v = valuation();
  const l = state.loan;
  const s = snap();
  const loan = s.loans[l.currency];
  const avail = available(state.account, s);
  const amount = Number(l.amount);
  // Loans come from 融資 buys (the ticket); here they're repaid.
  const canRepay = loan?.balance > 0 && amount > 0;
  // Nothing borrowed: one line on where loans come from, no form.
  if (!(v.debtTWD > 0) && !v.loans.length) return emptyHtml({ icon: 'bank', tint: TINT.indigo, title: t('noLoans'), body: t('loansIntroCredit') });
  return `<div class="q-stats kb-hide">
      ${stat(t('ratioShort'), pct(v.ratio, { digits: 0, sign: false }), t(`margin_${v.margin}`), v.margin === 'ok' ? '' : 'down')}
      ${stat(t('collateral'), money(v.collateral, BASE))}
      ${stat(t('interestAccrued'), money(v.interestTWD || 0, BASE, { digits: (v.interestTWD || 0) < 10 ? 2 : 0 }))}
    </div>
    ${v.debtTWD > 0 ? `<div class="card-box kb-hide">${gauge(v.ratio)}</div>` : ''}
    ${(x => (x ? `<div class="kb-hide">${x}</div>` : ''))(v.owed > 0 ? callPanelHtml(v) : '')}
    ${sectionHtml(
      t('repay'),
      `<div class="card-box">
        <div class="fx-side-row repay-row">${currencySelect('loan-cur', l.currency)}<input id="loan-amount" class="fx-input num" inputmode="decimal" autocomplete="off" value="${h(l.amount)}" placeholder="0" aria-label="${h(t('amount'))}" /></div>
        <div class="q-tags"><span class="q-tag num">${h(loan?.balance > 0 ? t('owed', { amount: money(loan.balance, l.currency) }) : t('noLoanCur', { cur: l.currency }))}</span></div>
        <div class="button-row"><button class="q-btn primary grow" type="button" data-action="repay" ${canRepay ? '' : 'disabled'}>${h(t('repay'))}</button>${loan?.balance > 0 ? `<button class="q-btn small" type="button" data-action="repay-all" ${(avail.cash[l.currency] || 0) > 0 ? '' : 'disabled'}>${h(t('repayAll'))}</button>` : ''}</div>
      </div>`
    )}
    ${sectionHtml(
      t('yourLoans'),
      v.loans.length
        ? `<div class="q-rowcard">${v.loans.map(x => `<div class="q-ritem">${tileHtml(curMark(x.currency), TINT.red, 'soft flag')}<span class="q-ritem-text"><span class="q-ritem-title">${h(x.currency)}</span><small class="num">${h(t('loanRate', { rate: pct(x.rate, { digits: 2, sign: false }) }))} · ${h(t('interestSoFar', { amount: money(x.interest, x.currency, { digits: 2 }) }))}</small></span><span class="q-ritem-end"><strong class="num down-ink">−${h(money(x.balance, x.currency))}</strong>${x.currency !== BASE ? `<small class="num">≈ −${h(money(x.twd, BASE))}</small>` : ''}</span></div>`).join('')}</div>`
        : ''
    )}`;
}

// The credit account (信用帳戶, a sheet): its limit and what's used, the terms
// of what's out with 展延; or, not open yet, what opening one needs.
function creditCardHtml(v) {
  const now = Date.now();
  const credit = creditAccount(state.account, now);
  const year = yearOfTrading(state.account, now);
  if (!credit.open) {
    const pick = CREDIT_TIERS.includes(state.creditTier) ? state.creditTier : CREDIT_TIERS[0];
    const check = creditCheck(state.account, pick, v.netWorth, now);
    const need = key => check.needs.find(n => n.key === key);
    const dayOk = dayTradeSellFirst(state.account, now);
    const dayRoom = dayOk ? dayTradeLeft(state.account, v.netWorth, now) : null;
    const row = (key, title, value = '') => `<div class="q-ritem">${tileHtml(need(key) ? svgIcon('alert') : ico('check'), need(key) ? TINT.orange : TINT.green, 'sm')}<span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span></span>${value ? `<span class="q-tag ${need(key) ? 'orange' : 'green'} num">${h(value)}</span>` : ''}</div>`;
    const ageNeed = need('age');
    return `${sectionHtml(t('creditPick'), `<div class="tier-grid" role="group">${CREDIT_TIERS.map(x => `<button class="tier q-press" type="button" data-action="credit-tier" data-limit="${x}" aria-pressed="${x === pick}" aria-label="${h(compactMoney(x, BASE))}"><strong class="num">${h(compact(x))}</strong></button>`).join('')}</div>`)}
      ${sectionHtml(
        t('creditNeeds'),
        `<div class="q-rowcard credit-checks">
        ${row('age', t('creditAgeOk'), ageNeed ? t('fromDate', { date: shortDate(ageNeed.from) }) : '')}
        ${row('trades', t('creditTradesT'), `${year.trades} / ${CREDIT_MIN_TRADES}`)}
        ${row('turnover', t('creditTurnoverT'), `${compact(year.turnoverTWD)} / ${compact(pick * CREDIT_TURNOVER)}`)}
        ${pick > CREDIT_TIERS[0] ? row('means', t('creditMeansT'), compactMoney(pick * CREDIT_PROOF, BASE)) : ''}
      </div>`
      )}
      <div class="q-rowcard"><div class="q-ritem">${tileHtml(dayOk ? ico('check') : ico('clock'), dayOk ? TINT.green : TINT.gray, 'sm')}<span class="q-ritem-text"><span class="q-ritem-title">${h(t('dayTradeTitle'))}</span><small class="num">${h(dayOk ? (dayRoom ? t('dayTradeLeftShort', { left: money(dayRoom.left, BASE) }) : '') : t('dayTradeNeed'))}</small></span>${dayOk ? `<span class="q-tag green">${h(t('dayTradeYes'))}</span>` : `<button class="q-btn small" type="button" data-action="access-open" data-key="daytrade">${h(t('accessGo'))}</button>`}</div></div>
      ${credit.pending ? `<p class="foot-note">${h(t('creditPendingLine', { v: compactMoney(credit.pending.limit, BASE), date: dateTime(credit.pending.from) }))}</p>` : `${sectionHtml(t('accessDocs'), docsHtml(stockCredit.CREDIT_DOCS || [], accessUi().docs))}
      <button class="q-btn primary block" type="button" data-action="credit-open" data-limit="${pick}" ${check.ok && (stockCredit.CREDIT_DOCS || []).every(x => accessUi().docs.has(x)) ? '' : 'disabled'}>${h(t('creditOpen', { v: compactMoney(pick, BASE) }))}</button>`}`;

  }
  const used = creditUsed(v);
  const better = bestTier(state.account, v.netWorth, now);
  const bar = (label, x) => `<div class="credit-use"><span>${h(label)}</span><strong class="num">${h(money(x, BASE))} / ${h(compactMoney(credit.limit, BASE))}</strong><div class="loan-bar"><i style="width:${Math.min(100, (x / credit.limit) * 100).toFixed(1)}%"></i></div></div>`;
  const list = creditTerms(v, now);
  return `<div class="card-box">${bar(t('creditLoanUsed'), used.loan)}${bar(t('creditShortUsed'), used.short)}</div>
    ${credit.pending ? `<p class="foot-note">${h(t('creditPendingLine', { v: compactMoney(credit.pending.limit, BASE), date: dateTime(credit.pending.from) }))}</p>` : ''}
    ${better > credit.limit && !credit.pending ? `<button class="q-btn tinted block" type="button" data-action="credit-open" data-limit="${better}">${h(t('creditRaise', { v: compactMoney(better, BASE) }))}</button>` : ''}
    ${sectionHtml(
      t('creditTermsTitle'),
      list.length
        ? `<div class="q-rowcard">${list.map(x => `<div class="q-ritem">${symbolBadge(x.symbol)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(x.symbol))}</span><small>${h(x.side === 'loan' ? t('termLoan') : t('termShort'))} · ${h(t('termDue', { date: fmtDate(x.due) }))}</small></span>${x.canExtend ? `<button class="q-btn small" type="button" data-action="extend" data-symbol="${h(x.symbol)}">${h(t('extend'))}</button>` : `<span class="q-tag">${h(t('extendFrom', { date: fmtDate(x.due - 30 * 86_400_000) }))}</span>`}</div>`).join('')}</div>`
        : '',
      { side: `<span class="q-tag tint">${h(t('creditLimitIs', { v: compactMoney(credit.limit, BASE) }))}</span>` }
    )}`;
}
function doOpenCredit(limit) {
  const r = openCredit(state.account, limit, valuation().netWorth, Date.now(), { docs: [...accessUi().docs] });
  if (r.error) return toast(r.error === 'credit' ? t('creditNotYet') : errorText(r), 'bad');
  commit(r.account);
  accessUi().docs = new Set();
  // (The broker opens it, or the new limit, the next trading day.)
  toast(r.event.from > r.event.t ? t('creditAppliedWait', { v: money(limit, BASE), date: shortDate(r.event.from) }) : t('creditOpened', { v: money(limit, BASE) }), 'good');
  render();
}
// 開戶與交易資格 (a sheet; the kit's stock-access.mjs): a row per account
// or permission with where it stands; each opens its page: what it needs
// (have / want), the papers to read and sign (each its own 我已詳閱並了解),
// KYC's six questions, and 申請. A broker approves some for the next trading day.
const KYC_OPTS = 3;
const accessUi = () => (state.accessUi ||= { key: null, docs: new Set(), answers: {}, li: [] });
// Where one stands, in a word: [text, tone].
function accessWord(key, now = Date.now()) {
  const a = stockAccess.accessState(state.account, key, now);
  if (a.open) return [key === 'kyc' && a.level ? `${t('accessOpen')} · ${t(`kyc_${a.level}`)}` : t('accessOpen'), 'green'];
  if (a.pending) return [t('accessPendingTag', { date: shortDate(a.pending) }), 'orange'];
  if (a.lapsed) return [t('accessLapsed'), 'red'];
  return [t('accessNone'), ''];
}
function accessTag(key, now = Date.now()) {
  const [word, tone] = accessWord(key, now);
  return `<span class="q-tag ${tone} num">${h(word)}</span>`;
}
function accessHtml() {
  const ui = accessUi();
  if (ui.key) return accessKeyHtml(ui.key);
  const glyph = { kyc: ico('list'), daytrade: ico('swap'), warrant: ico('ticket'), emerging: ico('spark'), innovation: ico('spark'), leveraged: ico('flame'), liFutures: ico('list'), futures: ico('chart'), sub: ico('exchange'), pro: ico('trophy') };
  const tint = { kyc: TINT.teal, daytrade: TINT.orange, warrant: TINT.purple, emerging: TINT.pink, innovation: TINT.green, leveraged: TINT.red, liFutures: TINT.orange, futures: TINT.indigo, sub: TINT.blue, pro: TINT.brown };
  return `<div class="q-rowcard">${stockAccess.ACCESS_KEYS.map(k => `<button class="q-ritem chevron" type="button" data-action="access-key" data-key="${k}">${tileHtml(glyph[k], tint[k])}<span class="q-ritem-text"><span class="q-ritem-title">${h(t(`acc_${k}`))}</span><small class="acc-word ${accessWord(k)[1]}">${h(accessWord(k)[0])}</small></span></button>`).join('')}</div>
    <p class="foot-note">${h(t('accessFoot'))}</p>`;
}
// One need (stock-access accessNeeds) in words.
function accessNeedText(n) {
  if (n.key === 'kyc') return t('needKyc');
  if (n.key === 'age') return t('needAge', { date: shortDate(n.from) });
  if (n.key === 'trades') return t('needTrades', { have: n.have, want: n.want });
  if (n.key === 'leveragedWay') return t('needLeveraged', { w: n.warrants, f: n.futures, want: n.want });
  if (n.key === 'means') return t('needMeans', { have: compactMoney(n.have, BASE), want: compactMoney(n.want, BASE) });
  return t('accessNotYet');
}
// The papers to read and sign: each a fold with what it says, and its own check.
const docsHtml = (docs, signed) =>
  docs
    .map(d => `<div class="acc-doc"><details><summary>${tileHtml(ico('book'), TINT.gray, 'sm')}<span>${h(t(`doc_${d}`))}</span></summary><ul>${t(`doc_${d}_says`).split('｜').map(x => `<li>${h(x)}</li>`).join('')}</ul></details><label class="acc-ok"><input type="checkbox" data-access-doc="${d}" ${signed.has(d) ? 'checked' : ''}><span>${h(t('docRead'))}</span></label></div>`)
    .join('');
function accessKeyHtml(key) {
  const ui = accessUi();
  const now = Date.now();
  const a = stockAccess.accessState(state.account, key, now);
  const spec = stockAccess.ACCESS[key];
  const back = `<button class="q-btn small acc-back" type="button" data-action="access-back">‹ ${h(t('accessAll'))}</button>`;
  const head = `<div class="card-box acc-head"><strong>${h(t(`acc_${key}`))}</strong><p>${h(t(`acc_${key}_what`))}</p><div class="q-tags">${accessTag(key, now)}${a.open && a.until ? `<span class="q-tag num">${h(t('accessUntil', { date: shortDate(a.until) }))}</span>` : ''}</div></div>`;
  // Open (KYC can be taken again any time), or waiting for the broker: nothing to sign.
  if ((a.open || a.pending) && key !== 'kyc') return `${back}${head}${a.pending ? `<p class="foot-note">${h(t('accessPendingLine', { date: dateTime(a.pending) }))}</p>` : ''}`;
  const needs = stockAccess.accessNeeds(state.account, key, { netWorthTWD: valuation()?.netWorth || 0 }, now);
  const needRows = needs.length ? sectionHtml(t('accessNeeds'), `<div class="q-rowcard acc-needs">${needs.map(n => `<div class="q-ritem">${tileHtml(svgIcon('alert'), TINT.orange, 'sm')}<span class="q-ritem-text"><span class="q-ritem-title">${h(accessNeedText(n))}</span></span>${n.key === 'kyc' ? `<button class="q-btn small" type="button" data-action="access-key" data-key="kyc">${h(t('accessGo'))}</button>` : ''}</div>`).join('')}</div>`) : '';
  let kyc = '';
  let result = null;
  if (key === 'kyc') {
    result = stockAccess.kycResult(ui.answers);
    kyc = stockAccess.KYC_QUESTIONS.map(q => sectionHtml(t(`kycQ_${q.id}`), `<div class="acc-pick" role="group">${Array.from({ length: KYC_OPTS }, (_, i) => `<button class="q-chip" type="button" data-action="access-kyc" data-q="${q.id}" data-i="${i}" aria-pressed="${ui.answers[q.id] === i}">${h(t(`kycA_${q.id}_${i}`))}</button>`).join('')}</div>`)).join('');
    if (result) kyc += `<div class="card-box acc-result"><strong>${h(t(`kyc_${result.level}`))}</strong><p>${h(t('kycResultLine', { rr: result.maxRR }))}</p></div>`;
  }
  // 槓反期貨 ETF 交易檢核表: each statement 是 or 否; a wrong one is marked once all are answered.
  let quiz = null;
  if (spec.quiz) {
    quiz = stockAccess.liCheckResult(ui.li);
    const marked = quiz.missing.length ? new Set() : new Set(quiz.wrong);
    kyc = sectionHtml(
      t('liTitle'),
      `<ol class="acc-quiz">${stockAccess.LI_FUTURES_CHECK.map((_, i) => `<li class="${marked.has(i) ? 'bad' : ''}"><p>${h(t(`liQ_${i}`))}</p><div class="acc-pick" role="group">${[true, false].map(v => `<button class="q-chip" type="button" data-action="access-li" data-i="${i}" data-v="${v}" aria-pressed="${ui.li[i] === v}">${h(t(v ? 'liYes' : 'liNo'))}</button>`).join('')}</div></li>`).join('')}</ol>
      ${!quiz.missing.length && quiz.wrong.length ? `<p class="warn">${h(t('err_liCheck', { n: quiz.wrong.length }))}</p>` : ''}`
    );
  }
  const docs = spec.docs.length ? sectionHtml(t('accessDocs'), docsHtml(spec.docs, ui.docs)) : '';
  const ready = !needs.length && spec.docs.every(d => ui.docs.has(d)) && (key !== 'kyc' || result) && (!quiz || quiz.ok);
  const word = key === 'kyc' ? (a.open ? t('kycAgain') : t('kycSubmit')) : spec.quiz ? t('liSign') : spec.wait ? t('accessApply') : t('accessSign');
  return `${back}${head}${needRows}${kyc}${docs}
    ${spec.wait ? `<p class="foot-note">${h(t('accessWaitNote'))}</p>` : ''}
    <button class="q-btn primary block" type="button" data-action="access-apply" data-key="${key}" ${ready ? '' : 'disabled'}>${h(word)}</button>`;
}
function openAccess(key = null) {
  const ui = accessUi();
  ui.key = key;
  ui.docs = new Set();
  ui.answers = {};
  ui.li = [];
  if (state.tool === 'access' && $('tool')?.open) return renderTool();
  openTool('access');
}
function doApplyAccess(key) {
  const ui = accessUi();
  const r = stockAccess.applyAccess(state.account, key, { netWorthTWD: valuation()?.netWorth || 0, answers: stockAccess.ACCESS[key]?.quiz ? ui.li : ui.answers, docs: [...ui.docs] }, Date.now());
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  const e = r.event;
  toast(key === 'kyc' ? t('kycDone', { level: t(`kyc_${e.level}`), rr: e.maxRR }) : e.from > e.t ? t('accessAppliedWait', { what: t(`acc_${key}`), date: shortDate(e.from) }) : t('accessSigned', { what: t(`acc_${key}`) }), 'good');
  ui.key = null;
  ui.docs = new Set();
  ui.answers = {};
  ui.li = [];
  render();
}
// What an order needs opened first (the ticket's line, with its button), or null.
function accessGate(q, d, extra = {}) {
  if (!stockAccess.accessProblem || !state.account) return null;
  return stockAccess.accessProblem(state.account, q, { side: d.side, ...extra }, Date.now());
}
const gateButton = g => (g?.error === 'accessNeeded' || g?.error === 'fundRisk' ? `<button class="q-btn tinted block acc-go" type="button" data-action="access-open" data-key="${g.error === 'fundRisk' ? 'kyc' : g.key}">${h(t(g.error === 'fundRisk' ? 'kycAgain' : g.pending ? 'accessSee' : 'accessGoApply'))}</button>` : '');

function doExtend(symbol) {
  const r = extendTerm(state.account, valuation(), symbol, Date.now());
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  toast(t('extended', { name: nameOf(symbol) }), 'good');
  render();
}

async function doExchange() {
  if (!pricesLive()) return;
  const f = state.fx;
  const amount = fxPayAmount();
  const quote = amount > 0 ? quoteExchange(f.from, f.to, amount, state.rates, state.fxOpen) : null;
  const declare = quote && fxDeclare(f.from, f.to, amount, quote.received);
  if (quote && !(await askKit({ lang: locale, icon: declare ? '🧾' : '💱', title: t('fxAsk', { from: money(amount, f.from), to: money(quote.received, f.to) }), body: declare ? t('fxDeclareBody') : t('fxAskBody'), ok: declare ? t('fxDeclareOk') : t('fxAskOk'), cancel: t('orderAskCancel') }))) return;
  const r = exchange(state.account, { from: f.from, to: f.to, amount: fxPayAmount() }, { rates: state.rates, fxOpen: state.fxOpen, now: Date.now() });
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  toast(t('fxDone', { from: money(r.event.amount, f.from), to: money(r.event.received, f.to) }), 'good');
  f.amount = '';
  render();
}

// 補繳: cash paid against the loans, as much as the call needs (or what there is).
async function payCall(amount) {
  if (!state.account || !(amount >= 1) || !pricesLive()) return;
  if (!(await askKit({ lang: locale, icon: '🏦', title: t('callPayAsk', { v: money(amount, BASE) }), body: t('callPayAskBody'), ok: t('callPayOk'), cancel: t('orderAskCancel') }))) return;
  const r = payDown(state.account, amount, { rates: state.rates, fxOpen: state.fxOpen, now: Date.now() });
  if (!(r.paid >= 1)) return toast(t('callNoCash'), 'bad');
  commit(r.account);
  afterPrices();
  toast(t('callPaid', { v: money(r.paid, BASE), ratio: pct(valuation().ratio, { digits: 0, sign: false }) }), 'good');
  render();
}

function doRepay(all = false) {
  const l = state.loan;
  // "Repay all" offers every unit of cash in the loan's currency; repay()
  // takes only what's owed.
  const amount = all ? Math.max(0, available(state.account, snap()).cash[l.currency] || 0) : Number(l.amount);
  const r = repay(state.account, { currency: l.currency, amount }, { now: Date.now() });
  if (r.error) return toast(errorText(r), 'bad');
  commit(r.account);
  toast(t('repaid', { amount: money(r.event.amount, l.currency) }), 'good');
  l.amount = '';
  render();
}

// ---- 紀錄: activity, orders, stats ------------------------------------------------------------

// Line glyphs (24×24, round 2px strokes like the kit's) for what the kit has no icon of.
const ICON_PATHS = {
  swap: 'M7 7h11l-3-3M17 17H6l3 3',
  coins: 'M12 7c4 0 7-1.3 7-3s-3-3-7-3-7 1.3-7 3 3 3 7 3zM5 4v6c0 1.7 3 3 7 3s7-1.3 7-3V4M5 10v6c0 1.7 3 3 7 3s7-1.3 7-3v-6',
  bank: 'M3 10h18L12 4 3 10zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  percent: 'M19 5 5 19M7 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  split: 'M6 4v6a6 6 0 0 0 6 6M18 4v6a6 6 0 0 1-6 6v4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  alert: 'M12 4 2.5 20h19L12 4zM12 10v4M12 17v.5',
  in: 'M12 4v12M6 10l6 6 6-6M5 20h14',
  hand: 'M4 14l4-4 3 3 3-3 6 6M4 20h16',
};
const svgIcon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`;
const actTile = (name, color) => tileHtml(svgIcon(name), color);
// A stock's record: its picture, with 買 / 賣 / 息 on its corner.
const symLead = (symbol, q, mark = '', cls = '') => `<span class="act-sym">${symbolBadge(symbol, q)}${mark ? `<i class="act-side ${cls}">${h(mark)}</i>` : ''}</span>`;

function activityRow(e) {
  const q = state.quotes.get(e.symbol);
  let lead;
  let title;
  let line = '';
  let meta = [];
  let amount = '';
  let tag = '';
  const fees = list => list.filter(Boolean);
  switch (e.type) {
    case 'fill': {
      lead = symLead(e.symbol, q, e.side === 'buy' ? t('buyShort') : t('sellShort'), e.side);
      title = nameOf(e.symbol, q);
      line = `${e.maturity ? t('maturedTag') : t(e.side)} ${fmtQty(e.qty)} ${unitOf(e.symbol)} @ ${fmtPrice(e.price, e.currency)}`;
      meta = fees([e.commission ? `${t('commission')} ${money(e.commission, e.currency)}` : '', e.tax ? `${t('tax')} ${money(e.tax, e.currency)}` : '', e.fee ? `${t(e.handling ? 'shortFees' : 'exchangeFee')} ${money(e.fee, e.currency)}` : '', e.settle > e.t ? (e.settle > Date.now() ? t('settlesOn', { date: shortDate(e.settle) }) : t('settledOn', { date: shortDate(e.settle) })) : '']);
      if (e.forced) tag = t('forcedTag');
      else if (e.credit) tag = t('termShort');
      else if (e.dayShort) tag = t('dayTradeTag');
      else if (e.after) tag = t('afterTag');
      amount = `<strong class="num ${e.side === 'buy' ? '' : 'up-ink'}">${e.side === 'buy' ? '−' : '+'}${h(money(e.total, e.currency))}</strong>`;
      break;
    }
    case 'fx':
      lead = actTile('swap', TINT.teal);
      title = `${e.from} → ${e.to}`;
      line = `${money(e.amount, e.from)} → ${money(e.received, e.to)}`;
      meta = [rateLine(e.from, e.to, e.rate), `${t('fxCost')} ${money(e.spreadTWD, BASE, { digits: e.spreadTWD < 10 ? 2 : 0 })}`];
      break;
    case 'div':
      lead = symLead(e.symbol, q, t('divShort'), 'div');
      title = nameOf(e.symbol, q);
      line = `${e.coupon ? t('couponPaid') : t('dividend')} ${fmtQty(e.shares)} × ${fmtPrice(e.perShare, e.currency)}`;
      meta = fees([e.withheld ? `${t('withheld')} ${money(e.withheld, e.currency)}` : '', e.nhi ? `${t('nhi')} ${money(e.nhi, e.currency)}` : '', e.fee ? `${t('remitFee')} ${money(e.fee, e.currency)}` : '']);
      if (e.t > Date.now()) tag = t('pendingTag');
      amount = `<strong class="num ${e.net < 0 ? '' : 'up-ink'}">${e.net < 0 ? '' : '+'}${h(money(e.net, e.currency))}</strong>`;
      break;
    case 'interest':
      lead = actTile('percent', TINT.green);
      title = t('interestRow');
      line = t('interestRate', { rate: pct(e.rate, { sign: false, digits: 2 }) });
      meta = fees([e.withheld ? `${t('withheld')} ${money(e.withheld, BASE)}` : '', e.nhi ? `${t('nhi')} ${money(e.nhi, BASE)}` : '']);
      amount = `<strong class="num up-ink">+${h(money(e.net, BASE))}</strong>`;
      break;
    case 'split':
      lead = actTile('split', TINT.green);
      title = nameOf(e.symbol, q);
      // A Taiwan 配股: whole shares, the fraction in cash at par, NHI on the new shares.
      line = e.par ? `${t('stockDiv')} ${num((e.ratio - 1) * e.par, 4)} ${locale === 'zh' ? '元' : 'NT$'}` : `${t('split')} ${num(e.ratio, 4)} : 1`;
      if (e.par) {
        meta = fees([e.cash ? `${t('stockDivCash')} ${money(e.cash, BASE)}` : '', e.nhi ? `${t('nhi')} ${money(e.nhi, BASE)}` : '']);
        if (e.cash || e.nhi) amount = `<strong class="num ${e.cash - e.nhi < 0 ? '' : 'up-ink'}">${e.cash - e.nhi < 0 ? '' : '+'}${h(money((e.cash || 0) - (e.nhi || 0), BASE))}</strong>`;
      }
      break;
    case 'deposit':
      lead = actTile(e.pool ? 'swap' : 'in', e.pool ? TINT.gray : TINT.blue);
      // A pooled entry: what it was as the title, the app it came from beside its time (its tile says so too).
      if (e.pool) [meta, title] = (([from, ...what]) => [[from], what.join(' · ') || from])(describeEntry(e, locale).split(' · '));
      else title = e.id === 'deposit:start' || e.start ? t('openedWith') : e.income ? t('payday') : e.game ? t('gameIncome', { game: t(`sg_${e.game}`) }) : t('deposited');
      amount = `<strong class="num ${e.amount < 0 ? 'down-ink' : ''}">${e.amount < 0 ? '' : '+'}${h(money(e.amount, e.currency))}</strong>`;
      break;
    case 'td':
      lead = actTile('lock', TINT.green);
      title = t('tdRow', { n: e.months });
      line = `${pct(e.rate, { digits: 3, sign: false })} · ${t('tdEnds', { date: fmtDate(e.ends), v: money(tdFull(e), BASE) })}`;
      amount = `<strong class="num">−${h(money(e.amount, BASE))}</strong>`;
      break;
    case 'tdend':
      lead = actTile('unlock', TINT.green);
      title = e.early ? t('tdBrokenRow') : t('tdEndRow');
      line = `${t('tdInterestLabel')} ${money(e.interest, BASE)}`;
      meta = fees([e.withheld ? `${t('withheld')} ${money(e.withheld, BASE)}` : '', e.nhi ? `${t('nhi')} ${money(e.nhi, BASE)}` : '']);
      amount = `<strong class="num up-ink">+${h(money(e.amount + e.net, BASE))}</strong>`;
      break;
    case 'lend':
      lead = symLead(e.symbol, q);
      title = t('lendRow', { name: nameOf(e.symbol, q), qty: fmtQty(e.qty) });
      line = t('lendRate', { rate: pct(e.rate, { digits: 2, sign: false }) });
      break;
    case 'recall':
      lead = actTile('hand', TINT.orange);
      title = t('recallRow');
      line = t('lendBack', { date: fmtDate(e.back) });
      break;
    case 'lendpay':
      if (e.t > Date.now()) return '';
      lead = actTile('coins', TINT.orange);
      title = t('lendPayRow', { name: nameOf(e.symbol, q) });
      meta = fees([`${t('lendCutLabel')} ${money(e.cut, BASE)}`, e.withheld ? `${t('withheld')} ${money(e.withheld, BASE)}` : '', e.nhi ? `${t('nhi')} ${money(e.nhi, BASE)}` : '']);
      amount = `<strong class="num up-ink">+${h(money(e.net, BASE))}</strong>`;
      break;
    // 新股申購: the application, a loss's money back, a win's shares.
    case 'ipo':
      lead = symLead(e.symbol, q, t('ipoShort'), 'buy');
      title = e.name || e.code;
      line = t('ipoRowApply', { qty: fmtQty(e.qty), p: fmtPrice(e.price, BASE) });
      meta = [`${t('ipoFeeLabel')} ${money(e.fee, BASE)}`];
      amount = `<strong class="num">−${h(money(Math.round(e.price * e.qty) + e.fee, BASE))}</strong>`;
      break;
    case 'ipoback':
      if (e.t > Date.now()) return '';
      lead = actTile('in', TINT.blue);
      title = t('ipoBackRow', { name: ipoApplied().find(a => a.code === e.code && a.draw === e.draw)?.name || e.code });
      amount = `<strong class="num up-ink">+${h(money(e.amount, BASE))}</strong>`;
      break;
    case 'ipowin':
      if (e.t > Date.now()) return '';
      lead = symLead(e.symbol, q, t('ipoShort'), 'buy');
      title = e.name || e.code;
      line = t('ipoRowWon', { qty: fmtQty(e.qty), p: fmtPrice(e.price, BASE) });
      meta = [`${t('ipoWinFeeLabel')} ${money(e.fee, BASE)}`];
      amount = `<strong class="num">−${h(money(e.fee, BASE))}</strong>`;
      break;
    case 'penalty':
      lead = actTile('alert', TINT.red);
      title = t('penaltyRow');
      line = t('penaltySub');
      amount = `<strong class="num down-ink">−${h(money(e.amount, e.currency))}</strong>`;
      break;
    case 'borrow':
      lead = actTile('bank', TINT.indigo);
      title = e.symbol ? t('creditRow', { name: nameOf(e.symbol) }) : t('borrowedRow', { cur: e.currency });
      line = t('loanRate', { rate: pct(e.rate, { digits: 2, sign: false }) });
      amount = `<strong class="num">+${h(money(e.amount, e.currency))}</strong>`;
      break;
    case 'link':
      lead = actTile('link', TINT.indigo);
      title = t('linkRow', { name: nameOf(e.symbol, q) });
      line = t('linkSub', { v: money(e.amount, e.currency) });
      break;
    case 'repay':
      lead = actTile('bank', TINT.indigo);
      title = e.symbol ? t('repaidRowFor', { name: nameOf(e.symbol) }) : t('repaidRow', { cur: e.currency });
      amount = `<strong class="num">−${h(money(e.amount, e.currency))}</strong>`;
      break;
    default:
      return '';
  }
  const [el, attrs] = activityTarget(e);
  return `<${el} ${attrs} class="q-ritem act-row">
    ${lead}<span class="q-ritem-text"><span class="q-ritem-title q-fit-wrap">${h(title)}</span>${line ? `<small class="num">${h(line)}</small>` : ''}<small class="meta num">${h([clock(e.t), ...meta].join(' · '))}</small></span>
    <span class="q-ritem-end">${amount}${tag ? `<span class="q-tag">${h(tag)}</span>` : ''}</span></${el}>`;
}

// Where a record takes you when tapped: its stock's page, the exchange (the
// two currencies set), the loans, the portfolio, or the Orbit app the money
// came from (signed in).
function activityTarget(e) {
  const button = attrs => ['button', `type="button" ${attrs}`];
  if (e.symbol && e.type !== 'deposit') return button(`data-action="open" data-symbol="${h(e.symbol)}"`);
  if (e.type === 'fx') return button(`data-action="fx-pair" data-from="${h(e.from)}" data-to="${h(e.to)}"`);
  if (e.type === 'interest' || e.type === 'borrow' || e.type === 'repay') return button('data-action="tool" data-tool="loans"');
  if (e.type === 'deposit' && e.pool && APPS[e.app]) return ['a', `href="${h(appUrl(e.app))}"`];
  if (e.type === 'deposit') return button('data-action="goto" data-tab="portfolio"');
  return ['div', ''];
}

const ACTIVITY_FILTERS = {
  all: () => true,
  trades: e => e.type === 'fill' || e.type === 'ipo' || e.type === 'ipowin' || e.type === 'ipoback',
  fx: e => e.type === 'fx',
  income: e => ['div', 'split', 'interest', 'td', 'tdend', 'lend', 'recall', 'lendpay'].includes(e.type),
  loans: e => e.type === 'borrow' || e.type === 'repay' || e.type === 'link',
  cash: e => e.type === 'deposit'
};

function renderHistory() {
  const box = $('history-body');
  const views = ['activity', 'orders', 'stats'];
  const head = `<div class="q-seg history-tabs" role="group">${views.map(x => `<button type="button" data-action="hview" data-view="${x}" aria-pressed="${state.historyView === x}">${h(t(`hview_${x}`))}${x === 'orders' && state.account?.orders.some(o => o.status === 'open') ? ` <b class="seg-count">${state.account.orders.filter(o => o.status === 'open').length}</b>` : ''}</button>`).join('')}</div>`;
  if (!state.account) return morph(box, `${head}<div class="empty"><div class="spinner"></div></div>`);
  if (state.historyView === 'orders') {
    const open = state.account.orders.filter(o => o.status === 'open').reverse();
    const done = state.account.orders.filter(o => o.status !== 'open').reverse().slice(0, 100);
    morph(
      box,
      `${head}
      ${sectionHtml(t('openOrders'), open.length ? `<div class="q-rowcard">${open.map(orderRow).join('')}</div>` : `${plainEmpty(t('noOpenOrders'))}`)}
      ${sectionHtml(t('pastOrders'), done.length ? `<div class="q-rowcard">${done.map(orderRow).join('')}</div>` : `${plainEmpty(t('nothingYet'))}`)}`
    );
    return;
  }
  if (state.historyView === 'stats') {
    morph(box, `${head}${statsHtml()}`);
    renderBench();
    return;
  }
  const f = ACTIVITY_FILTERS[state.activityFilter] ? state.activityFilter : 'all';
  const own = [...state.account.events].sort((a, b) => b.t - a.t).filter(ACTIVITY_FILTERS[f]);
  const shown = own.slice(0, state.activityShown);
  const groups = new Map();
  for (const e of shown) {
    const day = taipeiDay(e.t);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(e);
  }
  const days = [...groups].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  morph(
    box,
    `${head}
    <div class="q-chips bleed filter-chips">${Object.keys(ACTIVITY_FILTERS).map(k => `<button class="q-chip" type="button" data-action="afilter" data-f="${k}" aria-pressed="${f === k}">${h(t(`af_${k}`))}</button>`).join('')}</div>
    ${days.length ? days.map(([day, g]) => `<p class="sub-head">${h(dayLabel(day))}</p><div class="q-rowcard">${g.map(activityRow).join('')}</div>`).join('') : `${plainEmpty(t('nothingYet'))}`}
    ${own.length > shown.length ? `<button class="q-btn small tinted more" type="button" data-action="more">${h(t('showMore', { n: own.length - shown.length }))}</button>` : ''}`
  );
}

function dayLabel(day) {
  const today = taipeiDay(Date.now());
  const yesterday = taipeiDay(Date.now() - 86_400_000);
  if (day === today) return t('todayLabel');
  if (day === yesterday) return t('yesterday');
  return fmtDate(Date.parse(`${day}T12:00:00+08:00`));
}

// The last 30 days in NT$: bought, sold, income and what trading cost.
function last30(events) {
  const from = Date.now() - 30 * 86_400_000;
  const sums = { bought: 0, sold: 0, income: 0, costs: 0 };
  for (const e of events) {
    if (e.t < from || e.t > Date.now()) continue;
    const twd = e.twd || 1;
    if (e.type === 'fill') {
      sums[e.side === 'buy' ? 'bought' : 'sold'] += e.total * twd;
      sums.costs += ((e.commission || 0) + (e.tax || 0) + (e.fee || 0)) * twd;
    } else if (e.type === 'div') sums.income += e.net * twd;
    else if (e.type === 'interest' || e.type === 'tdend' || e.type === 'lendpay') sums.income += e.net || 0;
  }
  return sums;
}

function statsHtml() {
  const v = valuation();
  const s = snap();
  const closed = s.closed;
  const wins = closed.filter(c => c.realized > 0);
  const best = closed.reduce((b, c) => (!b || c.realized > b.realized ? c : b), null);
  const worst = closed.reduce((b, c) => (!b || c.realized < b.realized ? c : b), null);
  const income = v.dividends + (s.interestEarned || 0) + (s.lendIncome || 0);
  // Realised P/L and income by Taipei month, the last 12.
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.now() + 8 * 3_600_000);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const byMonth = Object.fromEntries(months.map(m => [m, 0]));
  for (const c of closed) {
    const m = taipeiDay(c.t).slice(0, 7);
    if (m in byMonth) byMonth[m] += c.realized;
  }
  for (const e of state.account.events) {
    if (e.t > Date.now()) continue;
    const m = taipeiDay(e.t).slice(0, 7);
    if (!(m in byMonth)) continue;
    if (e.type === 'div') byMonth[m] += e.net * (e.twd || 1);
    else if (e.type === 'interest' || e.type === 'tdend' || e.type === 'lendpay') byMonth[m] += e.net || 0;
  }
  const bars = months.map(m => [m, byMonth[m]]);
  const maxAbs = Math.max(1, ...bars.map(([, x]) => Math.abs(x)));
  const yearSum = bars.reduce((a, [, x]) => a + x, 0);
  const monthChart = bars.some(([, x]) => x)
    ? `<div class="card-box"><div class="pl-bars">${bars
        .map(([m, x]) => `<div class="pl-col" title="${h(m)} ${h(money(x, BASE, { sign: true }))}"><span class="pl-up">${x > 0 ? `<i class="up-bg" style="height:${(x / maxAbs) * 100}%"></i>` : ''}</span><span class="pl-down">${x < 0 ? `<i class="down-bg" style="height:${(-x / maxAbs) * 100}%"></i>` : ''}</span><small>${h(String(Number(m.slice(5))))}</small></div>`)
        .join('')}</div>
      <div class="q-tags"><span class="q-tag ${dirClass(bars.at(-1)[1])} num">${h(t('statsThisMonth'))} ${h(money(bars.at(-1)[1], BASE, { sign: true }))}</span><span class="q-tag ${dirClass(yearSum)} num">${h(t('statsYear'))} ${h(money(yearSum, BASE, { sign: true }))}</span></div></div>`
    : `${plainEmpty(t('noClosed'))}`;
  // What trading has cost, all told.
  const paid = v.paid;
  const costs = [
    [t('commission'), paid.commission],
    [t('tax'), paid.tax],
    [t('exchangeFee'), paid.fee],
    [t('fxCost'), paid.fx],
    [t('loanInterest'), paid.interest],
    [t('borrowFee'), paid.borrow],
    [t('withheld'), paid.withheld + paid.nhi],
    [t('penaltyRow'), paid.penalty]
  ].filter(([, x]) => x >= 0.5);
  const costTotal = costs.reduce((a, [, x]) => a + x, 0);
  const traded = Object.values(s.held).reduce((a, x) => a + x.bought + x.sold, 0);
  // Who made and lost the most, held and sold together.
  const contrib = {};
  for (const c of closed) contrib[c.symbol] = (contrib[c.symbol] || 0) + c.realized;
  for (const p of v.positions) contrib[p.symbol] = (contrib[p.symbol] || 0) + p.pl;
  const ranked = Object.entries(contrib).sort((a, b) => b[1] - a[1]);
  const movers = [...ranked.slice(0, 3), ...ranked.slice(3).slice(-3)].filter(([, x]) => Math.abs(x) >= 1);
  const byMarket = {};
  for (const [sym, x] of ranked) {
    const m = v.positions.find(p => p.symbol === sym)?.market || closed.find(c => c.symbol === sym)?.market || 'INTL';
    byMarket[m] = (byMarket[m] || 0) + x;
  }
  const marketRows = Object.entries(byMarket).sort((a, b) => b[1] - a[1]);
  const mMax = Math.max(1, ...marketRows.map(([, x]) => Math.abs(x)));
  const losses = closed.filter(c => c.realized < 0);
  const avgPct = closed.length ? closed.reduce((sum, c) => sum + c.pct, 0) / closed.length : 0;
  const tradeRow = (label, c) =>
    c ? `<button class="q-ritem" type="button" data-action="open" data-symbol="${h(c.symbol)}">${symbolBadge(c.symbol)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(c.symbol))}</span><small>${h(label)}</small></span><span class="q-ritem-end"><strong class="num ${dirClass(c.realized)}">${h(money(c.realized, BASE, { sign: true }))}</strong><span class="chg num ${dirClass(c.pct)}">${h(pct(c.pct))}</span></span></button>` : '';
  const m30 = last30(state.account.events);
  return `
    <div class="q-focus stats-hero">
      <span class="q-focus-label">${h(t('realizedPl'))}</span>
      <strong class="q-focus-value num ${dirClass(v.realized)}">${h(money(v.realized, BASE, { sign: true }))}</strong>
      <div class="q-focus-figs"><div><small>${h(t('unrealized'))}</small><b class="num">${h(money(v.unrealized, BASE, { sign: true }))}</b></div><div><small>${h(t('sumIncome'))}</small><b class="num">${h(money(income, BASE))}</b></div></div>
    </div>
    ${Object.values(m30).some(x => x > 0) ? sectionHtml(t('last30'), `<div class="q-stats">${stat(t('sumBought'), money(m30.bought, BASE))}${stat(t('sumSold'), money(m30.sold, BASE))}${stat(t('sumIncome'), money(m30.income, BASE), '', m30.income > 0 ? 'up' : '')}${stat(t('sumCosts'), money(m30.costs, BASE))}</div>`) : ''}
    ${sectionHtml(t('statsMonthly'), monthChart)}
    ${sectionHtml(
      t('closedTrades'),
      closed.length
        ? `<div class="card-box trade-record"><div class="win-ring" style="--p:${((wins.length / closed.length) * 100).toFixed(1)}"><strong class="num">${wins.length}<small>/${closed.length}</small></strong><small>${h(t('winsRing'))}</small></div>
            <dl class="record-lines"><div><dt>${h(t('winsLosses'))}</dt><dd class="num">${h(t('winsOf', { w: wins.length, l: losses.length }))}</dd></div><div><dt>${h(t('avgReturn'))}</dt><dd class="num ${dirClass(avgPct)}">${h(pct(avgPct))}</dd></div><div><dt>${h(t('avgHeld'))}</dt><dd class="num">${h(t('days', { n: num(closed.reduce((sum, c) => sum + c.held, 0) / closed.length / 86_400_000) }))}</dd></div></dl></div>
          <div class="q-rowcard">${tradeRow(t('bestTrade'), best)}${worst && worst !== best ? tradeRow(t(worst.realized < 0 ? 'worstTrade' : 'leastGain'), worst) : ''}</div>`
        : `${plainEmpty(t('noClosed'))}`,
      { side: `<span class="q-tag">${h(t('tradeCount', { n: closed.length }))}</span>` }
    )}
    ${sectionHtml(t('statsMovers'), movers.length ? `<div class="q-rowcard">${movers.map(([sym, x]) => `<button class="q-ritem" type="button" data-action="open" data-symbol="${h(sym)}">${symbolBadge(sym)}<span class="q-ritem-text"><span class="q-ritem-title">${h(nameOf(sym))}</span><small>${h(bareSymbol(sym))}</small></span><span class="q-ritem-value num ${dirClass(x)}">${h(money(x, BASE, { sign: true }))}</span></button>`).join('')}</div>` : '')}
    ${sectionHtml(t('byMarket'), marketRows.length ? `<div class="card-box"><ul class="bars-list">${marketRows.map(([m, x]) => `<li><span class="bar-label">${h(marketLabel(m))}</span><span class="bar-track"><span class="bar ${dirClass(x)}" style="width:${(Math.abs(x) / mMax) * 100}%"></span></span><strong class="num ${dirClass(x)}">${h(money(x, BASE, { sign: true }))}</strong></li>`).join('')}</ul></div>` : '')}
    ${sectionHtml(t('benchTitle'), '<div id="bench" class="card-box" data-own></div>')}
    ${sectionHtml(
      t('statsCosts'),
      costTotal >= 1 ? `<div class="card-box">${stackBar(costs.map(([label, x], i) => ({ label, value: x, color: SERIES[i % SERIES.length] })), { format: x => money(x, BASE) })}</div>${traded > 0 ? `<p class="foot-note">${h(t('statsCostShare', { pct: pct(costTotal / traded, { digits: 2, sign: false }), v: money(traded, BASE) }))}</p>` : ''}` : '',
      { side: `<strong class="sec-value num">${h(money(costTotal, BASE))}</strong>` }
    )}`;
}

// You against simply buying one index fund with the same money on the same days.
const BENCHES = [
  { symbol: '0050.TW', currency: 'TWD' },
  { symbol: 'VOO', currency: 'USD', short: 'bench_VOO' },
  { symbol: 'BTC-USD', currency: 'USD', short: 'bench_BTC' },
  { symbol: 'XAU', currency: 'TWD' }
];
async function renderBench() {
  const box = $('bench');
  if (!box || !state.account) return;
  const v = valuation();
  const deposits = state.account.events.filter(e => e.type === 'deposit').map(e => ({ t: e.t, amount: e.amount }));
  const age = Date.now() - state.account.created;
  const range = historyRange(age);
  const key = `${state.account.id}:${range}:${deposits.length}`;
  const draw = () => {
    const el = $('bench');
    if (!el) return;
    const rows = [{ label: t('you'), value: v.netWorth, you: true }, ...(state.bench?.rows || [])];
    const put = v.deposits;
    const maxAbs = Math.max(0.0001, ...rows.map(r => Math.abs(r.value / put - 1)));
    el.innerHTML = `<ul class="bars-list">${rows
      .map(r => {
        const ret = Math.round((r.value / put - 1) * 1e5) / 1e5;
        return `<li class="${r.you ? 'you' : ''}"><span class="bar-label">${h(r.label)}</span><span class="bar-track"><span class="bar ${dirClass(ret)}" style="width:${(Math.abs(ret) / maxAbs) * 100}%"></span></span><strong class="num ${dirClass(ret)}">${h(pct(ret))}</strong></li>`;
      })
      .join('')}</ul><p class="foot-note">${h(t(state.bench ? 'benchFoot' : 'benchLoading'))}</p>`;
  };
  if (state.bench?.key === key && Date.now() - state.bench.at < 10 * 60_000) return draw();
  draw();
  if (state.bench?.loading === key) return;
  state.bench = { ...(state.bench || {}), loading: key };
  try {
    const usd = await fetchChart(fxSymbol('USD'), range);
    const rows = [];
    for (const b of BENCHES) {
      const chart = await fetchChart(b.symbol, range).catch(() => null);
      if (!chart?.points?.length) continue;
      let j = 0;
      const points = chart.points.map(([tt, c]) => {
        if (b.currency === BASE) return [tt, c];
        while (j + 1 < usd.points.length && usd.points[j + 1][0] <= tt) j++;
        return [tt, c * (usd.points[j]?.[1] ?? state.rates.USD)];
      });
      const last = state.quotes.get(b.symbol);
      const nowPrice = last ? last.price * (b.currency === BASE ? 1 : state.rates.USD) : null;
      rows.push({ label: b.short ? t(b.short) : nameOf(b.symbol), value: benchmarkValue(deposits, points, nowPrice) });
    }
    state.bench = { key, at: Date.now(), rows };
  } catch {
    state.bench = { key, at: Date.now(), rows: [] };
  }
  draw();
}

// A folding row that remembers being opened or closed across redraws: its
// tile, title and a tag, the body under it.
function fold(tile, title, body, open = false, id = title, side = '') {
  const isOpen = state.openFolds.has(id) || (open && !state.openFolds.has(`closed:${id}`));
  return `<details class="fold" data-fold="${h(id)}"${isOpen ? ' open' : ''}><summary class="q-ritem">${tile}<span class="q-ritem-text"><span class="q-ritem-title">${h(title)}</span></span>${side}<i class="fold-chev" aria-hidden="true"></i></summary><div class="fold-body">${body}</div></details>`;
}
// ---- The Orbit Pass: the account lives with it ------------------------------------------
//
// Signing in is required (orbit.mjs shows the sign-in screen). The account
// is this app's data on the pass; the pass's wallet is the one Orbit money
// pool, which this account's NT$ cash shows: the money the Worker moves
// (the pay, 紓困, overdraft interest) arrives as pool deposits, and this account's own NT$ goes back to the
// wallet as its figure.

const q = orbitSession('stock', { lang: locale });

// The first time this pass opens Securities: an account of its own, funded
// by the pool.
function ensureAccount() {
  if (state.account) return;
  commit(newAccount(0), { sync: false });
  state.bench = null;
}

// Merges this device's account with the pass's copy both ways. Syncs run one
// after another: a write on its way never lands after a newer one.
let syncChain = Promise.resolve();
let syncQueued = false;
function syncNow({ pull = false } = {}) {
  if (!q.pass || syncQueued) return syncChain;
  syncQueued = true;
  syncChain = syncChain.then(async () => {
    syncQueued = false;
    if (!q.active) return;
    state.sync.busy = true;
    try {
      await mergeRemote(await q.read({ data: true, inbox: true }), { pull });
    } catch (error) {
      if (error.code !== 'ECO_SESSION_MOVED') state.sync.error = error.code === 'TOO_BIG' ? t('syncTooBig') : error.message;
    } finally {
      state.sync.busy = false;
      render();
    }
  });
  return syncChain;
}

async function mergeRemote(remote, { pull = false, applied = () => {} } = {}) {
  if (!remote) return;
  const theirs = remote.payload ? await unpack(remote.payload).catch(() => null) : null;
  // A copy on the pass that can't be read is never saved over.
  if (remote.payload && !isAccount(theirs)) throw new Error('unreadable account');
  const others = [];
  for (const item of remote.inbox || []) {
    const other = await unpack(item.payload).catch(() => null);
    if (isAccount(other)) others.push(other);
  }
  // Every read and unpack done first: from here to the commit below nothing
  // waits, so an order or exchange made meanwhile is in this copy (taken
  // before the inbox's unpacking, the commit put back a copy without it).
  let account = state.account;
  const their = isAccount(theirs) ? theirs : null;
  if (account && their && account.id !== their.id) account = mergeDistinct(their, account);
  else account = mergeAccounts(account, their);
  for (const other of others) account = mergeDistinct(account, other);
  let wallet = remote.wallet || q.wallet;
  if (!account) {
    ensureAccount();
    account = state.account;
  }
  account = applyPool(account, wallet).account;
  // NT$ cash for the other apps to spend: what's its own, as it is. A loan
  // is never cash here: 融資 lends only as a purchase fills, straight into
  // the shares, and the loan comes off the holdings below (and is
  // Securities' own to watch: margin calls, interest).
  //
  // Below zero when Securities has spent money from the pool (a fill, an
  // exchange) or holds it for an open order (掛單): that's taken off the pool,
  // so it's never counted twice.
  const sAll = replay(account);
  const figure = Math.round(ownCash(account, sAll) * 100) / 100;
  // Everything else Securities is worth, for the account's worth across apps
  // (Hub's 錢從哪裡來): the holdings less loans and shorts, and the cash the
  // pool figure above leaves out (held for 掛單, in other currencies). Sent
  // once prices are in, again when it moves 2% (or NT$1,000).
  const prev = wallet?.snap?.stock;
  const v = state.loaded ? valuate(sAll, state.quotes, state.rates) : null;
  const spendableTWD = available(account, sAll).cash[BASE] || 0;
  const holdings = v && !v.missingRates.length ? Math.round(v.netWorth - spendableTWD) : prev?.holdings;
  const moved = Number.isFinite(holdings) && !(Math.abs((prev?.holdings ?? Infinity) - holdings) < Math.max(1_000, Math.abs(holdings) * 0.02));
  // The opening money in Securities' own books (0 for an account the pool
  // funded), reported for the Worker's stock-check.
  const opened = account.events.filter(e => e.type === 'deposit' && !e.pool && (e.id === 'deposit:start' || e.start)).reduce((sum, e) => sum + e.amount, 0);
  // Made or lost by market (once prices are in), for the admin page's totals.
  const pl = v && !v.missingRates.length ? resultByMarket(sAll, v) : prev?.pl;
  const plMoved = !!pl && (!prev?.pl || Object.keys({ ...pl, ...prev.pl }).some(k => Math.abs((pl[k] || 0) - (prev.pl[k] || 0)) >= Math.max(1_000, Math.abs(pl[k] || 0) * 0.02)));
  // Taxes paid (whole NT$) for the Orbit Pass's 真相 › 政府: 證交稅 and other
  // trade taxes, tax withheld on dividends and interest (a foreign
  // government's too), and 二代健保's supplementary premium.
  const gov = { trade: Math.round(sAll.paid.tax), withheld: Math.round(sAll.paid.withheld), nhi: Math.round(sAll.paid.nhi) };
  const govMoved = JSON.stringify(prev?.gov || {}) !== JSON.stringify(gov);
  const snapPatch = prev?.cash === figure && prev?.opened === opened && !moved && !plMoved && !govMoved ? undefined : { stock: { cash: figure, opened, ...(Number.isFinite(holdings) ? { holdings } : {}), ...(pl ? { pl } : {}), gov, t: Date.now() } };
  const changed = !their || JSON.stringify(account) !== JSON.stringify(their);
  if (account !== state.account) commit(account, { sync: false });
  applied();
  if (changed || snapPatch || (remote.inbox || []).length) {
    const payload = changed ? await pack(account) : undefined;
    if (payload && payload.length > 1_000_000) throw Object.assign(new Error('too big'), { code: 'TOO_BIG' });
    const patch = { snap: snapPatch, settings: { ...affinityPatch('stock').settings } };
    const res = await q.write({ payload, wallet: patch });
    wallet = res.wallet || wallet;
  }
  for (const item of remote.inbox || []) await q.dropInbox(item.id).catch(() => {});
  state.wallet = wallet;
  state.sync.error = null;
  state.sync.at = Date.now();
}

// What the person does here, for every app's recommendations (orbit.mjs).
function track(keys = [], weight = 1) {
  if (keys.length) recordAffinity('stock', keys, weight);
}
const symbolKeys = symbol => {
  const info = catalogInfo(symbol);
  const quote = state.quotes.get(symbol);
  return [`sym:${symbol}`, info?.category ? `cat:${info.category}` : null, quote?.kind ? `kind:${quote.kind}` : null, quote?.market ? `mkt:${quote.market}` : null];
};

// This app's own settings, in the account sheet.
function settingsEl() {
  const box = document.createElement('div');
  const paint = () => {
    box.innerHTML = `<h3 class="q-sheet-h">${h(t('g_settings'))}</h3>
      <div class="q-rows settings-rows">
        <div class="setting-row stack"><span>${h(t('updownLabel'))}</span><div class="q-seg small" role="group"><button type="button" data-set="updown" data-v="tw" aria-pressed="${state.settings.updown === 'tw'}">${h(t('updownTw'))}</button><button type="button" data-set="updown" data-v="us" aria-pressed="${state.settings.updown === 'us'}">${h(t('updownUs'))}</button></div></div>
      </div>`;
  };
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    if (b.dataset.set === 'updown') {
      state.settings.updown = b.dataset.v;
      saveSettings();
      render();
    }
    paint();
  });
  paint();
  return box;
}

// ---- Page frame: tabs, the sheets, rendering ------------------------------------------------

// Only when there's nothing to show: the notice. Everything else about the
// prices (saved, offline, stale) is one tag on the home's top line.
function renderStatus() {
  const notice = $('notice');
  notice.hidden = !(state.error && !state.loaded);
  notice.textContent = state.error && !state.loaded ? t('noticeNoData') : '';
}

const TAB_ICONS = { home: 'home', markets: 'chart', portfolio: 'wallet', fx: 'exchange', history: 'history' };
const tabNav = tabBar({ tabs: TABS.map(id => ({ id, label: t(`tab_${id}`), icon: TAB_ICONS[id] })), onSelect: (tab, { again }) => !again && showTab(tab) });
function renderTabs() {
  tabNav.select(state.tab);
  tabNav.badge('history', state.account?.orders.filter(o => o.status === 'open').length || 0, { tone: 'warn' });
  const v = state.account && state.loaded ? valuation() : null;
  tabNav.badge('fx', v && v.margin !== 'ok' ? '!' : '', { tone: 'warn' });
}

function render() {
  renderStatus();
  renderTabs();
  if (state.tab === 'home') renderHome();
  else if (state.tab === 'markets') renderMarkets();
  else if (state.tab === 'portfolio') renderPortfolio();
  else if (state.tab === 'fx') renderFx();
  else if (state.tab === 'history') renderHistory();
  renderTool();
  if (state.detail && $('detail')?.open) refreshDetailLive();
}

// The tools a row opens, each a sheet of its own: its title and its body.
const TOOLS = {
  alloc: () => [t('allocation'), allocationHtml(valuation())],
  income: () => [t('incomeTitle'), incomeHtml(valuation())],
  plans: () => [t('plansTitle'), plansHtml()],
  alerts: () => [t('alertsTitle'), alertsHtml()],
  rates: () => [t('fxViewRates'), ratesHtml()],
  loans: () => [t('fxViewLoans'), loansHtml()],
  credit: () => [t('creditTitle'), creditCardHtml(valuation())],
  access: () => [t('accessTitle'), accessHtml()],
  td: () => [t('tdTitle'), tdHtml()],
  futacct: () => [t('futAcctTitle'), futAcctHtml()],
  lend: () => [t('lendTitle'), lendHtml()],
  relief: () => [t('reliefTitle'), reliefSheetHtml()],
  ranks: () => [t('ranksTitle'), ranksHtml()],
  truth: () => [t('truthTitle'), truthHtml()]
};
function openTool(kind) {
  if (!TOOLS[kind] || !state.account) return;
  state.tool = kind;
  const dialog = kitSheet('tool', { cls: 'tool-sheet', detent: '', onClose: () => (state.tool = null) });
  dialog.scrollTop = 0;
  renderTool();
  if (kind === 'lend') loadLendCloses(state.account);
}
function closeTool() {
  const dialog = $('tool');
  if (dialog?.open) (globalThis.orbitCloseSheet || (x => x.close()))(dialog);
}
function renderTool() {
  const box = $('tool-body');
  if (!box || !state.tool || !$('tool')?.open || !state.account || !snap()) return;
  const [title, body] = TOOLS[state.tool]();
  setHead($('tool'), h(title));
  morph(box, `${toolHero(state.tool)}<div class="tool-page">${body}</div>`);
}
// Each tool sheet's hero: the one number it is about and its facts as short tags,
// in the kit's sheetHero.
function toolHero(kind) {
  const v = valuation();
  if (!v) return '';
  const now = Date.now();
  const rate = x => pct(x, { digits: 2, sign: false });
  const make = {
    alloc: () => ({ eyebrow: t('netWorth'), big: money(v.netWorth, BASE), tags: [t('heroHoldN', { n: v.positions.length })], tint: TINT.indigo }),
    loans: () => ({
      eyebrow: t('borrowed'),
      big: money(v.debtTWD, BASE),
      tags: v.debtTWD > 0 ? [`${t('ratioShort')} ${pct(v.ratio, { digits: 0, sign: false })}`, t('loanUsed', { pct: pct(v.debtTWD / Math.max(1, v.debtTWD + v.capacity), { digits: 0, sign: false }) })] : [t('noLoans')],
      tint: TINT.indigo
    }),
    td: () => {
      const term = TD_TERMS.find(x => x.months === state.td.months) || TD_TERMS.at(-1);
      const amount = Math.round(Number(state.td.amount) || 0);
      const preview = tdPreview(Math.max(0, amount), term.months, now);
      return {
        eyebrow: t('tdHeroOf', { n: term.months }),
        big: rate(tdRate(term.months)),
        sub: t('tdYearRate'),
        tags: [t('tdEndsTag', { date: fmtDate(preview.ends) })],
        tint: TINT.green
      };
    },
    credit: () => {
      const credit = creditAccount(state.account, now);
      return credit.open
        ? { eyebrow: t('creditLimitWord'), big: money(credit.limit, BASE), tags: [t('creditTermTag'), t('creditShortTag')], tint: TINT.purple }
        : { eyebrow: t('creditTitle'), big: t('creditClosed'), tags: [t('creditTwTag'), t('creditCryptoTag')], tint: TINT.purple };
    },
    // The last year's income; before there's any, what's coming in.
    income: () => {
      const last12 = incomeSummary(state.account).last12;
      const soon = upcomingIncome().reduce((a, x) => a + x.net, 0);
      return last12 >= 0.5 || !soon ? { eyebrow: t('income12'), big: money(last12, BASE), tint: TINT.orange } : { eyebrow: t('upcomingTitle'), big: `+${money(soon, BASE)}`, tint: TINT.orange };
    },
    lend: () => ({
      eyebrow: t('lendEarned'),
      big: money(v.lendIncome || 0, BASE),
      tags: [t('lendCutTag', { cut: pct(LEND_CUT, { digits: 0, sign: false }) }), t('lendRecallTag', { days: LEND_RECALL })],
      tint: TINT.orange
    }),
    rates: () => {
      const q = state.quotes.get(fxSymbol('USD'));
      const sells = q ? num(q.price * (1 + fxSpread('USD', BASE, state.fxOpen)), 3) : '…';
      return { eyebrow: t('ratesHeroUsd'), big: sells, tags: [t('ratesInNtd'), ...(q && Number.isFinite(q.pct) ? [`${t('todayShort')} ${pct(q.pct, { digits: 2 })}`] : [])], tint: TINT.teal };
    },
    plans: () => {
      const plans = activePlans(state.account);
      return { eyebrow: t('plansTitle'), big: money(plans.reduce((a, p) => a + Number(p.amount || 0), 0), BASE), sub: t('plansMonthly', { n: plans.length }), tint: TINT.teal };
    },
    alerts: () => ({ eyebrow: t('alertsTitle'), big: String(Object.values(state.account.alerts || {}).filter(a => a.on).length), sub: t('alertsOnSub'), tint: TINT.red }),
    relief: () => ({ eyebrow: t('reliefTitle'), big: money(RELIEF.amount, BASE), sub: t('reliefHeroSub', { v: money(RELIEF.under, BASE) }), tint: TINT.orange }),
    ranks: () => {
      const { worth, at, next } = rankOf(passWallet());
      return { eyebrow: t('ranksTitle'), big: `${WEALTH_RANKS[at].icon} ${rankName(WEALTH_RANKS[at])}`, sub: t('ranksWorth', { v: money(worth, BASE) }), tags: next ? [t('rankNext', { v: money(next.min - worth, BASE), rank: rankName(next) })] : [], tint: TINT.orange };
    },
    truth: () => ({ eyebrow: t('truthWorth'), big: money(moneySides(passWallet()).worth, BASE), sub: t('truthSub'), tint: TINT.teal }),
    // (A page of one: its own head says what it is.)
    access: () => {
      if (accessUi().key) return null;
      const keys = stockAccess.ACCESS_KEYS || [];
      const open = keys.filter(k => stockAccess.accessState(state.account, k, now).open).length;
      return { eyebrow: t('accessTitle'), big: `${open} / ${keys.length}`, sub: t('accessOpenSub'), tint: TINT.blue };
    }
  }[kind];
  if (!make) return '';
  try {
    return kitUI.sheetHero(make()).outerHTML;
  } catch {
    return '';
  }
}
// Every sheet closed (a tab or the exchange opening from one).
function closeSheets() {
  closeTrade();
  closeTool();
  closeDetail();
}

// 修改 on a plan: the sheet scrolls to the plan's form, its amount ready to type.
// The form only exists once the quote is in, so it waits for it a little.
function scrollToPlanForm(symbol, tries = 20) {
  if (state.detail?.symbol !== symbol || !$('detail')?.open) return;
  const card = $('detail').querySelector('[data-fold="tool:plan"]');
  const input = card?.querySelector('#plan-amount');
  if (!input) return void (tries > 0 && setTimeout(() => scrollToPlanForm(symbol, tries - 1), 250));
  card.open = true;
  requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1600);
  });
}

// The whole sheet again, where it was scrolled to.
function redrawDetail() {
  const scroll = $('detail')?.scrollTop ?? 0;
  renderDetail();
  if ($('detail')) $('detail').scrollTop = scroll;
}

// Prices changed under an open sheet: update its numbers without touching
// what's being typed.
// A finger on the screen: the live redraw waits, so the button it's on
// is still there when the tap lands.
let pressedAt = 0;
document.addEventListener('pointerdown', () => (pressedAt = Date.now()), true);
document.addEventListener('click', () => (pressedAt = 0), true);
function refreshDetailLive() {
  if (Date.now() - pressedAt < 800) return void setTimeout(refreshDetailLive, 800 - (Date.now() - pressedAt) + 20);
  if (!state.detail) return;
  const active = document.activeElement;
  if (active && ($('detail')?.contains(active) || $('trade')?.contains(active)) && active.matches('input, select')) {
    renderTicket();
    return;
  }
  redrawDetail();
}

function showTab(tab) {
  if (!TABS.includes(tab)) return;
  state.tab = tab;
  render();
  window.scrollTo(0, 0);
  if (tab === 'home' || tab === 'markets') refresh();
}

function renderStatic() {
  kitUI.wireLogos(document);
  $('title').textContent = t('appName');
  document.title = t('appName');
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  $('search').placeholder = t('searchPlaceholder');
  // Every tab but the first opens on the kit's large title (Home has none).
  for (const id of TABS.slice(1)) {
    const panel = $(`panel-${id}`);
    const own = panel.querySelector(':scope > .q-nav-title');
    if (own) own.setTitle?.(t(`tab_${id}`));
    else {
      panel.prepend(kitUI.navTitle(t(`tab_${id}`)));
    }
  }
}
// ---- Events ---------------------------------------------------------------------------------

// Links to the other Orbit apps arrive signed in (orbit.mjs's go).
// A stock row of the kit's (a role=button, not a <button>): Enter and Space open it as a tap does.
document.addEventListener('keydown', event => {
  const row = event.target.closest?.('.q-stock[data-action="open"]');
  if (!row || event.target !== row || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  row.click();
});
document.addEventListener('click', event => {
  const link = event.target.closest('[data-go]');
  if (!link) return;
  event.preventDefault();
  q.go(link.dataset.go, link.dataset.hash || '');
});

document.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const d = state.detail;
  switch (a) {
    // The 台股/美股/加密/國際 switch lives on home and 市場: redraw the tab it was tapped on.
    case 'mover-group':
      state.moverGroup = el.dataset.v;
      if (state.tab === 'home') renderHome();
      else renderMarkets();
      break;
    // The home's 「交易中」 tag: that market's movers on 市場.
    case 'go-product':
      goMarket(el.dataset.id);
      showTab('markets');
      refresh({ list: true });
      break;
    case 'open-watch':
      goMarket('watch');
      showTab('markets');
      break;
    case 'movers-go':
      state.moverGroup = el.dataset.v;
      state.category = null;
      state.query = '';
      $('search').value = '';
      showTab('markets');
      break;
    case 'search-clear':
      $('search').value = '';
      onSearchInput('');
      $('search').focus();
      break;
    case 'trade':
      openTrade(el.dataset.side);
      break;
    case 'trade-close':
      closeTrade();
      break;
    case 'tool':
      openTool(el.dataset.tool);
      break;
    case 'tool-close':
      closeTool();
      break;
    case 'hview-go':
      state.historyView = el.dataset.view;
      closeSheets();
      showTab('history');
      break;
    case 'ipo-apply':
      applyIpo(el.dataset.key);
      break;
    case 'opt-month':
      state.optMonth = el.dataset.v;
      renderMarkets();
      refresh({ list: true });
      break;
    case 'product':
    case 'sub':
      goMarket(el.dataset.id, { sub: a === 'sub' });
      renderMarkets();
      window.scrollTo(0, 0);
      {
        // (A list picked from 各國市場 may sit past the phone's edge: its chip brought into view.)
        const row = $('markets-body').querySelector('.sub-chips');
        const on = row?.querySelector('[aria-pressed="true"]');
        if (on) row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
      }
      refresh({ list: true });
      break;
    case 'cover': {
      // Sell what the plan says, at market, one order each.
      const v = valuation();
      const { plan } = coverPlan(v, overdrawnBy(v));
      let account = state.account;
      let sold = 0;
      for (const x of plan) {
        const quote = state.quotes.get(x.symbol);
        // (A sale to cover: the broker splits whole and odd lots itself.)
        const r = place(account, { symbol: x.symbol, side: 'sell', type: 'market', qty: x.qty, cover: true }, { quote, rates: state.rates, valuation: valuate(replay(account), state.quotes, state.rates), now: Date.now() });
        if (r.account) {
          account = r.account;
          sold++;
        }
      }
      if (sold) {
        commit(account);
        toast(t('coverDone', { n: sold }), 'good');
        // The proxy fills them: asked at once, as an order from the ticket is.
        if (stockAccount.applyFills) askFills(state.account, { now: true }).catch(() => {});
      }
      render();
      break;
    }
    case 'list-more': {
      const sub = subOf(state.category);
      state.shown = { sub: sub.id, n: shownOf(sub) + PAGE };
      renderMarkets();
      refresh({ list: true });
      break;
    }
    case 'open':
      if (el.closest('.rec-rail')) feedback?.picked('stock', state.recs?.find(r => r.symbol === el.dataset.symbol));
      openDetail(el.dataset.symbol);
      break;
    case 'close':
      closeDetail();
      break;
    case 'range':
      d.range = el.dataset.range;
      for (const b of document.querySelectorAll('[data-action="range"]')) b.setAttribute('aria-pressed', String(b.dataset.range === d.range));
      loadChart();
      break;
    case 'star':
      if (!state.account) return;
      commit(toggleWatch(state.account, d.symbol));
      track(symbolKeys(d.symbol), 2);
      renderDetail();
      if (state.tab === 'markets' || state.tab === 'home') render();
      break;
    case 'credit':
      d.credit = Boolean(el.dataset.credit);
      d.qty = '';
      d.msg = null;
      renderTicket();
      break;
    case 'side':
      d.side = el.dataset.side;
      d.qty = '';
      d.msg = null;
      renderTicket();
      break;
    case 'tif':
      d.tif = el.dataset.tif;
      renderTicket();
      break;
    case 'ext':
      d.ext = Boolean(el.dataset.ext);
      d.msg = null;
      renderTicket();
      break;
    case 'otype': {
      d.type = el.dataset.otype;
      const q = state.quotes.get(d.symbol);
      if (q) d.limit = d.stop = startPrice(q);
      d.msg = null;
      renderTicket();
      break;
    }
    case 'qty':
      d.qty = String(+Number(el.dataset.qty).toPrecision(12));
      d.msg = null;
      renderTicket();
      break;
    case 'opt-to':
      retargetOption(el.dataset.symbol);
      break;
    case 'place':
      confirmOrder().then(ok => ok && atFreshPrice(placeFromTicket));
      break;
    case 'place-fx': {
      const need = Number(el.dataset.need);
      const from = el.dataset.from || BASE;
      confirmOrder().then(ok => ok && atFreshPrice(() => placeWithFx(need, from)));
      break;
    }
    case 'topup': {
      // A chip on the ticket: just the shortfall, from the currency it names.
      const from = el.dataset.from || BASE;
      const r = exchange(state.account, { from, to: el.dataset.cur, amount: Number(el.dataset.need) }, { rates: state.rates, fxOpen: state.fxOpen, now: Date.now() });
      if (r.error) toast(errorText(r), 'bad');
      else {
        commit(r.account);
        toast(t('fxDone', { from: money(r.event.amount, from), to: money(r.event.received, r.event.to) }), 'good');
      }
      renderTicket();
      break;
    }
    case 'cancel': {
      // The proxy rules on a cancel: an order its price bars reached since it
      // last looked is filled, not cancelled (stock-fill.js; the money lock-down).
      const order = state.account.orders.find(o => o.id === el.dataset.id && o.status === 'open');
      if (!order) break;
      let res = null;
      try {
        res = stockAccount.applyFills ? await workerJson('/stock', '', { body: JSON.stringify({ op: 'cancel', order: spec(order) }), timeout: 15_000 }) : { cancelled: true };
      } catch {
        toast(t('cancelNoNet'), 'bad');
        break;
      }
      if (res?.fill) {
        state.fills[order.id] = res.fill;
        afterPrices();
        toast(t('cancelFilled'), '');
      } else if (res?.cancelled) {
        commit(cancelOrder(state.account, order.id));
        toast(t('cancelled'), '');
      } else break;
      render();
      if (state.detail) renderDetail();
      break;
    }
    case 'goto':
      closeSheets();
      showTab(el.dataset.tab);
      break;
    case 'alloc':
      state.alloc = el.dataset.alloc;
      renderTool();
      break;
    case 'fx-from':
      state.fx.from = el.dataset.cur;
      if (state.fx.to === state.fx.from) state.fx.to = state.fx.from === BASE ? 'USD' : BASE;
      closeSheets();
      showTab('fx');
      break;
    // From an order: the sheets close, the exchange opens on the pair.
    case 'ticket-fx':
    case 'fx-pair':
      state.fx.from = el.dataset.from;
      state.fx.to = el.dataset.to;
      closeSheets();
      showTab('fx');
      break;
    case 'fx-to':
      state.fx.to = el.dataset.cur;
      if (state.fx.from === state.fx.to) state.fx.from = BASE;
      closeTool();
      if (state.tab !== 'fx') showTab('fx');
      else renderFx();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'fx-pct': {
      const have = Math.max(0, withdrawable(state.account, snap())[state.fx.from] || 0);
      const digits = currencyInfo(state.fx.from).digits ?? 2;
      state.fx.mode = 'pay';
      state.fx.amount = String(Math.floor(have * Number(el.dataset.pct) * 10 ** digits) / 10 ** digits);
      renderFx();
      break;
    }
    case 'fx-swap':
      [state.fx.from, state.fx.to] = [state.fx.to, state.fx.from];
      state.fx.amount = '';
      renderFx();
      break;
    case 'fx-mode':
      state.fx.mode = el.dataset.mode === 'get' ? 'get' : 'pay';
      state.fx.amount = '';
      renderFx();
      break;
    case 'fx-max': {
      const have = Math.max(0, withdrawable(state.account, snap())[state.fx.from] || 0);
      state.fx.mode = 'pay';
      state.fx.amount = String(have);
      renderFx();
      break;
    }
    case 'fx-trade':
      goMarket('fx');
      closeSheets();
      showTab('markets');
      refresh({ list: true });
      break;
    case 'fx-go':
      doExchange();
      break;
    case 'repay':
      doRepay(false);
      break;
    case 'call-pay':
      payCall(Number(el.dataset.v));
      break;
    case 'repay-all':
      doRepay(true);
      break;
    case 'credit-tier':
      state.creditTier = Number(el.dataset.limit);
      renderTool();
      break;
    case 'credit-open':
      doOpenCredit(Number(el.dataset.limit));
      break;
    case 'access-key':
      accessUi().key = el.dataset.key;
      accessUi().docs = new Set();
      accessUi().answers = {};
      renderTool();
      $('tool') && ($('tool').scrollTop = 0);
      break;
    case 'access-back':
      accessUi().key = null;
      renderTool();
      break;
    case 'access-kyc':
      accessUi().answers[el.dataset.q] = Number(el.dataset.i);
      renderTool();
      break;
    case 'access-li':
      accessUi().li[Number(el.dataset.i)] = el.dataset.v === 'true';
      renderTool();
      break;
    case 'access-apply':
      doApplyAccess(el.dataset.key);
      break;
    case 'access-open':
      openAccess(el.dataset.key || null);
      break;
    case 'extend':
      doExtend(el.dataset.symbol);
      break;
    case 'td-term':
      state.td.months = Number(el.dataset.months);
      renderTool();
      break;
    case 'td-max':
      state.td.amount = String(Math.floor(Math.max(0, withdrawable(state.account, snap())[BASE] || 0)));
      renderTool();
      break;
    case 'td-open':
      doOpenDeposit();
      break;
    case 'futx-dir':
      state.futx.dir = el.dataset.dir;
      state.futx.amount = '';
      renderTool();
      break;
    case 'futx-max':
      state.futx.amount = String(futxRoom());
      renderTool();
      break;
    case 'futx-go':
      doFutTransfer();
      break;
    case 'futx-open':
      closeTrade();
      state.futx.dir = 'in';
      state.futx.amount = el.dataset.need || '';
      openTool('futacct');
      break;
    case 'relief':
      doRelief();
      break;
    case 'td-break':
      doBreakDeposit(el.dataset.id);
      break;
    case 'lend':
      doLend(el.dataset.symbol, Number(el.dataset.qty));
      break;
    case 'recall':
      doRecall(el.dataset.id);
      break;
    case 'nw-view':
      state.nwView = el.dataset.v;
      renderPortfolio();
      break;
    // 市值 → 報酬 → 今日, a tap each.
    case 'pos-sort': {
      const order = ['value', 'pl', 'day'];
      state.posSort = order[(order.indexOf(state.posSort || 'value') + 1) % order.length];
      renderPortfolio();
      break;
    }
    case 'hview':
      state.historyView = el.dataset.view;
      renderHistory();
      break;
    case 'afilter':
      state.activityFilter = el.dataset.f;
      state.activityShown = 60;
      renderHistory();
      break;
    case 'more':
      state.activityShown += 100;
      renderHistory();
      break;
    case 'chart-style':
      state.settings.chart = el.dataset.v;
      saveSettings();
      redrawDetail();
      // A day's candles need the chart's bars (its line is the quote's own).
      if (state.detail && state.settings.chart === 'candle' && !state.detail.chart) loadChart();
      break;
    case 'about-period':
      state.aboutPeriod = el.dataset.v;
      redrawDetail();
      break;
    case 'chart-ma':
      state.settings.ma = !state.settings.ma;
      saveSettings();
      redrawDetail();
      break;
    case 'alert-preset':
      state.alertPrice = el.dataset.v;
      refreshDetailLive();
      break;
    case 'alert-add':
      addAlert();
      break;
    case 'alert-off': {
      const a = state.account.alerts?.[el.dataset.id];
      if (a) commit(setAlert(state.account, { id: a.id, on: false }).account);
      render();
      if (state.detail) refreshDetailLive();
      break;
    }
    case 'plan-add':
      addPlan();
      break;
    // Changing a plan: its amount and day in the form, saved over it.
    case 'plan-edit': {
      const plan = state.account?.plans?.[el.dataset.id];
      if (!plan) break;
      state.planEdit = plan.id;
      state.plan = { amount: String(plan.amount), day: String(plan.day) };
      state.openFolds.add('tool:plan');
      state.openFolds.delete('closed:tool:plan');
      if (el.dataset.row) {
        renderTool();
      } else {
        redrawDetail();
        scrollToPlanForm(plan.symbol);
      }
      break;
    }
    case 'plan-row-save':
      savePlanRow(el.dataset.id);
      break;
    case 'plan-edit-cancel':
      state.planEdit = null;
      if ($('detail')?.open) redrawDetail();
      else renderTool();
      break;
    case 'plan-off': {
      const id = el.dataset.id;
      askKit({ lang: locale, icon: '📅', title: t('planStopTitle'), body: t('planStopConfirm'), ok: t('planStop'), danger: true }).then(yes => {
        if (!yes || !state.account) return;
        commit(setPlan(state.account, { id, on: false }).account);
        render();
        if (state.detail) refreshDetailLive();
      });
      break;
    }
  }
});

// Folding cards remember being opened or closed across redraws.
document.addEventListener(
  'toggle',
  event => {
    const id = event.target.dataset?.fold;
    if (!id) return;
    if (event.target.open) {
      state.openFolds.add(id);
      state.openFolds.delete(`closed:${id}`);
    } else {
      state.openFolds.delete(id);
      state.openFolds.add(`closed:${id}`);
    }
  },
  true
);

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
});

// Typing: keep the caret where it was when the ticket redraws.
function keepCaret(redraw) {
  const active = document.activeElement;
  const id = active?.id;
  const pos = active?.selectionStart;
  redraw();
  const again = id && $(id);
  if (again && again !== active) {
    again.focus();
    try {
      again.setSelectionRange(pos, pos);
    } catch {}
  }
}

// A redraw that changes only what's different: the field being typed in
// stays the same element (a phone keeps its keyboard and caret), a logo
// stays loaded. An element marked data-own is drawn by its own code.
function morph(box, html) {
  const next = document.createElement(box.tagName);
  next.innerHTML = html;
  patchChildren(box, next);
}
function patchChildren(from, to) {
  const olds = [...from.childNodes];
  const news = [...to.childNodes];
  news.forEach((n, i) => {
    const o = olds[i];
    if (!o) from.appendChild(n);
    else if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) o.replaceWith(n);
    else if (o.nodeType === Node.ELEMENT_NODE) patchElement(o, n);
    else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  for (const o of olds.slice(news.length)) o.remove();
}
function patchElement(o, n) {
  for (const { name } of [...o.attributes]) if (!n.hasAttribute(name)) o.removeAttribute(name);
  for (const { name, value } of [...n.attributes]) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
  if (o instanceof HTMLInputElement) {
    const value = n.getAttribute('value') ?? '';
    // A field being typed in differs only where the redraw cleaned what was
    // typed (a letter in a number): the caret stays by what's left.
    if (o.value !== value) {
      const typing = o === document.activeElement && o.type !== 'checkbox';
      const caret = typing ? o.selectionStart - (o.value.length - value.length) : null;
      o.value = value;
      if (typing) o.setSelectionRange(Math.max(0, caret), Math.max(0, caret));
    }
    o.checked = n.hasAttribute('checked');
  }
  if (!o.hasAttribute('data-own')) patchChildren(o, n);
  if (o instanceof HTMLSelectElement) o.value = n.querySelector('option[selected]')?.value ?? o.value;
}

// A second point typed into a number field ends the number: that point and
// what's typed after it are refused (1.2.3.4 key by key stays 1.2, as pasted),
// until a deletion or the field is left.
const NUMBER_FIELDS = new Set(['t-qty', 't-limit', 't-stop', 'fx-amount', 'loan-amount', 'td-amount', 'futx-amount', 'alert-price', 'plan-amount', 'plan-row-amount', 'lend-rate']);
const numberJam = new WeakMap();
function refuseExtraPoint(el, event) {
  const kept = numberJam.get(el);
  if (event.inputType?.startsWith('delete')) numberJam.delete(el);
  else if (event.inputType?.startsWith('insert')) {
    const before = kept ?? el.value.slice(0, el.selectionStart - (event.data?.length ?? 0)) + el.value.slice(el.selectionStart);
    if (kept != null || (/\./.test(event.data || '') && (el.value.match(/\./g) || []).length > 1)) {
      const caret = el.selectionStart - (el.value.length - before.length);
      el.value = before;
      el.setSelectionRange(Math.max(0, caret), Math.max(0, caret));
      numberJam.set(el, before);
    }
  }
}
document.addEventListener('focusout', event => numberJam.delete(event.target));

document.addEventListener('input', event => {
  const el = event.target;
  const d = state.detail;
  if (NUMBER_FIELDS.has(el.id)) refuseExtraPoint(el, event);
  switch (el.id) {
    case 'search':
      onSearchInput(el.value);
      break;
    case 't-qty':
      d.qty = cleanNumber(el.value);
      d.msg = null;
      keepCaret(renderTicket);
      break;
    case 't-limit':
      d.limit = cleanNumber(el.value);
      keepCaret(renderTicket);
      break;
    case 't-stop':
      d.stop = cleanNumber(el.value);
      keepCaret(renderTicket);
      break;
    case 'fx-amount':
      state.fx.amount = cleanNumber(el.value);
      keepCaret(renderFx);
      break;
    case 'loan-amount':
      state.loan.amount = cleanNumber(el.value);
      keepCaret(renderTool);
      break;
    case 'td-amount':
      state.td.amount = cleanNumber(el.value).replace(/\..*/, '');
      keepCaret(renderTool);
      break;
    case 'futx-amount':
      state.futx.amount = cleanNumber(el.value).replace(/\..*/, '');
      keepCaret(renderTool);
      break;
    case 'alert-price':
      state.alertPrice = cleanNumber(el.value);
      keepCaret(redrawDetail);
      break;
    case 'plan-amount':
      state.plan.amount = cleanNumber(el.value);
      keepCaret(redrawDetail);
      break;
    case 'plan-row-amount':
      state.plan.amount = cleanNumber(el.value);
      break;
    case 'lend-rate':
      state.lend.rate = cleanNumber(el.value);
      keepCaret(renderTool);
      break;
  }
});

document.addEventListener('change', event => {
  const el = event.target;
  if (el.id === 'fx-from' || el.id === 'fx-to') {
    state.fx[el.id === 'fx-from' ? 'from' : 'to'] = el.value;
    if (state.fx.from === state.fx.to) state.fx[el.id === 'fx-from' ? 'to' : 'from'] = el.value === BASE ? 'USD' : BASE;
    const c = el.value;
    if (!state.rates[c]) ensureRates([c]).then(renderFx).catch(() => {});
    renderFx();
  }
  if (el.dataset?.accessDoc) {
    const docs = accessUi().docs;
    el.checked ? docs.add(el.dataset.accessDoc) : docs.delete(el.dataset.accessDoc);
    renderTool();
  }
  if (el.id === 'td-renew') state.td.renew = el.checked;
  if (el.id === 'lend-renew') state.lend.renew = el.checked;
  if (el.id === 'loan-cur') {
    state.loan.currency = el.value;
    renderTool();
  }
  if (el.id === 'plan-day' || el.id === 'plan-row-day') state.plan.day = el.value;
});

// The ticket sits over the stock's sheet: it closes with it.

{
  const fromHash = location.hash.slice(1);
  if (TABS.includes(fromHash)) state.tab = fromHash;
}
// A notice's banner (or a link) that points at a tab while the app is open.
window.addEventListener('hashchange', () => {
  const tab = location.hash.slice(1);
  if (TABS.includes(tab) && tab !== state.tab) showTab(tab);
});
// The same top-right in every Orbit app: help, refresh, then the account.
topActions(q, { refresh: () => refresh({ list: true }), extra: settingsEl });

// Big numbers shrink (to 60% at most) to stay on one line (the kit's fitNumbers).
// (And a fact or an order's hint, a line each.)
const FIT_SELECTOR = '.q-sf-sum b, .q-hc-big, .q-focus-value, .q-stat strong, .big-price, .idx-card > strong, .rec-foot strong, .q-ritem-end > strong, .fx-result, .verdict strong, .facts-grid dd span, .about-fin .about-h';
// (The kit's watchFit: new, so a phone on an older kit just isn't fitted after a redraw.)
kitOrbit.watchFit(FIT_SELECTOR);

// Redraw charts when the width changes (not when a phone's address bar hides).
let lastWidth = window.innerWidth;
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    render();
    if (state.detail) renderChart();
  }, 150);
});

// ---- Start ----------------------------------------------------------------------------------

window.__fxStarted = true;
// Phones and tablets: from the home screen only. Always the newest deploy.
const gated = installGate('stock', locale);
watchUpdates({ current: document.querySelector('meta[name="build-version"]')?.content, key: 'stockStudy', cachePrefix: 'stock-study-' });
applySettings();
loadQuotes();
renderStatic();
q.on('wallet', wallet => {
  state.wallet = wallet;
  // Money the Worker moved arrives in this account's NT$ cash.
  if (state.account) {
    const pooled = applyPool(state.account, wallet);
    // Quietly: the pay, a loan's installment and the like are in 紀錄, never a pop-up on opening (Jay 2026-10-21).
    if (pooled.account !== state.account) commit(pooled.account);
  }
  renderStatus();
  if (state.tab === 'portfolio' || state.tab === 'home' || state.tab === 'fx' || state.tool) render();
});
q.on('active', live => {
  if (live) {
    syncNow();
    refresh();
  }
});

async function boot() {
  const starting = q.start();
  // This phone's own copy, drawn at once while the Pass answers (on a slow
  // connection the sign-in took seconds, and the account waited on it).
  // The Pass's copy is merged into it when it comes, as at every sync.
  const local = q.pass ? withWelcome(await loadAccount()) : null;
  if (local) {
    state.wallet = q.wallet;
    state.account = local;
    state.accountReady = true;
    render();
    // With the prices kept too, it opens on them now: the Pass's sign-in and
    // merge are two round trips (1-2 s on a phone's link); what another
    // device changed is merged in place when it comes.
    if (state.fromCache) $('loading').hidden = true;
  }
  const first = await starting;
  state.wallet = first.wallet || q.wallet;
  if (!local) state.account = withWelcome(await loadAccount());
  // The pass's own copy, merged in (and the account made, the first time);
  // waited for until it's in, not for the save after it (on a weak
  // connection that save took minutes).
  if (first && !first.offline)
    await new Promise(merged => {
      syncChain = syncChain
        .then(() => mergeRemote(first, { applied: merged }))
        .catch(error => (state.sync.error = error.message))
        .finally(merged);
    });
  // A first account only once the pass has been read and has none: opened
  // offline on a new phone, the pass's own account isn't known (a new one
  // would be folded into it as a second). Until then, none; the next sync
  // (mergeRemote) makes it.
  if (!state.account && first && !first.offline) ensureAccount();
  state.accountReady = true;
  if (state.fromCache) $('loading').hidden = true;
  checkIncome();
  render();
  backfillOrders()
    .catch(() => {})
    .then(checkMarginHistory)
    .finally(() => {
      state.backfilled = true;
      refresh({ list: true }).then(async () => {
        // The first prices failed (the quote service busy): tried again while
        // the loading screen stays, so the page doesn't open on empty prices,
        // until the 8-second limit below opens it anyway.
        while (!state.loaded && Date.now() - bootAt < BOOT_LIMIT_MS - 1_500) {
          await new Promise(r => setTimeout(r, 1_500));
          await refresh({ list: true });
        }
        loadAlerts().then(() => state.loaded && render());
        // 新股申購 in before it lifts (2.5 s at most), not a section arriving after.
        await Promise.race([loadIpo(), new Promise(r => setTimeout(r, Math.max(0, Math.min(2_500, BOOT_LIMIT_MS - 500 - (Date.now() - bootAt)))))]);
        render();
        $('loading').hidden = true;
        checkBonds();
        checkCorporateActions();
        checkPlans();
        checkAlertHistory();
      });
    });
}
const bootAt = Date.now();
const BOOT_LIMIT_MS = 8_000;
if (!gated) boot();
// Hide the loading screen after at most 8 seconds whatever happens.
setTimeout(() => ($('loading').hidden = true), BOOT_LIMIT_MS);

setInterval(() => {
  if (document.visibilityState === 'visible' && q.active) refresh().then(checkBonds).then(() => Promise.all([loadIpo(), loadAlerts()]).then(() => state.tab === 'home' && renderHome()));
}, QUOTE_REFRESH_MS);
// What the other apps did (bets, the pay) arrives with the wallet
// (orbit.mjs checks it every minute); the account itself every few.
setInterval(() => {
  // (With no account yet too: one opened offline is made by the first sync.)
  if (document.visibilityState === 'visible' && q.active) syncNow();
}, 3 * 60_000);
// Monthly plans due today wait for their market's first price.
setInterval(() => {
  if (document.visibilityState !== 'visible' || !q.active) return;
  checkIncome();
  checkPlans();
}, 10 * 60_000);

// ---- Offline and installable ----------------------------------------------------------

window.addEventListener('online', () => {
  state.online = true;
  refresh();
});
window.addEventListener('offline', () => {
  state.online = false;
  renderStatus();
});
// Opens without a connection: the kit registers the worker and has it keep every file loaded.
keepOffline();
// Every screen is live (an old copy would read as now): no connection, the kit's cover, not the saved copy.
onlineOnly({ zh: '報價和交易需要網路連線', en: 'Prices and trading need a connection.' });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !state.accountReady) return;
  // Back after a while: settle what happened meanwhile from the history first.
  state.backfilled = false;
  backfillOrders()
    .catch(() => {})
    .then(checkMarginHistory)
    .finally(() => {
      state.backfilled = true;
      checkIncome();
      refresh().then(() => {
        checkBonds();
        checkPlans();
      });
    });
  syncNow();
});
