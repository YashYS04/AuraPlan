/**
 * Realistic test fixtures matching the Zod schema.
 */

export const MOCK_GENERATED_PLAN = {
  summary:
    'An elegant botanical garden wedding celebration with seasonal catering and curated acoustic performances.',
  budget: [
    { category: 'Venue & Grounds', weight: 35, tip: 'Book during Friday twilight for lower rental fees.' },
    { category: 'Catering & Beverages', weight: 30, tip: 'Opt for family-style dining rather than plated courses.' },
    { category: 'Photography & Film', weight: 15, tip: 'Contract a single lead photographer with second shooter.' },
    { category: 'Decor & Florals', weight: 10, tip: 'Repurpose ceremony arrangements at the reception tables.' },
    { category: 'Contingency Fund', weight: 10, tip: 'Keeps emergency cash liquid for unexpected weather or overtime.' },
  ],
  timeline: [
    { task: 'Secure garden venue and officiant', details: 'Sign rental contracts and lock in primary date.', weeksBefore: 24 },
    { task: 'Hire photographer and videographer', details: 'Review portfolios and verify natural light experience.', weeksBefore: 20 },
    { task: 'Send save-the-dates', details: 'Email digital or mail physical stationery.', weeksBefore: 16 },
    { task: 'Finalize catering menu and tastings', details: 'Select signature cocktails and confirm dietary plates.', weeksBefore: 8 },
    { task: 'Confirm RSVPs and finalize seating', details: 'Gather final headcount for venue table layouts.', weeksBefore: 2 },
    { task: 'Host rehearsal dinner and day-of prep', details: 'Walk through ceremony timing with wedding party.', weeksBefore: 0 },
  ],
  vendors: [
    {
      category: 'Venue Coordinator',
      lookFor: 'On-site experience with outdoor rain contingency execution.',
      questions: ['What is the exact load-in time window?', 'Is there a designated backup indoor space?'],
      weeksBefore: 24,
    },
    {
      category: 'Caterer',
      lookFor: 'Licensed, insured, and experienced with dietary allergies.',
      questions: ['Do you provide staffing and tableware?', 'What is your per-plate tasting policy?'],
      weeksBefore: 12,
    },
    {
      category: 'Photographer',
      lookFor: 'Strong golden-hour and outdoor lighting mastery.',
      questions: ['How many hours are included?', 'What is the turnaround time for the digital gallery?'],
      weeksBefore: 20,
    },
  ],
  ideas: [
    {
      area: 'theme',
      title: 'Botanical Elegance',
      description: 'Earthy neutral tones accented by eucalyptus greenery and warm incandescent fairy lights.',
      whyItFits: 'Matches the outdoor garden setting and intimate guest scale.',
    },
    {
      area: 'food',
      title: 'Artisanal Grazing Station',
      description: 'A pre-ceremony harvest table with local cheeses, fresh figs, and honeycomb.',
      whyItFits: 'Provides immediate hospitality as guests arrive without formal seated delays.',
    },
    {
      area: 'guest-experience',
      title: 'Polaroid Guestbook',
      description: 'A vintage instant camera table where guests snap photos and write personal notes.',
      whyItFits: 'Creates an authentic, interactive keepsake for the couple.',
    },
    {
      area: 'activities',
      title: 'Acoustic Sunset Serenade',
      description: 'A live solo guitarist playing indie-folk covers during cocktail hour.',
      whyItFits: 'Enhances the relaxed, romantic atmosphere without overwhelming conversation.',
    },
  ],
  risks: [
    {
      risk: 'Afternoon rain shower or wind gust during outdoor vows',
      impact: 'high',
      mitigation: 'Reserve a clear-top pavilion tent and establish a 3-hour call time decision with venue.',
    },
    {
      risk: 'Unforeseen guest dietary restrictions',
      impact: 'medium',
      mitigation: 'Include vegan, gluten-free, and nut-allergy checkboxes on RSVP cards.',
    },
  ],
  rfpTemplate: {
    subject: 'Inquiry: Wedding Reception Services - Oct 2026',
    opening: 'Hello! We are currently planning our garden wedding celebration in Seattle and love your work.',
    keyInquiries: [
      'Are you available on our target date?',
      'Could you share your standard wedding package breakdown and rate card?',
      'Do you have experience working with outdoor venue logistics?',
    ],
    closing: 'We would love to schedule a brief introductory call this week. Thank you!',
  },
};

// Computes a reliable future date (6 months ahead) so test assertions never expire
const futureEventDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const MOCK_REQUEST_DATA = {
  eventType: 'wedding',
  eventDate: futureEventDate,
  location: 'Seattle, WA',
  guestCount: 120,
  budget: 30000,
  currency: 'USD',
  vibe: 'Romantic botanical garden',
  priorities: 'Vegan catering options, live acoustic music',
  language: 'English',
};
