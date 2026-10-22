/**
 * Client-side planner utilities for calendar (.ics) and spreadsheet (.csv) export.
 */

/**
 * Generates RFC 5545 iCalendar (.ics) format string.
 * @param {Array<{ task: string, details?: string, dueDate: string }>} timeline
 * @param {string} eventTitle
 * @returns {string}
 */
export function generateIcsCalendar(timeline, eventTitle = 'Event Milestone') {
  const sanitize = (text = '') =>
    text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  const events = timeline
    .map((item, index) => {
      const cleanDate = item.dueDate.replace(/-/g, '');
      return [
        'BEGIN:VEVENT',
        `UID:${cleanDate}-${index}@auraplan.app`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART;VALUE=DATE:${cleanDate}`,
        `SUMMARY:${sanitize(`[${eventTitle}] ${item.task}`)}`,
        `DESCRIPTION:${sanitize(item.details || '')}`,
        'STATUS:CONFIRMED',
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      ].join('\r\n');
    })
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AuraPlan//Event Planning Assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Generates RFC 4180 CSV spreadsheet string.
 * @param {Array<{ category: string, amount: number, percent: number, tip?: string }>} budget
 * @param {number} total
 * @param {string} currency
 * @returns {string}
 */
export function generateCsvBudget(budget, total, currency) {
  const escapeCsv = (str) => `"${String(str).replace(/"/g, '""')}"`;

  const header = ['Category', `Amount (${currency})`, 'Percentage', 'Value Tip'].join(',');
  const rows = budget.map((b) =>
    [
      escapeCsv(b.category),
      b.amount,
      `${b.percent}%`,
      escapeCsv(b.tip || ''),
    ].join(','),
  );

  const totalRow = [escapeCsv('TOTAL BUDGET'), total, '100%', ''].join(',');
  return [header, ...rows, totalRow].join('\r\n');
}
