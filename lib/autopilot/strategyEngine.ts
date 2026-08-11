import {
  ACQUISITION_CHANNELS,
  BUSINESS_VERTICALS,
  getVerticalScorecard,
  type AcquisitionChannel,
  type BusinessVertical,
  type OutreachChannel,
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
  evidenceQuality?: number;
  strategicFit?: number;
  availableAudience?: number;
  historicalPerformance?: number;
  complianceRisk?: number;
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
  evidenceClass?: 'fact' | 'estimate' | 'hypothesis' | 'missing';
  sourceUrl?: string | null;
  publisher?: string | null;
  publishedAt?: string | null;
  retrievedAt?: string | null;
  credibility?: number;
  freshnessDays?: number | null;
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
  differentiation: string;
  requiredData: string[];
  requiredProof: string[];
  channelDecision: {
    primary: OutreachChannel;
    secondary: OutreachChannel;
    avoid: string[];
    rationale: string;
  };
  approvalRequirements: string[];
  attributionModel: string;
  nextExperiment: string;
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
  learningLoop: {
    stages: string[];
    daily: string;
    weekly: string;
    monthly: string;
    changeLogRequired: true;
  };
  dateCreated: string;
  status: 'candidate' | 'research_required' | 'approved' | 'testing' | 'measured' | 'retired';
  result: string | null;
  lesson: string | null;
  nextIteration: string | null;
  score: StrategyScore;
};

const DEFAULT_LEARNING_LOOP: VestBlockStrategy['learningLoop'] = {
  stages: [
    'real_world_signals', 'evidence_normalization', 'opportunity_identification',
    'strategy_hypothesis', 'channel_selection', 'approval', 'controlled_experiment',
    'crm_activity', 'outcome_attribution', 'retrospective', 'confidence_update',
    'improve_scale_pause_or_retire', 'next_experiment',
  ],
  daily: 'Collect, deduplicate, classify, and freshness-score approved signals; create research tasks for missing evidence.',
  weekly: 'Compare focus and challenger outcomes, inspect contradictions, and record every score change with its reason.',
  monthly: 'Review the nine-vertical portfolio, cost and compliance boundaries, attribution gaps, and retirement decisions.',
  changeLogRequired: true,
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
    evidenceQuality: clamp(input.evidenceQuality ?? input.confidence),
    strategicFit: clamp(input.strategicFit ?? 50),
    availableAudience: clamp(input.availableAudience ?? 50),
    historicalPerformance: clamp(input.historicalPerformance ?? 50),
    complianceRisk: clamp(input.complianceRisk ?? input.risk),
  };
  const total = Math.round(
    normalized.expectedImpact * 0.22 +
      normalized.confidence * 0.14 +
      normalized.evidenceQuality * 0.12 +
      normalized.strategicFit * 0.12 +
      normalized.availableAudience * 0.1 +
      normalized.historicalPerformance * 0.08 +
      normalized.timeToResult * 0.08 +
      (100 - normalized.cost) * 0.06 +
      (100 - normalized.executionDifficulty) * 0.04 +
      (100 - normalized.complianceRisk) * 0.04
  );

  return {
    ...normalized,
    total,
    formula:
      'impact × 22% + confidence × 14% + evidence × 12% + strategic fit × 12% + audience × 10% + history × 8% + speed × 8% + inverse cost × 6% + inverse difficulty × 4% + inverse compliance risk × 4%',
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
              evidenceClass: 'hypothesis',
              retrievedAt: now,
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
        evidenceClass: item.evidenceClass || (item.quality === 'missing' ? 'missing' : 'fact'),
        sourceUrl: item.sourceUrl?.trim() || null,
        publisher: item.publisher?.trim() || null,
        publishedAt: item.publishedAt || null,
        retrievedAt: item.retrievedAt || now,
        credibility: clamp(item.credibility ?? (item.quality === 'verified' ? 85 : item.quality === 'partial' ? 55 : 0)),
        freshnessDays: Number.isFinite(item.freshnessDays) ? Math.max(0, Number(item.freshnessDays)) : null,
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
  const vertical = getVerticalScorecard(input.vertical);
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
    differentiation: vertical.differentiation,
    requiredData: vertical.requiredData,
    requiredProof: vertical.requiredProof,
    channelDecision: {
      primary: vertical.primaryChannel,
      secondary: vertical.secondaryChannel,
      avoid: vertical.channelsToAvoid,
      rationale: vertical.channelRationale,
    },
    approvalRequirements: vertical.approvalRequirements,
    attributionModel: vertical.attributionModel,
    nextExperiment: vertical.nextExperiment,
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
    learningLoop: DEFAULT_LEARNING_LOOP,
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
    const scorecard = getVerticalScorecard(record.vertical as BusinessVertical);
    return {
      ...record,
      differentiation: String(record.differentiation || scorecard.differentiation),
      requiredData: Array.isArray(record.requiredData) ? record.requiredData : scorecard.requiredData,
      requiredProof: Array.isArray(record.requiredProof) ? record.requiredProof : scorecard.requiredProof,
      channelDecision: record.channelDecision || {
        primary: scorecard.primaryChannel,
        secondary: scorecard.secondaryChannel,
        avoid: scorecard.channelsToAvoid,
        rationale: scorecard.channelRationale,
      },
      approvalRequirements: Array.isArray(record.approvalRequirements) ? record.approvalRequirements : scorecard.approvalRequirements,
      attributionModel: String(record.attributionModel || scorecard.attributionModel),
      nextExperiment: String(record.nextExperiment || scorecard.nextExperiment),
      learningLoop: record.learningLoop || DEFAULT_LEARNING_LOOP,
    } as VestBlockStrategy;
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
