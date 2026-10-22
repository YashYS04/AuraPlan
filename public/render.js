/**
 * Safe, accessible DOM rendering engine.
 * STRICT SECURITY RULE: Uses document.createElement and textContent exclusively.
 * Zero innerHTML usage ensures absolute protection against XSS vulnerabilities.
 */

import { formatDate, formatMoney, groupByMonth } from './format.js';

/**
 * Creates an element with optional classes, attributes, and text content.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @param {Record<string, string>} [attrs]
 * @returns {HTMLElement}
 */
export function el(tag, className = '', text = '', attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v);
  }
  return node;
}

/**
 * Renders executive summary banner.
 * @param {string} summary
 * @param {{ eventType: string, eventDate: string, location: string, guestCount: number }} meta
 * @returns {HTMLElement}
 */
export function renderSummary(summary, meta) {
  const container = el('div', 'summary-card');
  const badge = el('span', 'badge badge-primary', meta.eventType.toUpperCase());
  const heading = el('h2', 'summary-title', 'Executive Event Blueprint');
  const text = el('p', 'summary-text', summary);

  const stats = el('div', 'summary-meta');
  stats.appendChild(el('span', 'meta-pill', `📅 ${formatDate(meta.eventDate)}`));
  stats.appendChild(el('span', 'meta-pill', `📍 ${meta.location}`));
  stats.appendChild(el('span', 'meta-pill', `👥 ${meta.guestCount.toLocaleString()} Guests`));

  container.append(badge, heading, text, stats);
  return container;
}

/**
 * Renders budget breakdown table and progress distribution.
 * @param {Array<{ category: string, amount: number, percent: number, tip: string }>} budget
 * @param {number} total
 * @param {string} currency
 * @returns {HTMLElement}
 */
export function renderBudget(budget, total, currency) {
  const container = el('div', 'budget-section');

  const header = el('div', 'section-header');
  header.appendChild(el('h3', 'section-title', 'Budget Allocation'));
  header.appendChild(el('span', 'total-badge', `Total: ${formatMoney(total, currency)}`));
  container.appendChild(header);

  // Visual proportional distribution bar
  const bar = el('div', 'budget-bar', '', { role: 'progressbar', 'aria-label': 'Budget category distribution' });
  for (const item of budget) {
    const segment = el('div', 'budget-bar-segment');
    segment.style.width = `${item.percent}%`;
    segment.title = `${item.category}: ${item.percent}% (${formatMoney(item.amount, currency)})`;
    bar.appendChild(segment);
  }
  container.appendChild(bar);

  // Detail cards
  const grid = el('div', 'budget-grid');
  for (const item of budget) {
    const card = el('div', 'budget-item-card');

    const top = el('div', 'budget-item-top');
    top.appendChild(el('h4', 'budget-item-name', item.category));
    top.appendChild(el('span', 'budget-item-amount', formatMoney(item.amount, currency)));

    const share = el('div', 'budget-item-share', `${item.percent}% of budget`);
    const tip = el('p', 'budget-item-tip', `💡 Tip: ${item.tip}`);

    card.append(top, share, tip);
    grid.appendChild(card);
  }

  container.appendChild(grid);
  return container;
}

/**
 * Renders timeline milestones grouped chronologically by month.
 * @param {Array<{ task: string, details: string, dueDate: string, compressed: boolean }>} timeline
 * @returns {HTMLElement}
 */
export function renderTimeline(timeline) {
  const container = el('div', 'timeline-section');
  const header = el('div', 'section-header');
  header.appendChild(el('h3', 'section-title', 'Execution Milestones'));
  header.appendChild(el('span', 'count-badge', `${timeline.length} Milestones`));
  container.appendChild(header);

  const groups = groupByMonth(timeline, 'dueDate');

  for (const group of groups) {
    const groupEl = el('div', 'timeline-group');
    groupEl.appendChild(el('h4', 'timeline-month-label', group.monthLabel));

    const list = el('ol', 'timeline-list');
    for (const item of group.items) {
      const li = el('li', `timeline-item ${item.compressed ? 'timeline-item-urgent' : ''}`);

      const marker = el('div', 'timeline-marker');
      const content = el('div', 'timeline-content');

      const dateRow = el('div', 'timeline-date-row');
      dateRow.appendChild(el('time', 'timeline-date', formatDate(item.dueDate), { datetime: item.dueDate }));

      if (item.compressed) {
        dateRow.appendChild(el('span', 'badge badge-urgent', '⚡ Do Now (Priority)'));
      }

      const task = el('h5', 'timeline-task', item.task);
      const details = el('p', 'timeline-details', item.details);

      content.append(dateRow, task, details);
      li.append(marker, content);
      list.appendChild(li);
    }

    groupEl.appendChild(list);
    container.appendChild(groupEl);
  }

  return container;
}

/**
 * Renders interactive vendor checklist with persistent checkbox tracking.
 * @param {Array<{ category: string, lookFor: string, questions: string[], dueDate: string }>} vendors
 * @param {Set<string>} checkedKeys
 * @param {(category: string, isChecked: boolean) => void} onToggle
 * @returns {HTMLElement}
 */
export function renderVendors(vendors, checkedKeys, onToggle) {
  const container = el('div', 'vendors-section');
  const header = el('div', 'section-header');
  header.appendChild(el('h3', 'section-title', 'Vendor Hiring & Verification Checklist'));
  header.appendChild(el('span', 'count-badge', `${vendors.length} Vendors Required`));
  container.appendChild(header);

  const grid = el('div', 'vendors-grid');

  for (const vendor of vendors) {
    const isChecked = checkedKeys.has(vendor.category);
    const card = el('div', `vendor-card ${isChecked ? 'vendor-card-done' : ''}`);

    const cardHeader = el('div', 'vendor-card-header');
    const label = el('label', 'vendor-checkbox-label');

    const checkbox = el('input', 'vendor-checkbox', '', {
      type: 'checkbox',
      'aria-label': `Mark ${vendor.category} as booked`,
    });
    checkbox.checked = isChecked;
    checkbox.addEventListener('change', () => {
      onToggle(vendor.category, checkbox.checked);
      card.classList.toggle('vendor-card-done', checkbox.checked);
    });

    const categoryTitle = el('span', 'vendor-category-title', vendor.category);
    label.append(checkbox, categoryTitle);

    const deadline = el('span', 'vendor-deadline', `Target: ${formatDate(vendor.dueDate)}`);
    cardHeader.append(label, deadline);

    const lookForBlock = el('div', 'vendor-look-for');
    lookForBlock.appendChild(el('strong', '', 'What to look for: '));
    lookForBlock.appendChild(el('span', '', vendor.lookFor));

    const questionsBlock = el('div', 'vendor-questions');
    questionsBlock.appendChild(el('strong', '', 'Discerning Interview Questions:'));
    const qList = el('ul', 'questions-list');
    for (const q of vendor.questions) {
      qList.appendChild(el('li', '', q));
    }
    questionsBlock.appendChild(qList);

    card.append(cardHeader, lookForBlock, questionsBlock);
    grid.appendChild(card);
  }

  container.appendChild(grid);
  return container;
}

/**
 * Renders creative personalized ideas.
 * @param {Array<{ area: string, title: string, description: string, whyItFits: string }>} ideas
 * @returns {HTMLElement}
 */
export function renderIdeas(ideas) {
  const container = el('div', 'ideas-section');
  const header = el('div', 'section-header');
  header.appendChild(el('h3', 'section-title', 'Curated Inspiration & Personalized Concepts'));
  container.appendChild(header);

  const grid = el('div', 'ideas-grid');

  for (const idea of ideas) {
    const card = el('div', 'idea-card');
    const tag = el('span', 'idea-tag', idea.area.toUpperCase());
    const title = el('h4', 'idea-title', idea.title);
    const desc = el('p', 'idea-desc', idea.description);
    const reason = el('div', 'idea-reason');
    reason.appendChild(el('span', 'reason-icon', '🎯 '));
    reason.appendChild(el('em', '', idea.whyItFits));

    card.append(tag, title, desc, reason);
    grid.appendChild(card);
  }

  container.appendChild(grid);
  return container;
}

/**
 * Renders Risk Mitigation Matrix.
 * @param {Array<{ risk: string, impact: string, mitigation: string }>} risks
 * @returns {HTMLElement}
 */
export function renderRisks(risks) {
  const container = el('div', 'risks-section');
  const header = el('div', 'section-header');
  header.appendChild(el('h3', 'section-title', 'Contingency & Operational Risk Safeguards'));
  container.appendChild(header);

  const grid = el('div', 'risks-grid');

  for (const item of risks) {
    const card = el('div', `risk-card risk-card-${item.impact}`);
    const top = el('div', 'risk-top');
    top.appendChild(el('h4', 'risk-name', item.risk));
    top.appendChild(el('span', `impact-badge impact-${item.impact}`, `${item.impact.toUpperCase()} IMPACT`));

    const solution = el('p', 'risk-mitigation', `🛡️ Contingency: ${item.mitigation}`);

    card.append(top, solution);
    grid.appendChild(card);
  }

  container.appendChild(grid);
  return container;
}

/**
 * Renders vendor inquiry email template (RFP).
 * @param {{ subject: string, opening: string, keyInquiries: string[], closing: string }} rfp
 * @param {(text: string) => void} onCopy
 * @returns {HTMLElement}
 */
export function renderRfp(rfp, onCopy) {
  const container = el('div', 'rfp-section');
  const header = el('div', 'section-header');
  header.appendChild(el('h3', 'section-title', 'Ready-to-Send Vendor RFP Email Draft'));

  const fullEmail = [
    `Subject: ${rfp.subject}`,
    '',
    rfp.opening,
    '',
    'Key Requirements & Questions:',
    ...rfp.keyInquiries.map((q) => `• ${q}`),
    '',
    rfp.closing,
  ].join('\n');

  const copyBtn = el('button', 'btn btn-secondary', '📋 Copy Email Draft', { type: 'button' });
  copyBtn.addEventListener('click', () => {
    onCopy(fullEmail);
    copyBtn.textContent = '✅ Copied to Clipboard!';
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy Email Draft';
    }, 2500);
  });

  header.appendChild(copyBtn);
  container.appendChild(header);

  const preview = el('div', 'rfp-preview');
  const subj = el('div', 'rfp-subject');
  subj.appendChild(el('strong', '', 'Subject: '));
  subj.appendChild(el('span', '', rfp.subject));

  const body = el('div', 'rfp-body');
  body.appendChild(el('p', '', rfp.opening));

  const list = el('ul', 'rfp-inquiries');
  for (const item of rfp.keyInquiries) {
    list.appendChild(el('li', '', item));
  }
  body.appendChild(list);
  body.appendChild(el('p', '', rfp.closing));

  preview.append(subj, body);
  container.appendChild(preview);
  return container;
}
