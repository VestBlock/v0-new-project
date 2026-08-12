export const nextMoveFocuses = [
  'business-funding',
  'real-estate-funding',
  'grants',
  'business-credit',
  'sell-property',
  'buy-property',
  'fund-deal',
  'business-acquisition',
  'builder-developer',
  'improve-credit',
  'increase-income',
  'start-business',
  'grow-business',
  'visibility',
] as const

export type NextMoveFocus = (typeof nextMoveFocuses)[number]
export type NextMovePath = 'Capital' | 'Deals' | 'Opportunity'
export type AccessType = 'Free' | 'Free account' | 'Paid' | 'Member tool' | 'Review required' | 'Partner-routed'

export type NextMoveAnswers = {
  firstName: string
  email: string
  phone?: string
  focus: NextMoveFocus
  timeline: 'now' | '30-days' | '90-days' | 'exploring'
  position: 'starting' | 'preparing' | 'active' | 'stalled'
  creditRange: 'unknown' | 'below-580' | '580-669' | '670-739' | '740-plus' | 'prefer-not-to-say'
  weeklyTime: 'under-3' | '3-7' | '8-plus'
  mainObstacle: string
  goalDetails?: string
  requestFollowUp: boolean
  analysisConsent: true
  marketingConsent: boolean
}

export type NextMoveResource = {
  title: string
  description: string
  href: string
  access: AccessType
  limitation: string
  nextStep?: string
}

export type NextMoveRoadmapStep = {
  window: 'First 7 days' | 'By day 30' | 'By day 60' | 'By day 90'
  title: string
  actions: string[]
}

export type NextMoveRoadmap = {
  title: string
  summary: string
  primaryPath: NextMovePath
  secondaryPaths: NextMovePath[]
  readiness: 'Start here' | 'Preparation needed' | 'Ready for review'
  steps: NextMoveRoadmapStep[]
  resources: NextMoveResource[]
  cautions: string[]
  model: 'deterministic' | 'ai-refined'
  generatedAt: string
}
