import { z } from 'zod';
import { EVENT_TYPES } from './event-types.js';
import { HttpError } from './http.js';

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD'];
export const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Bengali', 'Spanish', 'French', 'German'];
export const IDEA_AREAS = ['theme', 'decor', 'food', 'activities', 'guest-experience'];
export const RISK_IMPACTS = ['low', 'medium', 'high'];

const MAX_GUESTS = 10000;
const MAX_BUDGET = 1_000_000_000;
const MAX_YEARS_AHEAD = 3;
const CONTROL_CHARS = /\p{Cc}+/gu;

/**
 * Free text from users is sanitized: trimmed, bounded, and stripped of control characters.
 * @param {number} min
 * @param {number} max
 */
const userText = (min, max) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((value) => value.replace(CONTROL_CHARS, ' '));

const weeksBefore = (description) =>
  z.number().int().min(0).max(104).describe(description);

/**
 * The structured schema that Gemini must conform to.
 */
export const GeneratedPlan = z.object({
  summary: z.string().describe('Two or three evocative sentences capturing the event concept and execution plan.'),
  budget: z
    .array(
      z.object({
        category: z.string().describe('Specific budget category name.'),
        weight: z.number().int().min(1).max(100).describe('Relative percentage share of the total budget (1-100).'),
        tip: z.string().describe('Actionable, money-saving or value-maximizing advice for this category.'),
      }),
    )
    .min(3)
    .max(12),
  timeline: z
    .array(
      z.object({
        task: z.string().describe('Milestone name or planning action.'),
        details: z.string().describe('One concise sentence explaining how to accomplish this task.'),
        weeksBefore: weeksBefore('Target milestone timeline in whole weeks before the event; 0 is event week.'),
      }),
    )
    .min(4)
    .max(20),
  vendors: z
    .array(
      z.object({
        category: z.string().describe('Vendor service type, e.g. Caterer, AV Provider.'),
        lookFor: z.string().describe('Key qualifications, portfolio signals, or credentials to verify.'),
        questions: z.array(z.string()).min(2).max(4).describe('Direct, discerning questions to ask before hiring.'),
        weeksBefore: weeksBefore('Recommended latest booking deadline, in weeks before the event.'),
      }),
    )
    .min(3)
    .max(10),
  ideas: z
    .array(
      z.object({
        area: z.enum(IDEA_AREAS).describe('Creative dimension: theme, decor, food, activities, or guest-experience.'),
        title: z.string().describe('Creative concept title.'),
        description: z.string().describe('Detailed execution description.'),
        whyItFits: z.string().describe('Contextual justification linking back to user preferences, vibe, and guest count.'),
      }),
    )
    .min(4)
    .max(10),
  risks: z
    .array(
      z.object({
        risk: z.string().describe('Potential logistical, weather, vendor, or guest challenge.'),
        impact: z.enum(RISK_IMPACTS).describe('Assessed severity: low, medium, or high.'),
        mitigation: z.string().describe('Concrete preventative safeguard and backup contingency plan.'),
      }),
    )
    .min(2)
    .max(5)
    .describe('Risk assessment matrix with actionable mitigation strategies.'),
  rfpTemplate: z
    .object({
      subject: z.string().describe('Professional email subject line for vendor inquiries.'),
      opening: z.string().describe('Warm and professional introductory paragraph introducing the event and needs.'),
      keyInquiries: z.array(z.string()).min(2).max(4).describe('Bullet-point expectations/questions for prospective vendors.'),
      closing: z.string().describe('Polite closing line requesting availability and quotation.'),
    })
    .describe('Ready-to-use vendor inquiry email template.'),
});

/** Gemini structured output JSON schema with $schema removed */
export const GENERATED_PLAN_JSON_SCHEMA = z.toJSONSchema(GeneratedPlan);
delete GENERATED_PLAN_JSON_SCHEMA.$schema;

export const PlanRequest = z
  .strictObject({
    eventType: z.enum(Object.keys(EVENT_TYPES)),
    eventDate: z.iso.date(),
    location: userText(2, 100),
    guestCount: z.number().int().min(1).max(MAX_GUESTS),
    budget: z.number().int().min(1).max(MAX_BUDGET),
    currency: z.enum(CURRENCIES),
    vibe: userText(0, 250).default(''),
    priorities: userText(0, 500).default(''),
    language: z.enum(LANGUAGES).default('English'),
    feedback: userText(3, 400).optional(),
    previousPlan: GeneratedPlan.optional(),
  })
  .refine((request) => !request.feedback === !request.previousPlan, {
    path: ['feedback'],
    error: 'A revision request requires the previous plan.',
  });

/** @typedef {z.infer<typeof PlanRequest>} PlanRequest */
/** @typedef {z.infer<typeof GeneratedPlan>} GeneratedPlan */

const FIELD_MESSAGES = {
  eventType: 'Please select a valid event type (wedding, birthday, or community).',
  eventDate: `Event date must be between today and ${MAX_YEARS_AHEAD} years in the future.`,
  location: 'Please enter a location between 2 and 100 characters.',
  guestCount: `Please enter a guest count between 1 and ${MAX_GUESTS.toLocaleString('en')}.`,
  budget: `Please enter a budget between 1 and ${MAX_BUDGET.toLocaleString('en')}.`,
  currency: 'Please select a supported currency.',
  vibe: 'Vibe description must be 250 characters or less.',
  priorities: 'Priorities must be 500 characters or less.',
  language: 'Please select a supported language.',
  feedback: 'Revision feedback must be between 3 and 400 characters.',
};

/**
 * Validates untrusted request data against constraints and date boundaries.
 * @param {unknown} data
 * @param {string} today ISO date (YYYY-MM-DD)
 * @returns {PlanRequest}
 */
export function parsePlanRequest(data, today) {
  const result = PlanRequest.safeParse(data);
  const fieldErrors = {};

  for (const issue of result.error?.issues ?? []) {
    const field = String(issue.path[0] ?? 'form');
    fieldErrors[field] ??= FIELD_MESSAGES[field] ?? issue.message;
  }

  const latest = `${Number(today.slice(0, 4)) + MAX_YEARS_AHEAD}${today.slice(4)}`;
  const eventDate = data?.eventDate;
  if (typeof eventDate === 'string' && (eventDate < today || eventDate > latest)) {
    fieldErrors.eventDate = FIELD_MESSAGES.eventDate;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Some submitted details require correction.', { fieldErrors });
  }

  return result.data;
}

/**
 * Validates and safely parses model output.
 * @param {string} text
 * @returns {GeneratedPlan}
 */
export function parseGeneratedPlan(text) {
  const badResponse = new HttpError(
    502,
    'AI_BAD_RESPONSE',
    'The AI assistant returned an unparseable or incomplete plan. Please retry.',
  );

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw badResponse;
  }

  const result = GeneratedPlan.safeParse(data);
  if (!result.success) {
    throw badResponse;
  }

  return result.data;
}
