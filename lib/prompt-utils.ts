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
9.  **Credit Card Recommendations:** Suggest 2-3 suitable credit cards (if applicable) based on the user's profile and goals (e.g., for building credit, rewards, balance transfer). Include brief reasoning.
10. **Side Hustle Ideas:** Suggest 2-3 relevant side hustle ideas that could help the user improve their financial situation, considering potential income and effort.

Format the output as a JSON object with the following structure:
{
  "overall_summary": "string",
  "credit_score_analysis": { "score": "number | null", "bureau": "string | null", "positive_factors": ["string"], "negative_factors": ["string"] },
  "negative_items": [{ "type": "string", "creditor": "string", "details": "string", "recommendation": "string" }],
  "utilization_analysis": { "overall_ratio_percent": "number | null", "card_details": [{ "name": "string", "ratio_percent": "number | null", "recommendation": "string" }] },
  "account_age_and_mix_analysis": { "average_age_years": "number | null", "oldest_account_years": "number | null", "credit_mix_assessment": "string", "recommendation": "string" },
  "inquiries_analysis": [{ "creditor": "string", "date": "string", "impact_assessment": "string" }],
  "public_records_analysis": [{ "type": "string", "details": "string", "recommendation": "string" }],
  "actionable_roadmap_data": { // This should conform to your RoadmapData interface structure
    "overview": "string",
    "steps": [
      { "id": "string", "title": "string", "description": "string", "category": "string", "priority": "High | Medium | Low", "status": "Pending", "estimated_timeline_text": "string", "potential_impact_points": "number | null", "detailed_sub_steps": [{ "id": "string", "title": "string", "details": "string", "completed": false }], "resources": [{ "id": "string", "name": "string", "url": "string", "description": "string", "type": "article | tool" }] }
    ]
  },
  "ai_credit_card_recommendations": [{ "name": "string", "description": "string", "bestFor": "string", "minimumCredit": "string", "link": "string" }],
  "ai_side_hustle_recommendations": [{ "name": "string", "description": "string", "potentialEarnings": "string", "timeCommitment": "string", "difficulty": "easy | medium | hard" }]
}

Ensure all string fields provide detailed and helpful information. The roadmap should be practical and tailored.
If the text does not appear to be a credit report, state that clearly in the overall_summary and avoid fabricating analysis.
`
  return prompt
}
