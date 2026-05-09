import type { AutomationPackageKey } from '@/lib/services/automationPackages'
import type { VisibilityExpansionPackageKey } from '@/lib/services/visibilityExpansionPackages'

export const smallBusinessTemplateKeys = [
  'med_spa',
  'dental_practice',
  'hvac',
  'plumbing',
  'legal',
  'salon_spa',
  'tax_accounting',
  'restaurant_hospitality',
  'home_remodeling',
] as const

export type SmallBusinessTemplateKey = (typeof smallBusinessTemplateKeys)[number]

export type SmallBusinessTemplate = {
  key: SmallBusinessTemplateKey
  title: string
  industry: string
  summary: string
  aiAssistant: {
    recommendedPackage: AutomationPackageKey
    currentSystem: string
    monthlyLeadVolume: string
    notes: string
    firstFocus: string[]
  }
  visibility: {
    recommendedPackage: VisibilityExpansionPackageKey
    primaryOffer: string
    monthlyRevenueGoal: string
    biggestGap: string
    notes: string
    firstFocus: string[]
  }
}

export const smallBusinessTemplates: SmallBusinessTemplate[] = [
  {
    key: 'med_spa',
    title: 'Med Spa',
    industry: 'Med Spa',
    summary: 'Built for consult-heavy treatment inquiries, booking questions, and local authority growth.',
    aiAssistant: {
      recommendedPackage: 'appointment_booking_system',
      currentSystem: 'Website, phone calls, and treatment inquiries that need faster booking follow-up.',
      monthlyLeadVolume: '40-120 leads',
      notes:
        'Need better lead capture for treatment questions, pricing interest, consultation requests, and after-hours booking intent.',
      firstFocus: [
        'Consultation booking and treatment question flow',
        'Missed-call recovery and follow-up prompts',
        'Trust-building answers around services, timing, and next steps',
      ],
    },
    visibility: {
      recommendedPackage: 'authority_pr_engine',
      primaryOffer: 'Injectables, facials, and med spa treatments',
      monthlyRevenueGoal: 'Add more booked consultations each month',
      biggestGap: 'Weak city coverage, low trust compared with larger competitors, and too few pages around treatment intent.',
      notes:
        'Need stronger treatment pages, local credibility, and better search coverage for consultation-driven services.',
      firstFocus: [
        'Treatment pages that answer common consultation questions',
        'City and neighborhood pages around high-intent searches',
        'Proof, reviews, and authority signals near the main CTA',
      ],
    },
  },
  {
    key: 'dental_practice',
    title: 'Dental Practice',
    industry: 'Dental',
    summary: 'Prepared for appointment-driven practices that need stronger booking and local service visibility.',
    aiAssistant: {
      recommendedPackage: 'appointment_booking_system',
      currentSystem: 'Phone-heavy intake with form submissions and appointment requests that need better handling.',
      monthlyLeadVolume: '30-90 leads',
      notes:
        'Need to guide new patients toward the right appointment type and answer routine questions without staff bottlenecks.',
      firstFocus: [
        'New-patient and returning-patient booking paths',
        'Insurance, service, and availability question handling',
        'Better handoff for high-intent appointment requests',
      ],
    },
    visibility: {
      recommendedPackage: 'city_expansion_engine',
      primaryOffer: 'General, cosmetic, and family dentistry',
      monthlyRevenueGoal: 'Grow new-patient bookings in core service areas',
      biggestGap: 'Practice needs stronger local service pages and a better search footprint outside the immediate brand name.',
      notes:
        'Need cleaner service pages, stronger patient FAQs, and city coverage that supports new-patient acquisition.',
      firstFocus: [
        'Core treatment pages for high-intent patient searches',
        'Location and neighborhood search coverage',
        'Stronger trust and patient-proof placement',
      ],
    },
  },
  {
    key: 'hvac',
    title: 'HVAC Company',
    industry: 'HVAC',
    summary: 'Ready for call-heavy service businesses that need better lead handling and city-by-city demand capture.',
    aiAssistant: {
      recommendedPackage: 'ai_receptionist_launch',
      currentSystem: 'Phone calls, quote forms, and emergency-service requests that need faster capture.',
      monthlyLeadVolume: '50-150 leads',
      notes:
        'Need to capture emergency calls, estimate requests, and service-area questions after hours and during busy periods.',
      firstFocus: [
        'Emergency-service and estimate lead capture',
        'Service-area qualification before staff follow-up',
        'Cleaner call-to-action and quote path',
      ],
    },
    visibility: {
      recommendedPackage: 'city_expansion_engine',
      primaryOffer: 'HVAC repair, installs, and maintenance',
      monthlyRevenueGoal: 'Increase booked estimates and service calls across more cities',
      biggestGap: 'Service pages and city coverage are too thin for the number of areas served.',
      notes:
        'Need better city pages, stronger repair/install pages, and clearer conversion paths from search to estimate request.',
      firstFocus: [
        'Repair, install, and maintenance page coverage',
        'City-by-city search expansion',
        'Estimate and emergency-service CTAs that stand out faster',
      ],
    },
  },
  {
    key: 'plumbing',
    title: 'Plumbing Company',
    industry: 'Plumbing',
    summary: 'Set up for urgent service businesses that need stronger quote handling and better local search coverage.',
    aiAssistant: {
      recommendedPackage: 'ai_receptionist_launch',
      currentSystem: 'Phone-first lead flow with mixed forms and urgent service questions.',
      monthlyLeadVolume: '40-120 leads',
      notes:
        'Need better lead capture for urgent plumbing requests, quote questions, and service-area qualification.',
      firstFocus: [
        'Emergency request handling',
        'Quote and scheduling handoff',
        'FAQ answers around service types and timing',
      ],
    },
    visibility: {
      recommendedPackage: 'city_expansion_engine',
      primaryOffer: 'Drain, water heater, and plumbing service',
      monthlyRevenueGoal: 'Add more booked service calls in nearby cities',
      biggestGap: 'The site needs stronger service-intent pages and better local coverage for the areas already served.',
      notes:
        'Need clearer service pages, city targeting, and stronger proof near the call and quote path.',
      firstFocus: [
        'Service pages around urgent plumbing intent',
        'City and suburb visibility buildout',
        'Faster quote and call paths from mobile',
      ],
    },
  },
  {
    key: 'legal',
    title: 'Law Firm',
    industry: 'Legal',
    summary: 'Prepared for consultation-focused firms that need stronger intake and trust-building content.',
    aiAssistant: {
      recommendedPackage: 'appointment_booking_system',
      currentSystem: 'Consult requests, contact forms, and call intake that need better qualification.',
      monthlyLeadVolume: '20-70 leads',
      notes:
        'Need to answer early-stage client questions and guide people toward a consultation request without losing intent.',
      firstFocus: [
        'Consultation request qualification',
        'Practice-area intake prompts',
        'Cleaner handoff from question to scheduled conversation',
      ],
    },
    visibility: {
      recommendedPackage: 'authority_pr_engine',
      primaryOffer: 'Legal consultations and practice-area services',
      monthlyRevenueGoal: 'Increase qualified consultation demand',
      biggestGap: 'The firm needs stronger trust signals, better practice-area pages, and more authority in search.',
      notes:
        'Need stronger practice-area pages, FAQs, and credibility signals that help prospects feel confident before they contact the firm.',
      firstFocus: [
        'Practice-area content that answers early client questions',
        'Authority and trust signals on key pages',
        'City and location positioning where relevant',
      ],
    },
  },
  {
    key: 'salon_spa',
    title: 'Salon or Spa',
    industry: 'Salon',
    summary: 'Designed for booking-driven beauty businesses that need cleaner appointment flow and stronger local discovery.',
    aiAssistant: {
      recommendedPackage: 'appointment_booking_system',
      currentSystem: 'Instagram, website, and phone inquiries that need better booking follow-through.',
      monthlyLeadVolume: '25-80 leads',
      notes:
        'Need to turn service questions into bookings faster and reduce the amount of manual back-and-forth around scheduling.',
      firstFocus: [
        'Booking flow for popular services',
        'Stylist or service selection guidance',
        'Follow-up prompts for undecided visitors',
      ],
    },
    visibility: {
      recommendedPackage: 'visibility_starter',
      primaryOffer: 'Salon and spa services',
      monthlyRevenueGoal: 'Increase bookings from local search and repeat discovery',
      biggestGap: 'The site needs stronger service pages, local discovery support, and more visible proof.',
      notes:
        'Need better pages for top services, stronger local intent coverage, and cleaner booking CTAs.',
      firstFocus: [
        'Service pages for top booking categories',
        'Photo, review, and trust placement near CTAs',
        'Local search improvements around beauty-service intent',
      ],
    },
  },
  {
    key: 'tax_accounting',
    title: 'Tax or Accounting Firm',
    industry: 'Tax and Accounting',
    summary: 'Ready for firms that need better intake, bilingual readiness, and stronger visibility around service trust.',
    aiAssistant: {
      recommendedPackage: 'appointment_booking_system',
      currentSystem: 'Calls, email, and seasonal intake that need stronger qualification and scheduling.',
      monthlyLeadVolume: '20-100 leads',
      notes:
        'Need better handling for service questions, document-readiness questions, and appointment requests during busy periods.',
      firstFocus: [
        'Tax-season and bookkeeping appointment flow',
        'Qualification around business vs personal service needs',
        'Cleaner after-hours inquiry capture',
      ],
    },
    visibility: {
      recommendedPackage: 'authority_pr_engine',
      primaryOffer: 'Tax, bookkeeping, and accounting services',
      monthlyRevenueGoal: 'Increase qualified consults and recurring client demand',
      biggestGap: 'The firm needs stronger trust content, service-page coverage, and clearer local search positioning.',
      notes:
        'Need better service pages, trust signals, and content around common accounting and tax questions.',
      firstFocus: [
        'Service pages for tax, bookkeeping, and advisory work',
        'Trust content and proof for credibility',
        'Local search and bilingual opportunity coverage when relevant',
      ],
    },
  },
  {
    key: 'restaurant_hospitality',
    title: 'Restaurant or Hospitality',
    industry: 'Restaurant',
    summary: 'Built for reservation-heavy businesses that need better guest communication and stronger discovery.',
    aiAssistant: {
      recommendedPackage: 'appointment_booking_system',
      currentSystem: 'Reservations, private-event inquiries, and website questions that need better handling.',
      monthlyLeadVolume: '30-120 leads',
      notes:
        'Need a cleaner path for reservations, private dining questions, and after-hours guest inquiries.',
      firstFocus: [
        'Reservation and private-event handling',
        'Guest question flow for hours, menus, and location',
        'Lead capture for catering or group bookings',
      ],
    },
    visibility: {
      recommendedPackage: 'visibility_starter',
      primaryOffer: 'Reservations, events, and hospitality experiences',
      monthlyRevenueGoal: 'Increase direct reservations and event inquiries',
      biggestGap: 'Search visibility and website trust are weaker than the guest experience deserves.',
      notes:
        'Need stronger local discovery, event-oriented content, and cleaner paths for reservations and large-party inquiries.',
      firstFocus: [
        'Reservation and private-event page improvements',
        'Local search visibility around dining intent',
        'Trust content, menus, and next-step clarity',
      ],
    },
  },
  {
    key: 'home_remodeling',
    title: 'Home Remodeling',
    industry: 'Home Remodeling',
    summary: 'Prepared for estimate-driven remodeling businesses that need better intake and stronger project visibility.',
    aiAssistant: {
      recommendedPackage: 'ai_receptionist_launch',
      currentSystem: 'Estimate requests and project inquiries that need cleaner lead capture.',
      monthlyLeadVolume: '20-60 leads',
      notes:
        'Need better capture for project inquiries, estimate requests, and service-area qualification before human follow-up.',
      firstFocus: [
        'Estimate-request capture',
        'Project-type qualification',
        'Mobile CTA and trust-path improvements',
      ],
    },
    visibility: {
      recommendedPackage: 'city_expansion_engine',
      primaryOffer: 'Kitchen, bath, and home remodeling projects',
      monthlyRevenueGoal: 'Increase estimate requests in target cities',
      biggestGap: 'The business needs stronger project pages, city expansion, and better proof near key CTAs.',
      notes:
        'Need better project pages, service-area visibility, and a clearer estimate path for homeowners.',
      firstFocus: [
        'Project pages for top remodeling categories',
        'City and suburb page expansion',
        'Before-and-after proof and estimate CTA upgrades',
      ],
    },
  },
]

export function getSmallBusinessTemplate(key: string) {
  return smallBusinessTemplates.find((template) => template.key === key)
}
