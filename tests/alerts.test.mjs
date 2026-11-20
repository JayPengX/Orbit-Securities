import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAlertList, alertOf, rocDate } from '../public/lib/alerts.mjs';

test('rocDate reads 民國 dates as Taipei midnight', () => {
  assert.equal(new Date(rocDate('115/10/19') + 8 * 3_600_000).toISOString().slice(0, 10), '2026-10-19');
  assert.equal(rocDate('nope'), null);
});

test('處置 list: columns found by name, period end kept', () => {
  // TWSE's fields as the live list has them (checked on the Mac, 2026-10-18).
  const json = { stat: 'OK', fields: ['編號', '公布日期', '證券代號', '證券名稱', '累計', '處置條件', '處置起迄時間', '處置措施', '處置內容', '備註'], data: [['1', '115/10/16', '3231', '緯創', '1', '連續三次', '115/10/19～115/10/30', '第一次處置', '', ''], ['2', '115/10/16', 'x', 'bad', '', '', '', '', '', '']] };
  const m = parseAlertList(json, 'punish');
  assert.deepEqual([...m.keys()], ['3231']);
  const end = m.get('3231').until;
  assert.equal(alertOf('3231.TW', { punish: m }, end - 1), 'punish');
  assert.equal(alertOf('3231.TW', { punish: m }, end), '');
  assert.equal(alertOf('3231.TWO', { punish: m }, end - 1), '');
});

test('注意 list, and punish wins over notice', () => {
  const notice = parseAlertList({ fields: ['編號', '證券代號', '證券名稱', '累計次數', '注意交易資訊', '日期', '收盤價', '本益比'], data: [['1', '2330', '台積電', '1', '', '115/10/16', '1000', '20'], ['2', '3231', '緯創', '1', '', '115/10/16', '100', '15']] }, 'notice');
  const punish = parseAlertList({ fields: ['證券代號', '處置起迄時間'], data: [['3231', '']] }, 'punish');
  assert.equal(alertOf('2330.TW', { punish, notice }), 'notice');
  assert.equal(alertOf('3231.TW', { punish, notice }), 'punish');
  assert.equal(alertOf('AAPL', { punish, notice }), '');
});

test('a broken or empty answer is no flags', () => {
  assert.equal(parseAlertList(null, 'punish').size, 0);
  assert.equal(parseAlertList({ stat: '很抱歉，沒有符合條件的資料!' }, 'notice').size, 0);
  assert.equal(parseAlertList({ fields: ['名稱'], data: [['a']] }, 'notice').size, 0);
});

// (11-17) Listed the evening before it starts: 處置 from its first day, not the day it's listed.
test('a 處置 starting tomorrow is not one today', () => {
  const m = parseAlertList({ fields: ['公布日期', '證券代號', '處置起迄時間'], data: [['115/11/17', '2455', '115/11/18～115/11/24']] }, 'punish');
  const { from } = m.get('2455');
  assert.equal(from, Date.parse('2026-11-18T00:00:00+08:00'));
  assert.equal(alertOf('2455.TW', { punish: m }, from - 1), '');
  assert.equal(alertOf('2455.TW', { punish: m, notice: new Map([['2455', {}]]) }, from - 1), 'notice');
  assert.equal(alertOf('2455.TW', { punish: m }, from), 'punish');
});

// (11-20) A bare 注意 told nothing: TWSE's own reason is kept, its tags and clause mark off.
test("注意 keeps TWSE's reason and how many times running", () => {
  const m = parseAlertList({ fields: ['編號', '證券代號', '證券名稱', '累計次數', '注意交易資訊', '日期', '收盤價', '本益比'], data: [[10, '2330', '台積電', '1', "六個營業日起迄兩個營業日收盤價價差達350.00元且當日收盤價為最近六個營業日收盤價最低者<font color='#FF0000'>﹝第十一款﹞</font>。", '115.11.20', '2000.00', '20.36']] }, 'notice');
  assert.deepEqual(m.get('2330'), { why: '六個營業日起迄兩個營業日收盤價價差達350.00元且當日收盤價為最近六個營業日收盤價最低者', times: 1 });
});
