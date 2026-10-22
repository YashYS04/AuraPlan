/**
 * Pure formatting and date math helpers for the browser.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formats a currency amount into a clean integer string according to the locale.
 * @param {number} amount
 * @param {string} currency
 * @param {string} [locale='en-US']
 * @returns {string}
 */
export function formatMoney(amount, currency, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Formats an ISO date (YYYY-MM-DD) into a localized readable date string
 * without timezone drift.
 * @param {string} isoDate
 * @param {string} [locale='en-US']
 * @returns {string}
 */
export function formatDate(isoDate, locale = 'en-US') {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;

  // Use UTC to prevent local timezone offsets from moving the calendar day
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
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
 * Returns today's calendar date in local timezone as YYYY-MM-DD.
 * @returns {string}
 */
export function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Groups an array of items by month based on an ISO date field.
 * @template T
 * @param {T[]} items
 * @param {keyof T} dateKey
 * @returns {Array<{ monthLabel: string, items: T[] }>}
 */
export function groupByMonth(items, dateKey = 'dueDate') {
  const groups = new Map();

  for (const item of items) {
    const iso = String(item[dateKey] || '');
    const monthKey = iso.slice(0, 7); // YYYY-MM
    if (!groups.has(monthKey)) {
      const [year, month] = monthKey.split('-').map(Number);
      const label = isNaN(year)
        ? 'Unscheduled'
        : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
            new Date(Date.UTC(year, month - 1, 1)),
          );
      groups.set(monthKey, { monthLabel: label, items: [] });
    }
    groups.get(monthKey).items.push(item);
  }

  return Array.from(groups.values());
}
