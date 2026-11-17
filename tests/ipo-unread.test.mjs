// 新股申購 with TWSE's list unread (down, or not in yet): an application still
// drawing went from 首頁 and it said 目前沒有可申購的新股 while one was open
// (proven 11-18 with the list answering 503).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const body = app.slice(app.indexOf('function ipoHtml() {'), app.indexOf('\n}\n', app.indexOf('function ipoHtml() {')));

test('the person’s applications show with the list unread, and it never says there are none', () => {
  assert.match(body, /const list = ipoState\.list \|\| \[\];/);
  assert.doesNotMatch(body, /if \(!list\) return/);
  assert.match(body, /t\(ipoState\.list \? 'ipoNone' : 'ipoUnread'\)/);
});

test('the unread words in both languages', () => {
  const src = readFileSync(new URL('../public/lib/i18n.mjs', import.meta.url), 'utf8');
  assert.match(src, /ipoUnread: '新股申購名單暫時讀不到', ipoUnreadSub: '自動重試中。'/);
  assert.match(src, /ipoUnread: 'Couldn’t read the public offers', ipoUnreadSub: 'Trying again\.'/);
});
