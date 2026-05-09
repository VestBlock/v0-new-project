export type CreditCardFundingAnswers = {
  fullName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  businessStage: string;
  businessAgeMonths: number;
  monthlyRevenue: number;
  personalCreditScore: string;
  currentUtilization: string;
  recentInquiries: string;
  hasEin: boolean;
  hasBusinessBank: boolean;
  hasBusinessCreditCard: boolean;
  requestedFundingAmount: number;
  useOfFunds: string;
};

export type FundingReadinessResult = {
  score: number;
  tier: 'needs_prep' | 'review_ready' | 'strong_candidate';
  label: string;
  summary: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
};

function scoreCreditRange(range: string) {
  if (range === '740_plus') return 28;
  if (range === '700_739') return 22;
  if (range === '660_699') return 14;
  if (range === '620_659') return 8;
  return 0;
}

function scoreUtilization(value: string) {
  if (value === 'under_10') return 18;
  if (value === '10_29') return 15;
  if (value === '30_49') return 8;
  if (value === '50_74') return 2;
  return 0;
}

function scoreInquiries(value: string) {
  if (value === '0_1') return 14;
  if (value === '2_3') return 9;
  if (value === '4_6') return 3;
  return 0;
}

export function evaluateCardFundingReadiness(
  answers: CreditCardFundingAnswers
): FundingReadinessResult {
  let score = 0;
  const strengths: string[] = [];
  const risks: string[] = [];
  const nextSteps: string[] = [];

  const creditScore = scoreCreditRange(answers.personalCreditScore);
  score += creditScore;
  if (creditScore >= 22) {
    strengths.push('Personal credit range may support stronger card options.');
  } else {
    risks.push('Personal credit may limit approvals, limits, or terms.');
    nextSteps.push('Review credit report issues before applying for multiple cards.');
  }

  const utilizationScore = scoreUtilization(answers.currentUtilization);
  score += utilizationScore;
  if (utilizationScore >= 15) {
    strengths.push('Current utilization appears manageable for a funding review.');
  } else {
    risks.push('High utilization can reduce approval odds and starting limits.');
    nextSteps.push('Lower revolving utilization before a business credit funding sequence.');
  }

  const inquiryScore = scoreInquiries(answers.recentInquiries);
  score += inquiryScore;
  if (inquiryScore >= 9) {
    strengths.push('Recent inquiry count is not excessive.');
  } else {
    risks.push('Recent inquiries may make a card sequence riskier.');
    nextSteps.push('Avoid new applications until the review plan is clear.');
  }

  if (answers.hasEin) score += 8;
  else {
    risks.push('Business EIN is missing.');
    nextSteps.push('Set up or confirm the EIN before business funding review.');
  }

  if (answers.hasBusinessBank) score += 8;
  else {
    risks.push('Business bank account is missing.');
    nextSteps.push('Open a business bank account in the legal business name.');
  }

  if (answers.businessAgeMonths >= 24) {
    score += 10;
    strengths.push('Business operating history may support stronger positioning.');
  } else if (answers.businessAgeMonths >= 6) {
    score += 5;
  } else {
    risks.push('Newer businesses often rely more heavily on owner credit and guarantees.');
  }

  if (answers.monthlyRevenue >= 15000) {
    score += 9;
    strengths.push('Monthly revenue may support a clearer repayment story.');
  } else if (answers.monthlyRevenue >= 5000) {
    score += 5;
  } else {
    risks.push('Low or early revenue can limit funding fit.');
    nextSteps.push('Document deposits, contracts, invoices, or planned use of funds.');
  }

  if (answers.useOfFunds && answers.useOfFunds.trim().length >= 25) {
    score += 5;
    strengths.push('Use of funds is specific enough for review.');
  } else {
    risks.push('Use of funds needs more detail.');
    nextSteps.push('Clarify how the funds will be used and repaid.');
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 76) {
    return {
      score,
      tier: 'strong_candidate',
      label: 'Strong candidate for funding review',
      summary:
        'This profile appears ready to explore business funding options, subject to document review, lender terms, and current credit report verification.',
      strengths,
      risks,
      nextSteps: [
        'Compare funding options and submit only after reviewing terms.',
        'Verify current credit report details and business documents.',
        'Build an application sequence with consent before any application is submitted.',
        ...nextSteps,
      ],
    };
  }

  if (score >= 55) {
    return {
      score,
      tier: 'review_ready',
      label: 'Review-ready with preparation',
      summary:
        'This profile may qualify with careful lender selection, but the plan should address credit, utilization, documentation, or repayment risks first.',
      strengths,
      risks,
      nextSteps: [
        'Use the $300 funding prep plan if you want help improving eligibility before applying.',
        'Resolve the highest-risk items before submitting applications.',
        'Confirm all costs, APRs, fees, inquiries, and repayment obligations before applying.',
        ...nextSteps,
      ],
    };
  }

  return {
    score,
    tier: 'needs_prep',
    label: 'Needs prep before business funding',
    summary:
      'This profile should focus on eligibility work before a business funding sequence. Applying too early could create avoidable inquiries, fees, or utilization risk.',
    strengths,
    risks,
    nextSteps: [
      'Start with credit cleanup, utilization reduction, and business setup preparation.',
      'Organize EIN, banking, revenue records, and use-of-funds documentation.',
      'Use the $300 funding prep plan if you want VestBlock to help organize the prep work.',
      ...nextSteps,
    ],
  };
}
