"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Building2, Calculator, CheckCircle2, Download, FileText, Hammer, Home, Loader2, Route, ShieldCheck, SlidersHorizontal, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

const propertyTypes = [
  "Single Family",
  "Duplex / Triplex / Fourplex",
  "Condo",
  "Townhome",
  "Multifamily",
  "Land",
  "Commercial",
  "Other",
]

const propertyConditions = ["Excellent", "Good", "Fair / Dated", "Needs Repairs", "Major Repairs", "Vacant / Distressed"]
const occupancyStatuses = ["Owner Occupied", "Tenant Occupied", "Vacant", "Unknown"]
const timelines = ["ASAP", "Within 30 days", "30-60 days", "60-90 days", "Flexible"]
const exitStrategies = [
  { value: "not_sure", label: "Not sure yet" },
  { value: "flip", label: "Fix and flip" },
  { value: "rental", label: "Rental hold" },
  { value: "brrrr", label: "BRRRR" },
  { value: "dscr_refinance", label: "DSCR refinance" },
  { value: "wholesale", label: "Wholesale" },
  { value: "wholetail", label: "Wholetail" },
  { value: "seller_finance", label: "Seller finance hold" },
  { value: "hold_long_term", label: "Long-term hold" },
]
const creditScoreRanges = ["740+", "700-739", "660-699", "620-659", "Below 620", "Unknown"]
const entityStatuses = ["Active LLC / Corp", "Entity forming", "No entity yet", "Personal name only"]
const experienceLevels = ["New investor", "1-3 deals", "4-10 deals", "Experienced operator"]
const listingStatuses = [
  "Off market / private",
  "New listing",
  "Active",
  "Price reduced",
  "Expired / withdrawn",
  "Pending",
]

type AnalyzerComparableForm = {
  address: string
  salePrice: string
  squareFeet: string
  distanceMiles: string
  beds: string
  baths: string
  notes: string
}

function createEmptyComparable(): AnalyzerComparableForm {
  return {
    address: "",
    salePrice: "",
    squareFeet: "",
    distanceMiles: "",
    beds: "",
    baths: "",
    notes: "",
  }
}

type AnalyzerForm = {
  propertyAddress: string
  city: string
  state: string
  zipCode: string
  selectedComps: AnalyzerComparableForm[]
  listingSourceUrl: string
  listingStatus: string
  daysOnMarket: string
  priceCutCount: string
  lastPriceCutAmount: string
  listingNotes: string
  propertyType: string
  bedrooms: string
  bathrooms: string
  squareFeet: string
  propertyCondition: string
  occupancyStatus: string
  timelineToSell: string
  estimatedValue: string
  askingPrice: string
  monthlyRentEstimate: string
  afterRepairValue: string
  repairBudget: string
  assignmentFee: string
  closingCosts: string
  holdingPeriodMonths: string
  mortgageBalance: string
  liensOrTaxes: string
  monthlyTaxes: string
  monthlyInsurance: string
  monthlyUtilities: string
  propertyManagementPercent: string
  vacancyPercent: string
  maintenancePercent: string
  otherMonthlyExpenses: string
  monthlyDebtService: string
  downPayment: string
  interestRate: string
  loanTermYears: string
  points: string
  lenderFees: string
  loanToCost: string
  loanToValue: string
  privateMoneyAmount: string
  gapFundingAmount: string
  sellerFinanceAmount: string
  operatorCashAvailable: string
  exitStrategy: string
  creditScoreRange: string
  entityStatus: string
  realEstateExperience: string
  documentsAvailable: string
  targetMonthlyCashFlow: string
  creativeDownPayment: string
  creativeNoteInterestRate: string
  creativeAmortizationYears: string
  creativeBalloonYears: string
  existingLoanInterestRate: string
  existingLoanRemainingTermYears: string
}

type AnalyzerResult = {
  success: boolean
  address: string
  estimate: {
    sourceLabel: string
    estimateValue: number | null
    lowEstimate: number | null
    highEstimate: number | null
    rentEstimate: number | null
    confidence: number
    confidenceLabel: string
    equityEstimate: number | null
    ltvEstimate: number | null
    acquisitionRangeLow: number | null
    acquisitionRangeHigh: number | null
    warnings: string[]
    disclaimer: string
  }
  opportunity: {
    metrics: {
      arv: number | null
      repairBudget: number | null
      mao70: number | null
      conservativeCashReview: number | null
      balancedCashReview: number | null
      discountToValuePercent: number | null
      equityPercent: number | null
      grossRentYieldPercent: number | null
      estimatedMonthlyCarry: number | null
      estimatedMonthlyCashFlow: number | null
      dscr: number | null
      monthlyOperatingExpenses: number | null
      annualDebtService: number | null
      netOperatingIncomeAnnual: number | null
      capRatePercent: number | null
      cashOnCashReturnPercent: number | null
      debtYieldPercent: number | null
      breakEvenRent: number | null
      rentToPriceRatioPercent: number | null
      flipProfit: number | null
      flipRoiPercent: number | null
      recommendedLoanAmount: number | null
      totalProjectCost: number | null
      totalCashNeeded: number | null
      fundingGap: number | null
    }
    dealMath: {
      arvMode: "BASELINE" | "COMPS_AVG" | "MANUAL"
      ruleType: "residential" | "land" | "commercial"
      rulePercent: number
      assignmentFee: number | null
      mao: number | null
      sellerAsk: number | null
      spread: number | null
      endBuyerProfit: number | null
      grade: "RISKY" | "GOOD" | null
    }
    comparables: {
      usedCount: number
      averageSalePrice: number | null
      averagePricePerFoot: number | null
      selected: Array<{
        address: string | null
        salePrice: number | null
        squareFeet: number | null
        distanceMiles: number | null
        beds: number | null
        baths: number | null
        notes: string | null
        pricePerFoot: number | null
      }>
    }
    listingContext: {
      sourceUrl: string | null
      status: string | null
      daysOnMarket: number | null
      priceCutCount: number | null
      lastPriceCutAmount: number | null
      pressureLabel: string
      summary: string
      signals: string[]
    }
    dealStrength: {
      score: number
      label: "Strong" | "Promising" | "Watchlist" | "Weak"
      summary: string
      strengths: string[]
    }
    fundingReadiness: {
      score: number
      label: "Ready to route" | "Needs more file prep" | "Needs borrower cleanup" | "Manual review"
      recommendedPath: "DSCR" | "Hard money" | "Private money" | "Gap funding" | "Transactional funding" | "Business credit builder" | "Credit prep" | "Manual review"
      summary: string
      missingItems: string[]
    }
    capitalStack: {
      totalProjectCost: number | null
      seniorDebt: number | null
      privateMoney: number | null
      sellerFinance: number | null
      gapFunding: number | null
      operatorCash: number | null
      estimatedReserves: number | null
      totalCapitalAvailable: number | null
      fundingGap: number | null
      notes: string[]
    }
    riskFlags: string[]
    creativeOffers: Array<{
      key: "seller_finance" | "subject_to" | "wrap_mortgage"
      label: string
      viability: "Meets target" | "Borderline" | "Below target" | "Needs more inputs"
      summary: string
      caution: string | null
      metrics: {
        targetMonthlyCashFlow: number | null
        maxPriceToHitTargetCashFlow: number | null
        suggestedPurchasePrice: number | null
        cashToSellerNow: number | null
        cashToClose: number | null
        financedBalance: number | null
        existingLoanBalance: number | null
        existingLoanPayment: number | null
        noteRatePercent: number | null
        amortizationYears: number | null
        balloonYears: number | null
        monthlyPayment: number | null
        totalMonthlyPayment: number | null
        estimatedMonthlyCashFlow: number | null
        balloonBalance: number | null
      }
    }>
    routeFit: Array<{
      key: string
      label: string
      score: number
      summary: string
    }>
    builderDisposition: {
      score: number
      label: string
      summary: string
      strategy: string
      builderMaxPurchase: number | null
      recommendedSellerOffer: number | null
      suggestedAssignmentFee: number | null
      projectedGrossSpread: number | null
      rehabPlanningLow: number | null
      rehabPlanningHigh: number | null
      renovationScope: string
      sellerOutreachAngle: string
      buyBoxQuestions: string[]
      contractTerms: {
        earnestMoney: number | null
        inspectionDays: number
        closeWindowDays: number
      }
      nextSteps: string[]
    }
    buyerInterest: {
      label: string
      score: number
      summary: string
    }
    nextSteps: string[]
    disclaimer: string
  }
}

const initialForm: AnalyzerForm = {
  propertyAddress: "",
  city: "",
  state: "",
  zipCode: "",
  selectedComps: [createEmptyComparable(), createEmptyComparable(), createEmptyComparable()],
  listingSourceUrl: "",
  listingStatus: "",
  daysOnMarket: "",
  priceCutCount: "",
  lastPriceCutAmount: "",
  listingNotes: "",
  propertyType: "",
  bedrooms: "",
  bathrooms: "",
  squareFeet: "",
  propertyCondition: "",
  occupancyStatus: "",
  timelineToSell: "",
  estimatedValue: "",
  askingPrice: "",
  monthlyRentEstimate: "",
  afterRepairValue: "",
  repairBudget: "",
  assignmentFee: "",
  closingCosts: "",
  holdingPeriodMonths: "",
  mortgageBalance: "",
  liensOrTaxes: "",
  monthlyTaxes: "",
  monthlyInsurance: "",
  monthlyUtilities: "",
  propertyManagementPercent: "",
  vacancyPercent: "",
  maintenancePercent: "",
  otherMonthlyExpenses: "",
  monthlyDebtService: "",
  downPayment: "",
  interestRate: "",
  loanTermYears: "",
  points: "",
  lenderFees: "",
  loanToCost: "",
  loanToValue: "",
  privateMoneyAmount: "",
  gapFundingAmount: "",
  sellerFinanceAmount: "",
  operatorCashAvailable: "",
  exitStrategy: "not_sure",
  creditScoreRange: "",
  entityStatus: "",
  realEstateExperience: "",
  documentsAvailable: "",
  targetMonthlyCashFlow: "",
  creativeDownPayment: "",
  creativeNoteInterestRate: "",
  creativeAmortizationYears: "",
  creativeBalloonYears: "",
  existingLoanInterestRate: "",
  existingLoanRemainingTermYears: "",
}

function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (!value) return null
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Needs details"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Needs details"
  return `${value}%`
}

function routeColor(score: number) {
  if (score >= 78) return "text-cyan-200"
  if (score >= 58) return "text-blue-200"
  if (score >= 38) return "text-amber-100"
  return "text-slate-300"
}

function creativeViabilityTone(value: AnalyzerResult["opportunity"]["creativeOffers"][number]["viability"]) {
  if (value === "Meets target") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
  if (value === "Borderline") return "border-amber-400/20 bg-amber-400/10 text-amber-100"
  if (value === "Below target") return "border-rose-400/20 bg-rose-400/10 text-rose-100"
  return "border-white/10 bg-white/[0.04] text-slate-200"
}

function dealStrengthTone(value: AnalyzerResult["opportunity"]["dealStrength"]["label"]) {
  if (value === "Strong") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
  if (value === "Promising") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
  if (value === "Watchlist") return "border-amber-400/20 bg-amber-400/10 text-amber-100"
  return "border-rose-400/20 bg-rose-400/10 text-rose-100"
}

function dealGradeTone(value: AnalyzerResult["opportunity"]["dealMath"]["grade"]) {
  if (value === "GOOD") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
  if (value === "RISKY") return "border-rose-400/20 bg-rose-400/10 text-rose-100"
  return "border-white/10 bg-white/[0.04] text-slate-200"
}

function formatYears(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Needs details"
  return `${value} yrs`
}

function buildSellerHref(form: AnalyzerForm) {
  const params = new URLSearchParams()
  for (const key of [
    "propertyAddress",
    "city",
    "state",
    "propertyType",
    "bedrooms",
    "bathrooms",
    "propertyCondition",
    "timelineToSell",
    "exitStrategy",
    "estimatedValue",
    "askingPrice",
    "mortgageBalance",
    "liensOrTaxes",
    "occupancyStatus",
  ] as const) {
    if (form[key]) params.set(key, form[key])
  }

  return params.toString() ? `/sell?${params.toString()}` : "/sell"
}

export function PropertyOpportunityAnalyzer({ calculatorOnly = false }: { calculatorOnly?: boolean }) {
  const [form, setForm] = useState<AnalyzerForm>(initialForm)
  const [result, setResult] = useState<AnalyzerResult | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState<null | "investor" | "buyer" | "lender" | "builder" | "assignment_contract">(null)

  const updateField = (field: keyof AnalyzerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateComparable = (index: number, field: keyof AnalyzerComparableForm, value: string) => {
    setForm((current) => ({
      ...current,
      selectedComps: current.selectedComps.map((comp, compIndex) =>
        compIndex === index ? { ...comp, [field]: value } : comp
      ),
    }))
  }

  const calculator = useMemo(() => {
    const arv = parseMoney(form.afterRepairValue) ?? result?.opportunity.metrics.arv ?? result?.estimate.estimateValue ?? null
    const repairs = parseMoney(form.repairBudget) ?? result?.opportunity.metrics.repairBudget ?? 0
    const rent = parseMoney(form.monthlyRentEstimate) ?? result?.estimate.rentEstimate ?? null
    const taxes = parseMoney(form.monthlyTaxes) || 0
    const insurance = parseMoney(form.monthlyInsurance) || 0
    const debt = parseMoney(form.monthlyDebtService) || 0
    const asking = parseMoney(form.askingPrice)
    const mao70 = arv !== null ? Math.round((arv * 0.7 - repairs) / 500) * 500 : null
    const investorTargetProfit = arv !== null ? Math.max(15000, Math.round(arv * 0.1)) : null
    const flipOffer =
      arv !== null && investorTargetProfit !== null
        ? Math.round((arv - repairs - investorTargetProfit - arv * 0.05) / 500) * 500
        : null
    const carry = taxes + insurance + debt
    const cashFlow = rent !== null && carry > 0 ? Math.round(rent - carry) : null
    const grossYield = rent !== null && arv !== null && arv > 0 ? Math.round(((rent * 12) / arv) * 1000) / 10 : null
    const spread = arv !== null && asking !== null ? Math.round(arv - asking) : null

    return {
      arv,
      repairs,
      rent,
      mao70,
      flipOffer,
      cashFlow,
      grossYield,
      spread,
      carry: carry > 0 ? Math.round(carry) : null,
    }
  }, [form.afterRepairValue, form.askingPrice, form.monthlyDebtService, form.monthlyInsurance, form.monthlyTaxes, form.repairBudget, result])

  const handleAnalyze = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setResult(null)

    if (!form.propertyAddress.trim()) {
      setError("Enter a property address first.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/property-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json()

      if (!response.ok) throw new Error(payload.error || "Unable to analyze this property.")

      setResult(payload)
      setForm((current) => ({
        ...current,
        afterRepairValue:
          current.afterRepairValue ||
          (payload.opportunity?.metrics?.arv ? String(payload.opportunity.metrics.arv) : ""),
        monthlyRentEstimate:
          current.monthlyRentEstimate ||
          (payload.estimate?.rentEstimate ? String(payload.estimate.rentEstimate) : ""),
        repairBudget:
          current.repairBudget ||
          (payload.opportunity?.metrics?.repairBudget ? String(payload.opportunity.metrics.repairBudget) : ""),
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadReport = async (reportType: "investor" | "buyer" | "lender" | "builder" | "assignment_contract") => {
    if (!result) return

    setIsDownloading(reportType)
    try {
      const response = await fetch("/api/property-analyzer/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          address: result.address,
          form,
          estimate: result.estimate,
          opportunity: result.opportunity,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || "Unable to generate the report.")
      }

      const blob = await response.blob()
      const disposition = response.headers.get("content-disposition") || ""
      const match = disposition.match(/filename=\"?([^\";]+)\"?/)
      const fallbackExtension = response.headers.get("content-type")?.includes("pdf") ? "pdf" : "html"
      const fileName = match?.[1] || `vestblock-${reportType}-packet.${fallbackExtension}`
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate the report.")
    } finally {
      setIsDownloading(null)
    }
  }

  const sellerHref = buildSellerHref(form)

  return (
    <div className="relative overflow-hidden px-4 pb-12 pt-28 md:pb-16 md:pt-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(3,7,18,1))]" />
      <div className="container mx-auto max-w-7xl">
        <div className="mb-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
              Free VestBlock analyzer
            </Badge>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              {calculatorOnly ? "Real estate deal calculators." : "Analyze a property before you route it."}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Screen a property for rough value, cash-review range, buyer interest, creative paths, novation fit,
              rental signals, lender review, and rough seller-finance or subject-to offer math before it becomes a serious VestBlock routing packet.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Seller paths", value: "Cash / Creative / Novation" },
              { label: "Buyer routing", value: "Buy-box fit signals" },
              { label: "Funding angle", value: "Rent, DSCR, and note math" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="border-white/10 bg-slate-950/70 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-white">
                <Home className="h-5 w-5 text-cyan-300" />
                Property screen
              </CardTitle>
              <p className="text-sm leading-6 text-slate-400">
                Add enough detail to get a useful first pass. This does not replace verified comps, title, or partner review.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAnalyze} className="space-y-5">
                {error && (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="propertyAddress">Property address</Label>
                  <Input
                    id="propertyAddress"
                    value={form.propertyAddress}
                    onChange={(event) => updateField("propertyAddress", event.target.value)}
                    placeholder="123 Main Street"
                    className="bg-slate-950/70"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_0.5fr_0.5fr]">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(event) => updateField("city", event.target.value)}
                      placeholder="Milwaukee"
                      className="bg-slate-950/70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={form.state}
                      onChange={(event) => updateField("state", event.target.value)}
                      placeholder="WI"
                      className="bg-slate-950/70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP</Label>
                    <Input
                      id="zipCode"
                      value={form.zipCode}
                      onChange={(event) => updateField("zipCode", event.target.value)}
                      placeholder="53202"
                      className="bg-slate-950/70"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Property type</Label>
                    <Select value={form.propertyType} onValueChange={(value) => updateField("propertyType", value)}>
                      <SelectTrigger className="bg-slate-950/70">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={form.propertyCondition} onValueChange={(value) => updateField("propertyCondition", value)}>
                      <SelectTrigger className="bg-slate-950/70">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyConditions.map((condition) => (
                          <SelectItem key={condition} value={condition}>
                            {condition}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Occupancy</Label>
                    <Select value={form.occupancyStatus} onValueChange={(value) => updateField("occupancyStatus", value)}>
                      <SelectTrigger className="bg-slate-950/70">
                        <SelectValue placeholder="Select occupancy" />
                      </SelectTrigger>
                      <SelectContent>
                        {occupancyStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Exit strategy</Label>
                    <Select value={form.exitStrategy} onValueChange={(value) => updateField("exitStrategy", value)}>
                      <SelectTrigger className="bg-slate-950/70">
                        <SelectValue placeholder="Select exit path" />
                      </SelectTrigger>
                      <SelectContent>
                        {exitStrategies.map((strategy) => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            {strategy.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="creditScoreRange">Credit range</Label>
                    <Select value={form.creditScoreRange} onValueChange={(value) => updateField("creditScoreRange", value)}>
                      <SelectTrigger className="bg-slate-950/70">
                        <SelectValue placeholder="Borrower credit" />
                      </SelectTrigger>
                      <SelectContent>
                        {creditScoreRanges.map((range) => (
                          <SelectItem key={range} value={range}>
                            {range}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entityStatus">Entity status</Label>
                    <Select value={form.entityStatus} onValueChange={(value) => updateField("entityStatus", value)}>
                      <SelectTrigger className="bg-slate-950/70">
                        <SelectValue placeholder="Entity setup" />
                      </SelectTrigger>
                      <SelectContent>
                        {entityStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timeline</Label>
                    <Select value={form.timelineToSell} onValueChange={(value) => updateField("timelineToSell", value)}>
                      <SelectTrigger className="bg-slate-950/70">
                        <SelectValue placeholder="Select timeline" />
                      </SelectTrigger>
                      <SelectContent>
                        {timelines.map((timeline) => (
                          <SelectItem key={timeline} value={timeline}>
                            {timeline}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="realEstateExperience">Real estate experience</Label>
                  <Select value={form.realEstateExperience} onValueChange={(value) => updateField("realEstateExperience", value)}>
                    <SelectTrigger className="bg-slate-950/70">
                      <SelectValue placeholder="Experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      {experienceLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedValue">Estimated value</Label>
                    <Input id="estimatedValue" value={form.estimatedValue} onChange={(event) => updateField("estimatedValue", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="askingPrice">Asking price</Label>
                    <Input id="askingPrice" value={form.askingPrice} onChange={(event) => updateField("askingPrice", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRentEstimate">Monthly rent estimate</Label>
                    <Input
                      id="monthlyRentEstimate"
                      value={form.monthlyRentEstimate}
                      onChange={(event) => updateField("monthlyRentEstimate", event.target.value)}
                      placeholder="$"
                      className="bg-slate-950/70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignmentFee">Assignment fee</Label>
                    <Input
                      id="assignmentFee"
                      value={form.assignmentFee}
                      onChange={(event) => updateField("assignmentFee", event.target.value)}
                      placeholder="$10,000"
                      className="bg-slate-950/70"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[10000, 15000, 20000, 25000].map((fee) => (
                    <Button
                      key={fee}
                      type="button"
                      variant="outline"
                      className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
                      onClick={() => updateField("assignmentFee", String(fee))}
                    >
                      {formatMoney(fee)}
                    </Button>
                  ))}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">Comparable sales</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Add sold comps and the analyzer will switch from the baseline value to a comp-backed ARV.
                      </p>
                    </div>
                    <Badge className="border-white/10 bg-white/[0.04] text-slate-200">
                      {result?.opportunity.comparables.usedCount ?? form.selectedComps.filter((comp) => comp.salePrice.trim()).length} used
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-4">
                    {form.selectedComps.map((comp, index) => (
                      <div key={`comp-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                        <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_0.55fr_0.55fr]">
                          <div className="space-y-2">
                            <Label htmlFor={`comp-address-${index}`}>Comp {index + 1} address</Label>
                            <Input
                              id={`comp-address-${index}`}
                              value={comp.address}
                              onChange={(event) => updateComparable(index, "address", event.target.value)}
                              placeholder="123 Example Ave"
                              className="bg-slate-950/70"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`comp-sale-${index}`}>Sale price</Label>
                            <Input
                              id={`comp-sale-${index}`}
                              value={comp.salePrice}
                              onChange={(event) => updateComparable(index, "salePrice", event.target.value)}
                              placeholder="$165000"
                              className="bg-slate-950/70"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`comp-sqft-${index}`}>Sqft</Label>
                            <Input
                              id={`comp-sqft-${index}`}
                              value={comp.squareFeet}
                              onChange={(event) => updateComparable(index, "squareFeet", event.target.value)}
                              placeholder="1800"
                              className="bg-slate-950/70"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`comp-distance-${index}`}>Miles</Label>
                            <Input
                              id={`comp-distance-${index}`}
                              value={comp.distanceMiles}
                              onChange={(event) => updateComparable(index, "distanceMiles", event.target.value)}
                              placeholder="0.6"
                              className="bg-slate-950/70"
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-[0.45fr_0.45fr_1.1fr]">
                          <div className="space-y-2">
                            <Label htmlFor={`comp-beds-${index}`}>Beds</Label>
                            <Input
                              id={`comp-beds-${index}`}
                              value={comp.beds}
                              onChange={(event) => updateComparable(index, "beds", event.target.value)}
                              placeholder="3"
                              className="bg-slate-950/70"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`comp-baths-${index}`}>Baths</Label>
                            <Input
                              id={`comp-baths-${index}`}
                              value={comp.baths}
                              onChange={(event) => updateComparable(index, "baths", event.target.value)}
                              placeholder="2"
                              className="bg-slate-950/70"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`comp-notes-${index}`}>Notes</Label>
                            <Input
                              id={`comp-notes-${index}`}
                              value={comp.notes}
                              onChange={(event) => updateComparable(index, "notes", event.target.value)}
                              placeholder="Corner lot, updated kitchen, similar unit count"
                              className="bg-slate-950/70"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Public listing context</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Add public-listing pressure so the route engine can better size seller urgency and negotiation room.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="listingSourceUrl">Listing source URL</Label>
                      <Input
                        id="listingSourceUrl"
                        value={form.listingSourceUrl}
                        onChange={(event) => updateField("listingSourceUrl", event.target.value)}
                        placeholder="https://..."
                        className="bg-slate-950/70"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Listing status</Label>
                      <Select value={form.listingStatus} onValueChange={(value) => updateField("listingStatus", value)}>
                        <SelectTrigger className="bg-slate-950/70">
                          <SelectValue placeholder="Select listing status" />
                        </SelectTrigger>
                        <SelectContent>
                          {listingStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="daysOnMarket">Days on market</Label>
                      <Input
                        id="daysOnMarket"
                        value={form.daysOnMarket}
                        onChange={(event) => updateField("daysOnMarket", event.target.value)}
                        placeholder="74"
                        className="bg-slate-950/70"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceCutCount">Price cut count</Label>
                      <Input
                        id="priceCutCount"
                        value={form.priceCutCount}
                        onChange={(event) => updateField("priceCutCount", event.target.value)}
                        placeholder="2"
                        className="bg-slate-950/70"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastPriceCutAmount">Latest price cut</Label>
                      <Input
                        id="lastPriceCutAmount"
                        value={form.lastPriceCutAmount}
                        onChange={(event) => updateField("lastPriceCutAmount", event.target.value)}
                        placeholder="$10000"
                        className="bg-slate-950/70"
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="listingNotes">Listing notes</Label>
                    <Textarea
                      id="listingNotes"
                      value={form.listingNotes}
                      onChange={(event) => updateField("listingNotes", event.target.value)}
                      placeholder="Price reduced twice, dated photos, tenant remarks, stale listing copy..."
                      className="min-h-[84px] bg-slate-950/70"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="repairBudget">Repair budget</Label>
                    <Input id="repairBudget" value={form.repairBudget} onChange={(event) => updateField("repairBudget", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="afterRepairValue">ARV</Label>
                    <Input id="afterRepairValue" value={form.afterRepairValue} onChange={(event) => updateField("afterRepairValue", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mortgageBalance">Mortgage balance</Label>
                    <Input id="mortgageBalance" value={form.mortgageBalance} onChange={(event) => updateField("mortgageBalance", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="liensOrTaxes">Liens / taxes</Label>
                    <Input id="liensOrTaxes" value={form.liensOrTaxes} onChange={(event) => updateField("liensOrTaxes", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentsAvailable">Documents available</Label>
                  <Textarea
                    id="documentsAvailable"
                    value={form.documentsAvailable}
                    onChange={(event) => updateField("documentsAvailable", event.target.value)}
                    placeholder="Examples: bank statements, rehab scope, contractor bids, operating agreement, EIN, lease, rent roll"
                    className="min-h-24 bg-slate-950/70"
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
                  Analyze Property
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Rough value", value: formatMoney(result?.estimate.estimateValue), icon: TrendingUp },
              { label: "MAO 70%", value: formatMoney(calculator.mao70), icon: Calculator },
              { label: "Deal strength", value: result ? `${result.opportunity.dealStrength.score}/100` : "Needs details", icon: ShieldCheck },
              { label: "Funding path", value: result?.opportunity.fundingReadiness.recommendedPath ?? "Needs details", icon: Route },
            ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                      <Icon className="h-5 w-5 text-cyan-200" />
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                )
              })}
            </div>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Route className="h-5 w-5 text-cyan-300" />
                  Routing readout
                </CardTitle>
                <p className="text-sm text-slate-400">
                  These are screening signals. VestBlock still verifies the deal before sending it to buyers, lenders, or partners.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {result ? (
                  <>
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-cyan-100">{result.opportunity.buyerInterest.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{result.opportunity.buyerInterest.summary}</p>
                        </div>
                        <div className="min-w-28">
                          <p className="mb-2 text-right text-sm font-semibold text-white">{result.opportunity.buyerInterest.score}/100</p>
                          <Progress value={result.opportunity.buyerInterest.score} />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {result.opportunity.routeFit.map((route) => (
                        <div key={route.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-white">{route.label}</p>
                            <p className={`text-sm font-semibold ${routeColor(route.score)}`}>{route.score}/100</p>
                          </div>
                          <Progress value={route.score} className="mt-3" />
                          <p className="mt-3 text-sm leading-6 text-slate-400">{route.summary}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                    <ShieldCheck className="mx-auto h-8 w-8 text-cyan-300" />
                    <p className="mt-3 text-sm text-slate-300">
                      Run the analyzer to see rough value, route fit, and deal-calculator outputs.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Calculator className="h-5 w-5 text-cyan-300" />
                  Assignment math
                </CardTitle>
                <p className="text-sm text-slate-400">
                  Transparent wholesale math based on your ARV, repair budget, assignment fee, and seller ask.
                </p>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div>
                        <p className="text-sm font-medium text-white">Deal grade</p>
                        <p className="mt-1 text-sm text-slate-400">
                          Rule: {(result.opportunity.dealMath.rulePercent * 100).toFixed(0)}% {result.opportunity.dealMath.ruleType} · ARV source: {result.opportunity.dealMath.arvMode}
                        </p>
                      </div>
                      <Badge className={dealGradeTone(result.opportunity.dealMath.grade)}>
                        {result.opportunity.dealMath.grade ?? "Needs details"}
                      </Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">MAO with fee</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">{formatMoney(result.opportunity.dealMath.mao)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Assignment fee</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">{formatMoney(result.opportunity.dealMath.assignmentFee)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Seller ask</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">{formatMoney(result.opportunity.dealMath.sellerAsk)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">End-buyer profit</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">{formatMoney(result.opportunity.dealMath.endBuyerProfit)}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="grid gap-3 md:grid-cols-5">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">ARV</p>
                          <p className="mt-1 text-sm font-medium text-white">{formatMoney(result.opportunity.metrics.arv)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Rule %</p>
                          <p className="mt-1 text-sm font-medium text-white">{(result.opportunity.dealMath.rulePercent * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Repairs</p>
                          <p className="mt-1 text-sm font-medium text-white">{formatMoney(result.opportunity.metrics.repairBudget)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Assignment</p>
                          <p className="mt-1 text-sm font-medium text-white">{formatMoney(result.opportunity.dealMath.assignmentFee)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Spread</p>
                          <p className="mt-1 text-sm font-medium text-white">{formatMoney(result.opportunity.dealMath.spread)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                    <Calculator className="mx-auto h-8 w-8 text-cyan-300" />
                    <p className="mt-3 text-sm text-slate-300">
                      Run the analyzer to see a transparent MAO, spread, assignment-fee, and end-buyer-profit breakdown.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Home className="h-5 w-5 text-cyan-300" />
                  Comps and listing context
                </CardTitle>
                <p className="text-sm text-slate-400">
                  When you add sold comps and public listing pressure, the analyzer stops leaning on the baseline value and gives you a sharper route read.
                </p>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">ARV source</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">{result.opportunity.dealMath.arvMode}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Comp count</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">{result.opportunity.comparables.usedCount}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Average comp sale</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">{formatMoney(result.opportunity.comparables.averageSalePrice)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Average $ / sqft</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">
                          {result.opportunity.comparables.averagePricePerFoot !== null
                            ? `$${result.opportunity.comparables.averagePricePerFoot}`
                            : "Needs details"}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Listing pressure</p>
                        <p className="mt-3 text-lg font-semibold text-cyan-100">{result.opportunity.listingContext.pressureLabel}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{result.opportunity.listingContext.summary}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm text-slate-300">
                          <div>DOM: {result.opportunity.listingContext.daysOnMarket ?? "—"}</div>
                          <div>Price cuts: {result.opportunity.listingContext.priceCutCount ?? "—"}</div>
                          <div>Latest cut: {formatMoney(result.opportunity.listingContext.lastPriceCutAmount)}</div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Comp signals</p>
                        {result.opportunity.comparables.selected.filter((comp) => comp.salePrice !== null).length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {result.opportunity.comparables.selected
                              .filter((comp) => comp.salePrice !== null)
                              .slice(0, 3)
                              .map((comp, index) => (
                                <div key={`${comp.address || "comp"}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                                  <p className="text-sm font-medium text-white">{comp.address || `Comparable ${index + 1}`}</p>
                                  <p className="mt-1 text-sm text-slate-300">
                                    {formatMoney(comp.salePrice)}
                                    {comp.squareFeet ? ` • ${comp.squareFeet} sqft` : ""}
                                    {comp.distanceMiles ? ` • ${comp.distanceMiles} mi` : ""}
                                    {comp.pricePerFoot ? ` • $${comp.pricePerFoot}/sqft` : ""}
                                  </p>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-300">
                            No sold comps were entered yet, so the analyzer is still leaning on the baseline estimate.
                          </p>
                        )}
                        {result.opportunity.listingContext.signals.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.opportunity.listingContext.signals.map((signal) => (
                              <Badge key={signal} className="border-white/10 bg-white/[0.06] text-slate-100">
                                {signal}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                    <Home className="mx-auto h-8 w-8 text-cyan-300" />
                    <p className="mt-3 text-sm text-slate-300">
                      Add sold comps and public listing signals if you want the analyzer to move past a baseline estimate.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Hammer className="h-5 w-5 text-violet-300" />
                  Builder disposition lane
                </CardTitle>
                <p className="text-sm text-slate-400">
                  Use this when the play is to move a deal to builders, developers, or construction groups with a real buy box instead of blasting it widely.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {result ? (
                  <>
                    <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-violet-100">{result.opportunity.builderDisposition.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{result.opportunity.builderDisposition.summary}</p>
                        </div>
                        <div className="min-w-28">
                          <p className="mb-2 text-right text-sm font-semibold text-white">{result.opportunity.builderDisposition.score}/100</p>
                          <Progress value={result.opportunity.builderDisposition.score} />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Builder max purchase</p>
                        <p className="mt-3 text-lg font-semibold text-violet-100">{formatMoney(result.opportunity.builderDisposition.builderMaxPurchase)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Seller offer target</p>
                        <p className="mt-3 text-lg font-semibold text-violet-100">{formatMoney(result.opportunity.builderDisposition.recommendedSellerOffer)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Assignment fee</p>
                        <p className="mt-3 text-lg font-semibold text-violet-100">{formatMoney(result.opportunity.builderDisposition.suggestedAssignmentFee)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Rehab planning</p>
                        <p className="mt-3 text-lg font-semibold text-violet-100">
                          {formatMoney(result.opportunity.builderDisposition.rehabPlanningLow)} - {formatMoney(result.opportunity.builderDisposition.rehabPlanningHigh)}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Builder strategy</p>
                        <p className="mt-3 text-sm capitalize text-slate-200">{result.opportunity.builderDisposition.strategy.replaceAll("_", " ")}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-400">{result.opportunity.builderDisposition.sellerOutreachAngle}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Contract defaults</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          <div>Earnest money: {formatMoney(result.opportunity.builderDisposition.contractTerms.earnestMoney)}</div>
                          <div>Inspection: {result.opportunity.builderDisposition.contractTerms.inspectionDays} days</div>
                          <div>Close window: {result.opportunity.builderDisposition.contractTerms.closeWindowDays} days</div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm font-medium text-white">Builder buy-box questions</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                        {result.opportunity.builderDisposition.buyBoxQuestions.map((question) => (
                          <li key={question}>• {question}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                    <Hammer className="mx-auto h-8 w-8 text-violet-300" />
                    <p className="mt-3 text-sm text-slate-300">
                      Run the analyzer to see whether the deal is clean enough for a builder or construction disposition lane.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                  Underwriting command
                </CardTitle>
                <p className="text-sm text-slate-400">
                  Deal strength, funding-readiness, and file quality signals for the route that should happen next.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {result ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">Deal strength</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{result.opportunity.dealStrength.summary}</p>
                          </div>
                          <Badge className={dealStrengthTone(result.opportunity.dealStrength.label)}>
                            {result.opportunity.dealStrength.label}
                          </Badge>
                        </div>
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                            <span>Strength score</span>
                            <span>{result.opportunity.dealStrength.score}/100</span>
                          </div>
                          <Progress value={result.opportunity.dealStrength.score} />
                        </div>
                        {result.opportunity.dealStrength.strengths.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {result.opportunity.dealStrength.strengths.map((strength) => (
                              <Badge key={strength} className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                                {strength}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">Funding readiness</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{result.opportunity.fundingReadiness.summary}</p>
                          </div>
                          <Badge className="border-white/10 bg-white/[0.06] text-white">
                            {result.opportunity.fundingReadiness.recommendedPath}
                          </Badge>
                        </div>
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                            <span>Readiness</span>
                            <span>{result.opportunity.fundingReadiness.score}/100</span>
                          </div>
                          <Progress value={result.opportunity.fundingReadiness.score} />
                        </div>
                        <p className="mt-4 text-sm font-medium text-white">{result.opportunity.fundingReadiness.label}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">NOI</p>
                        <p className="mt-3 text-xl font-semibold text-cyan-100">{formatMoney(result.opportunity.metrics.netOperatingIncomeAnnual)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Cap rate</p>
                        <p className="mt-3 text-xl font-semibold text-cyan-100">{formatPercent(result.opportunity.metrics.capRatePercent)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Debt yield</p>
                        <p className="mt-3 text-xl font-semibold text-cyan-100">{formatPercent(result.opportunity.metrics.debtYieldPercent)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Break-even rent</p>
                        <p className="mt-3 text-xl font-semibold text-cyan-100">{formatMoney(result.opportunity.metrics.breakEvenRent)}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Missing file items</p>
                        {result.opportunity.fundingReadiness.missingItems.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.opportunity.fundingReadiness.missingItems.map((item) => (
                              <Badge key={item} className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-300">The file has enough information to start a real review.</p>
                        )}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Risk flags</p>
                        {result.opportunity.riskFlags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.opportunity.riskFlags.map((flag) => (
                              <Badge key={flag} className="border-rose-400/20 bg-rose-400/10 text-rose-100">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-300">No major risk flags surfaced from the current inputs.</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                    <ShieldCheck className="mx-auto h-8 w-8 text-cyan-300" />
                    <p className="mt-3 text-sm text-slate-300">
                      Run the analyzer to score the file quality, funding path, and key investment math.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Calculator className="h-5 w-5 text-cyan-300" />
                  Deal calculators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Max allowable offer</p>
                    <p className="mt-3 text-2xl font-semibold text-cyan-100">{formatMoney(calculator.mao70)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">70% of ARV minus repair budget.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Flip-style target offer</p>
                    <p className="mt-3 text-2xl font-semibold text-blue-100">{formatMoney(calculator.flipOffer)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">ARV minus repairs, target profit, and rough closing/holding buffer.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Rent yield</p>
                    <p className="mt-3 text-2xl font-semibold text-violet-100">{formatPercent(calculator.grossYield)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Annual rent hint divided by rough property value.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Cash review band</p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      {formatMoney(result?.opportunity.metrics.conservativeCashReview)} - {formatMoney(result?.opportunity.metrics.balancedCashReview)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Early screening band before comps and seller conversation.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Monthly cash-flow hint</p>
                    <p className="mt-3 text-lg font-semibold text-white">{formatMoney(calculator.cashFlow)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Rent hint minus the carry fields you enter.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Spread to asking</p>
                    <p className="mt-3 text-lg font-semibold text-white">{formatMoney(calculator.spread)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">Rough ARV/value minus asking price.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyTaxes">Monthly taxes</Label>
                    <Input id="monthlyTaxes" value={form.monthlyTaxes} onChange={(event) => updateField("monthlyTaxes", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyInsurance">Monthly insurance</Label>
                    <Input id="monthlyInsurance" value={form.monthlyInsurance} onChange={(event) => updateField("monthlyInsurance", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyDebtService">Existing loan payment / debt service</Label>
                    <Input id="monthlyDebtService" value={form.monthlyDebtService} onChange={(event) => updateField("monthlyDebtService", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyUtilities">Monthly utilities</Label>
                    <Input id="monthlyUtilities" value={form.monthlyUtilities} onChange={(event) => updateField("monthlyUtilities", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="propertyManagementPercent">Management %</Label>
                    <Input id="propertyManagementPercent" value={form.propertyManagementPercent} onChange={(event) => updateField("propertyManagementPercent", event.target.value)} placeholder="8" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vacancyPercent">Vacancy %</Label>
                    <Input id="vacancyPercent" value={form.vacancyPercent} onChange={(event) => updateField("vacancyPercent", event.target.value)} placeholder="5" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenancePercent">Maintenance %</Label>
                    <Input id="maintenancePercent" value={form.maintenancePercent} onChange={(event) => updateField("maintenancePercent", event.target.value)} placeholder="5" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="otherMonthlyExpenses">Other monthly expenses</Label>
                    <Input id="otherMonthlyExpenses" value={form.otherMonthlyExpenses} onChange={(event) => updateField("otherMonthlyExpenses", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="closingCosts">Closing costs</Label>
                    <Input id="closingCosts" value={form.closingCosts} onChange={(event) => updateField("closingCosts", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holdingPeriodMonths">Holding months</Label>
                    <Input id="holdingPeriodMonths" value={form.holdingPeriodMonths} onChange={(event) => updateField("holdingPeriodMonths", event.target.value)} placeholder="6" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="downPayment">Down payment / equity cash</Label>
                    <Input id="downPayment" value={form.downPayment} onChange={(event) => updateField("downPayment", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interestRate">Interest rate</Label>
                    <Input id="interestRate" value={form.interestRate} onChange={(event) => updateField("interestRate", event.target.value)} placeholder="7.25%" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loanTermYears">Loan term</Label>
                    <Input id="loanTermYears" value={form.loanTermYears} onChange={(event) => updateField("loanTermYears", event.target.value)} placeholder="30" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points">Points</Label>
                    <Input id="points" value={form.points} onChange={(event) => updateField("points", event.target.value)} placeholder="2" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="lenderFees">Lender fees</Label>
                    <Input id="lenderFees" value={form.lenderFees} onChange={(event) => updateField("lenderFees", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loanToCost">LTC %</Label>
                    <Input id="loanToCost" value={form.loanToCost} onChange={(event) => updateField("loanToCost", event.target.value)} placeholder="85" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loanToValue">LTV %</Label>
                    <Input id="loanToValue" value={form.loanToValue} onChange={(event) => updateField("loanToValue", event.target.value)} placeholder="75" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="operatorCashAvailable">Operator cash available</Label>
                    <Input id="operatorCashAvailable" value={form.operatorCashAvailable} onChange={(event) => updateField("operatorCashAvailable", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="privateMoneyAmount">Private money</Label>
                    <Input id="privateMoneyAmount" value={form.privateMoneyAmount} onChange={(event) => updateField("privateMoneyAmount", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gapFundingAmount">Gap funding</Label>
                    <Input id="gapFundingAmount" value={form.gapFundingAmount} onChange={(event) => updateField("gapFundingAmount", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sellerFinanceAmount">Seller finance amount</Label>
                    <Input id="sellerFinanceAmount" value={form.sellerFinanceAmount} onChange={(event) => updateField("sellerFinanceAmount", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="calculatorMonthlyRentEstimate">Monthly rent estimate</Label>
                    <Input
                      id="calculatorMonthlyRentEstimate"
                      value={form.monthlyRentEstimate}
                      onChange={(event) => updateField("monthlyRentEstimate", event.target.value)}
                      placeholder="$"
                      className="bg-slate-950/70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetMonthlyCashFlow">Target monthly cash flow</Label>
                    <Input id="targetMonthlyCashFlow" value={form.targetMonthlyCashFlow} onChange={(event) => updateField("targetMonthlyCashFlow", event.target.value)} placeholder="$250" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creativeDownPayment">Cash to seller now</Label>
                    <Input id="creativeDownPayment" value={form.creativeDownPayment} onChange={(event) => updateField("creativeDownPayment", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creativeNoteInterestRate">Creative note rate</Label>
                    <Input id="creativeNoteInterestRate" value={form.creativeNoteInterestRate} onChange={(event) => updateField("creativeNoteInterestRate", event.target.value)} placeholder="6%" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="existingLoanInterestRate">Existing loan rate</Label>
                    <Input id="existingLoanInterestRate" value={form.existingLoanInterestRate} onChange={(event) => updateField("existingLoanInterestRate", event.target.value)} placeholder="3.25%" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="creativeAmortizationYears">Amortization</Label>
                    <Input id="creativeAmortizationYears" value={form.creativeAmortizationYears} onChange={(event) => updateField("creativeAmortizationYears", event.target.value)} placeholder="30" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creativeBalloonYears">Balloon</Label>
                    <Input id="creativeBalloonYears" value={form.creativeBalloonYears} onChange={(event) => updateField("creativeBalloonYears", event.target.value)} placeholder="7" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="existingLoanRemainingTermYears">Existing term left</Label>
                    <Input id="existingLoanRemainingTermYears" value={form.existingLoanRemainingTermYears} onChange={(event) => updateField("existingLoanRemainingTermYears", event.target.value)} placeholder="22" className="bg-slate-950/70" />
                  </div>
                </div>
                <p className="mt-3 text-xs leading-6 text-slate-500">
                  Leave the creative fields blank if you want the analyzer to use default screening assumptions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Route className="h-5 w-5 text-cyan-300" />
                  Capital stack builder
                </CardTitle>
                <p className="text-sm text-slate-400">
                  Modeled debt, reserves, and operator cash so VestBlock can see whether the deal is actually financeable.
                </p>
              </CardHeader>
              <CardContent>
                {result ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Senior debt</p>
                        <p className="mt-3 text-xl font-semibold text-cyan-100">{formatMoney(result.opportunity.capitalStack.seniorDebt)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Total cash needed</p>
                        <p className="mt-3 text-xl font-semibold text-cyan-100">{formatMoney(result.opportunity.metrics.totalCashNeeded)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Funding gap</p>
                        <p className="mt-3 text-xl font-semibold text-cyan-100">{formatMoney(result.opportunity.capitalStack.fundingGap)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Operator cash</p>
                        <p className="mt-3 text-xl font-semibold text-cyan-100">{formatMoney(result.opportunity.capitalStack.operatorCash)}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Private money</p>
                        <p className="mt-3 text-lg font-semibold text-white">{formatMoney(result.opportunity.capitalStack.privateMoney)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Seller finance</p>
                        <p className="mt-3 text-lg font-semibold text-white">{formatMoney(result.opportunity.capitalStack.sellerFinance)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Reserves</p>
                        <p className="mt-3 text-lg font-semibold text-white">{formatMoney(result.opportunity.capitalStack.estimatedReserves)}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Cash on cash</p>
                        <p className="mt-3 text-lg font-semibold text-white">{formatPercent(result.opportunity.metrics.cashOnCashReturnPercent)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Rent / price</p>
                        <p className="mt-3 text-lg font-semibold text-white">{formatPercent(result.opportunity.metrics.rentToPriceRatioPercent)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Flip profit</p>
                        <p className="mt-3 text-lg font-semibold text-white">{formatMoney(result.opportunity.metrics.flipProfit)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm font-medium text-white">Flip ROI</p>
                        <p className="mt-3 text-lg font-semibold text-white">{formatPercent(result.opportunity.metrics.flipRoiPercent)}</p>
                      </div>
                    </div>
                    {result.opportunity.capitalStack.notes.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {result.opportunity.capitalStack.notes.map((note) => (
                          <Badge key={note} className="border-white/10 bg-white/[0.06] text-slate-100">
                            {note}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                    <Route className="mx-auto h-8 w-8 text-cyan-300" />
                    <p className="mt-3 text-sm text-slate-300">
                      Run the analyzer to see whether the capital stack really covers the modeled deal.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Calculator className="h-5 w-5 text-cyan-300" />
                  Creative offer generator
                </CardTitle>
                <p className="text-sm text-slate-400">
                  Rough seller-finance and subject-to structures based on rent, carry, payoff, and the cash-flow target you want to protect.
                </p>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {result.opportunity.creativeOffers.map((offer) => (
                      <div key={offer.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-white">{offer.label}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{offer.summary}</p>
                          </div>
                          <Badge className={creativeViabilityTone(offer.viability)}>{offer.viability}</Badge>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Max price</p>
                            <p className="mt-2 text-lg font-semibold text-white">{formatMoney(offer.metrics.maxPriceToHitTargetCashFlow)}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Suggested price</p>
                            <p className="mt-2 text-lg font-semibold text-white">{formatMoney(offer.metrics.suggestedPurchasePrice)}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Cash to seller now</p>
                            <p className="mt-2 text-lg font-semibold text-white">{formatMoney(offer.metrics.cashToSellerNow)}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Cash to close</p>
                            <p className="mt-2 text-lg font-semibold text-white">{formatMoney(offer.metrics.cashToClose)}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                              {offer.key === "subject_to"
                                ? "Seller carry payment"
                                : offer.key === "wrap_mortgage"
                                  ? "Wrap note payment"
                                  : "Note payment"}
                            </p>
                            <p className="mt-2 text-lg font-semibold text-white">{formatMoney(offer.metrics.monthlyPayment)}</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Monthly cash flow</p>
                            <p className="mt-2 text-lg font-semibold text-white">{formatMoney(offer.metrics.estimatedMonthlyCashFlow)}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Rate</p>
                            <p className="mt-1 text-sm font-medium text-white">{formatPercent(offer.metrics.noteRatePercent)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Amortization</p>
                            <p className="mt-1 text-sm font-medium text-white">{formatYears(offer.metrics.amortizationYears)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Balloon</p>
                            <p className="mt-1 text-sm font-medium text-white">{formatYears(offer.metrics.balloonYears)}</p>
                          </div>
                        </div>
                        {(offer.key === "subject_to" || offer.key === "wrap_mortgage") && (
                          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Existing loan stack</p>
                            <p className="mt-2 text-sm text-slate-300">
                              Balance {formatMoney(offer.metrics.existingLoanBalance)} • Payment {formatMoney(offer.metrics.existingLoanPayment)}
                            </p>
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm text-slate-400">
                          <span>Balloon due estimate {formatMoney(offer.metrics.balloonBalance)}</span>
                          <span>Target cash flow {formatMoney(offer.metrics.targetMonthlyCashFlow)}</span>
                        </div>
                        {offer.caution ? (
                          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                            {offer.caution}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
                    <Calculator className="mx-auto h-8 w-8 text-cyan-300" />
                    <p className="mt-3 text-sm text-slate-300">
                      Run the analyzer to size rough seller-finance and subject-to structures.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {result && (
              <Card className="border-cyan-400/20 bg-cyan-400/10 backdrop-blur-xl">
                <CardContent className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-cyan-100">
                      <CheckCircle2 className="h-5 w-5" />
                      <p className="font-medium">Ready to turn this into a real routing packet?</p>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      Submit the property so VestBlock can review fast cash, creative, novation, buyer, lender, and partner routes with real context.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/15 bg-slate-950/25 text-white hover:bg-white/[0.08]"
                      onClick={() => void handleDownloadReport("investor")}
                      disabled={isDownloading !== null}
                    >
                      {isDownloading === "investor" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Investor Report
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/15 bg-slate-950/25 text-white hover:bg-white/[0.08]"
                      onClick={() => void handleDownloadReport("builder")}
                      disabled={isDownloading !== null}
                    >
                      {isDownloading === "builder" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hammer className="mr-2 h-4 w-4" />}
                      Builder Packet
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/15 bg-slate-950/25 text-white hover:bg-white/[0.08]"
                      onClick={() => void handleDownloadReport("assignment_contract")}
                      disabled={isDownloading !== null}
                    >
                      {isDownloading === "assignment_contract" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Assignment Draft
                    </Button>
                    <Button asChild className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                      <Link href={sellerHref}>
                        Submit for Routing
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {result && (
              <Card className="border-white/10 bg-slate-950/70 backdrop-blur-xl">
                <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Download className="h-5 w-5 text-cyan-300" />
                  Routing packets
                </CardTitle>
                <p className="text-sm text-slate-400">
                    Export the current analyzer readout into operator-friendly packets for investors, buyers, lenders, and builder disposition.
                </p>
              </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => void handleDownloadReport("investor")}
                    disabled={isDownloading !== null}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-cyan-200" />
                      <div>
                        <div className="font-medium text-white">Investor report</div>
                        <div className="text-sm text-slate-400">Deal math, routes, risk, and next steps.</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-cyan-100">
                      {isDownloading === "investor" ? "Generating..." : "Download"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadReport("buyer")}
                    disabled={isDownloading !== null}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-cyan-200" />
                      <div>
                        <div className="font-medium text-white">Buyer packet</div>
                        <div className="text-sm text-slate-400">Property summary, price framing, and buyer-fit notes.</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-cyan-100">
                      {isDownloading === "buyer" ? "Generating..." : "Download"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadReport("builder")}
                    disabled={isDownloading !== null}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <Hammer className="h-5 w-5 text-cyan-200" />
                      <div>
                        <div className="font-medium text-white">Builder packet</div>
                        <div className="text-sm text-slate-400">MAO-backed builder lane, buy-box prompts, and assignment angle.</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-cyan-100">
                      {isDownloading === "builder" ? "Generating..." : "Download"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadReport("lender")}
                    disabled={isDownloading !== null}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-cyan-200" />
                      <div>
                        <div className="font-medium text-white">Lender packet</div>
                        <div className="text-sm text-slate-400">Funding readiness, DSCR, capital stack, and missing items.</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-cyan-100">
                      {isDownloading === "lender" ? "Generating..." : "Download"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadReport("assignment_contract")}
                    disabled={isDownloading !== null}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-cyan-200" />
                      <div>
                        <div className="font-medium text-white">Assignment draft</div>
                        <div className="text-sm text-slate-400">Planning-grade assignment agreement for builder or construction review.</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-cyan-100">
                      {isDownloading === "assignment_contract" ? "Generating..." : "Download"}
                    </div>
                  </button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
