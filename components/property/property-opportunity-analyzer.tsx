"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Calculator, CheckCircle2, Home, Loader2, Route, ShieldCheck, SlidersHorizontal, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

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

type AnalyzerForm = {
  propertyAddress: string
  city: string
  state: string
  zipCode: string
  propertyType: string
  bedrooms: string
  bathrooms: string
  squareFeet: string
  propertyCondition: string
  occupancyStatus: string
  timelineToSell: string
  estimatedValue: string
  askingPrice: string
  afterRepairValue: string
  repairBudget: string
  mortgageBalance: string
  liensOrTaxes: string
  monthlyTaxes: string
  monthlyInsurance: string
  monthlyDebtService: string
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
    }
    creativeOffers: Array<{
      key: "seller_finance" | "subject_to"
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
  propertyType: "",
  bedrooms: "",
  bathrooms: "",
  squareFeet: "",
  propertyCondition: "",
  occupancyStatus: "",
  timelineToSell: "",
  estimatedValue: "",
  askingPrice: "",
  afterRepairValue: "",
  repairBudget: "",
  mortgageBalance: "",
  liensOrTaxes: "",
  monthlyTaxes: "",
  monthlyInsurance: "",
  monthlyDebtService: "",
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

  const updateField = (field: keyof AnalyzerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const calculator = useMemo(() => {
    const arv = parseMoney(form.afterRepairValue) ?? result?.opportunity.metrics.arv ?? result?.estimate.estimateValue ?? null
    const repairs = parseMoney(form.repairBudget) ?? result?.opportunity.metrics.repairBudget ?? 0
    const rent = result?.estimate.rentEstimate ?? null
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedValue">Estimated value</Label>
                    <Input id="estimatedValue" value={form.estimatedValue} onChange={(event) => updateField("estimatedValue", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="askingPrice">Asking price</Label>
                    <Input id="askingPrice" value={form.askingPrice} onChange={(event) => updateField("askingPrice", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repairBudget">Repair budget</Label>
                    <Input id="repairBudget" value={form.repairBudget} onChange={(event) => updateField("repairBudget", event.target.value)} placeholder="$" className="bg-slate-950/70" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
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
              { label: "Rent hint", value: formatMoney(result?.estimate.rentEstimate), icon: Home },
              { label: "Creative max", value: formatMoney(result?.opportunity.creativeOffers?.[0]?.metrics.maxPriceToHitTargetCashFlow ?? null), icon: Route },
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
                <div className="mt-5 grid gap-4 md:grid-cols-4">
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
                              {offer.key === "subject_to" ? "Seller carry payment" : "Note payment"}
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
                        {offer.key === "subject_to" && (
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
                  <Button asChild className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                    <Link href={sellerHref}>
                      Submit for Routing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
