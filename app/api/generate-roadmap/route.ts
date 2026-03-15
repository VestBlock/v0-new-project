import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createChatCompletion } from "@/lib/openai-service"
import type { FinancialGoal } from "@/components/financial-goals-selector" // Ensure path is correct
import type { RoadmapData } from "@/types/supabase" // Import new types

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

interface RoadmapGenerationRequest {
  creditScore: number | null
  financialGoal: FinancialGoal // This is the {id, title, description, customDetails} from client
  userId?: string // Optional: if you want to pass it explicitly
}

// Helper to identify business-related goals (customize keywords as needed)
function isBusinessGoal(goal: FinancialGoal): boolean {
  const businessKeywords = [
    "business",
    "startup",
    "company",
    "entrepreneur",
    "funding",
    "llc",
    "corporation",
    "side hustle scale-up",
  ]
  const title = goal.title.toLowerCase()
  const description = (goal.description || "").toLowerCase()
  const customDetails = (goal.customDetails || "").toLowerCase()

  return businessKeywords.some(
    (keyword) => title.includes(keyword) || description.includes(keyword) || customDetails.includes(keyword),
  )
}

function getDetailedRoadmapPrompt(creditScore: number | null, goal: FinancialGoal): string {
  const isBusiness = isBusinessGoal(goal)

  let prompt = `Generate a highly detailed and actionable financial roadmap for a user.
User's Primary Goal: "${goal.title}"
Goal Description: "${goal.description || "Not specified"}"
User's Custom Details for this Goal: "${goal.customDetails || "None provided"}"
`
  if (creditScore !== null) {
    prompt += `User's Current Estimated Credit Score: ${creditScore}. Factor this into the advice, especially for credit-related goals or funding.\n`
  } else {
    prompt += `User has not provided a credit score. Provide general advice or suggest they find out their score as a first step if relevant.\n`
  }

  prompt += `
The roadmap should be structured as a JSON object with the following keys:
1.  "overview": (string) A brief (2-3 sentences) strategic overview of the roadmap.
2.  "generated_for_goal_title": (string) The title of the goal this roadmap is for (e.g., "${goal.title}").
3.  "generated_for_goal_id": (string) The ID of the goal this roadmap is for (e.g., "${goal.id}").
4.  "steps": (array of 3-7 main step objects) Each step object MUST include:
    a.  "id": (string) A unique slug-like ID for the step (e.g., "build-emergency-fund").
    b.  "title": (string) Concise, action-oriented title (e.g., "Build an Emergency Fund").
    c.  "description": (string) 2-3 sentences explaining the importance and objective of this step. For complex topics, this can be longer.
    d.  "category": (string) Categorize the step (e.g., "Credit Health", "Savings & Budgeting", "Debt Management", "Business Foundation", "Legal & Compliance", "Business Planning", "Funding Strategy", "Financial Management (Business)", "Operations & Risk Management", "Investment Strategy", "Income Generation").
    e.  "priority": (string) "High", "Medium", or "Low".
    f.  "estimated_timeline_text": (string) Estimated time to complete (e.g., "1-2 weeks", "3-6 months", "Ongoing").
    g.  "potential_impact_points": (number, optional) For credit-related goals, estimate potential FICO score point increase (e.g., 10, 25). Omit if not applicable.
    h.  "detailed_sub_steps": (array of 2-7 sub-step objects) Each sub-step object MUST include:
        i.  "id": (string) A unique slug-like ID for the sub-step (e.g., "define-savings-target").
        ii. "title": (string) Actionable title for the sub-step.
        iii. "details": (string, optional) A comprehensive explanation, instructions, examples, or implications for the sub-step. This is where detailed guidance should go.
        iv. "completed": (boolean) Default to false.
    i.  "resources": (array of 0-5 resource objects, optional) Each resource object MUST include:
        i.  "id": (string) A unique slug-like ID for the resource (e.g., "experian-credit-article").
        ii. "name": (string) Name of the resource (e.g., "Experian Article on Credit Scores", "SBA Guide to Writing a Business Plan", "Sample Cash Flow Template Description").
        iii. "url": (string, optional) A valid URL if it's an online resource. Prefer .gov or reputable .org sites.
        iv. "description": (string, optional) Brief description of the resource or what the user can find/learn there. If it's a template, describe what it covers.
        v.  "type": (string, optional) Type of resource (e.g., "article", "tool", "video", "government_resource", "template_guidance", "checklist").
`

  if (isBusiness) {
    prompt += `
--- SPECIFIC INSTRUCTIONS FOR BUSINESS GOAL ---
Given the user's goal is business-related, ensure the roadmap steps comprehensively cover the following areas. Create dedicated steps or integrate these details thoroughly into relevant steps:

A.  BUSINESS STRUCTURING & SETUP:
    1.  Detailed Guidance: Explain common business structures (Sole Proprietorship, Partnership, LLC, S-Corp, C-Corp).
    2.  Implications: For each structure, discuss liability, taxation, administrative burden, and ability to raise capital.
    3.  Actionable Steps: Provide sub-steps for choosing a structure, registering the business (e.g., name, state registration, EIN).
    4.  Example: For an LLC, sub-steps like "Choose a Registered Agent," "File Articles of Organization," "Create an Operating Agreement."
    5.  Resources: Suggest links to SBA guides on structures, state-specific registration portals, or information on operating agreements.

B.  BUSINESS PLAN & FUNDING PREPARATION:
    1.  Business Plan: Detail key sections of a business plan (Executive Summary, Company Description, Market Analysis, Organization & Management, Products/Services, Marketing & Sales Strategy, Financial Projections, Funding Request).
    2.  Funding-Focused Structure: Explain how a clear business structure and plan make the business more attractive to lenders/investors. Address how to structure the business to be fundable (e.g., clear ownership, good records).
    3.  Funding Options: Describe various funding sources (SBA loans, bank loans, angel investors, venture capital, crowdfunding, grants). For each, outline typical requirements, pros, and cons.
    4.  Actionable Steps: Sub-steps for drafting each section of the business plan, researching funding options, preparing a pitch deck.
    5.  Resources: Links to SBA business plan templates, SCORE mentorship, crowdfunding platforms, angel investor networks.

C.  BUSINESS FINANCIAL MANAGEMENT:
    1.  Setup: Importance of separate business bank accounts and credit cards. Steps to open them.
    2.  Bookkeeping: Basic bookkeeping practices, options for software (e.g., QuickBooks, Xero, Wave) or hiring a bookkeeper.
    3.  Cash Flow: Explain cash flow management, creating projections, and strategies for maintaining healthy cash flow.
    4.  Financial Statements: Basic understanding of Profit & Loss, Balance Sheet, and Cash Flow Statement.
    5.  Actionable Steps: Sub-steps for opening accounts, choosing bookkeeping method, creating a simple cash flow forecast.
    6.  Resources: Links to articles on business banking, bookkeeping guides, cash flow template descriptions.

D.  OPERATIONAL BEST PRACTICES & DISPUTE PROTECTION:
    1.  Documentation: Emphasize meticulous record-keeping for all transactions (invoices, receipts, contracts).
    2.  Contracts: Basics of using contracts for services, sales, and with vendors. Key clauses to include.
    3.  Dispute Resolution: Strategies for handling disputes with customers (e.g., clear return policies, customer service protocols) and vendors (e.g., communication, contract review).
    4.  Actionable Steps: Sub-steps for setting up a filing system, finding basic contract templates, drafting customer service policies.
    5.  Resources: Links to articles on small business contracts, dispute resolution techniques, or consumer protection agencies.

Ensure these business-specific details are woven into the "detailed_sub_steps.details" and "resources" sections effectively. The goal is to provide a comprehensive, actionable guide.
--- END OF BUSINESS SPECIFIC INSTRUCTIONS ---
`
  }

  prompt += `
Constraints & Focus:
-   Prioritize actionable advice. Provide specific examples where possible.
-   If credit score is low and goal is funding-related, initial steps MUST address credit improvement.
-   Ensure all string fields are well-written, clear, and encouraging.
-   The entire response MUST be a single, valid JSON object. Do NOT include any markdown formatting (like \`\`\`) or conversational text outside the JSON structure.
-   Generate unique and descriptive IDs for steps, sub-steps, and resources.

Example of a "steps" array item (general, adapt for business content as per above):
{
  "id": "improve-credit-utilization",
  "title": "Improve Credit Utilization Ratio",
  "description": "Lowering your credit utilization ratio by paying down balances or increasing credit limits can significantly boost your credit score.",
  "category": "Credit Health",
  "priority": "High",
  "estimated_timeline_text": "1-3 months",
  "potential_impact_points": 30,
  "detailed_sub_steps": [
    { "id": "list-cards-balances", "title": "List all credit cards, balances, and limits", "details": "Create a spreadsheet to track this information. This helps visualize where your debt is concentrated.", "completed": false },
    { "id": "target-high-utilization-cards", "title": "Prioritize paying down cards over 30% utilization", "details": "Focus on getting individual card utilization below 30%, then overall utilization. High utilization on even one card can negatively impact your score.", "completed": false }
  ],
  "resources": [
    { "id": "nerdwallet-utilization-guide", "name": "NerdWallet: What Is Credit Utilization?", "url": "https://www.nerdwallet.com/article/finance/what-is-credit-utilization-and-how-to-improve-it", "description": "Comprehensive guide on credit utilization and its impact.", "type": "article" }
  ]
}
`
  return prompt
}

function cleanJsonResponse(jsonString: string): string {
  // Remove Markdown code block fences (\`\`\`json ... \`\`\` or just \`\`\` ... \`\`\`)
  let cleaned = jsonString.replace(/^```json\s*/, "").replace(/```$/, "")
  cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "") // For cases without 'json' specified

  // Trim whitespace
  cleaned = cleaned.trim()
  return cleaned
}

export async function POST(req: Request) {
  try {
    const { creditScore, financialGoal, userId: clientUserId } = (await req.json()) as RoadmapGenerationRequest

    // User ID handling (ensure you have a robust way to get the authenticated user's ID)
    // const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(); // Example using Supabase auth
    // const userId = authUser?.id || clientUserId;
    // if (!userId) {
    //   return NextResponse.json({ error: "User authentication is required." }, { status: 401 });
    // }
    // For now, assuming userId will be handled if saving to DB is implemented.

    if (!financialGoal || !financialGoal.id || !financialGoal.title) {
      return NextResponse.json({ error: "Financial goal with id and title is required." }, { status: 400 })
    }

    const prompt = getDetailedRoadmapPrompt(creditScore, financialGoal)

    const aiResponse = await createChatCompletion(
      [
        {
          role: "system",
          content:
            "You are a meticulous financial planning assistant. Your sole output MUST be a valid JSON object adhering to the user's specified schema. Do not include any explanatory text, apologies, or markdown formatting outside of the JSON structure itself. Pay close attention to requests for detailed business guidance if the user's goal is business-related.",
        },
        { role: "user", content: prompt },
      ],
      false, // Not streaming for this
      { temperature: 0.2, model: "gpt-4o" }, // Lower temperature for more predictable JSON, gpt-4o for complexity
    )

    if (typeof aiResponse === "string" || !("choices" in aiResponse)) {
      console.error("Invalid AI response format (not a CompletionResponse):", aiResponse)
      throw new Error("Invalid AI response format for roadmap generation.")
    }

    const roadmapJsonString = aiResponse.choices[0]?.message?.content
    if (!roadmapJsonString) {
      console.error("AI did not return any content in choices[0].message.content")
      throw new Error("AI did not return roadmap content.")
    }

    const cleanedJsonString = cleanJsonResponse(roadmapJsonString)
    let roadmapDataParsed: RoadmapData

    try {
      roadmapDataParsed = JSON.parse(cleanedJsonString)
      if (!roadmapDataParsed.steps || !Array.isArray(roadmapDataParsed.steps) || !roadmapDataParsed.overview) {
        console.error("AI response JSON is missing required fields (steps, overview):", cleanedJsonString)
        throw new Error("AI response JSON is not in the expected format (missing steps array or overview).")
      }
      // Ensure goal identifiers are present
      roadmapDataParsed.generated_for_goal_title = roadmapDataParsed.generated_for_goal_title || financialGoal.title
      roadmapDataParsed.generated_for_goal_id = roadmapDataParsed.generated_for_goal_id || financialGoal.id
    } catch (e: any) {
      console.error("Failed to parse AI response JSON for roadmap:", e.message)
      console.error("Raw AI response string (after cleaning attempt):", cleanedJsonString)
      console.error("Original AI response string from API:", roadmapJsonString)
      // Include more details from the error object if available
      const errorMessage = e.message || "Unknown parsing error."
      const errorStack = e.stack || "No stack trace available."
      console.error(`Parse Error Details: ${errorMessage}\nStack: ${errorStack}`)
      throw new Error(`AI returned invalid JSON for the roadmap. Parse error: ${errorMessage}`)
    }

    // TODO: Implement saving the generated roadmap to `user_roadmaps` table
    // const { data: savedRoadmap, error: saveError } = await supabaseAdmin
    //   .from("user_roadmaps")
    //   .insert({
    //     user_id: userId, // Actual authenticated user ID
    //     financial_goal_id: financialGoal.id,
    //     financial_goal_title: financialGoal.title,
    //     financial_goal_custom_details: financialGoal.customDetails,
    //     credit_score_at_generation: creditScore,
    //     roadmap_data: roadmapDataParsed,
    //     // is_primary: true // if this is for their main profile goal
    //   })
    //   .select()
    //   .single();
    // if (saveError) {
    //   console.error("Error saving roadmap to DB:", saveError);
    //   throw new Error(`Failed to save the generated roadmap: ${saveError.message}`);
    // }
    // return NextResponse.json(savedRoadmap);

    // For now, returning the parsed data directly, wrapped as expected by the client
    return NextResponse.json({ roadmap_data: roadmapDataParsed })
  } catch (error: any) {
    console.error("[API generate-roadmap] Error:", error.message, error.stack)
    const responseError = {
      message: error.message || "Failed to generate roadmap.",
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }), // Include stack in dev
    }
    return NextResponse.json({ error: responseError }, { status: 500 })
  }
}
