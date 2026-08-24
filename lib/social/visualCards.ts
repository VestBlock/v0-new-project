import { absoluteUrl } from '@/lib/seo/site'

export const VESTBLOCK_SOCIAL_VISUAL_KEYS = [
  'capital-readiness',
  'real-estate-routing',
  'buyer-criteria',
  'lender-network',
  'business-systems',
  'financial-roadmap',
  'dealvault-proof',
] as const

export type VestBlockSocialVisualKey = (typeof VESTBLOCK_SOCIAL_VISUAL_KEYS)[number]

type SocialVisual = {
  eyebrow: string
  headline: string
  supporting: string
  routeLabel: string
}

const SOCIAL_VISUALS: Record<VestBlockSocialVisualKey, SocialVisual> = {
  'capital-readiness': {
    eyebrow: 'Capital readiness',
    headline: 'Start with the file. Then choose the path.',
    supporting: 'A clearer view of revenue, banking, obligations, timing, and use of capital.',
    routeLabel: 'Explore capital paths',
  },
  'real-estate-routing': {
    eyebrow: 'Real estate deal routing',
    headline: 'A property deserves the path that fits the situation.',
    supporting: 'Context first: condition, timeline, payoff, seller priorities, and buyer demand.',
    routeLabel: 'Explore property paths',
  },
  'buyer-criteria': {
    eyebrow: 'Buyer criteria',
    headline: 'A clear buy box turns noise into real deal flow.',
    supporting: 'Market, asset, price, structure, capital path, and the no-go list in one place.',
    routeLabel: 'Build a buy box',
  },
  'lender-network': {
    eyebrow: 'Capital partner criteria',
    headline: 'Better lending conversations start with fit.',
    supporting: 'Product, geography, leverage, borrower profile, and real underwriting context.',
    routeLabel: 'Join the lender network',
  },
  'business-systems': {
    eyebrow: 'Business systems',
    headline: 'The opportunity is not won until the handoff works.',
    supporting: 'Calls, intake, routing, follow-up, and the next step need one operating rhythm.',
    routeLabel: 'Strengthen the handoff',
  },
  'financial-roadmap': {
    eyebrow: 'Financial roadmap',
    headline: 'Your next financial move should match the real picture.',
    supporting: 'Credit, cash flow, obligations, goals, timing, and practical routes—not generic advice.',
    routeLabel: 'Get a free roadmap',
  },
  'dealvault-proof': {
    eyebrow: 'DealVault records',
    headline: 'Clear records make stronger partnerships.',
    supporting: 'Roles, introductions, decisions, milestones, and payouts should not live in screenshots.',
    routeLabel: 'See DealVault',
  },
}

export function isVestBlockSocialVisualKey(value: string): value is VestBlockSocialVisualKey {
  return VESTBLOCK_SOCIAL_VISUAL_KEYS.includes(value as VestBlockSocialVisualKey)
}

export function getVestBlockSocialVisual(key: VestBlockSocialVisualKey) {
  return SOCIAL_VISUALS[key]
}

export function buildVestBlockSocialVisualUrl(key: VestBlockSocialVisualKey) {
  return absoluteUrl(`/api/social-card/${key}?v=1`)
}
