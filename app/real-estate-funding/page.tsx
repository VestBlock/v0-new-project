"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { buildPartnerReferralPath, partnerReferralDefinitions } from "@/lib/partners/referrals"
import {
  ArrowUpRight,
  Building2,
  DollarSign,
  Send,
  Loader2,
  Home,
  Hammer,
  Phone
} from "lucide-react"

export default function RealEstateFundingPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loanType, setLoanType] = useState<string>("")

  // Common fields
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [creditScoreRange, setCreditScoreRange] = useState("")
  const [requestedLoanAmount, setRequestedLoanAmount] = useState("")
  const [availableLiquidity, setAvailableLiquidity] = useState("")
  const [vestingOrEntityName, setVestingOrEntityName] = useState("")
  const [fundingGoal, setFundingGoal] = useState("")

  // DSCR specific fields
  const [entity, setEntity] = useState("")
  const [propertyAddress, setPropertyAddress] = useState("")
  const [propertyType, setPropertyType] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [estimatedValue, setEstimatedValue] = useState("")
  const [expectedRent, setExpectedRent] = useState("")
  const [occupancy, setOccupancy] = useState("")
  const [downPaymentLtv, setDownPaymentLtv] = useState("")
  const [taxesInsuranceHoa, setTaxesInsuranceHoa] = useState("")
  const [closingDate, setClosingDate] = useState("")
  const [notes, setNotes] = useState("")

  // Hard Money specific fields
  const [experienceLevel, setExperienceLevel] = useState("")
  const [rehabBudget, setRehabBudget] = useState("")
  const [arv, setArv] = useState("")
  const [exitStrategy, setExitStrategy] = useState("")
  const [closingTimeline, setClosingTimeline] = useState("")
  const [fundsNeeded, setFundsNeeded] = useState("")
  const [purchaseContractStatus, setPurchaseContractStatus] = useState("")
  const [contractorReady, setContractorReady] = useState("")

  const handlePhoneClick = () => {
    // Track phone click conversion
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'event_category': 'Real Estate Funding',
        'event_label': 'Phone Click'
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!loanType) {
      toast({
        title: "Please select a loan type",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      const formData = {
        loanType,
        fullName,
        email,
        phone,
        creditScoreRange,
        requestedLoanAmount,
        availableLiquidity,
        vestingOrEntityName,
        fundingGoal,
        ...(loanType === "dscr" ? {
          entity,
          propertyAddress,
          propertyType,
          purchasePrice,
          estimatedValue,
          expectedRent,
          occupancy,
          downPaymentLtv,
          taxesInsuranceHoa,
          closingDate,
          notes
        } : {
          experienceLevel,
          propertyAddress,
          purchasePrice,
          rehabBudget,
          arv,
          exitStrategy,
          closingTimeline,
          fundsNeeded,
          purchaseContractStatus,
          contractorReady,
          notes
        })
      }

      const response = await fetch("/api/real-estate-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error("Failed to submit")
      const result = await response.json()

      // Track form submission conversion
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          'event_category': 'Real Estate Funding',
          'event_label': 'Form Submit',
          'loan_type': loanType
        })
      }

      const thanksParams = new URLSearchParams()
      thanksParams.set("loanType", loanType)
      if (result?.leadId) {
        thanksParams.set("leadId", result.leadId)
      }

      router.push(`/real-estate-funding/thanks?${thanksParams.toString()}`)
    } catch (_error) {
      toast({
        title: "Submission Failed",
        description: "Please try again or contact us directly.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="premium-page">
      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-500 px-4 py-2 rounded-full mb-6">
            <Building2 className="h-5 w-5" />
            <span className="text-sm font-medium">Real Estate Funding</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Real Estate Deal Review And{" "}
            <span className="gradient-text">Funding Support</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Submit the deal details, timeline, and property information so
            VestBlock can review whether the best next move is DSCR, hard
            money, or more preparation before lender conversations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-5">
            <Button
              size="lg"
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
              onClick={() =>
                document.getElementById("loan-type-selection")?.scrollIntoView({
                  behavior: "smooth",
                })
              }
            >
              <Building2 className="mr-2 h-5 w-5" />
              Review My Deal
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/services/financial-growth#request-service">
                Request Paid Deal Review
              </Link>
            </Button>
          </div>
          <a
            href="mailto:contact@vestblock.io?subject=Real%20Estate%20Funding%20Question"
            onClick={handlePhoneClick}
            className="inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-400 transition-colors"
          >
            <Phone className="h-5 w-5" />
            <span className="font-medium">Prefer to talk? Email VestBlock</span>
          </a>
        </div>
      </section>

      <section className="pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Submit the deal</CardTitle>
                <CardDescription>
                  Share property type, requested amount, liquidity, timeline, and the real estate use case.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Review the deal</CardTitle>
                <CardDescription>
                  VestBlock uses the deal details to judge whether the scenario looks ready for lender conversations or still needs more preparation.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="text-lg">Choose the next step</CardTitle>
                <CardDescription>
                  Stronger deals can move toward partner conversations. Other deals can move into paid review or more preparation first.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="pb-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-2xl">Partner paths VestBlock can open when the deal is strong</CardTitle>
              <CardDescription>
                These options are best used when the property, reserves, timeline, and borrower details are already fairly organized. VestBlock tracks the click first so the follow-up stays tied to the deal context on our side.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40">
                <div className="mb-3 flex items-center gap-2">
                  <Home className="h-5 w-5 text-cyan-500" />
                  <h3 className="text-lg font-semibold">{partnerReferralDefinitions.kiavi.displayName}</h3>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {partnerReferralDefinitions.kiavi.fitSummary}
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  {partnerReferralDefinitions.kiavi.disclosure}
                </p>
                <Button asChild className="w-full bg-cyan-600 hover:bg-cyan-700">
                  <a
                    href={buildPartnerReferralPath({
                      partnerKey: "kiavi",
                      source: "real-estate-funding",
                      loanType: loanType || "dscr",
                      service: "real_estate_funding"
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {partnerReferralDefinitions.kiavi.ctaLabel}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-amber-500" />
                  <h3 className="text-lg font-semibold">{partnerReferralDefinitions.rcn.displayName}</h3>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  {partnerReferralDefinitions.rcn.fitSummary}
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  {partnerReferralDefinitions.rcn.disclosure}
                </p>
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={buildPartnerReferralPath({
                      partnerKey: "rcn",
                      source: "real-estate-funding",
                      loanType: loanType || "hard-money",
                      service: "real_estate_funding"
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {partnerReferralDefinitions.rcn.ctaLabel}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Loan Type Selection */}
      <section id="loan-type-selection" className="py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card
              className={`cursor-pointer transition-all hover:border-cyan-500/50 ${loanType === 'dscr' ? 'border-2 border-cyan-500 bg-cyan-500/5' : ''}`}
              onClick={() => setLoanType('dscr')}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Home className="h-6 w-6 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">DSCR Loan</h3>
                    <p className="text-sm text-muted-foreground">
                      Best for rental-property cash-flow scenarios where the property and timing are already fairly well defined.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all hover:border-purple-500/50 ${loanType === 'hard-money' ? 'border-2 border-purple-500 bg-purple-500/5' : ''}`}
              onClick={() => setLoanType('hard-money')}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Hammer className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Hard Money / Fix & Flip</h3>
                    <p className="text-sm text-muted-foreground">
                      Best for rehab, flip, bridge, or time-sensitive scenarios that need a deal-specific review.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Form Section */}
      {loanType && (
        <section className="py-8 px-4 pb-16">
          <div className="container mx-auto max-w-2xl">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>
                  {loanType === 'dscr' ? 'DSCR Deal Review Form' : 'Hard Money / Fix & Flip Review Form'}
                </CardTitle>
                <CardDescription>
                  Fill out the form below and VestBlock can review the file, recommend the next step, and determine whether outside lender follow-up or paid prep makes more sense.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Borrower Information */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-cyan-500" />
                      Borrower Information
                    </h3>
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name *</Label>
                          <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            placeholder="John Smith"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone *</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            placeholder="(555) 123-4567"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="creditScoreRange">
                            Credit Score Range {loanType === 'hard-money' ? '(Optional)' : '*'}
                          </Label>
                          <Select value={creditScoreRange} onValueChange={setCreditScoreRange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="below-600">Below 600</SelectItem>
                              <SelectItem value="600-649">600-649</SelectItem>
                              <SelectItem value="650-699">650-699</SelectItem>
                              <SelectItem value="700-749">700-749</SelectItem>
                              <SelectItem value="750+">750+</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* DSCR specific: Entity */}
                      {loanType === 'dscr' && (
                        <div className="space-y-2">
                          <Label>Borrower Type *</Label>
                          <RadioGroup value={entity} onValueChange={setEntity} className="flex gap-6">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="llc" id="entity-llc" />
                              <Label htmlFor="entity-llc" className="cursor-pointer">LLC</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="personal" id="entity-personal" />
                              <Label htmlFor="entity-personal" className="cursor-pointer">Personal</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="requestedLoanAmount">Requested Loan Amount</Label>
                          <Input
                            id="requestedLoanAmount"
                            value={requestedLoanAmount}
                            onChange={(e) => setRequestedLoanAmount(e.target.value)}
                            placeholder="$350,000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="availableLiquidity">Available Liquidity</Label>
                          <Input
                            id="availableLiquidity"
                            value={availableLiquidity}
                            onChange={(e) => setAvailableLiquidity(e.target.value)}
                            placeholder="Cash/reserves available"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="vestingOrEntityName">Borrowing Entity / Vesting Name</Label>
                          <Input
                            id="vestingOrEntityName"
                            value={vestingOrEntityName}
                            onChange={(e) => setVestingOrEntityName(e.target.value)}
                            placeholder="LLC or borrower name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fundingGoal">Funding Goal</Label>
                          <Select value={fundingGoal} onValueChange={setFundingGoal}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select goal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="purchase">Purchase</SelectItem>
                              <SelectItem value="refinance">Refinance</SelectItem>
                              <SelectItem value="cash-out-refi">Cash-out refinance</SelectItem>
                              <SelectItem value="bridge">Bridge / time-sensitive close</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Hard Money specific: Experience */}
                      {loanType === 'hard-money' && (
                        <div className="space-y-2">
                          <Label htmlFor="experienceLevel">Experience Level (# of flips) *</Label>
                          <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select experience" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">First flip</SelectItem>
                              <SelectItem value="1-3">1-3 flips</SelectItem>
                              <SelectItem value="4-10">4-10 flips</SelectItem>
                              <SelectItem value="10+">10+ flips</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Property / Deal Information */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-cyan-500" />
                      {loanType === 'dscr' ? 'Property Information' : 'Deal Information'}
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="propertyAddress">Property Address *</Label>
                        <Input
                          id="propertyAddress"
                          value={propertyAddress}
                          onChange={(e) => setPropertyAddress(e.target.value)}
                          required
                          placeholder="123 Main St, City, State, ZIP"
                        />
                      </div>

                      {loanType === 'dscr' ? (
                        <>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="propertyType">Property Type *</Label>
                              <Select value={propertyType} onValueChange={setPropertyType}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sfr">Single Family (SFR)</SelectItem>
                                  <SelectItem value="2-4">2-4 Units</SelectItem>
                                  <SelectItem value="mfh-5+">Multifamily 5+</SelectItem>
                                  <SelectItem value="mixed-use">Mixed-Use</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="purchasePrice">Purchase Price *</Label>
                              <Input
                                id="purchasePrice"
                                value={purchasePrice}
                                onChange={(e) => setPurchasePrice(e.target.value)}
                                required
                                placeholder="$500,000"
                              />
                            </div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="estimatedValue">Estimated Current Value</Label>
                              <Input
                                id="estimatedValue"
                                value={estimatedValue}
                                onChange={(e) => setEstimatedValue(e.target.value)}
                                placeholder="$550,000"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="expectedRent">Expected Rent (Monthly) *</Label>
                              <Input
                                id="expectedRent"
                                value={expectedRent}
                                onChange={(e) => setExpectedRent(e.target.value)}
                                required
                                placeholder="$3,500"
                              />
                            </div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="occupancy">Occupancy *</Label>
                              <Select value={occupancy} onValueChange={setOccupancy}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="vacant">Vacant</SelectItem>
                                  <SelectItem value="tenant">Tenant in Place</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="downPaymentLtv">Down Payment / LTV *</Label>
                              <Input
                                id="downPaymentLtv"
                                value={downPaymentLtv}
                                onChange={(e) => setDownPaymentLtv(e.target.value)}
                                required
                                placeholder="e.g., 25% down or 75% LTV"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="taxesInsuranceHoa">Taxes / Insurance / HOA</Label>
                            <Input
                              id="taxesInsuranceHoa"
                              value={taxesInsuranceHoa}
                              onChange={(e) => setTaxesInsuranceHoa(e.target.value)}
                              placeholder="Monthly or annual estimate"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="purchasePrice">Purchase Price *</Label>
                              <Input
                                id="purchasePrice"
                                value={purchasePrice}
                                onChange={(e) => setPurchasePrice(e.target.value)}
                                required
                                placeholder="$200,000"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rehabBudget">Rehab Budget *</Label>
                              <Input
                                id="rehabBudget"
                                value={rehabBudget}
                                onChange={(e) => setRehabBudget(e.target.value)}
                                required
                                placeholder="$50,000"
                              />
                            </div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="arv">ARV (After Repair Value) *</Label>
                              <Input
                                id="arv"
                                value={arv}
                                onChange={(e) => setArv(e.target.value)}
                                required
                                placeholder="$350,000"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="exitStrategy">Exit Strategy *</Label>
                              <Select value={exitStrategy} onValueChange={setExitStrategy}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select strategy" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="flip">Flip (Sell)</SelectItem>
                                  <SelectItem value="brrrr">BRRRR (Refinance)</SelectItem>
                                  <SelectItem value="hold">Hold as Rental</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="closingTimeline">Closing Timeline *</Label>
                              <Select value={closingTimeline} onValueChange={setClosingTimeline}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select timeline" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="asap">ASAP (under 2 weeks)</SelectItem>
                                  <SelectItem value="2-4-weeks">2-4 weeks</SelectItem>
                                  <SelectItem value="1-2-months">1-2 months</SelectItem>
                                  <SelectItem value="flexible">Flexible</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="fundsNeeded">Funds Needed *</Label>
                              <Select value={fundsNeeded} onValueChange={setFundsNeeded}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select option" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="purchase-only">Purchase Only</SelectItem>
                                  <SelectItem value="purchase-rehab">Purchase + Rehab</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="purchaseContractStatus">Purchase Contract Status</Label>
                              <Select value={purchaseContractStatus} onValueChange={setPurchaseContractStatus}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="under-contract">Under contract</SelectItem>
                                  <SelectItem value="offer-submitted">Offer submitted</SelectItem>
                                  <SelectItem value="analyzing-deal">Analyzing deal</SelectItem>
                                  <SelectItem value="refinance-existing">Refinance existing property</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="contractorReady">Contractor / Scope Ready</Label>
                              <Select value={contractorReady} onValueChange={setContractorReady}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="scope-and-bid-ready">Scope and bid ready</SelectItem>
                                  <SelectItem value="contractor-selected">Contractor selected</SelectItem>
                                  <SelectItem value="needs-scope">Need scope/bid</SelectItem>
                                  <SelectItem value="not-sure">Not sure yet</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Timing / Notes (DSCR only) */}
                  {loanType === 'dscr' && (
                    <div>
                      <h3 className="font-semibold text-lg mb-4">Timing</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="closingDate">Target Closing Date / Timeline *</Label>
                          <Input
                            id="closingDate"
                            value={closingDate}
                            onChange={(e) => setClosingDate(e.target.value)}
                            required
                            placeholder="e.g., April 15, 2026 or ASAP"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">Additional Notes (Optional)</Label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any additional details about the deal..."
                            rows={4}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {loanType === 'hard-money' && (
                    <div>
                      <h3 className="font-semibold text-lg mb-4">Notes</h3>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Additional Deal Notes</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add seller deadlines, access issues, repair notes, appraisal details, or anything the lender should know."
                          rows={4}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-600"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Review...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Deal Review
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  )
}
