export type RevenueLane = 'deals' | 'capital' | 'partners'

export type RevenueRiskClass = 'green' | 'yellow' | 'red'

export type RevenuePipelineStage =
  | 'discovered'
  | 'intake'
  | 'research'
  | 'qualified'
  | 'analysis'
  | 'documents'
  | 'ready'
  | 'matched'
  | 'outreach'
  | 'engaged'
  | 'underwriting'
  | 'proposal'
  | 'term_sheet'
  | 'contract'
  | 'committed'
  | 'activated'
  | 'producing'
  | 'funded'
  | 'closed'
  | 'nurture'
  | 'lost'

export type RevenueContact = {
  id: string
  kind: 'seller' | 'buyer' | 'borrower' | 'lender' | 'investor' | 'vendor' | 'referral_partner'
  displayName: string
  email?: string | null
  phone?: string | null
  consentStatus: 'unknown' | 'allowed' | 'review' | 'suppressed'
  suppressionReason?: string | null
  source?: string | null
  createdAt: string
  updatedAt: string
}

export type RevenueAsset = {
  id: string
  kind: 'property' | 'business' | 'capital_request' | 'relationship'
  displayName: string
  address?: string | null
  market?: string | null
  estimatedValue?: number | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type RevenueOpportunity = {
  id: string
  lane: RevenueLane
  stage: RevenuePipelineStage
  title: string
  contactIds: string[]
  assetIds: string[]
  matchIds: string[]
  source: string
  owner: string | null
  value: number | null
  score: number | null
  scoreVersion?: string | null
  confidence: number | null
  nextAction: string | null
  nextActionAt: string | null
  lastActivityAt: string | null
  createdAt: string
  updatedAt: string
  closedAt?: string | null
  lossReason?: string | null
}

export type RevenueMatch = {
  id: string
  opportunityId: string
  subjectContactId?: string | null
  subjectAssetId?: string | null
  candidateContactId?: string | null
  candidateAssetId?: string | null
  score: number
  confidence: number
  reasons: string[]
  status: 'suggested' | 'review' | 'approved' | 'introduced' | 'accepted' | 'declined'
  createdAt: string
  updatedAt: string
}

export type RevenueActivity = {
  id: string
  correlationId: string
  opportunityId?: string | null
  contactId?: string | null
  assetId?: string | null
  matchId?: string | null
  automationId?: string | null
  lane?: RevenueLane | null
  kind:
    | 'source_received'
    | 'qualified'
    | 'stage_changed'
    | 'score_changed'
    | 'drafted'
    | 'approved'
    | 'sent'
    | 'delivered'
    | 'replied'
    | 'suppressed'
    | 'matched'
    | 'documented'
    | 'funded'
    | 'closed'
    | 'failed'
    | 'note'
  actorType: 'human' | 'automation' | 'provider' | 'system'
  actorId: string
  riskClass: RevenueRiskClass
  status: 'planned' | 'blocked' | 'completed' | 'failed'
  reason?: string | null
  metadata?: Record<string, unknown>
  occurredAt: string
}

export type RevenueScoreInput = {
  lane: RevenueLane
  fit: number
  urgency: number
  economics: number
  readiness: number
  engagement: number
  dataQuality: number
  riskPenalty?: number
}

export type RevenueScore = {
  score: number
  confidence: number
  version: string
  band: 'priority' | 'qualified' | 'nurture' | 'review'
  reasons: string[]
  inputs: RevenueScoreInput
}

export type RevenueLaneSnapshot = {
  lane: RevenueLane
  label: string
  status: 'green' | 'yellow' | 'red'
  active: number
  attention: number
  leadingMetric: string
  leadingValue: string | number
  nextMove: string
}

export type RevenueExecutiveSnapshot = {
  generatedAt: string
  headline: string
  today: {
    attentionCount: number
    urgentCount: number
    topPriorities: string[]
  }
  money: {
    revenue30d: number
    target30d: number
    targetProgress: number
    activeDeals: number
    packetReady: number
  }
  lanes: RevenueLaneSnapshot[]
  automation: AutomationRegistrySnapshot
  dailyBrief: string[]
  weeklyReview: {
    wins: string[]
    risks: string[]
    decisions: string[]
  }
}

export type AutomationSurface = 'vercel' | 'codex' | 'launchd' | 'inngest' | 'webhook' | 'database' | 'manual'

export type AutomationRegistryEntry = {
  id: string
  name: string
  lane: RevenueLane | 'control_plane' | 'protected_platform' | 'growth'
  surface: AutomationSurface
  schedule: string
  owner: string
  actionClass: 'read' | 'draft' | 'queue' | 'send' | 'payment' | 'control'
  riskClass: RevenueRiskClass
  approval: 'automatic' | 'policy_gated' | 'human_required'
  disposition: 'keep' | 'modernize' | 'merge' | 'archive' | 'replace'
  status: 'active' | 'paused' | 'blocked' | 'attention' | 'unknown'
  sourceOfTruth: string
  rollback: string
  verifiedAt: string
}

export type AutomationRegistrySnapshot = {
  verifiedAt: string
  inventoryTotal: number
  classifications: Record<'keep' | 'modernize' | 'merge' | 'archive' | 'replace' | 'remove', number>
  registeredSchedulers: number
  active: number
  paused: number
  blocked: number
  attention: number
  green: number
  yellow: number
  red: number
  entries: AutomationRegistryEntry[]
}
