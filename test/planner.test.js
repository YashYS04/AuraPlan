import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  allocateBudget,
  daysBetween,
  enrichPlan,
  scheduleByWeeks,
  toIsoDate,
} from '../lib/planner.js';
import { MOCK_GENERATED_PLAN } from './fixtures.js';

describe('allocateBudget', () => {
  test('sums exactly to total even when weights do not divide evenly', () => {
    const items = [
      { category: 'Venue', weight: 33 },
      { category: 'Catering', weight: 33 },
      { category: 'Photo', weight: 34 },
    ];
    const total = 10000;
    const allocated = allocateBudget(items, total);
    const sum = allocated.reduce((acc, curr) => acc + curr.amount, 0);

    assert.equal(sum, total);
    assert.equal(allocated[0].percent, 33);
    assert.equal(allocated[1].percent, 33);
    assert.equal(allocated[2].percent, 34);
  });

  test('normalizes relative weights that do not add up to 100', () => {
    const items = [
      { category: 'A', weight: 1 },
      { category: 'B', weight: 2 },
    ];
    const total = 100;
    const allocated = allocateBudget(items, total);
    const sum = allocated.reduce((acc, curr) => acc + curr.amount, 0);

    assert.equal(sum, total);
    assert.equal(allocated[0].amount, 33);
    assert.equal(allocated[1].amount, 67);
  });

  test('handles zero budget or empty items gracefully', () => {
    assert.deepEqual(allocateBudget([], 1000), []);
    const zero = allocateBudget([{ category: 'A', weight: 50 }], 0);
    assert.equal(zero[0].amount, 0);

    const zeroWeight = allocateBudget([{ category: 'A', weight: 0 }], 1000);
    assert.equal(zeroWeight[0].amount, 0);
  });
});

describe('scheduleByWeeks', () => {
  test('calculates correct calendar dates and sorts chronologically', () => {
    const items = [
      { task: 'Event Day', weeksBefore: 0 },
      { task: 'Two Weeks Prior', weeksBefore: 2 },
      { task: 'Four Weeks Prior', weeksBefore: 4 },
    ];
    const eventDate = '2026-10-24';
    const today = '2026-08-01';

    const scheduled = scheduleByWeeks(items, eventDate, today);
    assert.equal(scheduled.length, 3);
    assert.equal(scheduled[0].task, 'Four Weeks Prior');
    assert.equal(scheduled[0].compressed, false);
    assert.equal(scheduled[2].task, 'Event Day');
    assert.equal(scheduled[2].dueDate, eventDate);
  });

  test('pulls overdue milestones forward to today and flags them compressed', () => {
    const items = [
      { task: 'Overdue Task', weeksBefore: 20 },
      { task: 'Future Task', weeksBefore: 2 },
    ];
    const eventDate = '2026-10-24';
    const today = '2026-10-10'; // Only 2 weeks prior

    const scheduled = scheduleByWeeks(items, eventDate, today);
    const overdue = scheduled.find((i) => i.task === 'Overdue Task');
    assert.ok(overdue);
    assert.equal(overdue.dueDate, today);
    assert.equal(overdue.compressed, true);

    assert.deepEqual(scheduleByWeeks(null, eventDate, today), []);
  });
});

describe('enrichPlan', () => {
  test('injects exact amounts and dates into generated plan', () => {
    const enriched = enrichPlan(MOCK_GENERATED_PLAN, {
      budget: 50000,
      eventDate: '2026-10-24',
      today: '2026-05-01',
    });

    const budgetSum = enriched.budget.reduce((acc, curr) => acc + curr.amount, 0);
    assert.equal(budgetSum, 50000);
    assert.ok(enriched.timeline[0].dueDate);
    assert.ok(enriched.vendors[0].dueDate);
  });
});

describe('helpers', () => {
  test('toIsoDate converts timestamp or Date to YYYY-MM-DD', () => {
    assert.equal(toIsoDate(new Date('2026-10-24T12:00:00Z')), '2026-10-24');
  });

  test('daysBetween computes day intervals accurately', () => {
    assert.equal(daysBetween('2026-01-01', '2026-01-10'), 9);
  });
});
