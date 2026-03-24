"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
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

  // DSCR specific fields
  const [entity, setEntity] = useState("")
  const [propertyAddress, setPropertyAddress] = useState("")
  const [propertyType, setPropertyType] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [expectedRent, setExpectedRent] = useState("")
  const [occupancy, setOccupancy] = useState("")
  const [downPaymentLtv, setDownPaymentLtv] = useState("")
  const [closingDate, setClosingDate] = useState("")
  const [notes, setNotes] = useState("")

  // Hard Money specific fields
  const [experienceLevel, setExperienceLevel] = useState("")
  const [rehabBudget, setRehabBudget] = useState("")
  const [arv, setArv] = useState("")
  const [exitStrategy, setExitStrategy] = useState("")
  const [closingTimeline, setClosingTimeline] = useState("")
  const [fundsNeeded, setFundsNeeded] = useState("")

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
        ...(loanType === "dscr" ? {
          entity,
          propertyAddress,
          propertyType,
          purchasePrice,
          expectedRent,
          occupancy,
          downPaymentLtv,
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
          fundsNeeded
        })
      }

      const response = await fetch("/api/real-estate-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error("Failed to submit")

      // Track form submission conversion
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          'event_category': 'Real Estate Funding',
          'event_label': 'Form Submit',
          'loan_type': loanType
        })
      }

      router.push("/real-estate-funding/thanks")
    } catch (error) {
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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-500 px-4 py-2 rounded-full mb-6">
            <Building2 className="h-5 w-5" />
            <span className="text-sm font-medium">Real Estate Funding</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Get Funding for Your{" "}
            <span className="gradient-text">Real Estate Deal</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            DSCR loans for rental properties or hard money for fix & flip projects.
            Fast approvals, competitive rates.
          </p>
          <a
            href="tel:+18005551234"
            onClick={handlePhoneClick}
            className="inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-400 transition-colors"
          >
            <Phone className="h-5 w-5" />
            <span className="font-medium">Prefer to talk? Call us</span>
          </a>
        </div>
      </section>

      {/* Loan Type Selection */}
      <section className="py-8 px-4">
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
                      For rental properties. Qualify based on property cash flow, not personal income.
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
                      Short-term financing for flips and rehab projects. Fast closings.
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
            <Card className="bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle>
                  {loanType === 'dscr' ? 'DSCR Loan Application' : 'Hard Money / Fix & Flip Application'}
                </CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you within 24 hours.
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
                          <Label>Entity Type *</Label>
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
                              <Label htmlFor="expectedRent">Expected Rent (Monthly) *</Label>
                              <Input
                                id="expectedRent"
                                value={expectedRent}
                                onChange={(e) => setExpectedRent(e.target.value)}
                                required
                                placeholder="$3,500"
                              />
                            </div>
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

                  <Button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-600"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Application
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
