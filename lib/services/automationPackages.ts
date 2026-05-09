export const automationPackageKeys = [
  'ai_receptionist_launch',
  'appointment_booking_system',
  'website_upgrade_sprint',
] as const;

export type AutomationPackageKey = (typeof automationPackageKeys)[number];

export type AutomationPackage = {
  key: AutomationPackageKey;
  title: string;
  priceLabel: string;
  amount: number;
  billingModel: 'setup_and_monthly' | 'one_time';
  summary: string;
  bestFor: string;
  deliverables: string[];
  turnaround: string;
  complianceNote: string;
  leadType: 'ai_assistant' | 'website_upgrade';
  leadCategory: 'small_business' | 'website_upgrade';
  bestOffer: 'AI Receptionist' | 'Website Upgrade';
  slug: string;
};

export const automationPackages: AutomationPackage[] = [
  {
    key: 'ai_receptionist_launch',
    title: 'AI Receptionist Launch',
    priceLabel: '$495 setup + $149/mo',
    amount: 495,
    billingModel: 'setup_and_monthly',
    summary:
      'Launch a branded AI receptionist on your website so visitors can ask questions, leave details, and get routed without waiting on staff.',
    bestFor:
      'Service businesses that are missing website leads after hours or losing time answering the same questions repeatedly.',
    deliverables: [
      'Website AI chat installation',
      'Lead capture and email alert setup',
      'Business FAQ training',
      'Launch review and first-round script tuning',
    ],
    turnaround: 'Typical launch in 5-7 business days after signup and access are provided.',
    complianceNote:
      'VestBlock provides setup, training, and support for lead capture and customer communication. Performance still depends on traffic quality, business responsiveness, and truthful information.',
    leadType: 'ai_assistant',
    leadCategory: 'small_business',
    bestOffer: 'AI Receptionist',
    slug: 'ai-receptionist-launch',
  },
  {
    key: 'appointment_booking_system',
    title: 'AI Receptionist + Appointment Booking',
    priceLabel: '$895 setup + $249/mo',
    amount: 895,
    billingModel: 'setup_and_monthly',
    summary:
      'Add booking logic, calendar routing, and qualification questions so the assistant can move qualified visitors toward real appointments instead of dead-end chats.',
    bestFor:
      'Appointment-led businesses that need stronger qualification, booking, and calendar conversion from their website traffic.',
    deliverables: [
      'Everything in AI Receptionist Launch',
      'Booking and calendar handoff setup',
      'Qualification questions for new leads',
      'Missed-lead and booking notifications',
    ],
    turnaround: 'Typical launch in 7-10 business days after access and booking details are provided.',
    complianceNote:
      'VestBlock helps automate booking and scheduling. Appointment volume, no-show rate, and close rate still depend on the business, calendar availability, and follow-up process.',
    leadType: 'ai_assistant',
    leadCategory: 'small_business',
    bestOffer: 'AI Receptionist',
    slug: 'ai-appointment-booking-system',
  },
  {
    key: 'website_upgrade_sprint',
    title: 'Website Upgrade Sprint',
    priceLabel: 'From $2,500',
    amount: 2500,
    billingModel: 'one_time',
    summary:
      'A conversion-focused website refresh for businesses that need better mobile clarity, stronger calls to action, cleaner service pages, and better lead capture.',
    bestFor:
      'Businesses with a weak or outdated site that is hurting trust, lead conversion, or booking performance.',
    deliverables: [
      'Website conversion and mobile audit',
      'Homepage and key-page upgrade plan',
      'CTA, form, and booking improvements',
      'Launch QA and handoff notes',
    ],
    turnaround: 'Most sprint scopes start in the 2-4 week range depending on page count and revisions.',
    complianceNote:
      'Pricing starts at the listed amount for a defined sprint scope. Larger redesigns, copy rewrites, and custom features are scoped separately.',
    leadType: 'website_upgrade',
    leadCategory: 'website_upgrade',
    bestOffer: 'Website Upgrade',
    slug: 'website-upgrade-sprint',
  },
];

export function getAutomationPackage(key: string) {
  return automationPackages.find((pkg) => pkg.key === key);
}
