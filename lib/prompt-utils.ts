export interface ComprehensiveAnalysisPromptInput {
  extractedText: string
  userFinancialGoal?: string // e.g., "Improve credit score", "Buy a house"
  userContext?: string // Any other relevant context from the user
}

export function getComprehensiveAnalysisPrompt({
  extractedText,
  userFinancialGoal,
  userContext,
}: ComprehensiveAnalysisPromptInput): string {
  const prompt = `Analyze the following credit report text thoroughly.
The user's primary financial goal is: "${userFinancialGoal || "Not specified, provide general advice"}".
${userContext ? `Additional user context: "${userContext}"` : ""}

Credit Report Text:
---
${extractedText}
---

Based on the report and the user's goal, provide a comprehensive analysis including:
1.  **Overall Summary:** A brief overview of the credit report's health.
2.  **Credit Score Factors:** Identify key positive and negative factors impacting the credit score. If a score is present, comment on it.
3.  **Negative Items Analysis:** List all negative items (late payments, collections, charge-offs, bankruptcies, liens, judgments). For each, provide:
    *   Type of item
    *   Creditor/Furnisher
    *   Reported Date & Amount (if available)
    *   Actionable advice (e.g., dispute, pay, negotiate).
4.  **Credit Utilization Analysis:** Analyze overall and per-card credit utilization. Provide recommendations to optimize it.
5.  **Account Age & Mix:** Comment on the age of accounts and mix of credit.
6.  **Inquiries:** List recent hard inquiries and their potential impact.
7.  **Public Records:** Detail any public records and their implications.
8.  **Actionable Roadmap:** A step-by-step plan to address issues and achieve the user's financial goal. Prioritize steps.
9.  **Credit Card / Credit Builder Recommendations:** Suggest 3-5 realistic products or readiness moves based on the user's profile. For lower scores, thin files, or rebuilding situations, you may include credit builder loans, low-risk tradelines, rent reporting, secured cards, or alternative-underwriting cards. Avoid premium-card fantasy recommendations that do not fit the profile.
10. **Side Hustle Ideas:** Suggest 3-4 relevant income ideas that could help the user improve their financial situation, considering startup cost, time, and how quickly the idea could help support debt payoff, autopay stability, or savings.
11. **Boost Pack Logic:** If the profile is rebuilding or thin, mention a practical 30-90 day positive-history strategy: autopay, one installment builder if appropriate, one safe revolving builder if appropriate, low utilization, reporting checks, and rent reporting only if the user appears to be a renter. Do not promise score gains or approvals.

Important:
- Do not guarantee approvals, score increases, or exact funding results.
- Do not suggest opening many redundant accounts at once.
- Do not invent missing facts.
- Keep recommendations conservative and practical.

Format the output as a JSON object with the following structure and EXACT top-level keys:
{
  "summary": "string",
  "detailedAnalysis": {
    "overall_summary": "string",
    "credit_score_analysis": { "score": "number | null", "bureau": "string | null", "positive_factors": ["string"], "negative_factors": ["string"] },
    "negative_items": [{ "type": "string", "creditor": "string", "details": "string", "recommendation": "string" }],
    "utilization_analysis": { "overall_ratio_percent": "number | null", "card_details": [{ "name": "string", "ratio_percent": "number | null", "recommendation": "string" }] },
    "account_age_and_mix_analysis": { "average_age_years": "number | null", "oldest_account_years": "number | null", "credit_mix_assessment": "string", "recommendation": "string" },
    "inquiries_analysis": [{ "creditor": "string", "date": "string", "impact_assessment": "string" }],
    "public_records_analysis": [{ "type": "string", "details": "string", "recommendation": "string" }]
  },
  "roadmap": {
    "overview": "string",
    "steps": [
      { "id": "string", "title": "string", "description": "string", "category": "string", "priority": "High | Medium | Low", "status": "Pending", "estimated_timeline_text": "string", "potential_impact_points": "number | null", "detailed_sub_steps": [{ "id": "string", "title": "string", "details": "string", "completed": false }], "resources": [{ "id": "string", "name": "string", "url": "string", "description": "string", "type": "article | tool" }] }
    ]
  },
  "creditCardRecommendations": [
    {
      "name": "string",
      "description": "string",
      "bestFor": "string",
      "minimumCredit": "string",
      "link": "string",
      "annualFee": "string",
      "category": "string",
      "features": ["string"],
      "featured": false
    }
  ],
  "sideHustleRecommendations": [
    {
      "name": "string",
      "description": "string",
      "potentialEarnings": "string",
      "timeCommitment": "string",
      "difficulty": "easy | medium | hard",
      "category": "string",
      "startupCost": "string",
      "skills": ["string"],
      "platforms": [{ "name": "string", "url": "string" }]
    }
  ]
}

Ensure all string fields provide detailed and helpful information. The roadmap should be practical and tailored.
If the text does not appear to be a credit report, state that clearly in the overall_summary and avoid fabricating analysis.
`
  return prompt
}
