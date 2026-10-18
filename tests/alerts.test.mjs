import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAlertList, alertOf, rocDate } from '../public/lib/alerts.mjs';

test('rocDate reads 民國 dates as Taipei midnight', () => {
  assert.equal(new Date(rocDate('115/10/19') + 8 * 3_600_000).toISOString().slice(0, 10), '2026-10-19');
  assert.equal(rocDate('nope'), null);
});

test('處置 list: columns found by name, period end kept', () => {
  const json = { stat: 'OK', fields: ['編號', '公布日期', '證券代號', '證券名稱', '累計', '處置起迄時間', '處置措施'], data: [['1', '115/10/16', '3231', '緯創', '1', '115/10/19～115/10/30', '第一次處置'], ['2', '115/10/16', 'x', 'bad', '', '', '']] };
  const m = parseAlertList(json, 'punish');
  assert.deepEqual([...m.keys()], ['3231']);
  const end = m.get('3231').until;
  assert.equal(alertOf('3231.TW', { punish: m }, end - 1), 'punish');
  assert.equal(alertOf('3231.TW', { punish: m }, end), '');
  assert.equal(alertOf('3231.TWO', { punish: m }, end - 1), '');
});

test('注意 list, and punish wins over notice', () => {
  const notice = parseAlertList({ fields: ['編號', '證券代號', '證券名稱'], data: [['1', '2330', '台積電'], ['2', '3231', '緯創']] }, 'notice');
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
