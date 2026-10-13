# Quadra Securities

**https://jaypengx.github.io/Quadra-Securities/**

Where money lives and grows in **Quadra**. It is a practice brokerage, play
money only, with real prices and a real broker's rules:
- Taiwan's and the world's stocks, ETFs and funds;
- forex, government bonds, crypto and gold;
- margin, shorts and Taiwan's credit trading;
- time deposits and securities lending.

Its NT$ cash is the one Quadra pool.

The family's rules are `Shared-Proxy/docs/TRUTH.md` (they win over
anything here). The Pass, the pool, Plus and the economy are the kit's and
the Worker's (Shared-Proxy README §5–6). Quotes come through the data
proxy's Yahoo tiers (Shared-Proxy README §4.4).

## Quadra

| App | Part it plays |
| --- | --- |
| **Quadra Securities** | Where money lives and grows |
| **Quadra Play** | A place to play: sports bets and the lottery |
| **Quadra Pass** | The account behind every app's top-right: Plus, the truth about the money, every app and its guide |
| Orbit Class, Weather, Transit, Sports, Words | Orbit: the everyday tools, no money, the same pass |

- **A Quadra Pass is required.** The app opens on the sign-in screen until
  there's a pass.
- **One app at a time.** Opening another Quadra app pauses this one.
- **One money pool.** NT$ cash here is the Quadra balance. The pool may go
  below zero (an overdraft, 1% a month): spending stops, and **賣出補足**
  finds the fewest sales that cover it.
- **The guide** (fees, orders, FX, bonds, loans…) is in the Quadra Pass
  sheet's 說明.

**The pool counts the proxy's figure** (the owner's lock-down, 2026-10-12):
each save, Shared-Proxy's `stock-check.js` replays this account with the same
code (the kit's `stock-*`, which `public/lib` re-exports) and checks every new
event that adds cash against the market (a fill's price in that moment's
range, a dividend Yahoo paid, an exchange's rate, interest within its rate);
`snap.stock.cash` and the holdings' cost the pool and ranks count are the
Worker's, never this phone's.

## The tabs

Four tabs (the kit's `tabBar`; each keeps its place): **首頁** (markets),
**資產** (portfolio), **換匯・融資** (FX & loans), **紀錄** (history). At the
top right are help, refresh and the account.

### 首頁 Home

- **The home:** your total and today's change (a tap opens 資產), 為你推薦
  (`lib/foryou.mjs`: what fills a gap in the portfolio, dividend ETFs for
  an income holder, big moves today, the well-known names, ranked by the
  kit's `rank`), and today's movers (top five up and down).
- **Buying power:** NT$ cash plus what margin lends right now.
- **Search:** by Chinese name, English name or ticker. Chinese finds the
  curated lists; Latin letters also search Yahoo Finance, which reaches
  almost any listing worldwide.
- **The world markets strip:** TAIEX, S&P 500, Nasdaq, SOX, Nikkei, Hang
  Seng, Bitcoin, USD/TWD, the gold passbook, the US 10-year yield.
- **Lists** (`lib/catalog.mjs`, about 300 items with Chinese names):
  - Taiwan stocks (TWSE, TPEx) and ETFs, US stocks and ETFs;
  - government bonds and bond ETFs;
  - crypto, forex (18 pairs), gold and commodities;
  - Japan, Hong Kong, China A-shares, Korea, Europe;
  - US mutual funds, more markets, indexes;
  - the watchlist (☆).

  A list opens on 15 rows, the rest a tap away.
- **Each row:** today's line against yesterday's close, the price and
  currency, the company's logo, whether its market is open, and the
  change. Up is red in Chinese (Taiwan's way) and green in English; the
  account sheet switches either way.

### The detail sheet

- The price, the change, and whether the market is open, with local and Taiwan time. A closed market shows its next open.
- Charts over 1D, 5D, 1M, 6M, YTD, 1Y, 5Y or everything, with a crosshair: as a line or **candlesticks with volume**, and **moving averages** (MA5, MA20, MA60) on either.
- The facts: previous close, day and 52-week range, volume, currency, market, trading hours, trading costs, the price in NT$.
- Your position: quantity, average cost, value, P/L.
- **The ticket:**
  - buy or sell; market, limit or stop orders;
  - quick sizes: max affordable, 1/100 shares, 1 lot (1,000 shares in Taiwan), or ¼, ½ and all of a holding;
  - a preview of the price, amount, commission, taxes, exchange fees and total, in NT$ too.
  - **Short of a currency?** One tap exchanges exactly the NT$ needed.
  - **Short of cash?** 融資買進 borrows the rest in the order's currency (at the loan rate, repay any time) and places the order in one tap; 融資最大 sizes a buy to cash plus margin room.
- **Price alert** (🔔): tell me when it rises or falls to a price. Checked on every refresh and, for the time the page was closed, against the price bars since (reported with when it happened). With notifications turned on in the account sheet (the kit's notices; the switches follow the Quadra Pass), it notifies when the app is in the background. Account events use the kit's notice kinds too (`accountNotice`): fills and plan buys (`fill`), lapsed or dropped orders and skipped plans (`order`), a margin call once a day and forced sales (`margin`), ex-dividend, dividends, coupons and interest (`income`). On screen they're toasts that open their tab when tapped; a dividend's pay day is also sent by the Worker while the app is closed.
- **Monthly plan** (📅 定期定額): buy NT$X on day N of every month. Each month buys at the first price after 00:00 Taiwan time on its day, as many units as the money covers after costs (a foreign one exchanges only the NT$ it needs, at that moment's rate). Missed months are bought from the price history when the page opens again; a month without enough NT$ is skipped and recorded.
- **Time machine** link: what buying this years ago would be worth now.
- **About the company / fund:** a quick read first (is the price cheap or pricey, profitability, growth, dividends, balance sheet, swings; for funds fees, size, how spread out, dividends), rough rules of thumb shown as calm/middling/worth-a-look tags. Then the next earnings and ex-dividend dates, four years (or quarters) of revenue and net income as bars, the analysts' average target price and range against today's price, and the numbers grouped (price and value, profitability, dividends, balance sheet, performance against the S&P 500), each with a line on what it means. Funds show past returns (this year, 3 and 5 years), the sector mix, the stock/bond/cash mix and the top 10 holdings. Then what it does, translated into Chinese for a Chinese reader (the English original a tap away; the kit's `translate`, through the proxy, kept a month).
- **How fresh the price is:** "live" or "delayed N minutes", per market, from Yahoo's own figures.
- Indexes and futures are watch-only and point to what tracks them (TAIEX → 0050, S&P 500 → VOO/SPY/00646, gold → the gold passbook/GLD/00635U …).

### 外匯 Forex

Currency pairs trade like stocks (market, limit and stop orders, shorting, alerts, candles). EUR/USD = 1.14 means one euro is worth US$1.14: buying 10,000 EUR/USD costs US$11,400 and is counted in euros. A pair settles in its second currency (`EURUSD=X` in US$, `USDJPY=X` in yen, `USDTWD=X` in NT$). No commission, a 0.02% spread each way; Yahoo's weekday sessions. Borrowing against a pair: 50% of its value. This is apart from the FX tab, which only changes money from one currency to another.

### 公債 Government bonds

`public/lib/bonds.mjs`: real bonds, each with a coupon, a maturity and a face value, bought one bond at a time.

- **US Treasuries:** a 3-month bill and 2-, 5-, 10-, 20- and 30-year notes and bonds, plus two old low-coupon issues that trade well below par. They're priced from the live Treasury curve (Yahoo's 13-week, 2-, 5-, 10- and 30-year yields, straight lines between). Rates up, prices down, and longer bonds move more.
- **Taiwan central government bonds, Japanese JGBs, German Bunds and UK gilts:** there's no free live yield source for these, so each prices from a fixed reference curve (labelled as such), and their prices only drift toward par over time.
- **Price:** a quote is one bond's dirty price, clean price plus the interest accrued since the last coupon; a purchase pays that. The detail sheet shows the yield, clean price per 100, accrued interest, coupon and frequency, maturity, face value and coupon tax.
- **Coupons** are credited on their dates while held, less the issuer's withholding: Taiwan 10% (separate taxation), Japan 15.315%, Germany 26.375%, the US and UK 0 for foreigners. At maturity the face value is repaid automatically.
- **Trading:** weekdays in the issuer's business hours, over the counter at a 0.1% commission and a 0.05% bid–ask spread. Bonds count 80% as margin collateral.

### Short selling

- Stocks, ETFs, bond ETFs and crypto can be sold short: sell more than you hold.
- **To open:** afterwards, assets must be at least 150% of everything owed (loans plus the shorts' market value). The ticket shows the most you can sell.
- **While open:** a borrow fee of 3% a year accrues on the sale value and is paid on buying back. Dividends paid meanwhile are charged to you.
- **Margin:** shorts count as owed in the maintenance ratio. A forced sale buys every short back first.

### 資產 Portfolio

- Net worth in NT$, today's change, total return against the money put in.
- Net worth over time: rebuilt for every day since the account opened from the log and each day's closing prices and exchange rates, so there's no need to open the app daily. The money put in is a dashed line.
- Allocation by kind, currency or market: a ring with the total inside and each part's share and value.
- Positions (value, P/L, today, today's price line, a bar for each one's weight), open orders.
- **Cash:** the spendable NT$ total up top, what's held for open orders or still settling, the cash interest rate, and a wallet for every currency. Loans show here too, and the maintenance ratio when there are any.
- **Income:** dividends, bond coupons and cash interest over the last 12 months (month by month) and this year, the yield on holdings, the top payers, and dividends on the way.
- Monthly plans (next buy, last result, stop) and price alerts (distance from the price, remove).
- **Money in**: Quadra's own pay (NT$6,000 on the 1st of every Taiwan month, the Worker's `eco:pay:<month>`) and the other apps' money (Play's bets and winnings, Plus) arrive as NT$ deposits from the pool (`x:<entry id>`, `pool: true`), counted as money put in, not as return. Securities' own paydays (`pay:YYYY-MM`) ended with 2026-09 (`INCOME_UNTIL_MONTH`); the next payday shows under net worth. Where the money came from is the Quadra Pass sheet's account details, the same in every app.

### 換匯・融資 FX & loans

Three views, one at a time: **換匯** (the wallets with money in them as chips
to pay from; "you pay" and "you get" boxes, type either side; ¼, ½, all;
your rate, the spread and its cost; one confirm button that says what
happens), **匯率** (the rates board; a row opens the exchange with it) and
**融資** (what's borrowed, the maintenance ratio, how much of the limit is
used as a bar, collateral and interest so far; borrow or repay in one
form).

- **Exchange** between any two currencies, typing either what you pay or what you want to receive: the mid-market rate less a bank's spread (US$ 0.2%, JPY/EUR/HKD 0.3% … INR 1%, and the wider of the two between foreign currencies). The spread doubles while the FX market is shut (weekends), as a bank's does. The receiving side is rounded down to its smallest unit.
- **A rates board**: NT$ per unit (per 100 for yen and won), the bank's buy and sell rates, and today's line.
- **Margin loans** in any currency:
  - Borrowing power is the value of your holdings times a haircut (stocks, ETFs and bonds 60%, funds and gold 50%, crypto 30%).
  - Interest accrues continuously at each currency's rate (NT$ 6.5%, US$ 7.5%, ¥ 3% …).
  - The maintenance ratio is assets ÷ loans. Under 130% after Taiwan's close the broker calls (追繳): two business days to pay cash against the loans (補繳), repay or sell back to 166%, which cancels it. Still under 130% at the deadline, the margin holdings are sold from the next business day. Only under 100% (owing more than held) does it sell at once.

### 紀錄 History

- **Activity:** every trade, exchange, dividend, split, loan and deposit by day, with filters.
- **Orders:** open orders (cancel) and past ones (filled, cancelled, not filled with the reason).
- **Stats:**
  - where the money came from and went (put in, net worth, return, realized and unrealized P/L, dividends);
  - trading costs by kind (commissions, taxes, exchange fees, FX spreads, interest, withholding, NHI) and their share of the money put in;
  - closed trades (win rate, average return and hold, best and worst);
  - P/L by market;
  - **you vs. just buying an index**: the same deposits on the same days into 0050, VOO (in NT$), Bitcoin (in NT$) or the gold passbook.

### Time machine (回測)

In 紀錄, beside the activity: what a lump sum or a monthly plan in one of the
well-known funds and stocks would be worth today, with its worst drop, best
and worst years and a bank deposit to compare.

## The rules

| What | How |
| --- | --- |
| Starting money | The Quadra pool: NT$30,000 for a new pass (older accounts opened with NT$100,000 here, brought to the pool's NT$30,000 by the Worker's reset) |
| Taiwan | 0.1425% commission, min NT$20 (odd lots NT$1); sell tax 0.3% stocks (0.15% on a day trade: sold the day it was bought), 0.1% ETFs, 0% bond ETFs; fractions of a dollar dropped |
| US | 0.1% sub-brokerage commission, min US$3; SEC fee US$20.60 per million on sells (from 2026-04-04); 30% dividend withholding |
| Mutual funds | through a fund platform, not the exchange: a 1% subscription fee (申購手續費, `FUND_FEE`) on buying, the Plus discount applies; nothing on redeeming (no commission, fee or tax) |
| Hong Kong | 0.25%, min HK$100; 0.1% stamp duty on stocks both ways; 0.0085% exchange fees |
| UK, France, Italy, Spain | 0.25%, min £5/€5; stamp duty or FTT on buys of stocks (0.5%, 0.4%, 0.1%, 0.2%) |
| China, Korea, India | 0.3%; sell tax 0.05% (China), 0.20% (Korea, from 2026); 0.1% STT both ways and 0.015% stamp duty on buys (India) |
| Switzerland | 0.25%; federal stamp duty 0.075% each side |
| Japan, Germany, Netherlands, Switzerland, Denmark, Canada, Australia, Singapore | 0.25% with a local minimum |
| Crypto | 0.1%, fractions to 8 decimals, 24/7 |
| Gold and silver passbooks | NT$ per gram from COMEX futures × US$ rate ÷ 31.1035; buy 0.6% above, sell 0.6% below |
| Anywhere else search finds | 0.3%, 20% withholding, its currency's rate from Yahoo (through US$ if there's no NT$ pair), 1% FX spread |
| Dividends | Credited on the ex-date for shares held then; Yahoo's split-adjusted amounts scaled back; withholding by market; Taiwan's 2.11% NHI premium on a payment of NT$20,000+ |
| Splits | Shares multiplied from the split date; cost unchanged |
| Orders | Market orders fill at once while open, else at the first price after the open (holding 3% extra). Limit and stop orders are **day orders** by default: they end at the close of the session they're for (placed while shut: the next one) and expire unfilled; **長效 (GTC)** keeps one for 30 days. Crypto and currency pairs are always GTC. Open orders hold their cash or shares. A buy that no longer fits the cash when it triggers is dropped |
| While the page is closed | On opening (and on coming back to the tab), each open order is checked against the price bars since it was placed: 5-minute bars for the last few days, 30-minute for a month, hourly for two years. It fills at the first bar that reached its price, dated then, at that moment's exchange rate; a gap through the price fills at the bar's open. Dividends, splits, coupons and maturities are credited on their own dates, and net worth history is rebuilt from daily closes |
| Hours | Each market's own session and holidays from Yahoo; crypto always; government bonds on weekdays in the issuer's business hours |
| Short selling | Stocks, ETFs, bond ETFs, crypto; 150% initial cover; 3% a year borrow fee; dividends charged; bought back first in a forced sale |

All the rates live in `public/lib/markets.mjs`.

## How it works

The account is a log (`public/lib/account.mjs`):

- **Immutable events:** deposits, exchanges, fills, dividends, splits, borrowing and repaying.
- **Orders:** their status only moves forward.
- **Worked out by replaying the log:** cash in each currency, holdings and average costs (NT$ cost at each fill's own rate, so FX moves are part of P/L), and loans with continuous interest.

Two devices' copies merge by uniting their logs:

- Events are kept by id.
- An order takes its most advanced status, and one filled anywhere counts as filled.
- A copy started over wins if it's the newer start.

**Prices** come from Yahoo Finance's public endpoints (`public/lib/quotes.mjs`) through Shared-Proxy's data proxy (`/sports-proxy` on its one Worker), which adds CORS and caches:

- `/v7/finance/spark`: up to 20 quotes per request, with today's line.
- `/v8/finance/chart`: charts, dividends and splits.
- `/v1/finance/search`: search.
- `/v10/finance/quoteSummary`: company and fund numbers (the Worker adds Yahoo's session cookie and crumb).

**Rules that make it behave like a real broker:**

- **Exchange price rules:** Taiwan and US limit and stop prices must sit on the exchange's tick (Taiwan: 0.01 below NT$10 up to 5 from NT$1,000; ETFs 0.01/0.05; US one cent), and Taiwan limit orders must be inside the day's ±10% price limit. The order form shows the allowed range and the tick.
- **Dividends are paid on the market's pay day:** holding on the ex-date earns it; the cash arrives about 4 weeks later in Taiwan, 1 week in the US, 2–3 months in Japan, within days in much of Europe (`DIV_PAY_DAYS`). Until then it's listed as on the way and counted in net worth as a receivable (the price already dropped by it), but can't be spent.
- **Forced sales while away:** with a loan or a short, the price history since the last visit is walked (every price bar) and, where the account fell below the liquidation line, shorts are bought back and holdings sold at that moment's price, dated then, and the loans repaid; whatever the sale didn't cover is still owed.
- **Fills found in the past** must have fitted the cash and shares at that moment, and still fit today's.
- **The spread:** market and triggered stop orders buy at the ask and sell at the bid: half a tick at least, or a typical half-spread per market (US 0.01%, Europe and Asia 0.05%, crypto 0.02%). Limit orders fill only at their price or better. Monthly plans size their buy at the ask.
- **Settlement:** every fill records when it settles (Taiwan, Japan, Hong Kong, Korea, Europe, Australia and Singapore T+2; the US, Canada, India and China T+1; the UK, the EU and Switzerland T+1 from 2027-10-11), counted in the market's own business days (weekends and its holidays skipped) and ending at 23:59 in the market's own time. Sale money can buy again at once in its market, but can't be exchanged into another currency until it settles; wallets show what's still settling.
- **Taiwan odd lots** (not whole lots of 1,000) match only from 09:10, in the intraday odd-lot session, live and in history.
- **Welcome offer:** an account that hasn't traded (`withWelcome`, set by the app) pays no commission on its first fill (`firstTrade`); the ticket says so.
- **Quadra Plus** (the kit's `PLUS.stock`, `usePlus` in `account.mjs`): the commission at 2.8折 (×0.28, its minimum too), half the FX spread, 1 point off a new loan's rate, and 2% a year on NT$ cash. Each counts by when it happens: a trade by its fill time, an exchange or loan by its moment, cash interest by each Taiwan month the membership was paid for (the wallet's `eco:plus:<month>`). The ticket, the FX desk and the loan form show the member price as one quiet line.
- **Interest on idle NT$:** the settlement account earns the bank's demand-deposit rate (0.8% a year, `CASH_RATE`; Quadra Plus 2%), accrued daily and paid June 21 and December 21, with 10% tax and the 2.11% NHI premium on a payment of NT$20,000 or more.
- **The ledger is read as of a moment:** `replay(account, t)` ignores anything dated after `t`.

**Each market's own exchange rules** (`markets.mjs`, detail sheet 交易規則):

- **Tick sizes** by price band: Taiwan, the US, Hong Kong (the spread table after the 2025 reduction), Japan (the TOPIX 500 table), Korea (the 2023 table; ETFs 5 won), China (0.01; funds 0.001).
- **Daily price limits:** Taiwan ±10%, China ±10% (±20% on STAR 688xxx and ChiNext 300xxx/301xxx), Korea ±30%, Japan a yen amount by price band. Limit orders outside them are refused.
- **Board lots:** Japan 100 shares, China buys in 100s, Hong Kong each stock's own lot (the listed ones; e.g. HSBC 400, Tencent 100). An odd remainder sells whole. Taiwan keeps its odd-lot session; Singapore has its unit-share market.
- **Lunch breaks:** Tokyo 11:30–12:30, Hong Kong 12:00–13:00, Shanghai and Shenzhen 11:30–13:00, Singapore 12:00–13:00 (local time): no fills, shown as 午休.
- **China A-shares** are bought from abroad through Stock Connect: they trade only on days Hong Kong is open too, and shares bought today can be sold from the next trading day (T+1).

**What's still limited:**

- **Price delays** (Yahoo's `exchangeDataDelayedBy`): US stocks and funds, forex, crypto and the US yields are live; Taiwan, Tokyo, Seoul and Sydney 20 minutes; Hong Kong, Shanghai, London, Paris, Frankfurt, Milan, Madrid, Zurich, Toronto and India 15; Singapore and COMEX metals 10; Amsterdam and Copenhagen live. Orders fill at those prices. The Taiwan exchange's own real-time feed refuses requests from servers, so it can't go through the Worker.
- **Holidays** (`public/lib/holidays.mjs`): rule-based calendars for the US, UK, Europe, Switzerland, Denmark, Canada, Australia and Japan (any year), and the published 2026-27 calendars for Taiwan, Hong Kong, China, Korea and Singapore; a closed market's next opening skips them and the detail sheet lists the next ones. Other markets, and those five past 2027, fall back to weekdays.
- **Non-US government bonds** use reference yields, not live ones.

**Refreshes:**

- Quotes for holdings, open orders, the watchlist, currencies and the strip every 45 seconds while the page is visible; the open list every 90.
- Waiting orders are checked and today's net worth recorded after each refresh.
- Dividends and splits are checked twice a day for everything ever held.

**Offline and installable:** opened from the home screen, the top bar starts below the status bar (`env(safe-area-inset-top)`) and is solid rather than see-through, which iPadOS smeared. `public/sw.js` keeps the page's own files (each stamped version once), and the last prices are saved, so the app opens without a connection and shows when its prices are from; trading and exchanging wait for live prices. It can be installed to a phone's home screen.

**Saves** are gzip-compressed (`codec.mjs`) and kept with the Quadra Pass through Shared-Proxy's `/eco` (`stock-study-accounts`; a copy on the device under the pass, so it opens at once). Two devices' copies merge (nothing counted twice). Securities reports to the wallet `snap.stock` (cash, `holdings` for the account's worth and 財富等級, `opened`, and `pl` per market for the admin money report).

| File | Purpose |
| --- | --- |
| `public/lib/account.mjs` | The ledger: orders and fills (live and from price history), short positions, exchange, loans and margin, dividends, splits, coupons and maturities, valuation, net worth history, benchmarks, merging |
| `public/lib/bonds.mjs` | Government bonds: issuers, curves (live and reference), coupon dates, pricing with accrued interest, trading hours |
| `public/lib/markets.mjs` | Currencies (spreads, loan rates), markets (commissions, taxes, withholding), kinds, hours, margin rules |
| `public/lib/quotes.mjs` | Fetching and parsing Yahoo's quotes, charts, events and search; passbook metals |
| `public/lib/catalog.mjs` | The curated lists with Chinese names, the overview strip, trackers for indexes |
| `public/lib/chart.mjs` | SVG sparklines, line and candlestick charts with a crosshair, 100% bars |
| `public/lib/format.mjs` | Money, prices, percentages, 萬/億, dates |
| `public/lib/i18n.mjs` | Traditional Chinese and English (follows the browser) |
| `public/lib/holidays.mjs` | Exchange holiday calendars |
| `public/lib/foryou.mjs` | For you: candidates and their qualities for the shared recommender |
| `public/lib/timemachine.mjs` | The time machine and moving averages |
| `public/sw.js` | Offline files and alert notifications |
| `#kit/quadra.mjs` | The shared kit, from Shared-Proxy's Pages (sign-in, session, pool, recommender, the Quadra Pass sheet) |
| `public/lib/codec.mjs` | Compressed saves |
| `public/lib/credit.mjs` | Taiwan credit trading: the credit account, 融資 and 融券 terms, day trading |
| `public/lib/savings.mjs` | 定存 (time deposits) and 借券出借 (securities lending) |
| `public/lib/brands.mjs`, `tvlogos.mjs` | Company and fund logos (made by `scripts/brand-logos.mjs`, `scripts/tv-logos.mjs`) |
| `public/app.js` | Rendering and wiring |

## Taiwan credit trading (信用交易)

`lib/credit.mjs`, as Taiwan's brokers run it.

- **The credit account** gates margin and borrowed shorts in every market.
  - To open it: the account open 3 months, 10 trades in the last year,
    and that year's turnover at least half the limit asked for.
  - Above the first tier, proof of means: net worth of 30% of the limit.
  - Limits: NT$500,000, 1M, 2M, 3M, 5M (融資額度, the same again for
    融券).
- **融資 and 融券** each run six months from the trade.
  - **展延** adds six more. It is asked for in the last month, while not
    under a margin call.
  - Past due, the broker closes the position.
- **融券**: the seller puts up 90% of the sale (保證金成數) and the broker
  keeps the sale money, both as collateral. The 融券手續費 is 0.08%.
- **Day trading (現股當沖)**: buy first after 3 months open, sell first
  after 12, with a year of trading; the day trade's sell tax is 0.15%.
- **Margin elsewhere** is lent and called by `account.mjs`'s rules
  (Reg T-like). A currency pair sold borrows nothing.

## Money that sits still

`lib/savings.mjs`; each is recorded as events in the log.

- **定存 (time deposits).** NT$ locked for 1, 3, 6, 9 or 12 months at
  Bank of Taiwan's 2026 board (1.23%–1.72%), NT$10,000 at least, paid at
  maturity.
  - **Broken early**: 80% of the rate for the longest posted term held,
    nothing under a month.
  - **At maturity**: the principal returns to cash, or rolls over at the
    rate then (自動轉存, the interest paid out).
- **借券出借 (securities lending).** Taiwan stocks and ETFs held in whole
  lots, settled and not on margin, lent for a fee on their value.
  - **Terms**: the broker keeps 30% (`LEND_CUT`). Lent shares can't be
    sold. A recall returns them in 3 business days, and a contract ends
    after 180 days. The fee is paid when the shares come back.
- **Cash interest**: idle NT$ earns 0.8% a year (`CASH_RATE`; Quadra Plus
  2%), accrued daily and paid June 21 and December 21.
- **Tax**: interest and lending fees are income. A payment over NT$20,000
  has 10% withheld and 2.11% NHI premium.

## Notices

These are the kit's `stock` kinds, each with its own switch that follows
the pass:

| Kind | When |
| --- | --- |
| `alert` | A price alert is reached |
| `fill` | An order or a monthly plan fills (and on a plan's day) |
| `order` | An order lapses or is dropped, or a plan skips a month |
| `margin` | Margin runs low (once a day), or a loan or short is force-closed |
| `income` | Ex-dividend, dividends, coupons and interest paid |

On screen they're toasts that open their tab. While the app is closed, the
Worker sends price alerts (it checks Yahoo) and a dividend's pay day.

## Develop, test, deploy

```bash
npm test
```

```bash
node ../Shared-Proxy/tools/preview.mjs securities --webkit
```

- **Tests**: the account and its replay, credit, margin calls, savings,
  Plus, market rules, realism, holidays, i18n, the sheet.
- **Deploy**: a push to `main` runs the tests, stamps versions
  (`scripts/stamp-version.mjs`) and deploys `public/` to Pages; the kit
  puts a new deploy in place at once.
- **Logo tables**: `scripts/brand-logos.mjs` (Wikidata/Commons) and
  `scripts/tv-logos.mjs` (TradingView's CDN) rebuild them; don't edit
  them by hand.

## What depends on what

| If you change… | Also check |
| --- | --- |
| A fee, tax, spread or rate (`markets.mjs`, `savings.mjs`, `credit.mjs`) | The guide (the kit's `help.mjs` shows the same numbers), the kit's `truth.mjs` (it mirrors Securities' costs), `PLUS.stock` (the member's discounts) |
| The account's log or replay | Merging (two devices), the pool's deposits (`applyPool`), `snap.stock` (the Worker's worth, 財富等級, the money report) |
| A Yahoo read (`quotes.mjs`) | Shared-Proxy's Yahoo tiers and the `fundamentals`/`news` cookie handling; the push checks on prices (`push.js`) |
| Holidays | `lib/holidays.mjs` here; the kit's `holidays.mjs` is Taiwan's days off, not the exchange's |
