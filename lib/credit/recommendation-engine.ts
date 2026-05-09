import type {
  AiCreditCardRecommendation,
  AiDetailedAnalysis,
  AiSideHustleRecommendation,
  RoadmapData,
  RoadmapStep,
} from "@/types/supabase";
import { vestblockSideHustlePlaybook } from "@/lib/credit/side-hustle-playbook";

type RecommendationContext = {
  extractedText?: string | null;
  financialGoalTitle?: string | null;
  detailedAnalysis?: AiDetailedAnalysis | null;
  roadmap?: RoadmapData | null;
  existingCards?: AiCreditCardRecommendation[] | null;
  existingSideHustles?: AiSideHustleRecommendation[] | null;
};

type CreditProfileSignals = {
  creditScore: number | null;
  utilizationPercent: number | null;
  negativeItemCount: number;
  rentSignal: boolean;
  thinFileSignal: boolean;
};

function normalizeText(value?: string | null) {
  return (value || "").toLowerCase();
}

export function getCreditProfileSignals(
  context: RecommendationContext
): CreditProfileSignals {
  const extractedText = normalizeText(context.extractedText);
  const goal = normalizeText(context.financialGoalTitle);
  const detailed = context.detailedAnalysis || undefined;

  const creditScore =
    typeof detailed?.credit_score_analysis?.score === "number"
      ? detailed.credit_score_analysis.score
      : null;

  const utilizationPercent =
    typeof detailed?.utilization_analysis?.overall_ratio === "number"
      ? detailed.utilization_analysis.overall_ratio
      : null;

  const negativeItemCount = Array.isArray(detailed?.negative_items)
    ? detailed.negative_items.length
    : 0;

  const rentSignal =
    /\brent|renter|lease|landlord|apartment\b/.test(extractedText) ||
    /\brent|renter|lease|landlord|apartment\b/.test(goal);

  const totalAccounts =
    typeof detailed?.account_summary?.total === "number"
      ? detailed.account_summary.total
      : null;
  const thinFileSignal =
    (typeof creditScore === "number" && creditScore < 640) ||
    (typeof totalAccounts === "number" && totalAccounts <= 4) ||
    negativeItemCount === 0;

  return {
    creditScore,
    utilizationPercent,
    negativeItemCount,
    rentSignal,
    thinFileSignal,
  };
}

function dedupeByName<T extends { name: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildBoostPackRecommendations(
  context: RecommendationContext
): AiCreditCardRecommendation[] {
  const signals = getCreditProfileSignals(context);
  const cards: AiCreditCardRecommendation[] = [];

  const add = (card: AiCreditCardRecommendation, condition = true) => {
    if (condition) cards.push(card);
  };

  add({
    name: "Self Credit Builder Account",
    description:
      "Installment-style credit builder account for adding positive payment history and improving credit mix over time. Best used with autopay and patient 30-90 day monitoring.",
    bestFor: "Thin files, rebuilders, and users missing an installment tradeline",
    minimumCredit: "No traditional score minimum shown",
    annualFee: "Varies by plan",
    category: "Credit Builder Loan",
    providerType: "credit_builder",
    link: "https://www.self.inc/credit-builder-loan",
    featured: true,
    features: [
      "Adds installment payment history",
      "Supports credit mix improvement",
      "Useful for structured 90-day rebuild plans",
    ],
    complianceNote:
      "Use only if the monthly payment fits your budget and autopay is safely covered.",
  });

  add({
    name: "Kikoff Credit Account",
    description:
      "Low-cost revolving credit builder option designed to report consistent monthly activity. Helpful when a user needs a safer revolving tradeline without chasing premium approvals too early.",
    bestFor: "Low score, thin file, or users missing revolving activity",
    minimumCredit: "No hard credit check advertised",
    annualFee: "Plans start low; review current pricing",
    category: "Credit Builder Tradeline",
    providerType: "credit_builder",
    link: "https://kikoff.com/credit-account",
    featured: true,
    features: [
      "Revolving tradeline",
      "Can support utilization profile",
      "Useful for early-stage credit rebuilding",
    ],
    complianceNote:
      "Keep payments on time and avoid opening too many similar accounts at once.",
  });

  add(
    {
      name: "Boom Rent Reporting",
      description:
        "Rent reporting option that can turn recurring rent payments into a positive reporting signal when the housing setup is eligible.",
      bestFor: "Renters with limited mortgage-style history",
      minimumCredit: "Eligibility depends on rent verification setup",
      annualFee: "Check current pricing",
      category: "Rent Reporting",
      providerType: "rent_reporting",
      link: "https://www.boompay.app/download",
      features: [
        "Can add reported housing payment history",
        "Useful for thin files",
        "Worth reviewing if 12-24 months of rent history can be verified",
      ],
      complianceNote:
        "Confirm landlord or payment-portal verification before relying on this path.",
    },
    signals.rentSignal
  );

  add(
    {
      name: "TomoCredit",
      description:
        "Alternative-underwriting card option for users who may be blocked by stricter FICO-first issuers. Best used lightly with very disciplined payoff habits.",
      bestFor: "Limited credit history or profiles still rebuilding access",
      minimumCredit: "Alternative underwriting",
      annualFee: "Check current pricing and terms",
      category: "Alternative Underwriting Card",
      providerType: "alternative_underwriting",
      link: "https://www.tomocredit.com/",
      features: [
        "Alternative approval path",
        "Can help establish positive card activity",
        "Best paired with low utilization discipline",
      ],
      complianceNote:
        "Issuer decisions and product terms vary. Review APR, fees, and autopay behavior before applying.",
    },
    signals.creditScore === null || signals.creditScore < 650 || signals.thinFileSignal
  );

  add(
    {
      name: "Discover it Secured",
      description:
        "Traditional secured-card path that can help rebuild revolving history when the user is ready to manage a small limit responsibly.",
      bestFor: "Rebuilders who can handle a deposit and want a mainstream secured-card option",
      minimumCredit: "Often used for rebuilding credit",
      annualFee: "$0",
      category: "Secured Card",
      providerType: "secured_card",
      link: "https://www.discover.com/credit-cards/secured/",
      features: [
        "Reports revolving activity",
        "Useful when the user can keep balances very low",
        "More appropriate after autopay discipline is in place",
      ],
      complianceNote:
        "A secured card helps most when statement balances stay under 10-30% of the limit.",
    },
    signals.creditScore !== null ? signals.creditScore >= 580 : true
  );

  return dedupeByName(cards);
}

export function buildCreditCardRecommendations(
  context: RecommendationContext
): AiCreditCardRecommendation[] {
  const signals = getCreditProfileSignals(context);
  const goal = normalizeText(context.financialGoalTitle);
  const boosted = buildBoostPackRecommendations(context);
  const cards: AiCreditCardRecommendation[] = [];

  if (Array.isArray(context.existingCards) && context.existingCards.length > 0) {
    cards.push(...context.existingCards);
  }

  if (signals.creditScore !== null && signals.creditScore >= 660) {
    cards.push({
      name: "Capital One QuicksilverOne",
      description:
        "Fair-credit cash-back card option for users who already have some rebuilding momentum and need a simple everyday card with consistent on-time reporting.",
      bestFor: "Fair credit users graduating out of basic builder-only products",
      minimumCredit: "Fair credit",
      annualFee: "$39",
      category: "Cash Back",
      providerType: "unsecured_card",
      link: "https://www.capitalone.com/credit-cards/quicksilverone/",
      features: [
        "Simple rewards structure",
        "Can help after rebuild foundations are set",
        "Better fit once utilization discipline is stable",
      ],
    });
  }

  if (signals.utilizationPercent !== null && signals.utilizationPercent > 30) {
    cards.unshift({
      name: "Pause New Card Applications Until Utilization Drops",
      description:
        "Your profile may benefit more from paying balances down before adding new hard inquiries. Lowering utilization can be a faster score move than chasing another approval immediately.",
      bestFor: "Users above 30% utilization",
      minimumCredit: "Any score",
      annualFee: "$0",
      category: "Readiness Move",
      providerType: "general",
      link: "/credit-upload",
      features: [
        "Protects score from unnecessary inquiry pressure",
        "Supports stronger future approvals",
        "Pairs well with autopay and balance reduction",
      ],
      complianceNote:
        "This is a readiness recommendation, not a credit-card product.",
    });
  }

  cards.push(...boosted);

  if (goal.includes("travel") || goal.includes("rewards")) {
    cards.push({
      name: "Use Pre-Qualification Before Chasing Rewards Cards",
      description:
        "If your goal is eventually rewards or travel value, build a cleaner approval profile first and use issuer pre-qualification tools before taking hard pulls.",
      bestFor: "Users with future rewards-card goals",
      minimumCredit: "Usually better once the profile is stable",
      annualFee: "$0+",
      category: "Readiness Move",
      providerType: "general",
      link: "/funding",
      features: [
        "Reduces blind hard pulls",
        "Helps sequence future card applications more safely",
      ],
    });
  }

  return dedupeByName(cards).slice(0, 6);
}

export function buildSideHustleRecommendations(
  context: RecommendationContext
): AiSideHustleRecommendation[] {
  if (Array.isArray(context.existingSideHustles) && context.existingSideHustles.length >= 3) {
    return context.existingSideHustles;
  }

  const signals = getCreditProfileSignals(context);
  const goal = normalizeText(context.financialGoalTitle);
  const candidates: AiSideHustleRecommendation[] = [];

  const byName = (name: string) =>
    vestblockSideHustlePlaybook.find((item) => item.name === name);

  const pushNamed = (name: string, condition = true) => {
    const found = byName(name);
    if (found && condition) candidates.push(found);
  };

  pushNamed("Delivery App Hustle");
  pushNamed("Digital Product Seller", goal.includes("digital") || goal.includes("online") || goal.includes("income"));

  pushNamed(
    "Notary & Loan Signing Agent",
    goal.includes("funding") || goal.includes("business") || goal.includes("professional")
  );
  pushNamed(
    "Freelance GPT Prompt Writer",
    goal.includes("business") || goal.includes("ai") || goal.includes("marketing")
  );
  pushNamed(
    "Mobile Car Wash & Detailing",
    signals.creditScore === null || signals.creditScore < 640
  );
  pushNamed(
    "Local Lawn Care Service",
    signals.creditScore === null || signals.creditScore < 640
  );
  pushNamed(
    "Pressure Washing Service",
    goal.includes("business") || goal.includes("local")
  );
  pushNamed(
    "Junk Removal Hustle",
    signals.creditScore === null || signals.creditScore < 620
  );
  pushNamed(
    "Event Staffing",
    signals.creditScore !== null ? signals.creditScore < 640 : true
  );
  pushNamed(
    "Print-on-Demand Store",
    goal.includes("business") || goal.includes("brand") || goal.includes("online")
  );
  pushNamed(
    "Flipping Electronics",
    goal.includes("cash") || goal.includes("income") || goal.includes("fast")
  );
  pushNamed(
    "Airbnb Co-Hosting",
    signals.creditScore !== null ? signals.creditScore >= 640 : false
  );
  pushNamed(
    "Micro Equipment Rental",
    goal.includes("business") || goal.includes("asset")
  );
  pushNamed(
    "Drone Photography",
    goal.includes("creative") || goal.includes("real estate")
  );

  if (goal.includes("business") || goal.includes("funding") || goal.includes("entrepreneur")) {
    candidates.unshift({
      name: "Bookkeeping Or Back-Office Cleanup",
      description:
        "Business-minded income path that strengthens documentation habits and can support future funding readiness.",
      potentialEarnings: "$25-60/hour",
      timeCommitment: "5-15 hours/week",
      difficulty: "medium",
      category: "Business Services",
      startupCost: "Low",
      skills: ["Spreadsheets", "Organization", "Client Communication"],
      platforms: [{ name: "Upwork", url: "https://www.upwork.com" }],
    });
  }

  return dedupeByName(candidates).slice(0, 6);
}

export function buildBoostPackRoadmap(context: RecommendationContext): RoadmapStep[] {
  const signals = getCreditProfileSignals(context);
  const includeRent = signals.rentSignal;

  const steps: RoadmapStep[] = [
    {
      id: "boost-pack-activation",
      title: "Activate A Controlled Credit Boost Pack",
      description:
        "Open only the most useful credit-building accounts for your profile, set autopay immediately, and avoid stacking redundant applications in the same burst.",
      category: "Credit Health",
      priority: "High",
      status: "Pending",
      estimated_timeline_text: "Week 0-1",
      potential_impact_points: signals.creditScore !== null && signals.creditScore < 620 ? 20 : 10,
      detailed_sub_steps: [
        {
          id: "boost-pack-activation-1",
          title: "Turn on autopay before the first statement cuts",
          details:
            "A single late payment can erase progress. This step matters more than opening extra accounts.",
          completed: false,
        },
        {
          id: "boost-pack-activation-2",
          title: "Choose one installment builder and one safe revolving builder if appropriate",
          details:
            "Favor quality and reporting consistency over opening several similar accounts at once.",
          completed: false,
        },
      ],
      resources: [
        {
          id: "boost-pack-resource-self",
          name: "Review Credit Builder Loan Options",
          url: "https://www.self.inc/credit-builder-loan",
          description: "Installment credit-builder example",
          type: "tool",
        },
        {
          id: "boost-pack-resource-kikoff",
          name: "Review Kikoff Credit Account",
          url: "https://kikoff.com/credit-account",
          description: "Low-risk revolving tradeline example",
          type: "tool",
        },
      ],
    },
    {
      id: "boost-pack-reporting-check",
      title: "Monitor Reporting During The First 30-60 Days",
      description:
        "Once the first statement cycles, verify that new tradelines are reporting accurately and that your balances are still controlled.",
      category: "Credit Monitoring",
      priority: "High",
      status: "Pending",
      estimated_timeline_text: "Week 2-8",
      potential_impact_points: 10,
      detailed_sub_steps: [
        {
          id: "boost-pack-reporting-check-1",
          title: "Check bureau reporting after the first statement cycle",
          details:
            "Do not assume the account is helping until it actually appears and reports correctly.",
          completed: false,
        },
        {
          id: "boost-pack-reporting-check-2",
          title: "Keep utilization under 30%, ideally under 10%",
          details:
            "High balances can neutralize the benefits of new positive reporting.",
          completed: false,
        },
      ],
    },
    {
      id: "boost-pack-sequencing",
      title: "Sequence The Next Move Instead Of Chasing More Approvals",
      description:
        "After 60-90 days, reassess score, utilization, and negative items before deciding on secured cards, limit increases, or broader funding moves.",
      category: "Funding Readiness",
      priority: "Medium",
      status: "Pending",
      estimated_timeline_text: "Week 9-12",
      potential_impact_points: 8,
      detailed_sub_steps: [
        {
          id: "boost-pack-sequencing-1",
          title: "Avoid redundant same-month openings",
          details:
            "A cleaner file with measured sequencing usually beats a messy burst of extra accounts.",
          completed: false,
        },
      ],
    },
  ];

  if (includeRent) {
    steps.splice(1, 0, {
      id: "boost-pack-rent-reporting",
      title: "Add Rent Reporting If Your Housing Setup Supports It",
      description:
        "If your rent can be verified reliably, adding a housing tradeline may strengthen thin files without forcing another traditional card application.",
      category: "Credit Health",
      priority: "Medium",
      status: "Pending",
      estimated_timeline_text: "Week 1-4",
      potential_impact_points: 8,
      detailed_sub_steps: [
        {
          id: "boost-pack-rent-reporting-1",
          title: "Confirm landlord or portal verification",
          details:
            "Only rely on rent reporting if the provider can verify current or historical payment data cleanly.",
          completed: false,
        },
      ],
      resources: [
        {
          id: "boost-pack-resource-boom",
          name: "Review Boom Rent Reporting",
          url: "https://www.boompay.app/download",
          description: "Example rent reporting option",
          type: "tool",
        },
      ],
    });
  }

  return steps;
}

export function mergeRoadmapWithBoostPack(context: RecommendationContext): RoadmapData | null {
  const roadmap = context.roadmap;
  if (!roadmap) return null;

  const additions = buildBoostPackRoadmap(context);
  const existingTitles = new Set(
    (roadmap.steps || []).map((step) => step.title.trim().toLowerCase())
  );
  const mergedSteps = [
    ...additions.filter((step) => !existingTitles.has(step.title.trim().toLowerCase())),
    ...(roadmap.steps || []),
  ];

  return {
    ...roadmap,
    overview: roadmap.overview
      ? `${roadmap.overview}\n\nVestBlock Boost Pack note: use autopay, keep utilization disciplined, and favor quality tradelines over opening several redundant accounts at once.`
      : "VestBlock Boost Pack note: use autopay, keep utilization disciplined, and favor quality tradelines over opening several redundant accounts at once.",
    steps: mergedSteps,
  };
}

export function enrichCreditAnalysisResults(context: RecommendationContext) {
  const roadmap = mergeRoadmapWithBoostPack(context);
  const cards = buildCreditCardRecommendations(context);
  const sideHustles = buildSideHustleRecommendations(context);
  const signals = getCreditProfileSignals(context);

  const boostNoteParts = [
    "VestBlock Boost Pack:",
    "set autopay on every new builder account",
    "verify reporting after the first statement cycle",
    "keep utilization under 30% and ideally under 10%",
  ];
  if (signals.rentSignal) {
    boostNoteParts.push("review rent reporting if your payments can be verified");
  }

  return {
    roadmap,
    cards,
    sideHustles,
    boostSummaryNote: boostNoteParts.join("; ") + ".",
    creditScore: signals.creditScore,
  };
}
