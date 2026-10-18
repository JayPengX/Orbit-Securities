# Quadra Securities

A Taiwan broker on play money, with real prices and a real broker's rules:
Taiwan's and the world's stocks, ETFs and funds; forex, bonds, crypto and
gold; margin, shorts and Taiwan credit trading; time deposits, securities
lending and 新股申購. Its NT$ cash is the one Quadra pool.

Live: https://jaypengx.github.io/Quadra-Securities/

## How it works

- **Tabs:**
  - **首頁:** total, 為你推薦, movers, what's trading now, search,
    the world strip, about 300 curated items in lists.
  - **資產:** net worth over time, allocation, positions, cash in every
    currency, income.
  - **換匯・融資:** exchange, the rates board, margin loans.
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
    deposit, 0.08% handling);
  - 融資 / 融券 for six months; 定存 at Bank of Taiwan's rates;
  - interest on idle NT$ (0.8%, members alike);
  - day trading (either way) once the account is 3 months open with 10
    trades in the year, or has a credit account; the half tax then; what's
    sold first within the day's 當沖額度 (twice net worth);
  - a mixed Taiwan quantity (1,500 shares) placed in one tap as two
    orders, 整股 and 盤中零股, at one price and type (`placeLots`);
  - a day order that met its price just before the close fills: it
    expires only once the proxy has answered after its end (`lib/orders.mjs`).
- **Quadra Plus** (`PLUS.stock`): commission ×0.28 (the market's minimum
  still applies), half the FX spread, 1 point off loans.
- **Notices** (the kit's `stock` kinds): `alert`, `fill`, `order`, `margin`,
  `income`. The Worker sends alerts and pay days while the app is closed.
- **Offline:** covered (`onlineOnly`); never trades on old prices.
- **Saved:** gzip (`codec.mjs`) on the Pass (`stock-study-accounts`).
  `snap.stock` reports cash, holdings and P/L to the wallet.

## Decisions in force

- Like a real broker, not a teaching tool: no "simulated" or "practice"
  wording.
- Up is red in Chinese, green in English (switchable).
- Earns like a broker (about 0.3% of turnover). That gap with Play is
  deliberate.
- 新股申購 uses TWSE's real list, drawn by the proxy at TWSE's rate.
- 處置 and 注意 stocks (TWSE's lists, via the proxy) are tagged on holdings and the quote, with the 處置 rules on the ticket (lib/alerts.mjs).
- Non-US government bonds use reference curves (no free live source).
- Logo tables are generated (`scripts/brand-logos.mjs`,
  `scripts/tv-logos.mjs`); never edit them by hand.

## Files (`public/lib`)

| File | What |
| --- | --- |
| `account.mjs` | The ledger: orders, fills, shorts, FX, loans, dividends, valuation, history, merging |
| `markets.mjs` | Currencies, markets, fees, taxes, hours, margin rules |
| `credit.mjs`, `savings.mjs`, `bonds.mjs` | Taiwan credit trading; 定存 and lending; government bonds |
| `quotes.mjs`, `catalog.mjs` | Yahoo reads; the curated lists |
| `chart.mjs`, `format.mjs`, `i18n.mjs` | Charts; number formats; text |
| `holidays.mjs` | Exchange holidays (not Taiwan's days off: that's the kit's) |
| `foryou.mjs`, `series.mjs` | 為你推薦 (only what can be bought); a price series at a moment, moving averages |
| `orders.mjs`, `preview.mjs` | When a day order expires; what a screen shows before it's done (the ticket's estimate, the most a short can sell, Plus's commission, a 定存's end), by the same rules that then do it |
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
| A fee, tax, spread or rate | The kit's `help.mjs` and `truth.mjs`, `PLUS.stock`, `tools/economy.mjs` |
| The log or replay | Merging, the pool (`applyPool`), `snap.stock`, `stock-check.js` |
| A Yahoo read | Shared-Proxy's Yahoo tiers, `push.js` price checks |
