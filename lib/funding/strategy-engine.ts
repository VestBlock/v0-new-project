import type {
  FundingMode,
  FundingPath,
  FundingProduct,
  FundingProductType,
  FundingProfile,
  FundingRiskLevel,
  FundingSequenceStep,
  FundingStrategyResult,
} from '@/lib/funding/types';

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function revenueScore(range?: string | null) {
  const value = String(range || '').toLowerCase();
  if (
    value.includes('100k') ||
    value.includes('250k') ||
    value.includes('500k') ||
    value.includes('1m')
  ) {
    return 15;
  }

  if (
    value.includes('25k') ||
    value.includes('30k') ||
    value.includes('50k') ||
    value.includes('75k')
  ) {
    return 8;
  }

  return 0;
}

function getRiskLevel(score: number): FundingRiskLevel {
  if (score >= 80) return 'low';
  if (score >= 65) return 'moderate';
  if (score >= 50) return 'elevated';
  return 'high';
}

function pickRecommendedPath(
  profile: FundingProfile,
  readinessScore: number
): FundingPath {
  const fico = profile.fico_estimate ?? 0;
  const utilization = profile.credit_utilization ?? 0;
  const inquiries = profile.recent_inquiries_count ?? 0;
  const hasBusinessReady = Boolean(profile.has_llc && profile.ein_available);

  if (fico < 620) return 'repair_first';
  if (utilization >= 75) return 'repair_first';
  if (utilization >= 60) return 'build_first';
  if (inquiries >= 8) return 'build_first';

  if (profile.mode === 'business' && readinessScore >= 70) return 'apply_now';
  if (profile.mode === 'personal' && readinessScore >= 75) return 'apply_now';

  if (profile.mode === 'hybrid' && readinessScore >= 75 && hasBusinessReady) {
    return 'business_first';
  }

  if (profile.mode === 'hybrid' && readinessScore >= 70 && !hasBusinessReady) {
    return 'personal_first';
  }

  if (readinessScore >= 55 && readinessScore <= 69) return 'build_first';

  return 'repair_first';
}

function getEstimatedFundingRange(
  mode: FundingMode,
  riskLevel: FundingRiskLevel,
  path: FundingPath,
  readinessScore: number
) {
  if (mode === 'personal') {
    if (path === 'apply_now') {
      if (readinessScore >= 85) return { min: 15000, max: 50000 };
      if (readinessScore >= 75) return { min: 8000, max: 30000 };
      return { min: 5000, max: 15000 };
    }

    if (riskLevel === 'high') return { min: 0, max: 5000 };
    return { min: 1000, max: 10000 };
  }

  if (riskLevel === 'low') return { min: 25000, max: 100000 };
  if (riskLevel === 'moderate') return { min: 10000, max: 50000 };
  if (riskLevel === 'elevated') return { min: 2000, max: 20000 };
  return { min: 0, max: 5000 };
}

function buildWarnings(
  profile: FundingProfile,
  recommendedPath: FundingPath
) {
  const warnings = new Set<string>();

  warnings.add(
    'Use truthful, documentable application information. Do not estimate income, revenue, or business history beyond what you can support.'
  );
  warnings.add(
    'Funding ranges are estimates only. Approval decisions, terms, and credit limits may vary by issuer.'
  );

  if ((profile.credit_utilization ?? 0) >= 50) {
    warnings.add(
      'High utilization can reduce approvals, starting limits, and later sequence flexibility.'
    );
  }

  if ((profile.recent_inquiries_count ?? 0) >= 6) {
    warnings.add(
      'A high recent inquiry count can make additional applications riskier until the file cools down.'
    );
  }

  if ((profile.fico_estimate ?? 0) < 640) {
    warnings.add(
      'Lower FICO ranges usually point toward a repair-first or build-first path before a larger funding sequence.'
    );
  }

  if (
    profile.mode !== 'personal' &&
    (!profile.has_llc || !profile.ein_available)
  ) {
    warnings.add(
      'Business-mode recommendations are limited until the entity and EIN setup are complete.'
    );
  }

  if (recommendedPath === 'repair_first') {
    warnings.add(
      'Applying too early may create avoidable denials, fees, or additional inquiry pressure.'
    );
  }

  return Array.from(warnings);
}

function productTypePriority(
  mode: FundingMode,
  path: FundingPath,
  productType: FundingProductType
) {
  const businessFirst = {
    business_card: 100,
    business_line: 90,
    personal_card: 50,
    secured_card: 35,
    credit_builder: 25,
    personal_loan: 20,
    real_estate_funding: 15,
    grant_or_program: 10,
  };

  const personalFirst = {
    personal_card: 100,
    secured_card: 80,
    credit_builder: 75,
    personal_loan: 60,
    business_card: 40,
    business_line: 35,
    grant_or_program: 15,
    real_estate_funding: 10,
  };

  const prepFirst = {
    credit_builder: 100,
    secured_card: 85,
    personal_loan: 75,
    personal_card: 50,
    business_card: 35,
    business_line: 30,
    grant_or_program: 20,
    real_estate_funding: 10,
  };

  if (path === 'repair_first' || path === 'build_first') {
    return prepFirst[productType];
  }

  if (mode === 'business' || path === 'business_first') {
    return businessFirst[productType];
  }

  return personalFirst[productType];
}

function pathCompatibility(
  profile: FundingProfile,
  path: FundingPath,
  product: FundingProduct
) {
  if (!product.active) return -1000;
  if (product.requires_business && profile.mode === 'personal') return -250;
  if (product.requires_ein && !profile.ein_available) return -120;
  if (profile.mode !== 'personal' && product.requires_business && !profile.has_llc) return -80;

  if (path === 'repair_first' || path === 'build_first') {
    if (product.type === 'credit_builder' || product.type === 'secured_card') {
      return 45;
    }
    if (product.type === 'personal_loan') return 20;
  }

  if (path === 'business_first' || (profile.mode === 'business' && path === 'apply_now')) {
    if (product.type === 'business_card' || product.type === 'business_line') return 55;
  }

  if (path === 'personal_first' || (profile.mode === 'personal' && path === 'apply_now')) {
    if (product.type === 'personal_card') return 50;
    if (product.type === 'secured_card') return 35;
  }

  if (path === 'hybrid_sequence') {
    if (product.type === 'business_card' || product.type === 'business_line') return 45;
    if (product.type === 'personal_card') return 35;
  }

  return 0;
}

function getSequenceDay(path: FundingPath, index: number) {
  if (path === 'repair_first') {
    return [0, 14, 30, 45, 60][index] ?? index * 15;
  }

  if (path === 'build_first') {
    return [0, 10, 24, 38, 52][index] ?? index * 12;
  }

  if (path === 'business_first') {
    return [0, 3, 10, 21, 35][index] ?? index * 7;
  }

  if (path === 'personal_first') {
    return [0, 5, 16, 28, 42][index] ?? index * 8;
  }

  return [0, 3, 10, 18, 28][index] ?? index * 7;
}

function getSequenceReason(
  profile: FundingProfile,
  product: FundingProduct,
  path: FundingPath
) {
  if (path === 'repair_first' || path === 'build_first') {
    if (product.type === 'credit_builder') {
      return 'Use this step to improve profile stability before a larger application sequence.';
    }
    if (product.type === 'secured_card') {
      return 'A secured product can help rebuild utilization control and on-time history.';
    }
  }

  if (
    (profile.mode === 'business' || path === 'business_first') &&
    (product.type === 'business_card' || product.type === 'business_line')
  ) {
    return 'This product fits a business-first sequence once entity, EIN, and utilization are ready.';
  }

  if (
    (profile.mode === 'personal' || path === 'personal_first') &&
    product.type === 'personal_card'
  ) {
    return 'This product fits a personal funding lane when score, utilization, and inquiry pressure are within range.';
  }

  return 'This option fits the current readiness profile better than a rushed application pattern.';
}

function buildRecommendedSequence(
  profile: FundingProfile,
  products: FundingProduct[],
  path: FundingPath
): FundingSequenceStep[] {
  const fico = profile.fico_estimate ?? 0;
  const compatible = products
    .filter((product) => product.active)
    .map((product) => {
      let fitScore = 0;

      fitScore += product.requires_business
        ? profile.mode === 'personal'
          ? -200
          : 40
        : 10;
      fitScore += pathCompatibility(profile, path, product);
      fitScore += productTypePriority(profile.mode, path, product.type);

      if ((product.recommended_fico ?? 0) <= fico) {
        fitScore += 30;
      } else {
        fitScore -= Math.min(30, Math.max(0, (product.recommended_fico ?? 0) - fico) / 2);
      }

      fitScore += Math.min(18, (product.intro_apr_months ?? 0) * 1.2);
      fitScore += Math.min(25, Math.floor((product.estimated_limit_max ?? 0) / 5000));

      if (profile.mode === 'hybrid' && profile.has_llc && profile.ein_available) {
        if (product.type === 'business_card' || product.type === 'business_line') {
          fitScore += 12;
        }
      }

      if (profile.mode === 'hybrid' && (!profile.has_llc || !profile.ein_available)) {
        if (product.type === 'personal_card' || product.type === 'credit_builder') {
          fitScore += 12;
        }
      }

      return { product, fitScore };
    })
    .sort((left, right) => {
      if (right.fitScore !== left.fitScore) return right.fitScore - left.fitScore;

      const businessCompatibility =
        Number(Boolean(right.product.requires_business)) -
        Number(Boolean(left.product.requires_business));
      if (businessCompatibility !== 0) return businessCompatibility;

      const ficoDiff =
        (left.product.recommended_fico ?? 999) - (right.product.recommended_fico ?? 999);
      if (ficoDiff !== 0) return ficoDiff;

      const aprDiff =
        (right.product.intro_apr_months ?? 0) - (left.product.intro_apr_months ?? 0);
      if (aprDiff !== 0) return aprDiff;

      return (right.product.estimated_limit_max ?? 0) - (left.product.estimated_limit_max ?? 0);
    });

  return compatible.slice(0, 5).map(({ product, fitScore }, index) => ({
    product_id: product.id,
    sequence_order: index + 1,
    recommended_day: getSequenceDay(path, index),
    reason: getSequenceReason(profile, product, path),
    fit_score: fitScore,
  }));
}

function buildStrategySummary(
  profile: FundingProfile,
  path: FundingPath,
  riskLevel: FundingRiskLevel,
  readinessScore: number
) {
  const businessReady = Boolean(profile.has_llc && profile.ein_available);

  if (path === 'repair_first') {
    return 'Your profile points to a repair-first funding strategy. Lowering utilization, cooling inquiry pressure, and tightening your documentation should come before a larger application sequence.';
  }

  if (path === 'build_first') {
    return 'Your profile supports a build-first path. The next move is to improve profile stability and sequence timing before you pursue a broader funding lane.';
  }

  if (path === 'business_first') {
    return `Your hybrid profile is strong enough to start with business funding first. With entity setup${businessReady ? ', EIN readiness,' : ''} and a moderate-to-low risk profile, a business-led sequence is the cleanest path.`;
  }

  if (path === 'personal_first') {
    return 'Your hybrid profile is closer to a personal-first strategy right now. Build leverage on the personal side first, then move into business products after the entity side is more complete.';
  }

  if (profile.mode === 'personal') {
    return `Your profile shows ${riskLevel} risk, so VestBlock recommends a personal funding strategy focused on cleaner timing, lower utilization, and careful application spacing.`;
  }

  return `Your profile shows ${riskLevel} risk, which supports an apply-now strategy if you stay disciplined on sequence order, truthful data, and issuer-specific terms.`;
}

export function generateFundingStrategy(
  profile: FundingProfile,
  products: FundingProduct[]
): FundingStrategyResult {
  let score = 50;
  const fico = profile.fico_estimate ?? 0;
  const utilization = profile.credit_utilization ?? 0;
  const inquiries = profile.recent_inquiries_count ?? 0;
  const newAccounts = profile.new_accounts_24_months ?? 0;

  if (fico >= 760) score += 25;
  else if (fico >= 720) score += 20;
  else if (fico >= 680) score += 12;
  else if (fico >= 640) score += 5;
  else if (fico >= 620) score -= 10;
  else score -= 25;

  if (utilization <= 9) score += 15;
  else if (utilization <= 29) score += 10;
  else if (utilization <= 49) score -= 5;
  else if (utilization <= 74) score -= 15;
  else score -= 25;

  if (inquiries <= 2) score += 10;
  else if (inquiries <= 5) score -= 5;
  else score -= 15;

  if (newAccounts <= 2) score += 8;
  else if (newAccounts >= 5) score -= 12;

  if (profile.has_llc) score += 8;
  if (profile.ein_available) score += 8;
  score += revenueScore(profile.business_revenue_range);

  if (profile.mode !== 'personal' && (!profile.has_llc || !profile.ein_available)) {
    score -= 8;
  }

  const readinessScore = clampScore(score);
  const riskLevel = getRiskLevel(readinessScore);
  const recommendedPath = pickRecommendedPath(profile, readinessScore);
  const estimated = getEstimatedFundingRange(
    profile.mode,
    riskLevel,
    recommendedPath,
    readinessScore
  );
  const warnings = buildWarnings(profile, recommendedPath);
  const recommendedSequence = buildRecommendedSequence(
    profile,
    products,
    recommendedPath
  );

  return {
    readinessScore,
    riskLevel,
    recommendedPath,
    estimatedFundingMin: estimated.min,
    estimatedFundingMax: estimated.max,
    strategySummary: buildStrategySummary(
      profile,
      recommendedPath,
      riskLevel,
      readinessScore
    ),
    warnings,
    recommendedSequence,
  };
}
