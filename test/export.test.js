import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generateCsvBudget, generateIcsCalendar } from '../public/export.js';

describe('generateIcsCalendar', () => {
  test('generates standard RFC 5545 iCalendar content with all milestones', () => {
    const timeline = [
      { task: 'Book Venue', details: 'Sign contract; deposit required, 50%', dueDate: '2026-06-01' },
      { task: 'Send Invitations', details: 'Mail cards\nInclude RSVP link', dueDate: '2026-08-01' },
    ];
    const ics = generateIcsCalendar(timeline, 'Garden Wedding');

    assert.ok(ics.includes('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('VERSION:2.0'));
    assert.ok(ics.includes('PRODID:-//AuraPlan//Event Planning Assistant//EN'));
    assert.ok(ics.includes('BEGIN:VEVENT'));
    assert.ok(ics.includes('SUMMARY:[Garden Wedding] Book Venue'));
    assert.ok(ics.includes('DTSTART;VALUE=DATE:20260601'));
    assert.ok(ics.includes('UID:20260601-0@auraplan.app'));
    assert.ok(ics.includes('STATUS:CONFIRMED'));
    assert.ok(ics.includes('END:VEVENT'));
    assert.ok(ics.includes('END:VCALENDAR'));
  });

  test('handles empty timeline and default eventTitle safely', () => {
    const ics = generateIcsCalendar([]);
    assert.ok(ics.includes('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('END:VCALENDAR'));

    const nullTimelineIcs = generateIcsCalendar(null);
    assert.ok(nullTimelineIcs.includes('BEGIN:VCALENDAR'));
  });
});

describe('generateCsvBudget', () => {
  test('generates valid RFC 4180 escaped CSV string with headers and total row', () => {
    const budget = [
      { category: 'Venue, Food & Bar', amount: 15000, percent: 50, tip: 'Ask for "off-peak" discount' },
      { category: 'Photo & Video', amount: 15000, percent: 50, tip: 'Package deal' },
    ];
    const csv = generateCsvBudget(budget, 30000, 'USD');

    assert.ok(csv.includes('Category,Amount (USD),Percentage,Value Tip'));
    assert.ok(csv.includes('"Venue, Food & Bar",15000,50%,"Ask for ""off-peak"" discount"'));
    assert.ok(csv.includes('"TOTAL BUDGET",30000,100%'));
  });

  test('handles empty budget array and missing tips safely', () => {
    const csv = generateCsvBudget([], 0, 'EUR');
    assert.ok(csv.includes('Category,Amount (EUR),Percentage,Value Tip'));
    assert.ok(csv.includes('"TOTAL BUDGET",0,100%'));

    const itemWithoutTip = [{ category: 'Catering', amount: 5000, percent: 100 }];
    const singleCsv = generateCsvBudget(itemWithoutTip, 5000, 'INR');
    assert.ok(singleCsv.includes('"Catering",5000,100%,""'));
  });
});
