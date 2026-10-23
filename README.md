# Orbit Securities

A Taiwan broker on play money, with real prices and a real broker's rules:
Taiwan's and the world's stocks, ETFs and funds; forex, bonds, crypto and
gold; margin, shorts and Taiwan credit trading; time deposits, securities
lending and 新股申購. Its NT$ cash is the account's money: the weekly pay,
loans, relief and level rewards all land here.

Live: https://jaypengx.github.io/Orbit-Securities/

## How it works

- **Tabs:** 首頁, 市場, 資產, 資金, 紀錄.
  - **首頁:** the world strip, the 8 product tiles, holdings, watchlist,
    movers, 為你推薦, 新股申購, what's coming.
  - **市場:** search, then one product bar (總覽, 自選, 台股, 期權, 複委託,
    基金, 債券, 外匯, 黃金, 加密: `PRODUCTS` in `lib/catalog.mjs`) and the
    open product's lists under it (台股: 上市, 上櫃, 興櫃, ETF, 權證, 牛熊證,
    可轉債, 特別股・REITs…; 期權: 台指期貨, 個股期貨, ETF 期貨,
    台指選擇權). Every list is the same: the curated picks, then
    everything that market lists (`public/data/listings-*.json`), 50 rows at
    a time. Home's tiles open the same places.
  - **資產:** net worth over time, allocation, positions, cash in every
    currency, income.
  - **資金:** exchange, the rates board, margin loans; then 你的帳戶: 信貸
    and 急難紓困 (the kit's `loan.mjs` rules, asked through the Pass session),
    財富等級, and 真相 (where the money came from, the government's side,
    what trading costs: `lib/truth.mjs`). The Orbit Pass holds no money:
    all of it is shown here.
  - **紀錄:** activity, orders, stats (against 0050, VOO, BTC and gold).
- **The detail sheet:** charts (line or candles, MA5/20/60), the facts,
  your position, the ticket (market, limit, stop; quick sizes; a cost
  preview; one-tap exchange or 融資買進 when short), price alerts, 定期定額,
  and a plain-language read of the company or fund.
- **The account is a log** (`lib/account.mjs`): immutable events, orders
  whose status only moves forward. Cash, holdings, cost and loans come from
  replaying it. Two devices merge by uniting logs.
- **The proxy fills orders** (`Shared-Proxy/stock-fill.js`): first at a
  fresh quote, then from 5-minute bars at the order's terms, dated when it
  happened. The app applies exactly that fill. Orders waiting while the
  app was closed fill the same way.
- **The pool counts the proxy's figure** (`stock-check.js` replays the
  account): money is added only as the market allows. A phone's own figures
  never add money.
- **Prices:** Yahoo Finance through the data proxy (`lib/quotes.mjs`):
  spark quotes, charts, search, quoteSummary. Refreshed every 45 s while
  visible.
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
- **Offline:** covered (`onlineOnly`); never trades on old prices.
- **Saved:** gzip (`codec.mjs`) on the Pass (`stock-study-accounts`).
  `snap.stock` reports cash, holdings and P/L to the wallet.

## Decisions in force

- Like a real broker, not a teaching tool: no "simulated" or "practice"
  wording.
- Up is red in Chinese, green in English (switchable).
- Earns like a broker (about 0.3% of turnover).
- 新股申購 uses TWSE's real list, drawn by the proxy at TWSE's rate.
- 處置 and 注意 stocks (TWSE's lists, via the proxy) are tagged on holdings and the quote, with the 處置 rules on the ticket (lib/alerts.mjs).
- Non-US government bonds use reference curves (no free live source).
- Taiwan stocks are found by code and by Chinese name (`lib/twsearch.mjs`),
  ahead of Yahoo's results (which give Tokyo's 6898 for TW's), and named in
  Chinese from `lib/twnames.mjs` or TWSE's subscription list.
- TWSE's sessions as the kit has them: 13:25-13:30 closing call auction,
  after-hours odd lots from 13:40 and 盤後定價 from 14:00; a whole-lot day
  order waits for the 13:30 match (`lib/twse.mjs`).
- Logo and name tables are generated (`scripts/brand-logos.mjs`,
  `scripts/tv-logos.mjs`, then `scripts/tv-round.mjs` for the disc icons' tile colour,
  `scripts/tw-names.mjs`); never edit them by hand.

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
| `foryou.mjs`, `series.mjs` | 為你推薦 (only what can be bought); a price series at a moment, moving averages |
| `orders.mjs`, `preview.mjs` | When a day order expires; what a screen shows before it's done (the ticket's estimate, the most a short can sell, a 定存's end), by the same rules that then do it |
| `twse.mjs`, `twsearch.mjs`, `alerts.mjs` | TWSE's sessions; finding Taiwan stocks by code or name; 處置 and 注意 lists |
| `brands.mjs`, `tvlogos.mjs`, `tvround.mjs`, `twnames.mjs` | Generated logo and name tables |
| `../app.js` | Rendering and wiring |

## Run and test

```bash
npm test
```

```bash
node ../Shared-Proxy/tools/preview.mjs securities --live --width 375
```

A push to `main` tests, stamps versions and deploys to Pages.

## If you change…

| This | Also check |
| --- | --- |
| A fee, tax, spread or rate | The kit's `help.mjs` and `truth.mjs`, `tools/economy.mjs` |
| The log or replay | Merging, the pool (`applyPool`), `snap.stock`, `stock-check.js` |
| A Yahoo read | Shared-Proxy's Yahoo tiers, `push.js` price checks |
