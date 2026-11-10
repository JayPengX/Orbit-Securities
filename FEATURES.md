# Features kept

Every feature a person uses in this app, with the code that makes it.
`tests/features.test.mjs` fails if any mark below disappears, so a refactor cannot
drop a feature silently (2026-11-03, after the lost-features audit).
To remove a feature on purpose, delete its line here in the same commit and say why.

- 首頁: 總資產 first (its day under it), then 我的: what's held by value, then the stars, as rows (Jay 11-03 "Forget my rules") — `public/app.js`, `public/look.css`: `sc-day`, `t('netWorth')`, `nvRow`, `nv-mine`, `sc-mine-card`
- 首頁: every market a compact row with its index and its day — `public/app.js`, `public/look.css`: `homeMarkets`, `sc-mkt`
- 首頁: 今日漲跌幅 (text tabs by market), 為你推薦 with why, IPO and events — `public/app.js`: `moverGroups`, `sc-tabs`, `sc-foryou`, `ipoHtml`, `eventRows`
- A symbol's sheet on the teal focus card, 漲停/跌停 on its fill — `public/app.js`: `sheetHeroHtml`, `bigCls: limitClass(q)`
- 市場: one product bar, options chain — `public/app.js`: `productBar`, `optChainHtml`
- 開戶與交易資格 (real access rules, 當沖 risk notice) — `public/app.js`, `public/lib/access.mjs`, `public/lib/i18n.mjs`: `開戶與交易資格`, `daytrade`, `風險預告書`
- 融資 against shares bought — `public/app.js`: `融資`
- 資金 › 你的帳戶: 財富等級, 真相, weekly pay, 急難紓困 — `public/app.js`: `ranksHtml`, `truthTitle`, `nextPayday`, `reliefSheetHtml`
- 統計 — `public/app.js`: `statsHtml`
- 用說的下單: an order typed in words in the search fills the ticket — `public/app.js`, `public/lib/sayorder.mjs`: `sayOrderRow`, `readOrder`
- 持股新聞: a stock's sheet lists the Orbit News stories that name it, each opening in News — `public/app.js`: `newsHtml`, `loadNews`
