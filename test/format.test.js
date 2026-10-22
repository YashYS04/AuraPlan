import assert from 'node:assert/strict';
import test from 'node:test';
import { daysBetween, formatDate, formatMoney, groupByMonth, todayIsoDate } from '../public/format.js';

test('formatMoney formats amounts with currency symbols and no decimals', () => {
  const usd = formatMoney(25000, 'USD');
  assert.match(usd, /\$25,000/);

  const inr = formatMoney(500000, 'INR', 'en-IN');
  assert.ok(inr.includes('5,00,000') || inr.includes('500,000'));

  const fallback = formatMoney(1234, 'INVALID_CODE');
  assert.equal(fallback, 'INVALID_CODE 1,234');
});

test('formatDate formats ISO dates consistently without UTC offset drift', () => {
  const formatted = formatDate('2026-10-24');
  assert.match(formatted, /Oct 24, 2026/);
  assert.equal(formatDate(''), '');
  assert.equal(formatDate(null), '');
});

test('daysBetween correctly calculates signed whole days', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-10'), 9);
  assert.equal(daysBetween('2026-10-10', '2026-10-01'), -9);
  assert.equal(daysBetween('2026-10-01', '2026-10-01'), 0);
});

test('todayIsoDate returns valid YYYY-MM-DD', () => {
  const today = todayIsoDate();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
});

test('groupByMonth aggregates items chronologically by month', () => {
  const items = [
    { name: 'Task 1', dueDate: '2026-06-15' },
    { name: 'Task 2', dueDate: '2026-06-28' },
    { name: 'Task 3', dueDate: '2026-07-04' },
  ];

  const groups = groupByMonth(items, 'dueDate');
  assert.equal(groups.length, 2);
  assert.match(groups[0].monthLabel, /June 2026/);
  assert.equal(groups[0].items.length, 2);
  assert.match(groups[1].monthLabel, /July 2026/);
  assert.equal(groups[1].items.length, 1);
});
