# Orbit Securities: the map

A Taiwan broker on play money, with real prices and a real broker's rules:
Taiwan's and the world's stocks, ETFs and funds; forex, bonds, crypto and
gold; margin, shorts and Taiwan credit trading; time deposits, securities
lending and 新股申購. Its NT$ cash is the account's money: the weekly pay,
relief and level rewards land here. Live: https://orbit.jaypengx.com/securities/

## Rules

Jay's, dated (Taiwan day), newest wins; the family's (the economy, money only here) are in Orbit-Core `docs/RULEBOOK.md`.

- 10-21 List every product a person in Taiwan can legally buy; 10-23 with its real rules, applications and restrictions, however annoying (kit `stock-access.mjs` gates, the 開戶與交易資格 sheet).
- Like a real broker, not a teaching tool: no "simulated" or "practice" wording. Earns like a broker (about 0.3% of turnover).
- Orders are filled and cash counted by the proxy (`stock-fill.js`), never the phone; a phone's own figures never add money.
- 10-22 One product bar in 市場; every list is the picks, then the whole listing.
- 10-23 Trading days follow 臺北市's 停止上班.
- 10-27 現股當沖 follows TWSE: account open 3 months with 10 trades in the last year, or a credit account, plus the signed 風險預告書 (replaced 12 months, 10-24).
- 10-28 A symbol's sheet opens on the focus card (as 資產's), the chart on it; 買進/賣出 two even buttons, the price not repeated. The order ticket keeps one floating button, the total on its second line, the page fading under it.
- 10-30 No 信貸 (personal loan): a broker doesn't make one; the only borrowing is 融資 against the shares it buys.
- 10-31 Home shows every market (each country, 加密, 基金, 黃金, 外匯, 更多) with its day's move, not just 台股; no empty-holdings card.
- 11-03 The home opens on 總資產 (replaced 10-21's no balance on the home). `tests/home.test.mjs`.
- 11-06 Quota first: the server checks prices and the account only so bad local data can't corrupt real data, never heavy fraud-proofing.
- 11-10 The family's AI: 用說的下單 is code only and places nothing until the person does; 這筆交易學到什麼 and 重大訊息白話 are drawn (rows the one AI line rests on lit), never a paragraph, never advice.
- Up is red in Chinese, green in English (switchable). Non-US government bonds use reference curves (no free live source). 新股申購 uses TWSE's real list, drawn by the proxy at TWSE's rate.
- Logo and name tables are generated (`scripts/brand-logos.mjs`, `tv-logos.mjs`, `tv-round.mjs`, `tw-names.mjs`); never edit them by hand.

## How it works

- **Tabs:** 首頁 (我的: 總資產 and its day, what's held and starred as rows; 各市場; 今日漲跌幅; 為你推薦; 新股申購; `renderHome()`) · 市場 (search, the product bar `PRODUCTS` in `lib/catalog.mjs`, each list the picks then everything from `public/data/listings-*.json`, 50 rows at a time) · 資產 · 資金 (exchange, rates, margin loans; 你的帳戶: 急難紓困 by the kit's `pay.mjs`, 財富等級, 真相 `lib/truth.mjs`) · 紀錄 (activity grouped by Taipei day, `dayGroups`, every kind of record with a row; orders; stats against 0050, VOO, BTC and gold). Wide screens: two phone-width columns a tab.
- **The detail sheet:** charts (line or candles, MA5/20/60), facts, your position, the ticket (market, limit, stop, quick sizes, a cost preview), alerts, 定期定額, a plain read of the company; 重大訊息 (`lib/filings.mjs`, Orbit-Core `builders/filings.js` → `/data/stock/filings/`, `sec-filing`); 持股新聞 (News' stories naming it, kit `namesRe`); 這筆交易學到什麼 from 交易明細 (`lib/lesson.mjs`, `sec-lesson`); 用說的下單 in the search (`lib/sayorder.mjs`).
- Taiwan stocks are found by code and Chinese name (`lib/twsearch.mjs`) ahead of Yahoo's results; TWSE's sessions as the kit has them (`lib/twse.mjs`); 處置 and 注意 tags (`lib/alerts.mjs`).
- **The account is a log** (`lib/account.mjs`): immutable events, orders
  whose status only moves forward. Cash, holdings, cost and loans come from
  replaying it. Two devices merge by uniting logs.
- **The proxy fills orders** (`Orbit-Core/stock-fill.js`): first at a
  fresh quote, then from 5-minute bars at the order's terms, dated when it
  happened. The app applies exactly that fill. Orders waiting while the
  app was closed fill the same way.
- **The pool counts the proxy's figure** (`stock-check.js` replays the
  account): money is added only as the market allows. A phone's own figures
  never add money.
- **Prices:** Yahoo Finance through the data proxy (`lib/quotes.mjs`):
  spark quotes, charts, search, quoteSummary. Refreshed every 45 s while
  visible; a price whose market is shut till a later session, read after
  its day's last price (close + the market's delay + 30 min), isn't asked
  again until 15 minutes before that session (`lib/rest.mjs` `resting`:
  never crypto, currencies, futures or what's priced from them).
- **Real-broker rules** (`lib/markets.mjs`, `credit.mjs`, `savings.mjs`,
  `bonds.mjs`):
  - each market's commissions, taxes, ticks, price limits, lots, lunch
    breaks, holidays and settlement days;
  - spreads on fills;
  - dividends paid on the market's pay day;
  - margin calls at 130% (two business days, then forced sales);
  - shorts at 150% cover (Taiwan's 融券: its credit limit and a 90%
    deposit, 0.08% handling); abroad 複委託 is cash only, so a foreign
    stock is never bought on 融資 or sold short (`cashOnly`; crypto still
    shorts, with the credit account);
  - 融資 / 融券 for six months; 定存 at Bank of Taiwan's posted rates;
  - Hong Kong orders in each security's HKEX board lot (the kit's
    `stock-hk-lots.mjs`), limit orders only (the ticket offers no market
    or stop order); one not on HKEX's list can't be ordered
    (`lotUnknown`, said on the ticket);
  - US pre- and post-market (04:00-09:30, to 18:00 New York time): a
    盤前／盤後 switch on a US day limit order while they trade (`ext`),
    the session on the quote; half days close early (NYSE 13:00, Hong
    Kong noon); a market-wide circuit breaker (the S&P 500 down 7/13/20%)
    shown on US quotes and the ticket, nothing filling meanwhile;
  - Stock Connect: STAR (688/689) and ChiNext (30xxxx) shares sold only,
    never bought (`northboundBoard`);
  - Tokyo's ticks by TOPIX500 and each ETF's own unit (the kit's
    `stock-jp-lists.mjs`);
  - US commissions at 國泰's 2026 price (a stock 0.08% with no minimum,
    an ETF US$3) to 2026-12-31, then 0.1% (at least US$3), said with
    the date in the costs;
  - taxes that end on a date in law, shown with it: bond ETFs' exemption
    to 2026-12-31 (then 0.1%), 當沖's 0.15% to 2027-12-31;
  - interest on idle NT$ (0.8%, members alike);
  - 開戶與交易資格 (the kit's `stock-access.mjs`, the 資金 tab's sheet): a
    product is bought only once its account or papers are in place, as a
    Taiwan broker asks: KYC (six questions; a fund above its RR is refused;
    yearly), 現股當沖 (3 months and 10 trades, or a credit account; two
    papers; the next trading day), 權證 and 興櫃 (a 風險預告書 before the
    first buy), 創新板 (its 風險預告書 before the first buy), 槓反 ETF (a
    credit account, 10 warrant or futures trades, or one bought before;
    abroad up to 2× long or 1× short and no ETN unless a 專業投資人), 槓反期貨
    ETF (TWSE's 17-item 交易檢核表, all right, before the first buy;
    專業投資人 exempt), 期貨帳戶 (new positions only), 複委託 (every
    foreign buy) and 專業投資人 (NT$30M, or NT$15M with a NT$3M trade; 10
    trades; yearly). Selling or closing never needs any. Accounts from
    before 2026-10-24 keep what they had already traded. The credit account
    too: its contract and 風險預告書 signed, open the next trading day;
  - 期貨保證金專戶: from 2026-10-24 futures and options trade only from the
    futures account's money (入金 from settled NT$, 出金 of what margins and
    open losses leave; its 權益數 decides 追繳 and 25% forced closing); an
    older account's margin moved in then. It stays part of the NT$ cash;
  - 全額交割股 (TWSE's and TPEx's 變更交易 lists, the kit's `TW_FULL`):
    settled cash before a buy, settled shares before a sale, no 融資,
    融券 or 當沖;
  - 結匯: US$5M a calendar year each way; NT$500,000 or more declared on
    the 申報書 in the same confirm;
  - day trading (either way) once applied for; the half tax then, only
    on the whole lots the day's cash buys match (`dayTradeShareOf`: 3 lots
    sold, 1 bought today, a third at 0.15%), never on odd lots; what's
    sold first within the day's 當沖額度 (twice net worth);
  - 定期定額 of shares and ETFs in Taiwan and the US only (the kit's
    `planAllowed`; funds, crypto and gold anywhere; never futures, options, warrants or convertibles); a US one from US$10
    a buy in NT$ (`planMinTWD`), bought in fractional shares to 0.0001
    and sold down to them; from NT$100 on any day 1-31 (a
    shorter month's last day); a Taiwan stock or ETF bought as an odd-lot
    limit order at the session's first match (09:10, 09:00 from
    2026-12-07); NT$1 a buy to 2026-12-31, then 0.1425% with a NT$1
    minimum; three months running without the cash end it (the card and
    the plans list say so);
  - 借券出借 at the lender's own ask (0.01-16% a year; above the going
    rate no borrower takes it), six months, renewed twice where agreed;
    the fee accrues daily at each close (read for what's lent) and is
    paid, less the cut, 10% withheld and the NHI premium, when the shares
    come back;
  - a mixed Taiwan quantity (1,500 shares) placed in one tap as two
    orders, 整股 and 盤中零股, at one price and type (`placeLots`);
  - a day order that met its price just before the close fills: it
    expires only once the proxy has answered after its end (`lib/orders.mjs`).
- **Notices** (the kit's `stock` kinds): `alert`, `fill`, `order`, `margin`,
  `income`. The Worker sends alerts and pay days while the app is closed.
  An alert, a plan's day or a dividend opens the stock (`#stock=<symbol>`, `openStockFromHash`).
- **Offline:** covered (`onlineOnly`); never trades on old prices.
- **Saved:** gzip (`codec.mjs`) on the Pass (`stock-study-accounts`).
  `snap.stock` reports cash, holdings and P/L to the wallet.
  The family notebook on the phone (kit `family.mjs` `stock.holds`, `tellHolds`) gets the names of the shares and funds held, never an amount, for Orbit News' 你關心的.


## Files (`public/lib`)

`account`, `access`, `markets`, `credit`, `savings`, `bonds`, `holidays`, `codec` and
`ipo` are 3-line re-exports of the kit's `stock-*.mjs` (one copy for the
app and the Worker that checks it); the rules live in the kit.

| File | What |
| --- | --- |
| `account.mjs` | The ledger: orders, fills, shorts, FX, loans, dividends, valuation, history, merging |
| `markets.mjs` | Currencies, markets, fees, taxes, hours, margin rules |
| `credit.mjs`, `savings.mjs`, `bonds.mjs`, `ipo.mjs` | Taiwan credit trading; 定存 and lending; government bonds; 新股申購 |
| `access.mjs` | 開戶與交易資格: KYC, 當沖, 權證, 興櫃, 創新板, 槓反, 槓反期貨 檢核表, 期貨, 複委託, 專業投資人, the 結匯 cap |
| `quotes.mjs`, `catalog.mjs` | Yahoo reads; the curated lists |
| `chart.mjs`, `format.mjs`, `i18n.mjs`, `codec.mjs` | Charts; number formats; text; gzip saves |
| `holidays.mjs` | Exchange holidays (not Taiwan's days off: that's the kit's) |
| `foryou.mjs`, `series.mjs` | 為你推薦 (only what can be bought; ranked by the kit's one engine, `feedback.mjs`: the five 首頁 shows, opened from the rail or anywhere (`openDetail`), kept, planned, traded and what's held (`acted`, `seedFeedback`), learnt by thing, sector, kind and market and kept on the Pass (`fb:stock`, `feedback.keep`): what's passed over sinks, what's opened rises); a price series at a moment, moving averages |
| `orders.mjs`, `preview.mjs` | When a day order expires; what a screen shows before it's done (the ticket's estimate, the most a short can sell, a 定存's end), by the same rules that then do it |
| `twse.mjs`, `twsearch.mjs`, `sayorder.mjs`, `alerts.mjs` | TWSE's sessions; finding Taiwan stocks by code or name; an order in words; 處置 and 注意 lists |
| `brands.mjs`, `tvlogos.mjs`, `tvround.mjs`, `twnames.mjs` | Generated logo and name tables |
| `../app.js` | Rendering and wiring |

## Run and test

```bash
npm test
```

```bash
node ../Orbit-Core/tools/preview.mjs securities --live --width 375
```

A push to `main` tests, stamps versions and deploys to Cloudflare.

## If you change…

| This | Also check |
| --- | --- |
| A fee, tax, spread or rate | The kit's `help.mjs` and `truth.mjs`, `tools/economy.mjs` |
| The log or replay | Merging, the pool (`applyPool`), `snap.stock`, `stock-check.js` |
| A Yahoo read | Orbit-Core's Yahoo tiers, `push.js` price checks |
