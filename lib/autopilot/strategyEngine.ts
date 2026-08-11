import {
  ACQUISITION_CHANNELS,
  BUSINESS_VERTICALS,
  type AcquisitionChannel,
  type BusinessVertical,
  type StrategyType,
} from './verticalRegistry';

export const STRATEGY_VERTICALS = BUSINESS_VERTICALS;
export type StrategyVertical = BusinessVertical;

export type StrategyScoreInput = {
  expectedImpact: number;
  confidence: number;
  cost: number;
  timeToResult: number;
  executionDifficulty: number;
  risk: number;
};

export type StrategyScore = StrategyScoreInput & {
  total: number;
  formula: string;
};

export type StrategyEvidence = {
  source: string;
  metric: string;
  value: string | number | null;
  observedAt: string;
  quality: 'verified' | 'partial' | 'missing';
  caveat: string | null;
};

export type EvidenceState = 'sufficient' | 'partial' | 'research_required';
export type StrategyPortfolioRole = 'focus' | 'challenger' | 'backlog' | 'research';

export type VestBlockStrategy = {
  schemaVersion: 2;
  name: string;
  vertical: BusinessVertical;
  strategyType: StrategyType;
  channels: AcquisitionChannel[];
  hypothesis: string;
  targetAudience: string;
  problem: string;
  tactic: string;
  channel: string;
  expectedOutcome: string;
  primaryKpi: string;
  secondaryKpis: string[];
  cost: string;
  risk: 'low' | 'medium' | 'high';
  confidence: number;
  evidence: StrategyEvidence[];
  evidenceState: EvidenceState;
  researchRequired: string[];
  portfolioRole: StrategyPortfolioRole;
  outreachPlan: {
    audiences: string[];
    angles: string[];
    channels: AcquisitionChannel[];
    suppressionRequired: true;
    launchAuthority: 'not_granted';
  };
  compliance: {
    humanApprovalRequired: true;
    claimsReviewed: false;
    suppressionChecked: false;
    dataLineageRequired: true;
  };
  approval: {
    mode: 'human_required';
    status: 'draft';
    launch: false;
    send: false;
    publish: false;
    spend: false;
  };
  implementation: {
    nextActions: string[];
    owner: 'operator';
    estimatedCost: string;
    costBoundary: string;
  };
  measurement: {
    primaryKpi: string;
    secondaryKpis: string[];
    attributionKeys: string[];
    evaluationWindowDays: number;
    killCriteria: string[];
  };
  dateCreated: string;
  status: 'candidate' | 'research_required' | 'approved' | 'testing' | 'measured' | 'retired';
  result: string | null;
  lesson: string | null;
  nextIteration: string | null;
  score: StrategyScore;
};

export type StrategyCandidateInput = {
  name: string;
  vertical: BusinessVertical;
  strategyType?: StrategyType;
  channels?: AcquisitionChannel[];
  hypothesis: string;
  targetAudience: string;
  problem: string;
  tactic: string;
  channel: string;
  expectedOutcome: string;
  primaryKpi: string;
  secondaryKpis: string[];
  cost: string;
  risk: 'low' | 'medium' | 'high';
  confidence: number;
  evidence: Array<string | StrategyEvidence>;
  evidenceState?: EvidenceState;
  researchRequired?: string[];
  portfolioRole?: StrategyPortfolioRole;
  outreachAngles?: string[];
  implementationActions?: string[];
  costBoundary?: string;
  attributionKeys?: string[];
  evaluationWindowDays?: number;
  killCriteria?: string[];
  score: StrategyScoreInput;
};

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function scoreStrategy(input: StrategyScoreInput): StrategyScore {
  const normalized = {
    expectedImpact: clamp(input.expectedImpact),
    confidence: clamp(input.confidence),
    cost: clamp(input.cost),
    timeToResult: clamp(input.timeToResult),
    executionDifficulty: clamp(input.executionDifficulty),
    risk: clamp(input.risk),
  };
  const total = Math.round(
    normalized.expectedImpact * 0.3 +
      normalized.confidence * 0.25 +
      normalized.timeToResult * 0.15 +
      (100 - normalized.cost) * 0.1 +
      (100 - normalized.executionDifficulty) * 0.1 +
      (100 - normalized.risk) * 0.1
  );

  return {
    ...normalized,
    total,
    formula:
      'impact × 30% + confidence × 25% + speed × 15% + inverse cost × 10% + inverse difficulty × 10% + inverse risk × 10%',
  };
}

function normalizeChannels(channels: AcquisitionChannel[] | undefined) {
  const unique = [...new Set(channels || [])].filter((value) => ACQUISITION_CHANNELS.includes(value));
  return unique.length > 0 ? unique.slice(0, 5) : (['direct'] as AcquisitionChannel[]);
}

function normalizeEvidence(
  evidence: Array<string | StrategyEvidence>,
  now: string
): StrategyEvidence[] {
  return evidence
    .map((item): StrategyEvidence | null => {
      if (typeof item === 'string') {
        const value = item.trim();
        return value
          ? {
              source: 'operator_note',
              metric: 'supporting observation',
              value,
              observedAt: now,
              quality: 'partial',
              caveat: 'Legacy free-text evidence; verify its source before launch.',
            }
          : null;
      }
      if (!item?.source?.trim() || !item.metric?.trim()) return null;
      return {
        source: item.source.trim(),
        metric: item.metric.trim(),
        value: item.value,
        observedAt: item.observedAt || now,
        quality: item.quality,
        caveat: item.caveat?.trim() || null,
      };
    })
    .filter((item): item is StrategyEvidence => Boolean(item))
    .slice(0, 16);
}

function inferEvidenceState(evidence: StrategyEvidence[]): EvidenceState {
  if (evidence.length === 0 || evidence.every((item) => item.quality === 'missing')) {
    return 'research_required';
  }
  return evidence.some((item) => item.quality === 'verified') ? 'sufficient' : 'partial';
}

export function createStrategyObject(
  input: StrategyCandidateInput,
  now = new Date().toISOString()
): VestBlockStrategy {
  const channels = normalizeChannels(input.channels);
  const secondaryKpis = input.secondaryKpis.map((value) => value.trim()).filter(Boolean).slice(0, 8);
  const evidence = normalizeEvidence(input.evidence, now);
  const evidenceState = input.evidenceState || inferEvidenceState(evidence);
  const researchRequired = (input.researchRequired || [])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);
  const portfolioRole = evidenceState === 'research_required' ? 'research' : input.portfolioRole || 'backlog';
  const status = evidenceState === 'research_required' ? 'research_required' : 'candidate';

  return {
    schemaVersion: 2,
    name: input.name.trim(),
    vertical: input.vertical,
    strategyType: input.strategyType || (evidenceState === 'research_required' ? 'research' : 'acquisition'),
    channels,
    hypothesis: input.hypothesis.trim(),
    targetAudience: input.targetAudience.trim(),
    problem: input.problem.trim(),
    tactic: input.tactic.trim(),
    channel: input.channel.trim(),
    expectedOutcome: input.expectedOutcome.trim(),
    primaryKpi: input.primaryKpi.trim(),
    secondaryKpis,
    cost: input.cost.trim(),
    risk: input.risk,
    confidence: clamp(input.confidence),
    evidence,
    evidenceState,
    researchRequired,
    portfolioRole,
    outreachPlan: {
      audiences: [input.targetAudience.trim()],
      angles: (input.outreachAngles || [input.hypothesis]).map((value) => value.trim()).filter(Boolean).slice(0, 5),
      channels,
      suppressionRequired: true,
      launchAuthority: 'not_granted',
    },
    compliance: {
      humanApprovalRequired: true,
      claimsReviewed: false,
      suppressionChecked: false,
      dataLineageRequired: true,
    },
    approval: {
      mode: 'human_required',
      status: 'draft',
      launch: false,
      send: false,
      publish: false,
      spend: false,
    },
    implementation: {
      nextActions: (input.implementationActions || ['Review evidence and confirm the next operator action.'])
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8),
      owner: 'operator',
      estimatedCost: input.cost.trim(),
      costBoundary: input.costBoundary?.trim() || 'No send, publication, spend, or provider action without approval.',
    },
    measurement: {
      primaryKpi: input.primaryKpi.trim(),
      secondaryKpis,
      attributionKeys: (input.attributionKeys || ['strategy_id', 'campaign_run_id', 'source']).slice(0, 8),
      evaluationWindowDays: Math.max(1, Math.min(90, input.evaluationWindowDays || 14)),
      killCriteria: (input.killCriteria || ['Stop if evidence quality falls below the approved threshold.'])
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8),
    },
    dateCreated: now,
    status,
    result: null,
    lesson: null,
    nextIteration: null,
    score: scoreStrategy(input.score),
  };
}

const legacyVerticalMap: Record<string, BusinessVertical> = {
  business_funding: 'business_capital',
  dscr: 'real_estate_capital',
  funding_partners: 'capital_partners',
  real_estate_acquisitions: 'seller_opportunities',
  real_estate_buyers: 'buyers_investors',
  partnerships: 'opportunity_service_partners',
  referrals: 'opportunity_service_partners',
  seo: 'growth_visibility_services',
  aeo: 'growth_visibility_services',
  pr: 'growth_visibility_services',
  email_outreach: 'growth_visibility_services',
  sms: 'growth_visibility_services',
  social_media: 'growth_visibility_services',
  content: 'growth_visibility_services',
  paid_advertising: 'growth_visibility_services',
  conversion_rate: 'growth_visibility_services',
  retention_reactivation: 'growth_visibility_services',
};

export function normalizeStoredStrategy(value: unknown): VestBlockStrategy | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, any>;
  if (record.schemaVersion === 2 && BUSINESS_VERTICALS.includes(record.vertical)) {
    return record as VestBlockStrategy;
  }
  if (record.schemaVersion !== 1 || typeof record.name !== 'string') return null;

  const vertical = legacyVerticalMap[String(record.vertical)] || null;
  if (!vertical) return null;
  const normalized = createStrategyObject(
    {
      name: record.name,
      vertical,
      hypothesis: String(record.hypothesis || ''),
      targetAudience: String(record.targetAudience || ''),
      problem: String(record.problem || ''),
      tactic: String(record.tactic || ''),
      channel: String(record.channel || 'direct'),
      expectedOutcome: String(record.expectedOutcome || ''),
      primaryKpi: String(record.primaryKpi || 'qualified outcome'),
      secondaryKpis: Array.isArray(record.secondaryKpis) ? record.secondaryKpis.map(String) : [],
      cost: String(record.cost || 'Unknown'),
      risk: ['low', 'medium', 'high'].includes(record.risk) ? record.risk : 'medium',
      confidence: Number(record.confidence || 0),
      evidence: Array.isArray(record.evidence) ? record.evidence : [],
      score: record.score || {
        expectedImpact: 0,
        confidence: 0,
        cost: 100,
        timeToResult: 0,
        executionDifficulty: 100,
        risk: 100,
      },
      researchRequired: ['Verify legacy strategy evidence and channel lineage before approval.'],
    },
    typeof record.dateCreated === 'string' ? record.dateCreated : new Date().toISOString()
  );

  return {
    ...normalized,
    status: record.status === 'measured' ? 'measured' : normalized.status,
    result: typeof record.result === 'string' ? record.result : null,
    lesson: typeof record.lesson === 'string' ? record.lesson : null,
    nextIteration: typeof record.nextIteration === 'string' ? record.nextIteration : null,
  };
}

export function selectStrategyPortfolio(strategies: VestBlockStrategy[]) {
  const eligible = strategies
    .filter((strategy) => strategy.evidenceState !== 'research_required')
    .sort((a, b) => b.score.total - a.score.total);
  const promoted = new Map<string, StrategyPortfolioRole>();
  if (eligible[0]) promoted.set(strategyTargetKey(eligible[0], 'portfolio'), 'focus');
  if (eligible[1]) promoted.set(strategyTargetKey(eligible[1], 'portfolio'), 'challenger');

  return strategies.map((strategy) => ({
    ...strategy,
    portfolioRole:
      strategy.evidenceState === 'research_required'
        ? 'research'
        : promoted.get(strategyTargetKey(strategy, 'portfolio')) || 'backlog',
  }));
}

export function strategyTargetKey(strategy: VestBlockStrategy, weekKey: string) {
  return `autopilot:${weekKey}:${strategy.vertical}:${strategy.name}`
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);
}
