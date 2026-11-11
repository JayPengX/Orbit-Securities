// Orbit Securities' own switches in the kit's 測試工具 (hidden until unlocked:
// Orbit Pass › seven taps on 除錯紀錄). Each is read where it acts as
// globalThis.ORBIT_TEST?.flags?.<name>, and changes only what is shown or
// read: never an order, a fill or cash (those are the Worker's), never the
// account saved. The kit's clock, place and network switches work here too.
//   mktOpen: a market shown open or closed whatever the clock (app.js marketStatus, statusDot)
//   limit: a Taiwan stock or ETF shown at 漲停 or 跌停 (app.js limitOf)
//   alertList: every Taiwan stock on the 處置 or 注意 list (app.js alertOf)
//   ipoDraw: a 新股申購 of mine shown drawing, won or lost (app.js ipoHtml)
//   quotesFail: prices can't be read (lib/quotes.mjs fetchQuotes)
//   odFake: an overdraft's card and home strip, NT$12,345 short (app.js testOwed)
import { detectLocale } from './lib/i18n.mjs';

const T = (zh, en) => (detectLocale() === 'zh' ? zh : en);
(globalThis.ORBIT_TEST_TOOLS ||= []).push(
  {
    app: 'stock',
    title: T('市場開收盤', 'Market open or closed'),
    sub: T('不管時間，市場一律顯示交易中或已收盤（只改顯示）', 'Shown open or closed whatever the time (display only)'),
    flag: 'mktOpen',
    options: [
      { id: 'open', label: T('交易中', 'Open') },
      { id: 'closed', label: T('已收盤', 'Closed') }
    ]
  },
  {
    app: 'stock',
    title: T('漲停／跌停', 'Limit up / limit down'),
    sub: T('台股和 ETF 一律顯示在漲停或跌停（價格不變）', 'Taiwan stocks and ETFs shown at the limit (the price unchanged)'),
    flag: 'limit',
    options: [
      { id: 'up', label: T('漲停', 'Limit up') },
      { id: 'down', label: T('跌停', 'Limit down') }
    ]
  },
  {
    app: 'stock',
    title: T('處置股／注意股', 'Disposition / attention list'),
    sub: T('台股一律列為處置或注意，看標籤和提醒', 'Every Taiwan stock on the list: its tag and notes'),
    flag: 'alertList',
    options: [
      { id: 'punish', label: T('處置', 'Disposition') },
      { id: 'notice', label: T('注意', 'Attention') }
    ]
  },
  {
    app: 'stock',
    title: T('新股抽籤結果', 'IPO draw result'),
    sub: T('首頁新股申購多一列測試申購（只顯示，不扣款也不配股）', 'One test application on home (shown only: no money, no shares)'),
    flag: 'ipoDraw',
    options: [
      { id: 'drawing', label: T('抽籤中', 'Drawing') },
      { id: 'won', label: T('中籤', 'Won') },
      { id: 'lost', label: T('未中籤', 'Lost') }
    ]
  },
  { app: 'stock', title: T('讀不到報價', 'Quotes failing'), sub: T('所有報價讀取失敗，看沒有價格時的畫面', 'Every price read fails: the screens without prices'), flag: 'quotesFail' },
  { app: 'stock', title: T('透支（只顯示）', 'Overdraft (display only)'), sub: T('資產頁和首頁顯示透支 NT$12,345 的提醒；不會賣出任何持股', 'The overdraft card and strip, NT$12,345 short; nothing is sold'), flag: 'odFake' }
);
