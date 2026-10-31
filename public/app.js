/**
 * AuraPlan Client Application Controller
 * Featuring adaptive fluid theme dynamics, persistent blueprint vault history,
 * and seamless interactive plan management.
 */

import { formatMoney, todayIsoDate } from './format.js';
import {
  el,
  renderBudget,
  renderIdeas,
  renderRfp,
  renderRisks,
  renderSummary,
  renderTimeline,
  renderVendors,
} from './render.js';

const STORAGE_ACTIVE_KEY = 'auraplan_active_blueprint';
const STORAGE_VAULT_KEY = 'auraplan_history_vault';
const STORAGE_VENDOR_KEY = 'auraplan_checked_vendors';

let currentPlan = null;
let currentMeta = null;
let checkedVendors = new Set();
let blueprintHistory = [];

// DOM References
const form = document.getElementById('plan-form');
const eventTypeSelect = document.getElementById('event-type');
const themeLabel = document.getElementById('theme-label');
const submitBtn = document.getElementById('submit-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const errorBanner = document.getElementById('error-banner');
const planOutput = document.getElementById('plan-output');
const planContent = document.getElementById('plan-content');
const refineForm = document.getElementById('refine-form');
const feedbackInput = document.getElementById('feedback-input');
const refineBtn = document.getElementById('refine-btn');

// Clear / Reset buttons
const clearPlanBtn = document.getElementById('clear-plan-btn');
const resetFormBtn = document.getElementById('reset-form-btn');

// History Drawer Modal elements
const openHistoryBtn = document.getElementById('open-history-btn');
const closeHistoryBtn = document.getElementById('close-history-btn');
const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');
const historyCountBadge = document.getElementById('history-count');
const clearAllHistoryBtn = document.getElementById('clear-all-history-btn');

// Export buttons
const downloadIcsBtn = document.getElementById('download-ics-btn');
const downloadCsvBtn = document.getElementById('download-csv-btn');
const printBtn = document.getElementById('print-btn');

const THEME_NAMES = {
  wedding: 'Wedding Mode (Rose & Gold)',
  birthday: 'Birthday Mode (Neon Purple & Coral)',
  community: 'Community Mode (Emerald & Cyan)',
};

/**
 * Updates dynamic event theme on document body.
 * @param {string} type
 */
function setEventTheme(type) {
  const safeType = ['wedding', 'birthday', 'community'].includes(type) ? type : 'wedding';
  document.body.setAttribute('data-theme', safeType);
  if (themeLabel) {
    themeLabel.textContent = THEME_NAMES[safeType] || 'Event Mode';
  }
}

/**
 * Announces status changes to assistive technology.
 * @param {string} message
 */
function announceStatus(message) {
  const live = document.getElementById('screen-reader-announcer');
  if (live) live.textContent = message;
}

/**
 * Displays error banner.
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
 * Clears field-level error messages and aria-invalid attributes.
 */
function clearFieldErrors() {
  for (const node of document.querySelectorAll('.field-error')) {
    node.textContent = '';
  }
  for (const field of document.querySelectorAll('[aria-invalid]')) {
    field.removeAttribute('aria-invalid');
  }
}

/**
 * Binds field-level errors to accessible slots and shifts focus to the first invalid field.
 * @param {Record<string, string>} fieldErrors
 */
function showFieldErrors(fieldErrors) {
  for (const [name, message] of Object.entries(fieldErrors)) {
    const slot = document.getElementById(`${name}-error`) ?? document.getElementById('form-error');
    if (slot) slot.textContent = message;
    const input = document.querySelector(`[name="${CSS.escape(name)}"]`);
    input?.setAttribute('aria-invalid', 'true');
  }
  document.querySelector('[aria-invalid="true"]')?.focus();
}

/**
 * Loads vault history from localStorage.
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_VAULT_KEY);
    blueprintHistory = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(blueprintHistory)) blueprintHistory = [];
  } catch {
    blueprintHistory = [];
  }
  updateHistoryUI();
}

/**
 * Saves a blueprint record to persistent history vault.
 * @param {object} plan
 * @param {object} meta
 */
function saveToHistory(plan, meta) {
  const record = {
    id: String(Date.now()),
    timestamp: new Date().toISOString(),
    title: `${meta.eventType.toUpperCase()} in ${meta.location}`,
    eventType: meta.eventType,
    eventDate: meta.eventDate,
    location: meta.location,
    guestCount: meta.guestCount,
    budget: meta.budget,
    currency: meta.currency,
    plan,
    meta,
  };

  // Prepend new record, limit to 20
  blueprintHistory = [record, ...blueprintHistory.filter((item) => item.id !== record.id)].slice(0, 20);

  try {
    localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(blueprintHistory));
  } catch {
    // Ignore storage quota
  }

  updateHistoryUI();
}

/**
 * Deletes a single history record.
 * @param {string} id
 */
function deleteHistoryRecord(id) {
  blueprintHistory = blueprintHistory.filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(blueprintHistory));
  } catch {
    // Ignore storage quota
  }
  updateHistoryUI();
  announceStatus('Blueprint removed from history vault.');
}

/**
 * Clears all history from vault.
 */
function clearAllHistory() {
  if (!confirm('Are you sure you want to clear your entire blueprint history?')) return;
  blueprintHistory = [];
  try {
    localStorage.removeItem(STORAGE_VAULT_KEY);
  } catch {
    // Ignore storage quota
  }
  updateHistoryUI();
  announceStatus('All history cleared.');
}

/**
 * Updates history UI drawer and count badges.
 */
function updateHistoryUI() {
  if (historyCountBadge) {
    historyCountBadge.textContent = String(blueprintHistory.length);
  }

  if (!historyList) return;
  historyList.replaceChildren();

  if (blueprintHistory.length === 0) {
    const emptyBox = el('div', 'history-empty');
    emptyBox.appendChild(el('div', 'history-empty-icon', '📜'));
    emptyBox.appendChild(el('h3', '', 'Vault is Empty'));
    emptyBox.appendChild(el('p', '', 'Planned celebration blueprints will be stored here automatically for instant review.'));
    historyList.appendChild(emptyBox);
    return;
  }

  for (const item of blueprintHistory) {
    const card = el('div', 'history-item-card');

    const top = el('div', 'history-item-top');
    top.appendChild(el('span', 'history-item-type', item.eventType));
    top.appendChild(el('span', 'history-item-date', new Date(item.timestamp).toLocaleDateString()));

    const title = el('h4', 'history-item-title', item.title);

    const footer = el('div', 'history-item-footer');
    footer.appendChild(el('span', 'history-item-budget', formatMoney(item.budget, item.currency)));

    const actions = el('div', 'history-item-actions');
    const loadBtn = el('button', 'btn btn-glass', 'Load', { type: 'button' });
    loadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadBlueprintRecord(item);
      closeHistoryDrawer();
    });

    const delBtn = el('button', 'btn btn-ghost', '🗑️', {
      type: 'button',
      'aria-label': `Delete ${item.title}`,
      title: 'Delete from history',
    });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryRecord(item.id);
    });

    actions.append(loadBtn, delBtn);
    footer.appendChild(actions);

    card.append(top, title, footer);
    card.addEventListener('click', () => {
      loadBlueprintRecord(item);
      closeHistoryDrawer();
    });

    historyList.appendChild(card);
  }
}

/**
 * Loads a selected record into the active planner workspace.
 * @param {object} record
 */
function loadBlueprintRecord(record) {
  currentPlan = record.plan;
  currentMeta = record.meta;

  setEventTheme(record.eventType);
  if (eventTypeSelect) eventTypeSelect.value = record.eventType;

  // Populate form fields with loaded record
  const dateInput = document.getElementById('event-date');
  const locInput = document.getElementById('location');
  const guestInput = document.getElementById('guest-count');
  const budgetInput = document.getElementById('budget');
  const currSelect = document.getElementById('currency');
  const vibeInput = document.getElementById('vibe');
  const prioInput = document.getElementById('priorities');
  const langSelect = document.getElementById('language');

  if (dateInput) dateInput.value = record.eventDate || '';
  if (locInput) locInput.value = record.location || '';
  if (guestInput) guestInput.value = record.guestCount || '';
  if (budgetInput) budgetInput.value = record.budget || '';
  if (currSelect) currSelect.value = record.currency || 'USD';
  if (vibeInput) vibeInput.value = record.meta?.vibe || '';
  if (prioInput) prioInput.value = record.meta?.priorities || '';
  if (langSelect) langSelect.value = record.meta?.language || 'English';

  try {
    localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify({ plan: currentPlan, meta: currentMeta }));
  } catch {
    // Ignore storage quota
  }

  displayPlan();
  announceStatus(`Loaded ${record.title} from vault.`);
}

/**
 * Opens slide-over history drawer.
 */
function openHistoryDrawer() {
  if (!historyModal) return;
  historyModal.hidden = false;
  requestAnimationFrame(() => historyModal.classList.add('open'));
  openHistoryBtn?.setAttribute('aria-expanded', 'true');
  announceStatus('History vault opened.');
}

/**
 * Closes slide-over history drawer.
 */
function closeHistoryDrawer() {
  if (!historyModal) return;
  historyModal.classList.remove('open');
  openHistoryBtn?.setAttribute('aria-expanded', 'false');
  setTimeout(() => {
    historyModal.hidden = true;
  }, 350);
}

/**
 * Clears active plan, resets form, and returns to pristine state.
 */
function clearAndReset() {
  form?.reset();
  currentPlan = null;
  currentMeta = null;

  try {
    localStorage.removeItem(STORAGE_ACTIVE_KEY);
  } catch {
    // Ignore storage quota
  }

  if (planOutput) planOutput.hidden = true;
  clearError();
  clearFieldErrors();

  // Reset default event theme
  setEventTheme('wedding');

  // Scroll smoothly to form
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  announceStatus('Form cleared. Ready for a new event.');
}

/**
 * Renders the entire active blueprint view.
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
      try {
        localStorage.setItem(STORAGE_VENDOR_KEY, JSON.stringify(Array.from(checkedVendors)));
      } catch {
        // Ignore storage quota
      }
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
}

/**
 * Requests plan from backend API.
 * @param {object} payload
 */
async function requestPlan(payload) {
  clearError();
  clearFieldErrors();
  submitBtn.disabled = true;
  if (refineBtn) refineBtn.disabled = true;
  loadingIndicator.hidden = false;
  loadingIndicator.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  announceStatus('Generating your tailored event blueprint. Please wait...');

  try {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.error?.message || `Planning request failed with status ${res.status}`);
      err.fieldErrors = data?.error?.fieldErrors;
      throw err;
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

    // Save as active plan
    try {
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify({ plan: currentPlan, meta: currentMeta }));
    } catch {
      // Ignore storage quota
    }

    // Save to historical vault
    saveToHistory(currentPlan, currentMeta);

    displayPlan();
    announceStatus('Event blueprint successfully generated and saved to vault.');
  } catch (err) {
    showError(err.message || 'Unable to generate plan. Please try again.');
    if (err.fieldErrors) {
      showFieldErrors(err.fieldErrors);
    }
  } finally {
    submitBtn.disabled = false;
    if (refineBtn) refineBtn.disabled = false;
    loadingIndicator.hidden = true;
  }
}

/**
 * Initializes controller.
 */
function init() {
  // Load saved vendors & history
  try {
    const rawVendors = localStorage.getItem(STORAGE_VENDOR_KEY);
    if (rawVendors) checkedVendors = new Set(JSON.parse(rawVendors));
  } catch {
    checkedVendors = new Set();
  }

  loadHistory();

  // Set min date to today
  const dateInput = document.getElementById('event-date');
  if (dateInput) {
    dateInput.min = todayIsoDate();
  }

  // URL query params preselection
  const params = new URLSearchParams(window.location.search);
  const typeParam = params.get('type');
  if (eventTypeSelect) {
    if (typeParam && ['wedding', 'birthday', 'community'].includes(typeParam)) {
      eventTypeSelect.value = typeParam;
    }
    setEventTheme(eventTypeSelect.value);

    // Event listener for dynamic theme switching
    eventTypeSelect.addEventListener('change', () => {
      setEventTheme(eventTypeSelect.value);
    });
  }

  // Restore active plan if present
  try {
    const cached = localStorage.getItem(STORAGE_ACTIVE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.plan && parsed?.meta) {
        currentPlan = parsed.plan;
        currentMeta = parsed.meta;
        displayPlan();
      }
    }
  } catch {
    // Ignore storage error
  }

  // Form submission
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

  // Refine submission
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

  // Clear / Reset buttons
  clearPlanBtn?.addEventListener('click', clearAndReset);
  resetFormBtn?.addEventListener('click', clearAndReset);

  // History Drawer modal interactions
  openHistoryBtn?.addEventListener('click', openHistoryDrawer);
  closeHistoryBtn?.addEventListener('click', closeHistoryDrawer);
  clearAllHistoryBtn?.addEventListener('click', clearAllHistory);

  historyModal?.addEventListener('click', (e) => {
    if (e.target === historyModal) closeHistoryDrawer();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && historyModal?.classList.contains('open')) {
      closeHistoryDrawer();
    }
  });

  // Calendar sync download (.ics)
  downloadIcsBtn?.addEventListener('click', async () => {
    if (!currentPlan?.timeline) return;
    const { generateIcsCalendar } = await import('./export.js');
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
    announceStatus('iCalendar schedule downloaded.');
  });

  // Budget spreadsheet download (.csv)
  downloadCsvBtn?.addEventListener('click', async () => {
    if (!currentPlan?.budget) return;
    const { generateCsvBudget } = await import('./export.js');
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
    announceStatus('Budget CSV downloaded.');
  });

  // Print mode
  printBtn?.addEventListener('click', () => {
    window.print();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
