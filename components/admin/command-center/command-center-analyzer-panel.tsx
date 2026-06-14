"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, Download, FileText, Home, Loader2, Radar, ShieldCheck, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type CommandCenterComparableForm = {
  address: string
  salePrice: string
  squareFeet: string
  distanceMiles: string
}

function createEmptyComparable(): CommandCenterComparableForm {
  return {
    address: "",
    salePrice: "",
    squareFeet: "",
    distanceMiles: "",
  }
}

const COMMAND_CENTER_COMP_LIMIT = 6

function createComparableRows() {
  return Array.from({ length: COMMAND_CENTER_COMP_LIMIT }, () => createEmptyComparable())
}

type CommandCenterAnalyzerForm = {
  propertyAddress: string
  city: string
  state: string
  zipCode: string
  selectedComps: CommandCenterComparableForm[]
  listingStatus: string
  daysOnMarket: string
  priceCutCount: string
  listingNotes: string
  propertyType: string
  propertyCondition: string
  timelineToSell: string
  askingPrice: string
  monthlyRentEstimate: string
  afterRepairValue: string
  repairBudget: string
  assignmentFee: string
  preferredSalePath: string
  exitStrategy: string
}

type PropertyCommandEventDetail = Partial<
  Pick<
    CommandCenterAnalyzerForm,
    | "propertyAddress"
    | "city"
    | "state"
    | "zipCode"
    | "propertyType"
    | "propertyCondition"
    | "askingPrice"
    | "monthlyRentEstimate"
    | "afterRepairValue"
    | "repairBudget"
    | "assignmentFee"
  >
>

export type PropertyCommandSeed = PropertyCommandEventDetail & {
  id: number
}

type CommandCenterAnalyzerResult = {
  success: boolean
  address: string
  estimate: {
    sourceLabel: string
    estimateValue: number | null
    lowEstimate: number | null
    highEstimate: number | null
    rentEstimate: number | null
    confidenceLabel: string
    disclaimer: string
  }
  opportunity: {
    metrics: {
      mao70: number | null
      conservativeCashReview: number | null
      balancedCashReview: number | null
      estimatedMonthlyCashFlow: number | null
      dscr: number | null
      capRatePercent: number | null
      flipProfit: number | null
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
        pricePerFoot: number | null
      }>
    }
    listingContext: {
      pressureLabel: string
      summary: string
      daysOnMarket: number | null
      priceCutCount: number | null
      signals: string[]
    }
    dealStrength: {
      score: number
      label: string
      summary: string
    }
    fundingReadiness: {
      label: string
      recommendedPath: string
      summary: string
      missingItems: string[]
    }
    routeFit: Array<{
      key: string
      label: string
      score: number
      summary: string
    }>
    builderDisposition: {
      label: string
      summary: string
      builderMaxPurchase: number | null
      recommendedSellerOffer: number | null
      suggestedAssignmentFee: number | null
      projectedGrossSpread: number | null
      nextSteps: string[]
    }
    buyerInterest: {
      label: string
      score: number
      summary: string
    }
    riskFlags: string[]
    nextSteps: string[]
  }
}

const propertyTypes = [
  "Single Family",
  "Duplex / Triplex / Fourplex",
  "Multifamily",
  "Land",
  "Commercial",
  "Other",
]

const propertyConditions = ["Unknown", "Good", "Fair / Dated", "Needs Repairs", "Major Repairs", "Vacant / Distressed"]
const listingStatuses = [
  "Off market / private",
  "New listing",
  "Active",
  "Price reduced",
  "Expired / withdrawn",
  "Pending",
]
const sellerPaths = [
  { value: "not_sure", label: "Not sure yet" },
  { value: "fast_cash", label: "Fast cash" },
  { value: "creative", label: "Creative" },
  { value: "novation", label: "Novation" },
]

const exitStrategies = [
  { value: "not_sure", label: "Not sure yet" },
  { value: "flip", label: "Fix and flip" },
  { value: "rental", label: "Rental hold" },
  { value: "brrrr", label: "BRRRR" },
  { value: "wholesale", label: "Wholesale" },
  { value: "seller_finance", label: "Seller finance hold" },
]

function createInitialForm(): CommandCenterAnalyzerForm {
  return {
    propertyAddress: "",
    city: "",
    state: "",
    zipCode: "",
    selectedComps: createComparableRows(),
    listingStatus: "",
    daysOnMarket: "",
    priceCutCount: "",
    listingNotes: "",
    propertyType: "Single Family",
    propertyCondition: "Unknown",
    timelineToSell: "Flexible",
    askingPrice: "",
    monthlyRentEstimate: "",
    afterRepairValue: "",
    repairBudget: "",
    assignmentFee: "",
    preferredSalePath: "not_sure",
    exitStrategy: "not_sure",
  }
}

function money(value: number | null | undefined) {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function metricTone(value: number | null | undefined, goodThreshold: number, watchThreshold = 0) {
  if (!Number.isFinite(value)) return "text-slate-400"
  if (Number(value) >= goodThreshold) return "text-emerald-300"
  if (Number(value) > watchThreshold) return "text-amber-200"
  return "text-rose-300"
}

function dealGradeTone(value: CommandCenterAnalyzerResult["opportunity"]["dealMath"]["grade"]) {
  if (value === "GOOD") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
  if (value === "RISKY") return "border-rose-400/20 bg-rose-400/10 text-rose-100"
  return "border-white/10 bg-white/[0.04] text-slate-200"
}

export function CommandCenterAnalyzerPanel({ commandSeed }: { commandSeed?: PropertyCommandSeed | null }) {
  const [form, setForm] = useState<CommandCenterAnalyzerForm>(() => createInitialForm())
  const [result, setResult] = useState<CommandCenterAnalyzerResult | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState<"builder" | "lender" | "buyer" | "assignment_contract" | null>(null)

  const applyPropertyCommand = useCallback((detail: PropertyCommandEventDetail) => {
    if (!detail.propertyAddress?.trim()) return

    setForm((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(detail)
          .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
          .map(([field, value]) => [field, String(value).trim()])
      ),
    }))
    setResult(null)
    setError("")
  }, [])

  useEffect(() => {
    if (!commandSeed) return
    applyPropertyCommand(commandSeed)
  }, [applyPropertyCommand, commandSeed])

  useEffect(() => {
    const handlePropertyCommand = (event: Event) => {
      applyPropertyCommand((event as CustomEvent<PropertyCommandEventDetail>).detail || {})
    }

    window.addEventListener("vestblock:property-command", handlePropertyCommand as EventListener)
    return () => window.removeEventListener("vestblock:property-command", handlePropertyCommand as EventListener)
  }, [applyPropertyCommand])

  const routeFit = useMemo(
    () => [...(result?.opportunity.routeFit || [])].sort((left, right) => right.score - left.score).slice(0, 3),
    [result]
  )

  const updateField = (field: keyof CommandCenterAnalyzerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateComparable = (index: number, field: keyof CommandCenterComparableForm, value: string) => {
    setForm((current) => ({
      ...current,
      selectedComps: current.selectedComps.map((comp, compIndex) =>
        compIndex === index ? { ...comp, [field]: value } : comp
      ),
    }))
  }

  const handleAnalyze = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

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
      const payload = (await response.json()) as CommandCenterAnalyzerResult & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Unable to analyze this property.")
      setResult(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to analyze this property.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (reportType: "builder" | "lender" | "buyer" | "assignment_contract") => {
    if (!result) return

    setIsDownloading(reportType)
    setError("")
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error || "Unable to generate the packet.")
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
      setError(caught instanceof Error ? caught.message : "Unable to generate the packet.")
    } finally {
      setIsDownloading(null)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200">
              <Home className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-white">Property command</h2>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
            Drop an address into the cockpit and get a live first-pass route: value band, cash-review range,
            buyer/lender fit, builder spread, and the next move.
          </p>
        </div>
        <Link
          href="/property-analyzer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-300/40 hover:text-white"
        >
          Open full analyzer
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleAnalyze} className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="cc-property-address" className="text-xs text-slate-300">Property address</Label>
              <Input
                id="cc-property-address"
                value={form.propertyAddress}
                onChange={(event) => updateField("propertyAddress", event.target.value)}
                placeholder="123 Example St"
                className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="cc-city" className="text-xs text-slate-300">City</Label>
                <Input
                  id="cc-city"
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder="Milwaukee"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cc-state" className="text-xs text-slate-300">State</Label>
                <Input
                  id="cc-state"
                  value={form.state}
                  onChange={(event) => updateField("state", event.target.value)}
                  placeholder="WI"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cc-zip" className="text-xs text-slate-300">ZIP</Label>
                <Input
                  id="cc-zip"
                  value={form.zipCode}
                  onChange={(event) => updateField("zipCode", event.target.value)}
                  placeholder="53206"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-2">
                <Label className="text-xs text-slate-300">Property type</Label>
                <Select value={form.propertyType} onValueChange={(value) => updateField("propertyType", value)}>
                  <SelectTrigger className="border-white/10 bg-slate-950/70 text-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-slate-300">Condition</Label>
                <Select value={form.propertyCondition} onValueChange={(value) => updateField("propertyCondition", value)}>
                  <SelectTrigger className="border-white/10 bg-slate-950/70 text-white">
                    <SelectValue placeholder="Condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyConditions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-slate-300">Seller path</Label>
                <Select value={form.preferredSalePath} onValueChange={(value) => updateField("preferredSalePath", value)}>
                  <SelectTrigger className="border-white/10 bg-slate-950/70 text-white">
                    <SelectValue placeholder="Seller path" />
                  </SelectTrigger>
                  <SelectContent>
                    {sellerPaths.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="grid gap-2">
                <Label htmlFor="cc-asking" className="text-xs text-slate-300">Asking</Label>
                <Input
                  id="cc-asking"
                  value={form.askingPrice}
                  onChange={(event) => updateField("askingPrice", event.target.value)}
                  placeholder="175000"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cc-rent" className="text-xs text-slate-300">Monthly rent</Label>
                <Input
                  id="cc-rent"
                  value={form.monthlyRentEstimate}
                  onChange={(event) => updateField("monthlyRentEstimate", event.target.value)}
                  placeholder="2400"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cc-arv" className="text-xs text-slate-300">ARV</Label>
                <Input
                  id="cc-arv"
                  value={form.afterRepairValue}
                  onChange={(event) => updateField("afterRepairValue", event.target.value)}
                  placeholder="245000"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cc-repairs" className="text-xs text-slate-300">Repairs</Label>
                <Input
                  id="cc-repairs"
                  value={form.repairBudget}
                  onChange={(event) => updateField("repairBudget", event.target.value)}
                  placeholder="45000"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cc-assignment" className="text-xs text-slate-300">Assignment fee</Label>
                <Input
                  id="cc-assignment"
                  value={form.assignmentFee}
                  onChange={(event) => updateField("assignmentFee", event.target.value)}
                  placeholder="10000"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-slate-300">Exit</Label>
                <Select value={form.exitStrategy} onValueChange={(value) => updateField("exitStrategy", value)}>
                  <SelectTrigger className="border-white/10 bg-slate-950/70 text-white">
                    <SelectValue placeholder="Exit" />
                  </SelectTrigger>
                  <SelectContent>
                    {exitStrategies.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[10000, 15000, 20000, 25000].map((fee) => (
                <button
                  key={fee}
                  type="button"
                  onClick={() => updateField("assignmentFee", String(fee))}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.68rem] text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-white"
                >
                  ${fee.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">Comp-backed ARV</p>
                  <p className="mt-1 text-[0.72rem] leading-5 text-slate-400">
                    Add sold comps and the command center will switch from the baseline estimate to a comp average.
                  </p>
                </div>
                <Badge className="border-white/10 bg-white/[0.04] text-slate-200">
                  {result?.opportunity.comparables.usedCount ?? form.selectedComps.filter((comp) => comp.salePrice.trim()).length} comps
                </Badge>
              </div>
              <div className="mt-3 space-y-3">
                {form.selectedComps.map((comp, index) => (
                  <div key={`cc-comp-${index}`} className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.45fr_0.45fr]">
                    <Input
                      value={comp.address}
                      onChange={(event) => updateComparable(index, "address", event.target.value)}
                      placeholder={`Comp ${index + 1} address`}
                      className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    />
                    <Input
                      value={comp.salePrice}
                      onChange={(event) => updateComparable(index, "salePrice", event.target.value)}
                      placeholder="Sale price"
                      className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    />
                    <Input
                      value={comp.squareFeet}
                      onChange={(event) => updateComparable(index, "squareFeet", event.target.value)}
                      placeholder="Sqft"
                      className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    />
                    <Input
                      value={comp.distanceMiles}
                      onChange={(event) => updateComparable(index, "distanceMiles", event.target.value)}
                      placeholder="Mi"
                      className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs font-semibold text-white">Listing pressure</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Select value={form.listingStatus} onValueChange={(value) => updateField("listingStatus", value)}>
                  <SelectTrigger className="border-white/10 bg-slate-950/70 text-white">
                    <SelectValue placeholder="Listing status" />
                  </SelectTrigger>
                  <SelectContent>
                    {listingStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={form.daysOnMarket}
                  onChange={(event) => updateField("daysOnMarket", event.target.value)}
                  placeholder="Days on market"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
                <Input
                  value={form.priceCutCount}
                  onChange={(event) => updateField("priceCutCount", event.target.value)}
                  placeholder="Price cuts"
                  className="border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
              </div>
              <Input
                value={form.listingNotes}
                onChange={(event) => updateField("listingNotes", event.target.value)}
                placeholder="Listing notes, stale remarks, tenant notes, photo condition..."
                className="mt-3 border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isLoading} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
              Analyze property
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(createInitialForm())
                setResult(null)
                setError("")
              }}
              className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
            >
              Clear
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          {result ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="vb-mono text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">Analyzed address</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{result.address}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {result.estimate.sourceLabel} · {result.estimate.confidenceLabel}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                    {result.opportunity.dealStrength.label}
                  </Badge>
                  <Badge className={dealGradeTone(result.opportunity.dealMath.grade)}>
                    {result.opportunity.dealMath.grade ?? "Needs details"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {[
                  { label: "Value band", value: result.estimate.lowEstimate && result.estimate.highEstimate ? `${money(result.estimate.lowEstimate)} - ${money(result.estimate.highEstimate)}` : money(result.estimate.estimateValue), tone: "text-white" },
                  { label: "70% MAO", value: money(result.opportunity.metrics.mao70), tone: "text-cyan-200" },
                  { label: "Builder max", value: money(result.opportunity.builderDisposition.builderMaxPurchase), tone: "text-emerald-300" },
                  { label: "Seller offer", value: money(result.opportunity.builderDisposition.recommendedSellerOffer), tone: "text-amber-200" },
                  { label: "Deal assignment", value: money(result.opportunity.dealMath.assignmentFee), tone: "text-violet-300" },
                  { label: "Builder spread", value: money(result.opportunity.builderDisposition.projectedGrossSpread), tone: "text-cyan-200" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                    <p className={`mt-1 text-base font-semibold tabular-nums ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-white">Assignment math</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Rule {(result.opportunity.dealMath.rulePercent * 100).toFixed(0)}% {result.opportunity.dealMath.ruleType} · ARV source {result.opportunity.dealMath.arvMode}
                    </p>
                  </div>
                  <Badge className={dealGradeTone(result.opportunity.dealMath.grade)}>
                    {result.opportunity.dealMath.grade ?? "Needs details"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "MAO w/ fee", value: money(result.opportunity.dealMath.mao) },
                    { label: "Seller ask", value: money(result.opportunity.dealMath.sellerAsk) },
                    { label: "Spread", value: money(result.opportunity.dealMath.spread) },
                    { label: "End-buyer profit", value: money(result.opportunity.dealMath.endBuyerProfit) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2">
                      <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                  <p className="text-xs font-semibold text-white">Comp-backed ARV</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2">
                      <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Comp count</p>
                      <p className="mt-1 text-sm font-semibold text-white">{result.opportunity.comparables.usedCount}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2">
                      <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Avg sale</p>
                      <p className="mt-1 text-sm font-semibold text-white">{money(result.opportunity.comparables.averageSalePrice)}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2">
                      <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Avg $/sqft</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {result.opportunity.comparables.averagePricePerFoot !== null
                          ? `$${result.opportunity.comparables.averagePricePerFoot}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                  <p className="text-xs font-semibold text-white">Listing pressure</p>
                  <p className="mt-2 text-sm font-medium text-cyan-100">{result.opportunity.listingContext.pressureLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{result.opportunity.listingContext.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {result.opportunity.listingContext.signals.length ? (
                      result.opportunity.listingContext.signals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[0.65rem] text-slate-200"
                        >
                          {signal}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">Add listing signals if you want seller-pressure context in the stack.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-white">Funding path</p>
                        <p className="mt-1 text-xs text-slate-400">{result.opportunity.fundingReadiness.summary}</p>
                      </div>
                      <Badge variant="outline" className="border-white/10 text-slate-200">
                        {result.opportunity.fundingReadiness.recommendedPath}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Buyer fit</p>
                      <p className="mt-1 text-sm font-semibold text-white">{result.opportunity.buyerInterest.label}</p>
                      <p className="text-[0.65rem] text-slate-500">{result.opportunity.buyerInterest.score}/100</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">DSCR</p>
                      <p className={`mt-1 text-sm font-semibold ${metricTone(result.opportunity.metrics.dscr, 1.2, 1)}`}>
                        {Number.isFinite(result.opportunity.metrics.dscr) ? result.opportunity.metrics.dscr?.toFixed(2) : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="vb-mono text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Cash flow</p>
                      <p className={`mt-1 text-sm font-semibold ${metricTone(result.opportunity.metrics.estimatedMonthlyCashFlow, 250, 0)}`}>
                        {money(result.opportunity.metrics.estimatedMonthlyCashFlow)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-cyan-200" />
                      <p className="text-xs font-semibold text-white">Risk flags</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.opportunity.riskFlags.length ? (
                        result.opportunity.riskFlags.slice(0, 6).map((flag) => (
                          <span
                            key={flag}
                            className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2 py-0.5 text-[0.65rem] text-amber-100"
                          >
                            {flag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">No major risk flags surfaced from this pass.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-cyan-200" />
                      <p className="text-xs font-semibold text-white">Route stack</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {routeFit.map((route) => (
                        <div key={route.key} className="rounded-xl border border-white/[0.06] bg-slate-950/40 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium text-slate-100">{route.label}</p>
                            <span className="vb-mono text-[0.7rem] text-cyan-200">{route.score}/100</span>
                          </div>
                          <p className="mt-1 text-[0.7rem] leading-5 text-slate-400">{route.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-cyan-200" />
                      <p className="text-xs font-semibold text-white">Packets & next moves</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["builder", "lender", "buyer", "assignment_contract"] as const).map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant="outline"
                          disabled={isDownloading !== null}
                          onClick={() => void handleDownload(type)}
                          className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
                        >
                          {isDownloading === type ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : type === "assignment_contract" ? (
                            <FileText className="mr-2 h-4 w-4" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          {type === "builder"
                            ? "Builder packet"
                            : type === "lender"
                              ? "Lender packet"
                              : type === "buyer"
                                ? "Buyer packet"
                                : "Assignment draft"}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      {(result.opportunity.builderDisposition.nextSteps.length
                        ? result.opportunity.builderDisposition.nextSteps
                        : result.opportunity.nextSteps
                      )
                        .slice(0, 5)
                        .map((step) => (
                          <div key={step} className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-3 py-2 text-[0.72rem] text-slate-300">
                            {step}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[0.65rem] leading-5 text-slate-500">{result.estimate.disclaimer}</p>
            </div>
          ) : (
            <div className="flex h-full min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-6 text-center">
              <div className="max-w-md">
                <p className="text-sm font-medium text-white">No property analyzed yet</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  Run a quick address screen here when you want instant routing context without leaving the command center.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
