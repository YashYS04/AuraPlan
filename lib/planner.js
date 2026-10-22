/**
 * Deterministic planning logic: financial allocation, milestone scheduling,
 * and standard calendar/spreadsheet export generation.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

/**
 * Formats a Date or millisecond timestamp as YYYY-MM-DD in UTC.
 * @param {number | Date | string} time
 * @returns {string}
 */
export function toIsoDate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Calculates whole days between two ISO dates (b - a).
 * @param {string} a YYYY-MM-DD
 * @param {string} b YYYY-MM-DD
 * @returns {number}
 */
export function daysBetween(a, b) {
  const msA = Date.parse(`${a}T00:00:00Z`);
  const msB = Date.parse(`${b}T00:00:00Z`);
  return Math.round((msB - msA) / DAY_MS);
}

/**
 * Implements the Hamilton / Largest-Remainder Method to allocate currency
 * amounts from integer percentage weights. The returned amounts are guaranteed
 * to sum exactly to `total`.
 *
 * @template {{ weight: number }} T
 * @param {T[]} items
 * @param {number} total Whole currency units.
 * @returns {(T & { amount: number, percent: number })[]}
 */
export function allocateBudget(items, total) {
  if (!items || items.length === 0) return [];
  if (total <= 0) {
    return items.map((item) => ({ ...item, amount: 0, percent: 0 }));
  }

  const weightSum = items.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum === 0) {
    return items.map((item) => ({ ...item, amount: 0, percent: 0 }));
  }

  const exact = items.map((item) => (total * item.weight) / weightSum);
  const amounts = exact.map(Math.floor);

  let leftover = total - amounts.reduce((sum, amount) => sum + amount, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - amounts[index] }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const { index } of byRemainder) {
    if (leftover <= 0) break;
    amounts[index] += 1;
    leftover -= 1;
  }

  return items.map((item, index) => ({
    ...item,
    amount: amounts[index],
    percent: Math.round((item.weight / weightSum) * 1000) / 10,
  }));
}

/**
 * Converts relative week offsets into calendar dates counted back from `eventDate`.
 * Overdue milestones are brought forward to `today` and flagged as `compressed`.
 *
 * @template {{ weeksBefore: number }} T
 * @param {T[]} items
 * @param {string} eventDate ISO date (YYYY-MM-DD)
 * @param {string} today ISO date (YYYY-MM-DD)
 * @returns {(T & { dueDate: string, compressed: boolean })[]}
 */
export function scheduleByWeeks(items, eventDate, today) {
  if (!items) return [];
  const eventTime = Date.parse(`${eventDate}T00:00:00Z`);

  return items
    .map((item) => {
      const ideal = toIsoDate(eventTime - item.weeksBefore * DAYS_PER_WEEK * DAY_MS);
      const compressed = ideal < today;
      return {
        ...item,
        dueDate: compressed ? today : ideal,
        compressed,
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Enriches model output with mathematically guaranteed budget amounts and calendar dates.
 * @param {import('./schema.js').GeneratedPlan} plan
 * @param {{ budget: number, eventDate: string, today: string }} context
 */
export function enrichPlan(plan, { budget, eventDate, today }) {
  return {
    ...plan,
    budget: allocateBudget(plan.budget, budget),
    timeline: scheduleByWeeks(plan.timeline, eventDate, today),
    vendors: scheduleByWeeks(plan.vendors, eventDate, today),
  };
}

/**
 * Generates RFC 5545 iCalendar (.ics) format string for milestone synchronization.
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
 * Generates standard RFC 4180 CSV spreadsheet string for budget export.
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
