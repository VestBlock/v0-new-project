export const fundingModes = ['business', 'personal', 'hybrid'] as const;
export const fundingPaths = [
  'apply_now',
  'build_first',
  'repair_first',
  'business_first',
  'personal_first',
  'hybrid_sequence',
] as const;
export const fundingRiskLevels = ['low', 'moderate', 'elevated', 'high'] as const;
export const applicationStatuses = [
  'not_started',
  'opened',
  'applied',
  'pending',
  'approved',
  'denied',
  'skipped',
] as const;
export const fundingProductTypes = [
  'business_card',
  'personal_card',
  'secured_card',
  'credit_builder',
  'personal_loan',
  'business_line',
  'real_estate_funding',
  'grant_or_program',
] as const;
export const fundingPaymentPlanIds = [
  'software_access',
  'strategy_report',
  'assisted_funding_package',
  'custom_plan',
] as const;

export type FundingMode = (typeof fundingModes)[number];
export type FundingPath = (typeof fundingPaths)[number];
export type FundingRiskLevel = (typeof fundingRiskLevels)[number];
export type ApplicationStatus = (typeof applicationStatuses)[number];
export type FundingProductType = (typeof fundingProductTypes)[number];
export type FundingPaymentPlanId = (typeof fundingPaymentPlanIds)[number];

export const FUNDING_ASSISTANT_DISCLAIMER =
  'VestBlock provides education, organization, and funding strategy tools. Approval decisions, credit limits, APRs, and terms are made by the issuer or lender. Only submit truthful, accurate, and documentable information.';

export type FundingProfile = {
  id?: string;
  user_id?: string;
  mode: FundingMode;
  funding_goal_amount?: number | null;
  funding_goal_reason?: string | null;
  fico_estimate?: number | null;
  income_range?: string | null;
  monthly_debt_payments?: number | null;
  credit_utilization?: number | null;
  recent_inquiries_count?: number | null;
  new_accounts_24_months?: number | null;
  has_llc?: boolean;
  business_name?: string | null;
  business_start_date?: string | null;
  business_revenue_range?: string | null;
  business_industry?: string | null;
  ein_available?: boolean;
  risk_level?: FundingRiskLevel | null;
  readiness_score?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type FundingProduct = {
  id: string;
  type: FundingProductType;
  issuer: string;
  product_name: string;
  application_url?: string | null;
  affiliate_url?: string | null;
  min_fico?: number | null;
  recommended_fico?: number | null;
  requires_business?: boolean | null;
  requires_ein?: boolean | null;
  reports_to_personal?: boolean | null;
  reports_to_business?: boolean | null;
  intro_apr_months?: number | null;
  annual_fee?: number | null;
  estimated_limit_min?: number | null;
  estimated_limit_max?: number | null;
  bureau_notes?: string | null;
  velocity_rules?: string | null;
  risk_notes?: string | null;
  truthful_application_notes?: string | null;
  active?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type FundingRecommendation = {
  id?: string;
  user_id?: string;
  profile_id?: string;
  mode: FundingMode;
  recommended_path: FundingPath;
  readiness_score: number;
  estimated_funding_min: number;
  estimated_funding_max: number;
  strategy_summary: string;
  warnings: string[];
  created_at?: string;
  updated_at?: string;
};

export type FundingSequenceItem = {
  id?: string;
  recommendation_id?: string;
  user_id?: string;
  product_id?: string | null;
  sequence_order: number;
  recommended_day?: number | null;
  status: ApplicationStatus;
  opened_at?: string | null;
  applied_at?: string | null;
  approved_at?: string | null;
  denied_at?: string | null;
  approved_limit?: number | null;
  user_notes?: string | null;
  screenshot_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FundingSequenceStep = {
  product_id: string;
  sequence_order: number;
  recommended_day: number;
  reason: string;
  fit_score: number;
};

export type FundingSequenceItemWithProduct = FundingSequenceItem & {
  product: FundingProduct | null;
};

export type FundingPayment = {
  id?: string;
  user_id?: string;
  recommendation_id?: string | null;
  payment_plan?: FundingPaymentPlanId | string | null;
  standard_fee?: number | null;
  discounted_fee?: number | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  stripe_customer_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_subscription_id?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FundingEvent = {
  id?: string;
  user_id?: string | null;
  event_type: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

export type FundingProgressSummary = {
  totalSequenceCount: number;
  openedCount: number;
  appliedCount: number;
  approvedCount: number;
  deniedCount: number;
  pendingCount: number;
  skippedCount: number;
  totalApprovedLimit: number;
  nextRecommendedItem: FundingSequenceItemWithProduct | null;
  paymentStatus: string | null;
};

export type FundingPaymentPlan = {
  id: FundingPaymentPlanId;
  name: string;
  description: string;
  price: number;
  discountedPrice?: number | null;
  features: string[];
  ctaLabel: string;
  requiresAdminReview: boolean;
  stripeCheckoutReady: boolean;
};

export type FundingStrategyResult = {
  readinessScore: number;
  riskLevel: FundingRiskLevel;
  recommendedPath: FundingPath;
  estimatedFundingMin: number;
  estimatedFundingMax: number;
  strategySummary: string;
  warnings: string[];
  recommendedSequence: FundingSequenceStep[];
};
