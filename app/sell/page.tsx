"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  MapPin,
  Zap,
  HandshakeIcon,
  TrendingUp,
  Users
} from "lucide-react"
import Image from "next/image"

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
const SELLING_REASONS = [
  "Foreclosure",
  "Inherited",
  "Tired Landlord",
  "Divorce",
  "Relocating",
  "Other"
]

export default function SellPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const [formData, setFormData] = useState({
    propertyAddress: "",
    city: "",
    state: "",
    name: "",
    phone: "",
    propertyCondition: "",
    timelineToSell: "",
    mortgageBalance: "",
    reasonForSelling: ""
  })

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
      setFormData({
        propertyAddress: "",
        city: "",
        state: "",
        name: "",
        phone: "",
        propertyCondition: "",
        timelineToSell: "",
        mortgageBalance: "",
        reasonForSelling: ""
      })
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
    <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative pt-16 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/20" />
          <div className="absolute inset-0 circuit-bg" />

          <div className="container mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-4xl mx-auto"
            >
              <div className="flex justify-center mb-8">
                <Image
                  src="/4D3E27E0-6C7A-4B5B-92D5-CF92182A4C7A.png"
                  alt="VestBlock"
                  width={120}
                  height={120}
                  className="object-contain"
                  priority
                />
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                <span className="gradient-text">Sell Your House Fast</span>
                <br />
                <span className="text-white">Get a Cash Offer in 24 Hours</span>
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                No Repairs. No Agents. No Fees. Flexible Closing.
              </p>

              <Button
                size="lg"
                className="bg-cyan-500 hover:bg-cyan-600 glow"
                onClick={scrollToForm}
              >
                <Home className="mr-2 h-5 w-5" />
                Get My Offer
              </Button>
            </motion.div>
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
              <Card className="bg-card/80 backdrop-blur border-cyan-500/20">
                <CardHeader className="text-center pb-6">
                  <CardTitle className="text-3xl font-bold gradient-text">
                    Get Your Cash Offer
                  </CardTitle>
                  <p className="text-muted-foreground mt-2">
                    Fill out the form below and we'll contact you within 24 hours
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
                        We've received your information and will contact you within 24 hours with your cash offer.
                      </p>
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

                      {/* Name and Phone */}
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

                      {/* Mortgage Balance */}
                      <div className="space-y-2">
                        <Label htmlFor="mortgageBalance" className="text-sm font-medium">
                          Estimated Mortgage Balance (Optional)
                        </Label>
                        <Input
                          id="mortgageBalance"
                          placeholder="$"
                          value={formData.mortgageBalance}
                          onChange={(e) => handleInputChange("mortgageBalance", e.target.value)}
                          className="bg-background/50"
                        />
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
                            Get My Cash Offer
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
                Flexible Selling Solutions
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                We offer multiple options to meet your unique needs
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-card/80 backdrop-blur border-cyan-500/20 h-full hover:border-cyan-500/50 transition-colors">
                  <CardContent className="pt-8 text-center">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Zap className="h-8 w-8 text-cyan-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Fast Cash Offers</h3>
                    <p className="text-muted-foreground">
                      Get a competitive cash offer within 24 hours. No waiting, no uncertainty.
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
                <Card className="bg-card/80 backdrop-blur border-cyan-500/20 h-full hover:border-cyan-500/50 transition-colors">
                  <CardContent className="pt-8 text-center">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <HandshakeIcon className="h-8 w-8 text-cyan-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Take Over Payments</h3>
                    <p className="text-muted-foreground">
                      If applicable, we can take over your existing mortgage payments to help you move on.
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
                <Card className="bg-card/80 backdrop-blur border-cyan-500/20 h-full hover:border-cyan-500/50 transition-colors">
                  <CardContent className="pt-8 text-center">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <TrendingUp className="h-8 w-8 text-cyan-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">Maximize Your Sale</h3>
                    <p className="text-muted-foreground">
                      Sell without traditional fees, commissions, or agent costs. Keep more of your equity.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
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
                Why Choose Us
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
                  <h3 className="font-semibold text-white">Nationwide Network</h3>
                  <p className="text-sm text-muted-foreground">Buyers across the country</p>
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
                  <h3 className="font-semibold text-white">Close in 7 Days</h3>
                  <p className="text-sm text-muted-foreground">Fast, flexible closing</p>
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
                  <h3 className="font-semibold text-white">No Commissions</h3>
                  <p className="text-sm text-muted-foreground">Keep your equity</p>
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
                  <h3 className="font-semibold text-white">No Upfront Costs</h3>
                  <p className="text-sm text-muted-foreground">Zero fees to get started</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Minimal Footer */}
        <footer className="py-12 px-4 border-t border-border/50">
          <div className="container mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <Image
                  src="/4D3E27E0-6C7A-4B5B-92D5-CF92182A4C7A.png"
                  alt="VestBlock"
                  width={40}
                  height={40}
                  className="object-contain"
                />
                <span className="text-lg font-semibold text-white">VestBlock</span>
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
