import type {
  FundingPaymentPlan,
  FundingPaymentPlanId,
  FundingProfile,
  FundingRecommendation,
} from '@/lib/funding/types';

type PaymentPlanContext = {
  profile?: FundingProfile | null;
  recommendation?: FundingRecommendation | null;
};

function basePlans(): FundingPaymentPlan[] {
  return [
    {
      id: 'software_access',
      name: 'Software Access',
      description:
        'A lighter-touch option for users who want the dashboard, reminders, and strategy tracking without white-glove support.',
      price: 49,
      discountedPrice: 39,
      features: [
        'Funding dashboard access',
        'Progress tracking and reminders',
        'Saved funding-prep profile',
        'Estimated sequence organization',
      ],
      ctaLabel: 'Choose Software Access',
      requiresAdminReview: false,
      stripeCheckoutReady: false,
    },
    {
      id: 'strategy_report',
      name: 'Funding Strategy Report',
      description:
        'A one-time roadmap option for users who want a clearer plan before they decide on higher-touch support.',
      price: 149,
      discountedPrice: 99,
      features: [
        'Detailed funding-prep summary',
        'Recommended application path',
        'Warnings and timing notes',
        'Follow-up checklist',
      ],
      ctaLabel: 'View Strategy Report Plan',
      requiresAdminReview: false,
      stripeCheckoutReady: false,
    },
    {
      id: 'assisted_funding_package',
      name: 'Assisted Funding Package',
      description:
        'Higher-touch support for users who want VestBlock follow-up on eligibility, sequencing, and guided review.',
      price: 300,
      discountedPrice: 300,
      features: [
        'Guided review included',
        'Eligibility cleanup guidance',
        'Sequence support',
        'Follow-up task handling',
      ],
      ctaLabel: 'Request Assisted Review',
      requiresAdminReview: true,
      stripeCheckoutReady: false,
    },
    {
      id: 'custom_plan',
      name: 'Custom Plan',
      description:
        'A flexible option for hybrid funding, real-estate-focused capital planning, or unusual credit constraints.',
      price: 0,
      discountedPrice: null,
      features: [
        'Personal review included',
        'Custom sequencing review',
        'Edge-case business structure support',
      ],
      ctaLabel: 'Request Custom Plan',
      requiresAdminReview: true,
      stripeCheckoutReady: false,
    },
  ];
}

export function getFundingPaymentPlans(
  context: PaymentPlanContext = {}
): {
  recommendedPlanId: FundingPaymentPlanId;
  plans: FundingPaymentPlan[];
  stripeIntegrationNote: string;
} {
  const plans = basePlans();
  const path = context.recommendation?.recommended_path;
  const mode = context.profile?.mode;
  const readiness = context.recommendation?.readiness_score ?? 0;

  let recommendedPlanId: FundingPaymentPlanId = 'strategy_report';

  if (path === 'repair_first' || path === 'build_first') {
    recommendedPlanId = 'assisted_funding_package';
  } else if (mode === 'hybrid') {
    recommendedPlanId = 'custom_plan';
  } else if (readiness >= 78) {
    recommendedPlanId = 'software_access';
  }

  return {
    recommendedPlanId,
    plans,
    stripeIntegrationNote:
      'Stripe checkout is not wired for this feature yet. Connect an existing Stripe helper before enabling live checkout from Funding Assistant.',
  };
}
