"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion } from "framer-motion"
import {
  Home,
  DollarSign,
  Clock,
  Shield,
  CheckCircle2,
  Phone,
  Mail,
  Zap,
  HandshakeIcon,
  TrendingUp,
  Users
} from "lucide-react"
import { BrandMark } from "@/components/brand-logo"
import { useAuth } from "@/contexts/auth-context"

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
]

const PROPERTY_CONDITIONS = ["Good", "Needs Repairs", "Major Repairs"]
const TIMELINES = ["ASAP", "30 days", "60+ days"]
const PROPERTY_TYPES = ["Single Family", "Duplex / Triplex / Fourplex", "Condo", "Townhome", "Multifamily", "Land", "Other"]
const OCCUPANCY_STATUS = ["Owner Occupied", "Tenant Occupied", "Vacant", "Unknown"]
const BEST_TIMES = ["Morning", "Afternoon", "Evening", "Anytime"]
const SELLER_REVIEW_PATHS = [
  { value: "not_sure", label: "Not sure yet - review the best path" },
  { value: "fast_cash", label: "Fast cash buyer review" },
  { value: "creative_structure", label: "Creative structure review" },
  { value: "novation", label: "Novation / market-assisted sale review" },
]
const SELLING_REASONS = [
  "Foreclosure",
  "Pre-Foreclosure",
  "Inherited",
  "Tired Landlord",
  "Divorce",
  "Relocating",
  "Other"
]

type SellPageMarket = {
  city: string
  state: string
  stateName: string
}

type SellPageProps = {
  market?: SellPageMarket
}

function getInitialFormData(market?: SellPageMarket) {
  return {
    propertyAddress: "",
    city: market?.city || "",
    state: market?.stateName || "",
    name: "",
    email: "",
    phone: "",
    propertyType: "",
    bedrooms: "",
    bathrooms: "",
    propertyCondition: "",
    timelineToSell: "",
    estimatedValue: "",
    askingPrice: "",
    mortgageBalance: "",
    liensOrTaxes: "",
    occupancyStatus: "",
    bestTimeToCall: "",
    preferredSalePath: "not_sure",
    notes: "",
    reasonForSelling: ""
  }
}

export function SellPage({ market }: SellPageProps) {
  const { user, userProfile } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [formData, setFormData] = useState(() => getInitialFormData(market))

  useEffect(() => {
    const email = user?.email || ""
    const fullName =
      userProfile?.full_name ||
      (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "")

    if (!email && !fullName) return

    setFormData((current) => ({
      ...current,
      email: current.email || email,
      name: current.name || fullName,
    }))
  }, [user?.email, user?.user_metadata?.full_name, userProfile?.full_name])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validatePhone = (phone: string) => {
    const phoneRegex = /^[\d\s\-\(\)\+]{10,}$/
    return phoneRegex.test(phone.replace(/\s/g, ""))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError("")

    // Validate required fields
    if (!formData.propertyAddress || !formData.city || !formData.state || !formData.name || !formData.phone) {
      setSubmitError("Please fill in all required fields.")
      setIsSubmitting(false)
      return
    }

    if (!validatePhone(formData.phone)) {
      setSubmitError("Please enter a valid phone number.")
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/sell-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit form")
      }

      setSubmitSuccess(true)
      setFormData(getInitialFormData(market))
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const scrollToForm = () => {
    document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="premium-page text-slate-100">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 pb-12 pt-10 md:pb-14 md:pt-14">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/45 via-slate-950/20 to-cyan-950/35" />
          <div className="absolute inset-0 circuit-bg" />

          <div className="container mx-auto relative z-10">
            <motion.div
              initial={market ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-4xl mx-auto"
            >
              <div className="flex justify-center mb-5">
                <BrandMark
                  className="h-[92px] w-[92px] rounded-[1.6rem]"
                />
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 text-white">
                <span className="text-cyan-200">
                  {market ? `Sell a Property in ${market.city}?` : "Submit Your Property"}
                </span>
                <br />
                {" "}
                <span className="text-white">
                  {market ? "Compare Fast Cash, Creative, or Novation Paths" : "For Fast Cash, Creative, or Novation Review"}
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-200 mb-7 max-w-2xl mx-auto">
                {market
                  ? `Share the address, condition, timeline, occupancy, and seller situation for a ${market.city} property review. VestBlock routes the submission to our acquisitions review for fast cash, creative structure, novation, or another partner path.`
                  : "Share the property details, timeline, occupancy, and selling situation so VestBlock can route the submission to our acquisitions review for fast cash, creative structure, novation, or a partner path."}
              </p>

              <Button
                size="lg"
                className="bg-cyan-400 text-slate-950 hover:bg-cyan-300 glow"
                onClick={scrollToForm}
              >
                <Home className="mr-2 h-5 w-5" />
                Review My Sale Options
              </Button>
            </motion.div>
          </div>
        </section>

        <section className="pb-10 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="premium-card border-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Share the sale situation</CardTitle>
                  <p className="text-sm text-slate-300">
                    Add the address, condition, timeline, payoff context, preferred sale path, and any issues affecting the deal.
                  </p>
                </CardHeader>
              </Card>
              <Card className="premium-card border-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Compare three paths</CardTitle>
                  <p className="text-sm text-slate-300">
                    Your submission is reviewed for fast cash, creative structure, novation, or a partner conversation as the cleaner next step.
                  </p>
                </CardHeader>
              </Card>
              <Card className="premium-card border-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Route the right conversation</CardTitle>
                  <p className="text-sm text-slate-300">
                    The goal is clarity first, then the best-fit sale conversation based on the property and seller situation.
                  </p>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Lead Capture Form Section */}
        <section id="lead-form" className="py-20 px-4 bg-gradient-to-b from-background to-muted/10">
          <div className="container mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Card className="premium-card border-cyan-500/20">
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-3xl font-bold gradient-text">
                    Request Your Property Review
                  </CardTitle>
                  <p className="text-muted-foreground mt-2">
                    Fill out the form below so your property can be routed for fast cash, creative, novation, or partner review.
                  </p>
                </CardHeader>

                <CardContent>
                  {submitSuccess ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-12"
                    >
                      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-4">
                        Thank You!
                      </h3>
                      <p className="text-muted-foreground text-lg">
                        We've received your information and will follow up after reviewing the property, timeline, and preferred sale path.
                      </p>
                      <div className="mt-6 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-left">
                        <p className="font-medium text-foreground">What happens next</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          The property details go to our acquisitions review first, then the follow-up is shaped around fast cash,
                          creative structure, novation, or another partner conversation based on the timeline and condition.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {submitError && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-center">
                          {submitError}
                        </div>
                      )}

                      {/* Property Address */}
                      <div className="space-y-2">
                        <Label htmlFor="propertyAddress" className="text-sm font-medium">
                          Property Address <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="propertyAddress"
                          placeholder="123 Main Street"
                          value={formData.propertyAddress}
                          onChange={(e) => handleInputChange("propertyAddress", e.target.value)}
                          className="bg-background/50"
                          required
                        />
                      </div>

                      {/* City and State */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city" className="text-sm font-medium">
                            City <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="city"
                            placeholder="City"
                            value={formData.city}
                            onChange={(e) => handleInputChange("city", e.target.value)}
                            className="bg-background/50"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="state" className="text-sm font-medium">
                            State <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.state}
                            onValueChange={(value) => handleInputChange("state", value)}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select State" />
                            </SelectTrigger>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Name and Contact */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-sm font-medium">
                            Your Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="name"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => handleInputChange("name", e.target.value)}
                            className="bg-background/50"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium">
                            Email
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={(e) => handleInputChange("email", e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm font-medium">
                            Phone Number <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={formData.phone}
                            onChange={(e) => handleInputChange("phone", e.target.value)}
                            className="bg-background/50"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bestTimeToCall" className="text-sm font-medium">
                            Best Time to Call
                          </Label>
                          <Select
                            value={formData.bestTimeToCall}
                            onValueChange={(value) => handleInputChange("bestTimeToCall", value)}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select Time" />
                            </SelectTrigger>
                            <SelectContent>
                              {BEST_TIMES.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Property Type and Occupancy */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="propertyType" className="text-sm font-medium">
                            Property Type
                          </Label>
                          <Select
                            value={formData.propertyType}
                            onValueChange={(value) => handleInputChange("propertyType", value)}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROPERTY_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="occupancyStatus" className="text-sm font-medium">
                            Occupancy
                          </Label>
                          <Select
                            value={formData.occupancyStatus}
                            onValueChange={(value) => handleInputChange("occupancyStatus", value)}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select Occupancy" />
                            </SelectTrigger>
                            <SelectContent>
                              {OCCUPANCY_STATUS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Property Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="bedrooms" className="text-sm font-medium">
                            Bedrooms
                          </Label>
                          <Input
                            id="bedrooms"
                            placeholder="3"
                            value={formData.bedrooms}
                            onChange={(e) => handleInputChange("bedrooms", e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bathrooms" className="text-sm font-medium">
                            Bathrooms
                          </Label>
                          <Input
                            id="bathrooms"
                            placeholder="2"
                            value={formData.bathrooms}
                            onChange={(e) => handleInputChange("bathrooms", e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                      </div>

                      {/* Property Condition and Timeline */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="propertyCondition" className="text-sm font-medium">
                            Property Condition
                          </Label>
                          <Select
                            value={formData.propertyCondition}
                            onValueChange={(value) => handleInputChange("propertyCondition", value)}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select Condition" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROPERTY_CONDITIONS.map((condition) => (
                                <SelectItem key={condition} value={condition}>
                                  {condition}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="timelineToSell" className="text-sm font-medium">
                            Timeline to Sell
                          </Label>
                          <Select
                            value={formData.timelineToSell}
                            onValueChange={(value) => handleInputChange("timelineToSell", value)}
                          >
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select Timeline" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMELINES.map((timeline) => (
                                <SelectItem key={timeline} value={timeline}>
                                  {timeline}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Numbers */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="estimatedValue" className="text-sm font-medium">
                            Estimated Property Value
                          </Label>
                          <Input
                            id="estimatedValue"
                            placeholder="$"
                            value={formData.estimatedValue}
                            onChange={(e) => handleInputChange("estimatedValue", e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="askingPrice" className="text-sm font-medium">
                            Desired Sale Price
                          </Label>
                          <Input
                            id="askingPrice"
                            placeholder="$"
                            value={formData.askingPrice}
                            onChange={(e) => handleInputChange("askingPrice", e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="mortgageBalance" className="text-sm font-medium">
                            Estimated Mortgage Balance
                          </Label>
                          <Input
                            id="mortgageBalance"
                            placeholder="$"
                            value={formData.mortgageBalance}
                            onChange={(e) => handleInputChange("mortgageBalance", e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="liensOrTaxes" className="text-sm font-medium">
                            Liens / Back Taxes / HOA
                          </Label>
                          <Input
                            id="liensOrTaxes"
                            placeholder="Amount or describe"
                            value={formData.liensOrTaxes}
                            onChange={(e) => handleInputChange("liensOrTaxes", e.target.value)}
                            className="bg-background/50"
                          />
                        </div>
                      </div>

                      {/* Reason for Selling */}
                      <div className="space-y-2">
                        <Label htmlFor="reasonForSelling" className="text-sm font-medium">
                          Reason for Selling
                        </Label>
                        <Select
                          value={formData.reasonForSelling}
                          onValueChange={(value) => handleInputChange("reasonForSelling", value)}
                        >
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Select Reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {SELLING_REASONS.map((reason) => (
                              <SelectItem key={reason} value={reason}>
                                {reason}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="preferredSalePath" className="text-sm font-medium">
                          Preferred Sale Path
                        </Label>
                        <Select
                          value={formData.preferredSalePath}
                          onValueChange={(value) => handleInputChange("preferredSalePath", value)}
                        >
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Select Sale Path" />
                          </SelectTrigger>
                          <SelectContent>
                            {SELLER_REVIEW_PATHS.map((path) => (
                              <SelectItem key={path.value} value={path.value}>
                                {path.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Choose what you want reviewed first. VestBlock may still recommend a different route after looking at the property, payoff, timing, and buyer interest.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes" className="text-sm font-medium">
                          Anything Else We Should Know?
                        </Label>
                        <Textarea
                          id="notes"
                          placeholder="Repairs needed, foreclosure date, access notes, tenant details, creative terms, novation questions, or cash-sale timing."
                          value={formData.notes}
                          onChange={(e) => handleInputChange("notes", e.target.value)}
                          className="bg-background/50"
                          rows={4}
                        />
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full bg-cyan-500 hover:bg-cyan-600 glow"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <DollarSign className="mr-2 h-5 w-5" />
                            Submit Property Review
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Flexible Solutions Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-4">
                Flexible selling options
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                The best path depends on the property, timeline, payoff, repairs, marketability, and buyer interest.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="premium-card h-full border-cyan-500/20 hover:border-cyan-500/50">
                  <CardContent className="pt-8 text-center">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Zap className="h-8 w-8 text-cyan-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Fast Cash Buyer Review</h3>
                    <p className="text-muted-foreground">
                      When speed and simplicity matter most, the property can be reviewed for a faster cash-buyer or as-is investor conversation.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <Card className="premium-card h-full border-cyan-500/20 hover:border-cyan-500/50">
                  <CardContent className="pt-8 text-center">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <HandshakeIcon className="h-8 w-8 text-cyan-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Creative Structure Review</h3>
                    <p className="text-muted-foreground">
                      When payoff, equity, timing, or seller goals support it, the property can be reviewed for seller finance, subject-to, or other creative structures.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
              >
                <Card className="premium-card h-full border-cyan-500/20 hover:border-cyan-500/50">
                  <CardContent className="pt-8 text-center">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <TrendingUp className="h-8 w-8 text-cyan-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Novation Review</h3>
                    <p className="text-muted-foreground">
                      When a property may perform better with market exposure, retail buyer demand, or coordinated improvement work, a novation path can be reviewed.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
            <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
              VestBlock routes seller submissions for sale-path review. It does not guarantee a cash offer, creative terms, novation approval, sale price, closing timeline, or completed transaction.
            </p>
          </div>
        </section>

        {/* Trust Indicators Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-muted/10 to-background">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-4">
                Why sellers use VestBlock first
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-4 p-6 bg-card/50 rounded-lg border border-cyan-500/10"
              >
                <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Buyer Fit Review</h3>
                  <p className="text-sm text-muted-foreground">Buyers, investors, and partners reviewed for fit</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true }}
                className="flex items-center gap-4 p-6 bg-card/50 rounded-lg border border-cyan-500/10"
              >
                <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="h-6 w-6 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Faster Paths Available</h3>
                  <p className="text-sm text-muted-foreground">Investor and cash conversations when timing fits</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                viewport={{ once: true }}
                className="flex items-center gap-4 p-6 bg-card/50 rounded-lg border border-cyan-500/10"
              >
                <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Clear Options Reviewed</h3>
                  <p className="text-sm text-muted-foreground">Fast cash, creative, novation, or partner paths compared</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                viewport={{ once: true }}
                className="flex items-center gap-4 p-6 bg-card/50 rounded-lg border border-cyan-500/10"
              >
                <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="h-6 w-6 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">No Upfront Review Fee</h3>
                  <p className="text-sm text-muted-foreground">Submit details before any commitment is required</p>
                </div>
              </motion.div>
            </div>
            <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
              VestBlock routes property details for possible next conversations. It does not guarantee offers, sale price, closing timelines, buyer acceptance, funding approval, or a completed transaction.
            </p>
          </div>
        </section>

        {/* Minimal Footer */}
        <footer className="py-12 px-4 border-t border-border/50">
          <div className="container mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <BrandMark className="h-10 w-10" />
                <div>
                  <span className="block text-lg font-semibold leading-none text-white">VestBlock</span>
                  <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-cyan-200/70">Real estate partner network</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 text-muted-foreground">
                <a
                  href="mailto:contact@vestblock.io"
                  className="flex items-center gap-2 hover:text-cyan-500 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  contact@vestblock.io
                </a>
                <a
                  href="tel:414-687-6923"
                  className="flex items-center gap-2 hover:text-cyan-500 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  (414) 687-6923
                </a>
              </div>

              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} VestBlock. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
  )
}
