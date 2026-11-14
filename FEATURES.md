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
- 問 Orbit's question (`#ask=`, the Pass sheet's box) typed into 市場's search (用說的下單 reads an order there) — `public/app.js`, `public/lib/sayorder.mjs`: `function askFromLink`, `export function askSearch`
- 這筆交易學到什麼: a sale that closed a holding opens its result and rows from your own numbers (best and worst close while held, the market alongside), with the AI's one line on what it teaches on a tap of its AI button (AI 看這筆交易; never on opening the sheet, Jay 11-14) — `public/app.js`: `openLesson`, `renderLesson`, `askLesson`; `public/lib/lesson.mjs`: `lessonOf`, `lessonFacts`
- 重大訊息白話: a Taiwan stock's sheet shows its filings of the week as rows, with the AI's one plain line on a tap of each filing's AI button (白話說明; never on opening the stock, Jay 11-14) and the rows it rests on lit — `public/app.js`: `filingsHtml`, `loadFilings`, `tellFiling`; `public/lib/filings.mjs`: `filingsOf`, `rowsShown`
- 持股新聞: a stock's sheet lists the Orbit News stories that name it, each opening in News — `public/app.js`: `newsHtml`, `loadNews`
