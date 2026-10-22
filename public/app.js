/**
 * AuraPlan Client Application Controller
 */

import { todayIsoDate } from './format.js';
import {
  renderBudget,
  renderIdeas,
  renderRfp,
  renderRisks,
  renderSummary,
  renderTimeline,
  renderVendors,
} from './render.js';

const STORAGE_KEY = 'auraplan_saved_blueprint';
const VENDOR_STORAGE_KEY = 'auraplan_checked_vendors';

let currentPlan = null;
let currentMeta = null;
let checkedVendors = new Set();

// DOM elements
const form = document.getElementById('plan-form');
const submitBtn = document.getElementById('submit-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const errorBanner = document.getElementById('error-banner');
const planOutput = document.getElementById('plan-output');
const planContent = document.getElementById('plan-content');
const refineForm = document.getElementById('refine-form');
const feedbackInput = document.getElementById('feedback-input');
const refineBtn = document.getElementById('refine-btn');

// Export buttons
const downloadIcsBtn = document.getElementById('download-ics-btn');
const downloadCsvBtn = document.getElementById('download-csv-btn');
const printBtn = document.getElementById('print-btn');

/**
 * Loads cached vendor checkbox states from localStorage.
 */
function loadCheckedVendors() {
  try {
    const raw = localStorage.getItem(VENDOR_STORAGE_KEY);
    if (raw) {
      checkedVendors = new Set(JSON.parse(raw));
    }
  } catch {
    checkedVendors = new Set();
  }
}

/**
 * Persists vendor checkbox states to localStorage.
 */
function saveCheckedVendors() {
  try {
    localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(Array.from(checkedVendors)));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Announces dynamic state changes to assistive technology / screen readers.
 * @param {string} message
 */
function announceStatus(message) {
  const live = document.getElementById('screen-reader-announcer');
  if (live) live.textContent = message;
}

/**
 * Displays error banner with accessible alert role.
 * @param {string} message
 */
function showError(message) {
  if (!errorBanner) return;
  errorBanner.textContent = message;
  errorBanner.hidden = false;
  errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  announceStatus(`Error: ${message}`);
}

/**
 * Clears error banner.
 */
function clearError() {
  if (!errorBanner) return;
  errorBanner.hidden = true;
  errorBanner.textContent = '';
}

/**
 * Renders the entire plan view.
 */
function displayPlan() {
  if (!currentPlan || !currentMeta || !planContent) return;

  planContent.replaceChildren();

  // 1. Executive Summary
  planContent.appendChild(renderSummary(currentPlan.summary, currentMeta));

  // 2. Budget Allocation
  planContent.appendChild(renderBudget(currentPlan.budget, currentMeta.budget, currentMeta.currency));

  // 3. Timeline Milestones
  planContent.appendChild(renderTimeline(currentPlan.timeline));

  // 4. Vendor Checklist
  planContent.appendChild(
    renderVendors(currentPlan.vendors, checkedVendors, (category, isChecked) => {
      if (isChecked) {
        checkedVendors.add(category);
      } else {
        checkedVendors.delete(category);
      }
      saveCheckedVendors();
      announceStatus(`Vendor ${category} marked as ${isChecked ? 'booked' : 'pending'}.`);
    }),
  );

  // 5. Personalized Ideas
  planContent.appendChild(renderIdeas(currentPlan.ideas));

  // 6. Risk Mitigation Matrix
  if (currentPlan.risks && currentPlan.risks.length > 0) {
    planContent.appendChild(renderRisks(currentPlan.risks));
  }

  // 7. Vendor Inquiry RFP Template
  if (currentPlan.rfpTemplate) {
    planContent.appendChild(
      renderRfp(currentPlan.rfpTemplate, (text) => {
        navigator.clipboard?.writeText(text);
        announceStatus('Vendor inquiry email copied to clipboard.');
      }),
    );
  }

  planOutput.hidden = false;
  planOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
  announceStatus('Event blueprint successfully generated.');
}

/**
 * Sends planning payload to POST /api/plan.
 * @param {object} payload
 */
async function requestPlan(payload) {
  clearError();
  submitBtn.disabled = true;
  if (refineBtn) refineBtn.disabled = true;
  loadingIndicator.hidden = false;
  announceStatus('Generating your tailored event blueprint. Please wait...');

  try {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Planning request failed with status ${res.status}`);
    }

    currentPlan = data.plan;
    currentMeta = {
      eventType: payload.eventType,
      eventDate: payload.eventDate,
      location: payload.location,
      guestCount: payload.guestCount,
      budget: payload.budget,
      currency: payload.currency,
      vibe: payload.vibe,
      priorities: payload.priorities,
      language: payload.language,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan: currentPlan, meta: currentMeta }));
    } catch {
      // Storage unavailable or full
    }

    displayPlan();
  } catch (err) {
    showError(err.message || 'Unable to generate plan. Please try again.');
  } finally {
    submitBtn.disabled = false;
    if (refineBtn) refineBtn.disabled = false;
    loadingIndicator.hidden = true;
  }
}

/**
 * Initializes form handlers and query parameter routing.
 */
function init() {
  loadCheckedVendors();

  // Set default min date to today
  const dateInput = document.getElementById('event-date');
  if (dateInput) {
    const today = todayIsoDate();
    dateInput.min = today;
  }

  // Check URL query parameters for preselection (?type=wedding, etc.)
  const params = new URLSearchParams(window.location.search);
  const typeParam = params.get('type');
  const typeSelect = document.getElementById('event-type');
  if (typeSelect && typeParam && ['wedding', 'birthday', 'community'].includes(typeParam)) {
    typeSelect.value = typeParam;
  }

  // Restore saved plan if exists
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.plan && parsed?.meta) {
        currentPlan = parsed.plan;
        currentMeta = parsed.meta;
        displayPlan();
      }
    }
  } catch {
    // Ignore invalid storage
  }

  // Initial creation form
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const payload = {
      eventType: String(formData.get('eventType') || 'wedding'),
      eventDate: String(formData.get('eventDate') || ''),
      location: String(formData.get('location') || '').trim(),
      guestCount: Number(formData.get('guestCount')),
      budget: Number(formData.get('budget')),
      currency: String(formData.get('currency') || 'USD'),
      vibe: String(formData.get('vibe') || '').trim(),
      priorities: String(formData.get('priorities') || '').trim(),
      language: String(formData.get('language') || 'English'),
    };

    await requestPlan(payload);
  });

  // Iterative revision / refinement form
  refineForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = feedbackInput?.value?.trim();
    if (!feedback || !currentPlan || !currentMeta) return;

    const payload = {
      ...currentMeta,
      feedback,
      previousPlan: currentPlan,
    };

    await requestPlan(payload);
    if (feedbackInput) feedbackInput.value = '';
  });

  // Calendar sync download (.ics)
  downloadIcsBtn?.addEventListener('click', async () => {
    if (!currentPlan?.timeline) return;

    // Dynamically import planner helper to avoid bundling in initial parse
    const { generateIcsCalendar } = await import('./planner.js');
    const icsContent = generateIcsCalendar(
      currentPlan.timeline,
      `${currentMeta.eventType.toUpperCase()} - ${currentMeta.location}`,
    );

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-milestones-${currentMeta.eventType}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announceStatus('iCalendar milestone schedule downloaded.');
  });

  // Budget spreadsheet download (.csv)
  downloadCsvBtn?.addEventListener('click', async () => {
    if (!currentPlan?.budget) return;

    const { generateCsvBudget } = await import('./planner.js');
    const csvContent = generateCsvBudget(currentPlan.budget, currentMeta.budget, currentMeta.currency);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-budget-${currentMeta.eventType}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announceStatus('Budget spreadsheet downloaded.');
  });

  // Print mode
  printBtn?.addEventListener('click', () => {
    window.print();
  });
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
