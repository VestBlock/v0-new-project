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
import {
  MessageSquare,
  UserCheck,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  Zap,
  ArrowRight,
  Bot,
  Send,
  Loader2
} from "lucide-react"

export default function AIAssistantPage() {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    websiteUrl: "",
    industry: "",
    hasBookingSoftware: "",
    bookingSoftwareName: "",
    notes: ""
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/ai-assistant-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error("Failed to submit")

      toast({
        title: "Request Submitted!",
        description: "We'll be in touch within 24 hours to discuss your AI assistant setup.",
      })

      setFormData({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        websiteUrl: "",
        industry: "",
        hasBookingSoftware: "",
        bookingSoftwareName: "",
        notes: ""
      })
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
      {/* Section 1: Hero */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-500 px-4 py-2 rounded-full mb-6">
            <Bot className="h-5 w-5" />
            <span className="text-sm font-medium">AI-Powered Lead Capture</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            AI Assistant That Captures Leads + Books Appointments{" "}
            <span className="gradient-text">Automatically</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Perfect for service businesses (HVAC, roofing, dental, med spa, auto repair).
            Works 24/7 and installs on your site fast.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white" asChild>
              <a href="https://cdn.botpress.cloud/webchat/v3.6/shareable.html?configUrl=https://files.bpcontent.cloud/2026/03/07/00/20260307001828-1TCHUA94.json" target="_blank" rel="noopener noreferrer">
                <MessageSquare className="mr-2 h-5 w-5" />
                Try Live Demo
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#request-setup">
                <Send className="mr-2 h-5 w-5" />
                Request Setup
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Section 2: What It Does */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What Your AI Assistant Does</h2>
            <p className="text-xl text-muted-foreground">Automate your customer interactions and never miss a lead</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="bg-card/80 backdrop-blur border-cyan-500/20">
              <CardContent className="pt-6">
                <MessageSquare className="h-10 w-10 text-cyan-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Answers Questions Instantly</h3>
                <p className="text-muted-foreground">Respond to customer inquiries 24/7 with accurate, helpful information about your services.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur border-cyan-500/20">
              <CardContent className="pt-6">
                <UserCheck className="h-10 w-10 text-cyan-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Captures Lead Info</h3>
                <p className="text-muted-foreground">Collects name, phone, and service needed from every visitor who engages.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur border-cyan-500/20">
              <CardContent className="pt-6">
                <Mail className="h-10 w-10 text-cyan-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Sends Leads Automatically</h3>
                <p className="text-muted-foreground">Delivers leads straight to your email and Google Sheet in real-time.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur border-cyan-500/20">
              <CardContent className="pt-6">
                <Calendar className="h-10 w-10 text-cyan-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Books Appointments</h3>
                <p className="text-muted-foreground">Guides visitors to book through Calendly or your existing booking system.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/80 backdrop-blur border-cyan-500/20">
              <CardContent className="pt-6">
                <Clock className="h-10 w-10 text-cyan-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Works After Hours</h3>
                <p className="text-muted-foreground">Captures leads and answers questions even when you're closed—never miss a job.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Section 3: How It Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground">Get up and running in 3 simple steps</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-xl mb-2">We Install It</h3>
              <p className="text-muted-foreground">We set up and install the AI assistant on your website—no tech skills needed.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-xl mb-2">Customers Engage</h3>
              <p className="text-muted-foreground">Visitors ask questions, request services, and book appointments through the chat.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-xl mb-2">You Get Leads</h3>
              <p className="text-muted-foreground">Receive leads and booking requests instantly via email and spreadsheet.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Pricing */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground">Choose the package that fits your business</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter Package */}
            <Card className="bg-card/80 backdrop-blur border-2 hover:border-cyan-500/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl">Starter</CardTitle>
                <CardDescription>AI Assistant</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold">$399</span>
                    <span className="text-muted-foreground">one-time setup</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">$79</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Website chat assistant</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Lead capture</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Email notifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Basic FAQ responses</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline" asChild>
                  <a href="#request-setup">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Pro Package */}
            <Card className="bg-card/80 backdrop-blur border-2 border-cyan-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-cyan-500 text-white text-sm font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Pro</CardTitle>
                <CardDescription>AI Assistant + Appointment Booking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold">$699</span>
                    <span className="text-muted-foreground">one-time setup</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">$149</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Everything in Starter</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Appointment booking integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Calendly / booking page support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Lead qualification questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Google Sheet + email routing</span>
                  </li>
                </ul>
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600" asChild>
                  <a href="#request-setup">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Section 5: Request Setup Form */}
      <section id="request-setup" className="py-16 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Request Your AI Assistant Setup</h2>
            <p className="text-xl text-muted-foreground">Fill out the form and we'll get back to you within 24 hours</p>
          </div>
          <Card className="bg-card/80 backdrop-blur">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      required
                      placeholder="ABC Services"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name *</Label>
                    <Input
                      id="contactName"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleInputChange}
                      required
                      placeholder="John Smith"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL *</Label>
                  <Input
                    id="websiteUrl"
                    name="websiteUrl"
                    type="url"
                    value={formData.websiteUrl}
                    onChange={handleInputChange}
                    required
                    placeholder="https://yourwebsite.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry *</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) => handleSelectChange("industry", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hvac">HVAC</SelectItem>
                      <SelectItem value="roofing">Roofing</SelectItem>
                      <SelectItem value="dental">Dental</SelectItem>
                      <SelectItem value="medspa">Med Spa</SelectItem>
                      <SelectItem value="auto">Auto Repair</SelectItem>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="contractor">General Contractor</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label>Do you currently use booking software? *</Label>
                  <RadioGroup
                    value={formData.hasBookingSoftware}
                    onValueChange={(value) => handleSelectChange("hasBookingSoftware", value)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="booking-yes" />
                      <Label htmlFor="booking-yes" className="cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="booking-no" />
                      <Label htmlFor="booking-no" className="cursor-pointer">No</Label>
                    </div>
                  </RadioGroup>
                </div>
                {formData.hasBookingSoftware === "yes" && (
                  <div className="space-y-2">
                    <Label htmlFor="bookingSoftwareName">Which booking software?</Label>
                    <Input
                      id="bookingSoftwareName"
                      name="bookingSoftwareName"
                      value={formData.bookingSoftwareName}
                      onChange={handleInputChange}
                      placeholder="e.g., Calendly, Acuity, ServiceTitan"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Tell us more about your business or specific needs..."
                    rows={4}
                  />
                </div>
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
                      Submit Request
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
