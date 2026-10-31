/**
 * Deterministic planning logic: financial allocation and milestone scheduling.
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
