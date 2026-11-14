<p align="center">
  <img src="public/icons/icon-192.png" width="96" height="96" alt="">
</p>

<h1 align="center">Orbit Securities</h1>

<p align="center">
  <b>Invest worldwide, risk-free.</b><br>
  <a href="https://orbit.jaypengx.com/app/"><b>Use it in Orbit</b></a> · on its own at <a href="https://orbit.jaypengx.com/securities/">orbit.jaypengx.com/securities</a>
</p>

<p align="center">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=000"> <img alt="PWA" src="https://img.shields.io/badge/PWA-works_offline-5A0FC8?logo=pwa&logoColor=fff"> <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=fff"> <img alt="Tests" src="https://img.shields.io/badge/Tests-node_--test-339933?logo=nodedotjs&logoColor=fff">
</p>

A Taiwan brokerage on play money, with real prices and a real broker's rules. Part of **Orbit**, a family of apps for life in Taiwan that share one sign-in, the Orbit Pass.

> **Best in Orbit.** Add [Orbit](https://orbit.jaypengx.com/app/) to your home screen: every Orbit app in one, signed in once, switching between them without reloading. Orbit Securities also works on its own at [orbit.jaypengx.com/securities](https://orbit.jaypengx.com/securities/) if it's the only one you want.

<p align="center">
  <img src="docs/screenshots/securities-1.webp" width="30%" alt="Everything you own, at a glance">
  <img src="docs/screenshots/securities-2.webp" width="30%" alt="Real prices, real charts">
  <img src="docs/screenshots/securities-3.webp" width="30%" alt="Every market, one account">
</p>

<p align="center">
  <img src="docs/screenshots/securities-4.webp" width="30%" alt="Market, limit and stop orders">
  <img src="docs/screenshots/securities-5.webp" width="30%" alt="Exchange at the bank's rates">
  <img src="docs/screenshots/securities-6.webp" width="30%" alt="Today's movers, on one page">
</p>

<details>
<summary>中文畫面</summary>

<p align="center">
  <img src="docs/screenshots/securities-1.zh.webp" width="30%" alt="你的總資產，一眼看">
  <img src="docs/screenshots/securities-2.zh.webp" width="30%" alt="真實報價與 K 線">
  <img src="docs/screenshots/securities-3.zh.webp" width="30%" alt="全世界的市場，一個帳戶買">
</p>

<p align="center">
  <img src="docs/screenshots/securities-4.zh.webp" width="30%" alt="市價、限價、停損，像真的券商">
  <img src="docs/screenshots/securities-5.zh.webp" width="30%" alt="換匯照銀行牌價">
  <img src="docs/screenshots/securities-6.zh.webp" width="30%" alt="今天誰漲誰跌，一頁看完">
</p>

</details>

## Features

- **Orbit AI:** 用說的下單: type an order in plain words in search (用 5 萬買台積電零股, 買兩張鴻海, 賣掉一半聯發科) and a tap opens the ticket filled in, worked out by code; 重大訊息白話: a Taiwan stock's filings of the week as rows with one plain AI line, asked once for everyone; 這筆交易學到什麼: a sale that closed a holding, told back from the account's own numbers; 持股新聞: Orbit News' stories that name a stock.
- **Every market a Taiwan investor reaches:** 上市, 上櫃 and 興櫃 stocks, ETFs, warrants, convertibles, futures and options, 複委託 (US, Hong Kong, Tokyo and more), funds, bonds, forex, gold and crypto, each list complete, 50 rows at a time.
- **A real broker's rules:** each market's fees, taxes, ticks, price limits, board lots, lunch breaks, holidays and settlement days; US pre- and post-market; circuit breakers.
- **Orders:** market, limit and stop, quick sizes and a cost preview; whole and odd lots in one tap.
- **Taiwan credit trading:** 融資, 融券, day trading, margin calls at 130% and forced sales, as a Taiwan broker does them.
- **Account opening and eligibility:** KYC, 當沖, warrants, futures and professional-investor status before a product can be bought.
- **Savings and income:** 定存 at Bank of Taiwan's rates, 定期定額 plans, securities lending, dividends on the real pay day, 新股申購 from TWSE's real list.
- **各國市場:** every country's market one tap from 市場's 總覽: its flag, name and index's day; 為你推薦 learns what you open and what you pass over.
- **Your portfolio:** net worth over time, allocation, positions, cash in every currency, income, and how you did against 0050, VOO, BTC and gold.
- **Detail pages:** a 台股 price tagged 即時 when it is TWSE's own last trade; line or candle charts with moving averages, the facts, your position, price alerts and a plain-language read of the company or fund.
- **Every screen, either way up:** on a phone on its side, a tablet or a computer each tab is two columns (markets beside yours, positions beside the account), quote lists in two or three columns, and a stock's chart beside its numbers.

## Tech stack

| Layer | What |
| --- | --- |
| App | Plain JavaScript (ES modules), HTML and CSS; no framework, no build step, no dependencies |
| Platform | Installable web app with a service worker; covered when offline (never trades on old prices) |
| Shared | Look, Orbit Pass and notices from the kit in [Orbit-Core](https://github.com/JayPengX/Orbit-Core); the broker rules are the kit's `stock-*.mjs`, one copy for the app and the server |
| Prices | Yahoo Finance through the Orbit proxy, refreshed every 45 s while on screen |
| Orders | Filled by the proxy (`stock-fill.js`, Cloudflare Workers) at a fresh quote or from 5-minute bars, never by the phone |
| Lists | Every listing, fund, logo and Chinese name generated from TWSE, TPEx, HKEX and JPX open data by scripts |
| Tests | `node --test` on the ledger, fees, credit, savings and eligibility |

## How it works

```
the ticket ──► order event in the account log
                    │
                    ▼
     api.jaypengx.com/stock (stock-fill.js): filled at the market's terms, dated when it happened
                    │
                    ▼
     the log replayed ─► cash · holdings · cost · loans · P/L
```

- **The account is a log** (`lib/account.mjs`): immutable events and orders whose status only moves forward. Every figure comes from replaying it, and two devices merge by uniting logs.
- **The server checks the money:** `stock-check.js` replays the account itself; a phone's own figures never add money.
- **What you see before is what happens after:** the ticket's estimate, a short's limit and a 定存's end use the same rules that then carry it out (`lib/preview.mjs`).

The full rule list and the decisions still in force: **[MAP.md](MAP.md)**.

## Project structure

```
public/
├── index.html, app.js, styles.css   rendering and wiring
├── lib/                 26 modules
│   ├── account, markets, credit, savings, bonds, ipo, access, codec, holidays
│   │                    re-exports of the kit's stock-*.mjs (the rules live there)
│   ├── quotes.mjs, catalog.mjs      Yahoo reads; the curated lists
│   ├── chart.mjs, format.mjs, i18n.mjs
│   ├── orders.mjs, preview.mjs, foryou.mjs, series.mjs
│   └── brands, tvlogos, tvround, twnames   generated logo and name tables
├── data/                every market's listings (generated)
├── logos/, flags/       company logos and flags
└── sw.js
scripts/                 listings, funds, logos and names generators
tests/                   node --test
MAP.md                   how it works
```

## Getting started

The app loads the shared kit from a sibling folder, so clone this repo next to [Orbit-Core](https://github.com/JayPengX/Orbit-Core):

```bash
git clone https://github.com/JayPengX/Orbit-Core.git
git clone https://github.com/JayPengX/Orbit-Securities.git
cd Orbit-Securities
```

Requirements: Node.js 22 or newer. There is nothing to install: no framework, no `node_modules`.

```bash
npm test   # links ../Orbit-Core/kit as .kit, then runs node --test
```

See it on a phone-sized screen, signed in with a made-up wallet and real data (needs Playwright):

```bash
# a screenshot, saved in /tmp/orbit-preview
node ../Orbit-Core/tools/preview.mjs securities --live --width 375
# serve it, then open http://localhost:8123/Orbit-Securities/
node ../Orbit-Core/tools/preview.mjs securities --live --serve --port 8123
```

`--dark`, `--lang en`, `--webkit` (Safari's engine) and the other flags are listed in [Orbit-Core/tools/README.md](https://github.com/JayPengX/Orbit-Core/blob/main/tools/README.md).

Add `--fake-yahoo` when Yahoo answers 429. The logo and name tables are generated (`scripts/brand-logos.mjs`, `tv-logos.mjs`, `tv-round.mjs`, `tw-names.mjs`): never edit them by hand.

## Deploying

Push to `main`. GitHub Actions runs the tests, stamps every file with its content hash (so a phone downloads only what changed) and publishes `public/` to Cloudflare at its orbit.jaypengx.com address (Orbit-Core `deploy/cf-site.mjs`). There are no pull requests or release branches.

## Part of Orbit

Every app below is in **[Orbit](https://orbit.jaypengx.com/app/)**, one home-screen app for them all; each also works on its own.

| App | What it is |
| --- | --- |
| [Orbit Sports](https://github.com/JayPengX/Orbit-Sports) | Every game you can watch in Taiwan, live |
| [Orbit Transit](https://github.com/JayPengX/Orbit-Transit) | Bus, train, metro and YouBike, planned and navigated |
| [Orbit Weather](https://github.com/JayPengX/Orbit-Weather) | One clear forecast, to the township |
| [Orbit Words](https://github.com/JayPengX/Orbit-Words) | English vocabulary that stays |
| [Orbit Securities](https://github.com/JayPengX/Orbit-Securities) | A Taiwan broker on play money |
| [Orbit Class](https://github.com/JayPengX/Orbit-Class) | Today's classes at a glance |
| [Orbit Beats](https://github.com/JayPengX/Orbit-Beats) | Endless music and your own beats |
| [Orbit Law](https://github.com/JayPengX/Orbit-Law) | Laws, rulings and bills, linked |
| [Orbit Money](https://github.com/JayPengX/Orbit-Money) | Your own books |
| [Orbit-Core](https://github.com/JayPengX/Orbit-Core) | The kit, the Orbit Pass and the Workers behind them all |

How it was all built, in pictures and numbers: [jaypengx.com/showcase](https://jaypengx.com/showcase/).
