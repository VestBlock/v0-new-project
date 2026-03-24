"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  DollarSign,
  CheckCircle,
  Star,
  ExternalLink,
  Building2,
  CreditCard,
  Home,
  Briefcase,
  Phone,
} from "lucide-react"

export default function FundingPage()

{
  const { user } = useAuth()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    business_type: "",
    funding_amount: "",
    credit_score: "",
    message: "",
  })

  useEffect(() => {
    if (user?.email) {
      setFormData((prev) => ({ ...prev, email: user.email || "" }))
    }
  }, [user])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      console.log("Form submitted:", formData)

      toast({
        title: "Application Submitted!",
        description: "We'll review your information and get back to you within 24 hours.",
        variant: "default",
      })

      setFormData({
        name: "",
        email: user?.email || "",
        phone: "",
        business_type: "",
        funding_amount: "",
        credit_score: "",
        message: "",
      })
    } catch (error) {
      console.error("Error submitting form:", error)
      toast({
        title: "Submission Error",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  return (
    <div className="min-h-screen bg-background">
      
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold gradient-text mb-6">Business Funding Solutions</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Access capital for your business through our trusted lending partners. From startup funding to expansion
            capital, we connect you with the right financial solutions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white">
              <DollarSign className="mr-2 h-5 w-5" />
              Get Funding Now
            </Button>
            <Button size="lg" variant="outline">
              <Phone className="mr-2 h-5 w-5" />
              Speak with Expert
            </Button>
          </div>
        </div>
      </section>
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-cyan-500 mb-2">$500M+</div>
              <div className="text-muted-foreground">Total Funding Facilitated</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-cyan-500 mb-2">2,500+</div>
              <div className="text-muted-foreground">Businesses Funded</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-cyan-500 mb-2">2</div>
              <div className="text-muted-foreground">Trusted Partners</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-cyan-500 mb-2">24hrs</div>
              <div className="text-muted-foreground">Average Response Time</div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Funding Partners</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We've partnered with industry-leading lenders to provide you with the best funding options available.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <Card className="border-2 border-cyan-500/20 bg-gradient-to-br from-cyan-50/50 to-blue-50/50 dark:from-cyan-950/20 dark:to-blue-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className="bg-cyan-500 text-white">Featured Lender</Badge>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <CardTitle className="text-2xl">The Funding Playbook</CardTitle>
                <CardDescription className="text-base">
                  Comprehensive lending solutions with expert underwriters handling most of the work for you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-cyan-500" />
                    <span>Real Estate Loans</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-cyan-500" />
                    <span>Credit Card Stacking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-cyan-500" />
                    <span>Business Loans</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-cyan-500" />
                    <span>DSCR Loans</span>
                  </div>
                </div>
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Funding Range:</span>
                      <div className="text-cyan-600 font-bold">$25K - $5M</div>
                    </div>
                    <div>
                      <span className="font-medium">Processing Time:</span>
                      <div className="text-green-600 font-bold">7-14 Days</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Key Benefits:</h4>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Expert underwriters handle most paperwork
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Multiple loan products available
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Competitive rates and terms
                    </li>
                  </ul>
                </div>
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white" asChild>
                  <a
                    href="https://thefundingplaybook.com/homepage?am_id=VestBlock"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apply with The Funding Playbook
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-2 border-blue-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Referral Network</Badge>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <CardTitle className="text-2xl">OPM Mastery Network</CardTitle>
                <CardDescription className="text-base">
                  Exclusive lending network focused on startup business owners with strong personal credit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Requirements:</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">700+ Personal Credit Score Required</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Target Audience:</span>
                    <div className="text-blue-600 font-bold">Startup Business Owners</div>
                  </div>
                  <div>
                    <span className="font-medium">Focus:</span>
                    <div className="text-blue-600 font-bold">Lending Solutions</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Network Benefits:</h4>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Exclusive access to qualified lenders
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Lending-focused, not educational
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Specialized in startup funding
                    </li>
                  </ul>
                </div>
                <Button className="w-full bg-transparent" variant="outline" asChild>
                  <a
                    href="https://opmmastery.referralrock.com/l/ROBERTSAND60/referral"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Join OPM Network
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Get Pre-Qualified Today</h2>
              <p className="text-muted-foreground">
                Fill out our quick form and we'll connect you with the right funding partner for your needs.
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Funding Application</CardTitle>
                <CardDescription>
                  Tell us about your business and funding needs. We'll review your information and get back to you
                  within 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-2">
                        Full Name *
                      </label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email Address *
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium mb-2">
                        Phone Number *
                      </label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label htmlFor="business_type" className="block text-sm font-medium mb-2">
                        Business Type *
                      </label>
                      <Input
                        id="business_type"
                        name="business_type"
                        value={formData.business_type}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., E-commerce, Real Estate, etc."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="funding_amount" className="block text-sm font-medium mb-2">
                        Funding Amount Needed *
                      </label>
                      <Input
                        id="funding_amount"
                        name="funding_amount"
                        value={formData.funding_amount}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., $50,000"
                      />
                    </div>
                    <div>
                      <label htmlFor="credit_score" className="block text-sm font-medium mb-2">
                        Personal Credit Score *
                      </label>
                      <Input
                        id="credit_score"
                        name="credit_score"
                        type="number"
                        min="300"
                        max="850"
                        value={formData.credit_score}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g., 720"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium mb-2">
                      Additional Information
                    </label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Tell us more about your business and funding needs..."
                      rows={4}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Fund Your Business?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Don't let funding be the barrier to your business success. Our partners are ready to help you access the
            capital you need.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white" asChild>
              <a
                href="https://thefundingplaybook.com/homepage?am_id=VestBlock"
                target="_blank"
                rel="noopener noreferrer"
              >
                Apply with The Funding Playbook
                <ExternalLink className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a
                href="https://opmmastery.referralrock.com/l/ROBERTSAND60/referral"
                target="_blank"
                rel="noopener noreferrer"
              >
                Join OPM Network
                <ExternalLink className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
