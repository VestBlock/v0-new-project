"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Target,
  TrendingUp,
  Home,
  Building,
  CreditCard,
  DollarSign,
  Search,
  Filter,
  CheckCircle,
  Star,
  Lightbulb,
} from "lucide-react"

interface RoadmapStep {
  title: string
  description: string
  duration: string
  tasks: string[]
  tips: string[]
  completed?: boolean
}

interface PremadeRoadmap {
  id: string
  title: string
  description: string
  category: "credit-repair" | "business" | "real-estate" | "personal"
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  duration: string
  creditScoreRange: string
  icon: React.ReactNode
  steps: RoadmapStep[]
  featured?: boolean
}

const premadeRoadmaps: PremadeRoadmap[] = [
  {
    id: "credit-repair-beginner",
    title: "Credit Repair for Beginners",
    description: "Complete step-by-step guide to repair your credit from scratch",
    category: "credit-repair",
    difficulty: "Beginner",
    duration: "6-12 months",
    creditScoreRange: "300-650",
    icon: <TrendingUp className="h-6 w-6" />,
    featured: true,
    steps: [
      {
        title: "Phase 1: Credit Report Analysis",
        description: "Get your credit reports and identify all negative items",
        duration: "Week 1-2",
        tasks: [
          "Order free credit reports from all 3 bureaus",
          "Review each report line by line",
          "Identify inaccurate, outdated, or unverifiable items",
          "Create a spreadsheet to track all negative items",
          "Take screenshots of all negative items",
        ],
        tips: [
          "Use AnnualCreditReport.com for free reports",
          "Look for accounts that aren't yours",
          "Check for duplicate accounts",
          "Verify all personal information is correct",
        ],
      },
      {
        title: "Phase 2: Dispute Preparation",
        description: "Prepare and send dispute letters for inaccurate items",
        duration: "Week 3-4",
        tasks: [
          "Draft dispute letters for each inaccurate item",
          "Gather supporting documentation",
          "Send disputes via certified mail",
          "Create a tracking system for responses",
          "Follow up on any non-responses after 30 days",
        ],
        tips: [
          "Be specific about what you're disputing",
          "Keep copies of all correspondence",
          "Use certified mail with return receipt",
          "Don't dispute too many items at once",
        ],
      },
      {
        title: "Phase 3: Debt Validation",
        description: "Validate debts with collection agencies",
        duration: "Month 2-3",
        tasks: [
          "Send debt validation letters to all collectors",
          "Request proof of debt ownership",
          "Challenge any debts without proper validation",
          "Negotiate pay-for-delete agreements",
          "Get all agreements in writing",
        ],
        tips: [
          "Send validation requests within 30 days of first contact",
          "Don't admit to owing the debt",
          "Request original creditor information",
          "Negotiate before paying anything",
        ],
      },
      {
        title: "Phase 4: Credit Building",
        description: "Start building positive credit history",
        duration: "Month 3-6",
        tasks: [
          "Apply for a secured credit card",
          "Become an authorized user on family member's account",
          "Apply for a credit builder loan",
          "Set up automatic payments for all accounts",
          "Keep credit utilization below 10%",
        ],
        tips: [
          "Start with secured cards if needed",
          "Pay balances in full every month",
          "Use cards regularly but keep balances low",
          "Monitor your credit score monthly",
        ],
      },
      {
        title: "Phase 5: Score Optimization",
        description: "Optimize your credit score for maximum improvement",
        duration: "Month 6-9",
        tasks: [
          "Optimize credit utilization across all cards",
          "Request credit limit increases",
          "Pay down existing balances strategically",
          "Add more positive accounts if needed",
          "Monitor credit reports for new negative items",
        ],
        tips: [
          "Keep total utilization under 10%",
          "Pay balances before statement dates",
          "Don't close old accounts",
          "Space out new applications",
        ],
      },
      {
        title: "Phase 6: Maintenance & Growth",
        description: "Maintain good credit and continue building",
        duration: "Month 9-12",
        tasks: [
          "Continue monitoring credit reports monthly",
          "Maintain low credit utilization",
          "Add new credit accounts strategically",
          "Build emergency fund to avoid debt",
          "Plan for major purchases with good credit",
        ],
        tips: [
          "Set up credit monitoring alerts",
          "Review credit reports quarterly",
          "Keep building positive payment history",
          "Use credit responsibly for rewards",
        ],
      },
    ],
  },
  {
    id: "business-credit-scratch",
    title: "Build Business Credit from Scratch",
    description: "Establish and build business credit without personal guarantees",
    category: "business",
    difficulty: "Intermediate",
    duration: "12-18 months",
    creditScoreRange: "Any",
    icon: <Building className="h-6 w-6" />,
    steps: [
      {
        title: "Phase 1: Business Foundation",
        description: "Establish proper business structure and documentation",
        duration: "Month 1",
        tasks: [
          "Choose and register business name",
          "Obtain Federal EIN from IRS",
          "Register business with state",
          "Open business bank account",
          "Get business phone number and address",
        ],
        tips: [
          "Choose a professional business name",
          "Use a business address, not home address",
          "Get a dedicated business phone line",
          "Keep business and personal finances separate",
        ],
      },
      {
        title: "Phase 2: Business Credit Profile",
        description: "Create business credit profiles with major bureaus",
        duration: "Month 2-3",
        tasks: [
          "Register with Dun & Bradstreet",
          "Create Experian Business profile",
          "Set up Equifax Business profile",
          "Verify business information is accurate",
          "Monitor business credit reports",
        ],
        tips: [
          "Ensure NAP (Name, Address, Phone) consistency",
          "Add business description and industry codes",
          "Upload business documents for verification",
          "Check for duplicate listings",
        ],
      },
      {
        title: "Phase 3: Starter Business Credit",
        description: "Apply for initial business credit accounts",
        duration: "Month 3-6",
        tasks: [
          "Apply for business credit cards (Amex, Chase)",
          "Open accounts with office supply stores",
          "Get net terms accounts with vendors",
          "Apply for gas station business cards",
          "Establish utility accounts in business name",
        ],
        tips: [
          "Start with cards that don't require personal guarantee",
          "Use business credit cards for business expenses only",
          "Pay all accounts on time or early",
          "Keep utilization low on credit cards",
        ],
      },
      {
        title: "Phase 4: Trade Lines & Vendors",
        description: "Build relationships with net terms vendors",
        duration: "Month 6-9",
        tasks: [
          "Apply for net 30 terms with 10+ vendors",
          "Make purchases and pay on time",
          "Request credit limit increases",
          "Add more vendor accounts monthly",
          "Ensure vendors report to business bureaus",
        ],
        tips: [
          "Start with smaller orders to build trust",
          "Pay invoices early when possible",
          "Ask vendors to report to credit bureaus",
          "Keep detailed records of all payments",
        ],
      },
      {
        title: "Phase 5: Credit Line Growth",
        description: "Graduate to larger credit lines and term loans",
        duration: "Month 9-15",
        tasks: [
          "Apply for larger business credit cards",
          "Request credit limit increases on existing accounts",
          "Apply for business lines of credit",
          "Consider equipment financing if needed",
          "Build banking relationships",
        ],
        tips: [
          "Show consistent revenue and cash flow",
          "Maintain strong business credit scores",
          "Use credit responsibly and pay on time",
          "Build relationships with business bankers",
        ],
      },
      {
        title: "Phase 6: Advanced Business Funding",
        description: "Access larger funding without personal guarantees",
        duration: "Month 15-18",
        tasks: [
          "Apply for SBA loans if qualified",
          "Explore asset-based lending options",
          "Consider invoice factoring for cash flow",
          "Build relationships with private lenders",
          "Maintain and optimize business credit profile",
        ],
        tips: [
          "Keep business financials organized",
          "Maintain strong business credit scores",
          "Document business growth and success",
          "Network with other business owners",
        ],
      },
    ],
  },
  {
    id: "home-buyer-credit",
    title: "First-Time Home Buyer's Credit Roadmap",
    description: "Optimize your credit for the best mortgage rates and terms",
    category: "real-estate",
    difficulty: "Intermediate",
    duration: "12-24 months",
    creditScoreRange: "580-750",
    icon: <Home className="h-6 w-6" />,
    featured: true,
    steps: [
      {
        title: "Phase 1: Credit Assessment",
        description: "Evaluate current credit and set mortgage goals",
        duration: "Month 1",
        tasks: [
          "Pull credit reports from all 3 bureaus",
          "Calculate debt-to-income ratio",
          "Determine target credit score for best rates",
          "Identify credit issues to address",
          "Set timeline for home purchase",
        ],
        tips: [
          "Aim for 740+ credit score for best rates",
          "Keep DTI below 43% for most loans",
          "Consider FHA loans if credit is below 620",
          "Factor in down payment requirements",
        ],
      },
      {
        title: "Phase 2: Debt Reduction Strategy",
        description: "Pay down existing debts strategically",
        duration: "Month 2-6",
        tasks: [
          "List all debts by balance and interest rate",
          "Create debt payoff plan (avalanche or snowball)",
          "Pay down credit card balances to below 10%",
          "Avoid closing old credit accounts",
          "Don't take on new debt",
        ],
        tips: [
          "Focus on high-utilization accounts first",
          "Pay balances before statement dates",
          "Consider balance transfers if beneficial",
          "Keep old accounts open for credit history",
        ],
      },
      {
        title: "Phase 3: Credit Optimization",
        description: "Optimize credit utilization and payment history",
        duration: "Month 6-12",
        tasks: [
          "Keep credit utilization below 10% on all cards",
          "Set up automatic payments for all accounts",
          "Request credit limit increases",
          "Dispute any remaining negative items",
          "Monitor credit scores monthly",
        ],
        tips: [
          "Pay balances multiple times per month if needed",
          "Use credit cards for small purchases only",
          "Don't apply for new credit during this phase",
          "Keep utilization low across all cards",
        ],
      },
      {
        title: "Phase 4: Pre-Approval Preparation",
        description: "Prepare for mortgage pre-approval process",
        duration: "Month 12-18",
        tasks: [
          "Gather all financial documents",
          "Save for down payment and closing costs",
          "Research mortgage lenders and rates",
          "Get pre-qualified with multiple lenders",
          "Lock in interest rate when ready",
        ],
        tips: [
          "Shop for mortgages within 14-45 day window",
          "Compare rates, fees, and terms",
          "Get pre-approval letter before house hunting",
          "Don't make major financial changes during process",
        ],
      },
      {
        title: "Phase 5: House Hunting",
        description: "Find and purchase your home",
        duration: "Month 18-24",
        tasks: [
          "Work with qualified real estate agent",
          "Stay within pre-approved budget",
          "Get home inspection and appraisal",
          "Finalize mortgage application",
          "Close on your new home",
        ],
        tips: [
          "Don't exceed your budget",
          "Factor in all homeownership costs",
          "Review all closing documents carefully",
          "Keep credit stable until closing",
        ],
      },
      {
        title: "Phase 6: Post-Purchase Credit Management",
        description: "Maintain good credit after home purchase",
        duration: "Ongoing",
        tasks: [
          "Continue making all payments on time",
          "Monitor credit for any changes",
          "Build emergency fund for home expenses",
          "Consider refinancing if rates drop",
          "Plan for future home improvements",
        ],
        tips: [
          "Keep mortgage payments current",
          "Maintain good credit for future needs",
          "Build equity through payments and improvements",
          "Consider home equity loans for improvements",
        ],
      },
    ],
  },
  {
    id: "debt-freedom-plan",
    title: "Complete Debt Freedom Plan",
    description: "Systematic approach to eliminate all debt and build wealth",
    category: "personal",
    difficulty: "Intermediate",
    duration: "24-36 months",
    creditScoreRange: "Any",
    icon: <DollarSign className="h-6 w-6" />,
    steps: [
      {
        title: "Phase 1: Debt Inventory & Budget",
        description: "List all debts and create a realistic budget",
        duration: "Month 1",
        tasks: [
          "List all debts with balances, rates, and payments",
          "Calculate total debt and monthly obligations",
          "Create detailed monthly budget",
          "Identify areas to cut expenses",
          "Set up debt tracking system",
        ],
        tips: [
          "Include all debts: credit cards, loans, mortgages",
          "Use apps or spreadsheets to track progress",
          "Be honest about your spending habits",
          "Find ways to increase income if possible",
        ],
      },
      {
        title: "Phase 2: Emergency Fund",
        description: "Build starter emergency fund before debt payoff",
        duration: "Month 2-3",
        tasks: [
          "Save $1,000 starter emergency fund",
          "Open separate high-yield savings account",
          "Cut unnecessary expenses temporarily",
          "Use windfalls for emergency fund",
          "Don't touch fund unless true emergency",
        ],
        tips: [
          "Start with small amounts if needed",
          "Sell items you don't need",
          "Take on extra work temporarily",
          "Keep fund in separate account",
        ],
      },
      {
        title: "Phase 3: Debt Payoff Strategy",
        description: "Choose and implement debt payoff method",
        duration: "Month 3-24",
        tasks: [
          "Choose debt avalanche or snowball method",
          "Make minimum payments on all debts",
          "Put extra money toward target debt",
          "Celebrate each debt paid off",
          "Don't take on new debt",
        ],
        tips: [
          "Avalanche saves more money (highest interest first)",
          "Snowball provides more motivation (smallest balance first)",
          "Stay consistent with your chosen method",
          "Find ways to increase payments when possible",
        ],
      },
      {
        title: "Phase 4: Income Optimization",
        description: "Increase income to accelerate debt payoff",
        duration: "Month 6-18",
        tasks: [
          "Ask for raise or promotion at work",
          "Start side hustle or freelance work",
          "Sell unused items and possessions",
          "Consider part-time job temporarily",
          "Use all extra income for debt payoff",
        ],
        tips: [
          "Focus on skills you already have",
          "Use online platforms for side work",
          "Automate extra payments to avoid temptation",
          "Track income increases and apply to debt",
        ],
      },
      {
        title: "Phase 5: Final Debt Elimination",
        description: "Pay off remaining debts and celebrate freedom",
        duration: "Month 18-30",
        tasks: [
          "Maintain momentum as debts decrease",
          "Apply payments from paid-off debts to remaining ones",
          "Consider debt consolidation if beneficial",
          "Make final payments on all debts",
          "Celebrate your debt-free achievement",
        ],
        tips: [
          "Don't slow down as you get close",
          "Avoid lifestyle inflation during payoff",
          "Keep emergency fund intact",
          "Plan celebration that doesn't involve debt",
        ],
      },
      {
        title: "Phase 6: Wealth Building",
        description: "Build wealth and maintain debt-free lifestyle",
        duration: "Month 30+",
        tasks: [
          "Build full emergency fund (3-6 months expenses)",
          "Start investing for retirement",
          "Save for major goals (house, car, vacation)",
          "Use credit responsibly if needed",
          "Continue monitoring and budgeting",
        ],
        tips: [
          "Pay yourself first with automatic savings",
          "Invest in low-cost index funds",
          "Only use credit if you can pay in full",
          "Maintain the habits that got you debt-free",
        ],
      },
    ],
  },
  {
    id: "premium-credit-cards",
    title: "Qualify for Premium Credit Cards",
    description: "Build credit profile to qualify for the best rewards cards",
    category: "credit-repair",
    difficulty: "Advanced",
    duration: "18-24 months",
    creditScoreRange: "650-800+",
    icon: <CreditCard className="h-6 w-6" />,
    steps: [
      {
        title: "Phase 1: Credit Foundation Review",
        description: "Assess current credit and set premium card goals",
        duration: "Month 1-2",
        tasks: [
          "Pull credit reports and scores from all bureaus",
          "Research target premium cards and requirements",
          "Calculate current credit utilization",
          "Identify any remaining negative items",
          "Set timeline for applications",
        ],
        tips: [
          "Target cards with benefits you'll actually use",
          "Most premium cards require 700+ credit scores",
          "Consider annual fees vs. benefits",
          "Research current sign-up bonuses",
        ],
      },
      {
        title: "Phase 2: Credit Score Optimization",
        description: "Optimize credit scores for premium card approval",
        duration: "Month 2-8",
        tasks: [
          "Pay down all credit card balances to under 10%",
          "Request credit limit increases on existing cards",
          "Pay balances before statement dates",
          "Dispute any remaining negative items",
          "Monitor scores across all three bureaus",
        ],
        tips: [
          "Aim for under 5% utilization for best scores",
          "Pay multiple times per month if needed",
          "Don't close old accounts",
          "Use AZEO method (All Zero Except One)",
        ],
      },
      {
        title: "Phase 3: Banking Relationships",
        description: "Build relationships with premium card issuers",
        duration: "Month 6-12",
        tasks: [
          "Open checking/savings with target banks",
          "Use bank services and maintain balances",
          "Apply for starter cards with target issuers",
          "Build payment history with each issuer",
          "Consider business banking relationships",
        ],
        tips: [
          "Chase, Amex, and Citi have best premium cards",
          "Maintain higher balances for private client status",
          "Use bank services beyond just credit cards",
          "Build 6-12 months history before premium applications",
        ],
      },
      {
        title: "Phase 4: Income Documentation",
        description: "Prepare income documentation for applications",
        duration: "Month 12-15",
        tasks: [
          "Gather tax returns and pay stubs",
          "Document all income sources",
          "Consider ways to increase reported income",
          "Organize financial documents",
          "Practice application process",
        ],
        tips: [
          "Include all legitimate income sources",
          "Household income may be acceptable",
          "Keep documentation current and organized",
          "Be honest but maximize legitimate income",
        ],
      },
      {
        title: "Phase 5: Strategic Applications",
        description: "Apply for premium cards strategically",
        duration: "Month 15-20",
        tasks: [
          "Apply for cards in order of preference",
          "Space applications 2-3 months apart",
          "Meet minimum spending requirements",
          "Activate and use cards responsibly",
          "Monitor credit after each application",
        ],
        tips: [
          "Apply for most desired cards first",
          "Have plan to meet spending requirements",
          "Don't manufacture spending unnecessarily",
          "Keep utilization low on new cards",
        ],
      },
      {
        title: "Phase 6: Portfolio Management",
        description: "Manage premium card portfolio for maximum value",
        duration: "Month 20-24+",
        tasks: [
          "Optimize spending across different cards",
          "Track and redeem rewards regularly",
          "Monitor annual fee value propositions",
          "Consider product changes or upgrades",
          "Maintain excellent payment history",
        ],
        tips: [
          "Use each card for its bonus categories",
          "Don't let rewards expire",
          "Evaluate annual fees annually",
          "Consider downgrading if benefits don't justify fees",
        ],
      },
    ],
  },
  {
    id: "real-estate-investment",
    title: "Real Estate Investment Credit Strategy",
    description: "Build credit profile for real estate investment financing",
    category: "real-estate",
    difficulty: "Advanced",
    duration: "24-36 months",
    creditScoreRange: "680-800+",
    icon: <Target className="h-6 w-6" />,
    steps: [
      {
        title: "Phase 1: Investment Planning",
        description: "Plan real estate investment strategy and financing needs",
        duration: "Month 1-3",
        tasks: [
          "Define investment goals and strategy",
          "Research target markets and properties",
          "Calculate financing needs and down payments",
          "Assess current credit and financial position",
          "Create investment timeline",
        ],
        tips: [
          "Start with clear investment goals",
          "Consider different property types and strategies",
          "Factor in all costs, not just purchase price",
          "Build relationships with real estate professionals",
        ],
      },
      {
        title: "Phase 2: Credit Profile Enhancement",
        description: "Optimize credit for investment property loans",
        duration: "Month 3-12",
        tasks: [
          "Increase credit scores to 740+ for best rates",
          "Build business credit profile if applicable",
          "Increase credit limits and available credit",
          "Maintain low utilization across all accounts",
          "Document stable income and employment",
        ],
        tips: [
          "Investment property loans require higher scores",
          "Consider business credit for multiple properties",
          "Maintain 6+ months reserves for each property",
          "Keep debt-to-income ratio manageable",
        ],
      },
      {
        title: "Phase 3: Down Payment & Reserves",
        description: "Build capital for down payments and reserves",
        duration: "Month 6-18",
        tasks: [
          "Save for 20-25% down payments",
          "Build 6 months reserves per property",
          "Consider creative financing options",
          "Explore partnership opportunities",
          "Document all income sources",
        ],
        tips: [
          "Investment properties typically require 20-25% down",
          "Lenders want to see significant reserves",
          "Consider house hacking for first property",
          "Document rental income potential",
        ],
      },
      {
        title: "Phase 4: Lender Relationships",
        description: "Build relationships with investment property lenders",
        duration: "Month 12-24",
        tasks: [
          "Research portfolio lenders and banks",
          "Build relationships with loan officers",
          "Get pre-qualified for investment loans",
          "Understand different loan programs",
          "Compare rates and terms",
        ],
        tips: [
          "Portfolio lenders often have better terms",
          "Build relationships before you need loans",
          "Consider local banks and credit unions",
          "Understand DSCR and asset-based lending",
        ],
      },
      {
        title: "Phase 5: First Investment Purchase",
        description: "Purchase first investment property",
        duration: "Month 18-30",
        tasks: [
          "Find and analyze potential properties",
          "Make offers and negotiate terms",
          "Secure financing and close on property",
          "Set up property management systems",
          "Begin building rental income history",
        ],
        tips: [
          "Run conservative numbers on cash flow",
          "Factor in vacancy and maintenance costs",
          "Consider property management if needed",
          "Keep detailed records for taxes and future loans",
        ],
      },
      {
        title: "Phase 6: Portfolio Expansion",
        description: "Scale real estate investment portfolio",
        duration: "Month 24-36+",
        tasks: [
          "Use rental income to qualify for more loans",
          "Refinance properties to pull out equity",
          "Consider commercial loans for larger deals",
          "Build business credit for more financing options",
          "Continue expanding portfolio strategically",
        ],
        tips: [
          "Use BRRRR strategy (Buy, Rehab, Rent, Refinance, Repeat)",
          "Maintain strong credit and financial position",
          "Consider 1031 exchanges for tax benefits",
          "Build team of professionals (agents, lenders, contractors)",
        ],
      },
    ],
  },
]

interface PremadeRoadmapGeneratorProps {
  onRoadmapSelect: (roadmap: PremadeRoadmap) => void
}

export function PremadeRoadmapGenerator({ onRoadmapSelect }: PremadeRoadmapGeneratorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | null>(null)

  const filteredRoadmaps = premadeRoadmaps.filter((roadmap) => {
    const matchesCategory = selectedCategory === "all" || roadmap.category === selectedCategory
    const matchesDifficulty = selectedDifficulty === "all" || roadmap.difficulty === selectedDifficulty
    const matchesSearch =
      searchTerm === "" ||
      roadmap.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roadmap.description.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesCategory && matchesDifficulty && matchesSearch
  })

  const handleStepToggle = (roadmapId: string, stepIndex: number) => {
    // This would typically update the completion status in a database
    console.log(`Toggled step ${stepIndex} for roadmap ${roadmapId}`)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Proven Financial Roadmaps</h2>
        <p className="text-muted-foreground">
          Choose from our expert-designed roadmaps with step-by-step guidance and proven results
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search roadmaps..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="credit-repair">Credit Repair</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="real-estate">Real Estate</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Roadmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRoadmaps.map((roadmap) => (
          <Card key={roadmap.id} className="relative">
            {roadmap.featured && <Badge className="absolute -top-2 -right-2 bg-cyan-500">Featured</Badge>}
            <CardHeader>
              <div className="flex items-center gap-3">
                {roadmap.icon}
                <div>
                  <CardTitle className="text-lg">{roadmap.title}</CardTitle>
                  <CardDescription>{roadmap.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium">Duration</div>
                  <div className="text-muted-foreground">{roadmap.duration}</div>
                </div>
                <div>
                  <div className="font-medium">Difficulty</div>
                  <Badge variant="outline" className="text-xs">
                    {roadmap.difficulty}
                  </Badge>
                </div>
                <div>
                  <div className="font-medium">Credit Range</div>
                  <div className="text-muted-foreground">{roadmap.creditScoreRange}</div>
                </div>
                <div>
                  <div className="font-medium">Steps</div>
                  <div className="text-muted-foreground">{roadmap.steps.length} phases</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => setSelectedRoadmap(selectedRoadmap === roadmap.id ? null : roadmap.id)}
                >
                  {selectedRoadmap === roadmap.id ? "Hide Details" : "View Details"}
                </Button>
                <Button className="flex-1" onClick={() => onRoadmapSelect(roadmap)}>
                  Start Roadmap
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed View */}
      {selectedRoadmap && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {premadeRoadmaps.find((r) => r.id === selectedRoadmap)?.icon}
              {premadeRoadmaps.find((r) => r.id === selectedRoadmap)?.title}
            </CardTitle>
            <CardDescription>{premadeRoadmaps.find((r) => r.id === selectedRoadmap)?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {premadeRoadmaps
                .find((r) => r.id === selectedRoadmap)
                ?.steps.map((step, index) => (
                  <AccordionItem key={index} value={`step-${index}`}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-cyan-600">{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-semibold">{step.title}</div>
                          <div className="text-sm text-muted-foreground">{step.duration}</div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <p className="text-muted-foreground">{step.description}</p>

                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Action Steps:
                          </h4>
                          <div className="space-y-2">
                            {step.tasks.map((task, taskIndex) => (
                              <div key={taskIndex} className="flex items-start gap-2">
                                <Checkbox
                                  id={`${selectedRoadmap}-${index}-${taskIndex}`}
                                  onCheckedChange={() => handleStepToggle(selectedRoadmap, index)}
                                />
                                <label
                                  htmlFor={`${selectedRoadmap}-${index}-${taskIndex}`}
                                  className="text-sm leading-relaxed cursor-pointer"
                                >
                                  {task}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            Pro Tips:
                          </h4>
                          <ul className="space-y-1">
                            {step.tips.map((tip, tipIndex) => (
                              <li key={tipIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                                <Star className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {filteredRoadmaps.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            No roadmaps found matching your criteria. Try adjusting your filters.
          </div>
        </Card>
      )}
    </div>
  )
}
