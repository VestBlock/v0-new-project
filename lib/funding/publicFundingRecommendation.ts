import type {
  FundingProduct,
  FundingProfile,
  FundingProductType,
  FundingStrategyResult,
} from '@/lib/funding/types';
import {
  evaluateCardFundingReadiness,
  type CreditCardFundingAnswers,
  type FundingReadinessResult,
} from '@/lib/funding/cardStacking';
import { generateFundingStrategy } from '@/lib/funding/strategy-engine';
import type { GeneratedServiceDeliverable } from '@/lib/services/aiServiceDeliverables';

export type PublicFundingEligibilitySnapshot = {
  businessStage?: string | null;
  businessAgeMonths?: number | null;
  monthlyRevenue?: number | null;
  personalCreditScore?: string | null;
  currentUtilization?: string | null;
  recentInquiries?: string | null;
  hasEin?: boolean | null;
  hasBusinessBank?: boolean | null;
  hasBusinessCreditCard?: boolean | null;
  requestedFundingAmount?: number | null;
  useOfFunds?: string | null;
};

export type PublicFundingLeadInput = {
  businessType?: string | null;
  requestedFundingAmount?: string | number | null;
  creditScore?: string | number | null;
  notes?: string | null;
  snapshot?: PublicFundingEligibilitySnapshot | null;
};

export type PublicFundingProductRecommendation = {
  id: string;
  issuer: string;
  productName: string;
  type: FundingProductType;
  applicationUrl: string | null;
  affiliateUrl: string | null;
  estimatedLimitMin: number | null;
  estimatedLimitMax: number | null;
  recommendedDay: number;
  reason: string;
  fitScore: number;
};

export type PublicFundingRecommendation = {
  confidence: 'full' | 'limited';
  readiness: FundingReadinessResult;
  strategy: FundingStrategyResult;
  recommendedProducts: PublicFundingProductRecommendation[];
  deliverable: GeneratedServiceDeliverable;
};

function parseCurrency(value?: string | number | null) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCreditBucket(value?: string | null) {
  const raw = String(value || '').trim().toLowerCase();

  if (
    raw === 'under_620' ||
    raw === '620_659' ||
    raw === '660_699' ||
    raw === '700_739' ||
    raw === '740_plus'
  ) {
    return raw;
  }

  const numeric = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(numeric)) return '660_699';
  if (numeric >= 740) return '740_plus';
  if (numeric >= 700) return '700_739';
  if (numeric >= 660) return '660_699';
  if (numeric >= 620) return '620_659';
  return 'under_620';
}

function ficoEstimateFromBucket(bucket: string) {
  if (bucket === '740_plus') return 760;
  if (bucket === '700_739') return 720;
  if (bucket === '660_699') return 680;
  if (bucket === '620_659') return 640;
  return 600;
}

function utilizationPercentFromBucket(bucket?: string | null) {
  const normalized = String(bucket || '');
  if (normalized === 'under_10') return 9;
  if (normalized === '10_29') return 20;
  if (normalized === '30_49') return 40;
  if (normalized === '50_74') return 62;
  if (normalized === '75_plus') return 80;
  return 40;
}

function inquiriesFromBucket(bucket?: string | null) {
  const normalized = String(bucket || '');
  if (normalized === '0_1') return 1;
  if (normalized === '2_3') return 3;
  if (normalized === '4_6') return 5;
  if (normalized === '7_plus') return 8;
  return 3;
}

function revenueRangeFromMonthlyRevenue(monthlyRevenue?: number | null) {
  const annual = Math.max(0, Number(monthlyRevenue || 0) * 12);

  if (annual >= 1_000_000) return '1m+';
  if (annual >= 500_000) return '500k-1m';
  if (annual >= 250_000) return '250k-500k';
  if (annual >= 100_000) return '100k-250k';
  if (annual >= 50_000) return '50k-100k';
  if (annual >= 25_000) return '25k-50k';
  return 'under_25k';
}

function isoDateMonthsAgo(monthsAgo: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date.toISOString().slice(0, 10);
}

function buildAnswers(input: PublicFundingLeadInput) {
  const snapshot = input.snapshot;
  const fallbackFundingAmount = parseCurrency(input.requestedFundingAmount);
  const fallbackUseOfFunds = String(input.notes || '').trim();
  const creditBucket = normalizeCreditBucket(
    snapshot?.personalCreditScore || String(input.creditScore || '')
  );

  const answers: CreditCardFundingAnswers = {
    businessStage: String(snapshot?.businessStage || 'operating'),
    businessAgeMonths: Math.max(0, Number(snapshot?.businessAgeMonths || 0)),
    monthlyRevenue: Math.max(0, Number(snapshot?.monthlyRevenue || 0)),
    personalCreditScore: creditBucket,
    currentUtilization: String(snapshot?.currentUtilization || '30_49'),
    recentInquiries: String(snapshot?.recentInquiries || '2_3'),
    hasEin: Boolean(snapshot?.hasEin),
    hasBusinessBank: Boolean(snapshot?.hasBusinessBank),
    hasBusinessCreditCard: Boolean(snapshot?.hasBusinessCreditCard),
    requestedFundingAmount:
      Number(snapshot?.requestedFundingAmount || 0) || fallbackFundingAmount,
    useOfFunds: String(snapshot?.useOfFunds || fallbackUseOfFunds),
  };

  return {
    answers,
    confidence: snapshot ? ('full' as const) : ('limited' as const),
  };
}

function buildFundingProfile(
  input: PublicFundingLeadInput,
  answers: CreditCardFundingAnswers
): FundingProfile {
  const hasEin = Boolean(answers.hasEin);
  const businessAgeMonths = Math.max(0, Number(answers.businessAgeMonths || 0));

  return {
    mode: 'hybrid',
    funding_goal_amount: answers.requestedFundingAmount || null,
    funding_goal_reason: answers.useOfFunds || String(input.notes || '') || null,
    fico_estimate: ficoEstimateFromBucket(answers.personalCreditScore),
    credit_utilization: utilizationPercentFromBucket(answers.currentUtilization),
    recent_inquiries_count: inquiriesFromBucket(answers.recentInquiries),
    new_accounts_24_months: 0,
    has_llc: hasEin,
    business_name: String(input.businessType || '').trim() || null,
    business_start_date: businessAgeMonths > 0 ? isoDateMonthsAgo(businessAgeMonths) : null,
    business_revenue_range: revenueRangeFromMonthlyRevenue(answers.monthlyRevenue),
    business_industry: String(input.businessType || '').trim() || null,
    ein_available: hasEin,
  };
}

function pathLabel(path: string) {
  if (path === 'apply_now') return 'Apply-now sequence';
  if (path === 'build_first') return 'Build-first sequence';
  if (path === 'repair_first') return 'Repair-first sequence';
  if (path === 'business_first') return 'Business-first sequence';
  if (path === 'personal_first') return 'Personal-first sequence';
  return 'Funding sequence';
}

function formatCurrencyRange(min: number, max: number) {
  if (max <= 0) return 'No reliable range yet';
  return `$${min.toLocaleString()}-$${max.toLocaleString()}`;
}

function buildDeliverable(
  recommendation: Omit<PublicFundingRecommendation, 'deliverable'>
): GeneratedServiceDeliverable {
  const sequenceBullets = recommendation.recommendedProducts.slice(0, 5).map((item) => {
    const limitText =
      item.estimatedLimitMax && item.estimatedLimitMax > 0
        ? `Estimated range: $${Number(item.estimatedLimitMin || 0).toLocaleString()}-$${Number(
            item.estimatedLimitMax
          ).toLocaleString()}.`
        : 'Limit depends on issuer review.';

    return `${item.productName} (${item.issuer}) on day ${item.recommendedDay}: ${item.reason} ${limitText}`;
  });

  const riskBullets = recommendation.readiness.risks.slice(0, 5);
  const nextStepBullets = recommendation.readiness.nextSteps.slice(0, 5);
  const warnings = recommendation.strategy.warnings.slice(0, 4);
  const confidenceLine =
    recommendation.confidence === 'limited'
      ? 'This first-pass recommendation uses limited public lead details. A fuller funding check improves sequencing accuracy.'
      : 'This recommendation uses the funding-prep details submitted through the funding check.';

  return {
    title: 'Funding Prep Snapshot',
    summary: `${recommendation.strategy.strategySummary} Estimated first-pass range: ${formatCurrencyRange(
      recommendation.strategy.estimatedFundingMin,
      recommendation.strategy.estimatedFundingMax
    )}.`,
    sections: [
      {
        heading: 'Recommended path',
        body: `${pathLabel(recommendation.strategy.recommendedPath)}. ${confidenceLine}`,
        bullets: [
          `Funding-prep score: ${recommendation.readiness.score}/100`,
          `Funding-prep level: ${recommendation.readiness.label}`,
          `Estimated range: ${formatCurrencyRange(
            recommendation.strategy.estimatedFundingMin,
            recommendation.strategy.estimatedFundingMax
          )}`,
        ],
      },
      {
        heading: 'What to fix or verify first',
        body: 'These items are the main blockers or watch areas before new applications should be considered.',
        bullets: riskBullets.length > 0 ? riskBullets : ['No major blockers were flagged from the submitted details.'],
      },
      {
        heading: 'Suggested first-pass sequence',
        body: 'Use this as a review order, not an instruction to rush applications. Terms, fees, and truthfulness checks come first.',
        bullets:
          sequenceBullets.length > 0
            ? sequenceBullets
            : ['No funding products were available to rank for this profile yet.'],
      },
      {
        heading: 'Documents and review prep',
        body: 'Before any application, make sure the business story, repayment plan, and support documents are clean.',
        bullets: warnings.length > 0 ? warnings : nextStepBullets,
      },
    ],
    recommendedActions: nextStepBullets,
    followUpQuestions: [
      'What is the exact use of funds and repayment plan?',
      'Do you already have an EIN and business bank account?',
      'Are there any recent denials, high balances, or new inquiries not listed here?',
    ],
    adminReviewFocus: [
      'Confirm the recommendation matches the client’s real use of funds.',
      'Check whether a prep-first path is safer than immediate applications.',
      'Verify the client has the documents needed before sending them to any partner path.',
    ],
    customerMessage:
      recommendation.strategy.recommendedPath === 'apply_now' ||
      recommendation.strategy.recommendedPath === 'business_first' ||
      recommendation.strategy.recommendedPath === 'personal_first'
        ? 'VestBlock created a first-pass application sequence. Review terms, fees, inquiries, and truthfulness requirements before you apply to anything.'
        : 'VestBlock created a prep-first funding snapshot. Clean up the highest-risk items before you start a broader funding sequence.',
  };
}

export function generatePublicFundingRecommendation(
  input: PublicFundingLeadInput,
  products: FundingProduct[]
): PublicFundingRecommendation {
  const { answers, confidence } = buildAnswers(input);
  const readiness = evaluateCardFundingReadiness(answers);
  const profile = buildFundingProfile(input, answers);
  const strategy = generateFundingStrategy(profile, products);

  const productsById = new Map(products.map((product) => [product.id, product]));
  const recommendedProducts: PublicFundingProductRecommendation[] = [];

  for (const step of strategy.recommendedSequence) {
    const product = productsById.get(step.product_id);
    if (!product) continue;

    recommendedProducts.push({
      id: product.id,
      issuer: product.issuer,
      productName: product.product_name,
      type: product.type,
      applicationUrl: product.application_url || null,
      affiliateUrl: product.affiliate_url || null,
      estimatedLimitMin: product.estimated_limit_min ?? null,
      estimatedLimitMax: product.estimated_limit_max ?? null,
      recommendedDay: step.recommended_day,
      reason: step.reason,
      fitScore: step.fit_score,
    });
  }

  const baseRecommendation = {
    confidence,
    readiness,
    strategy,
    recommendedProducts,
  };

  return {
    ...baseRecommendation,
    deliverable: buildDeliverable(baseRecommendation),
  };
}
