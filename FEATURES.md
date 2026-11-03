# Features kept

Every feature a person uses in this app, with the code that makes it.
`tests/features.test.mjs` fails if any mark below disappears, so a refactor cannot
drop a feature silently (2026-11-03, after the lost-features audit).
To remove a feature on purpose, delete its line here in the same commit and say why.

- 首頁: every market a tile with its day's move — `public/app.js`: `homeMarkets`
- 首頁: 我的持股 and 自選股 first on a phone (Jay 10-22) — `public/app.js`, `public/styles.css`: `home-mine`, `holdCard`, `watchChip`
- 首頁: 今日漲跌幅, 為你推薦, IPO and events — `public/app.js`: `moverSeg`, `recCard`, `ipoHtml`, `eventRows`
- A symbol's sheet on the teal focus card, 漲停/跌停 on its fill — `public/app.js`: `sheetHeroHtml`, `bigCls: limitClass(q)`
- 市場: one product bar, options chain — `public/app.js`: `productBar`, `optChainHtml`
- 開戶與交易資格 (real access rules, 當沖 risk notice) — `public/app.js`, `public/lib/access.mjs`, `public/lib/i18n.mjs`: `開戶與交易資格`, `daytrade`, `風險預告書`
- 融資 against shares bought — `public/app.js`: `融資`
- 資金 › 你的帳戶: 財富等級, 真相, weekly pay, 急難紓困 — `public/app.js`: `ranksHtml`, `truthTitle`, `nextPayday`, `reliefSheetHtml`
- 統計 — `public/app.js`: `statsHtml`
