"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, BadgeDollarSign, CheckCircle2, ClipboardCheck, Home, Network, Send, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"

const buyerCategories = [
  { value: "local_cash_buyer", label: "Local cash buyer" },
  { value: "fix_and_flip_buyer", label: "Fix-and-flip buyer" },
  { value: "landlord_buyer", label: "Landlord / rental buyer" },
  { value: "small_multifamily_buyer", label: "Small multifamily buyer" },
  { value: "creative_finance_buyer", label: "Creative finance buyer" },
  { value: "land_buyer", label: "Land buyer" },
  { value: "commercial_buyer", label: "Commercial buyer" },
  { value: "hedge_fund_buyer", label: "Institutional / hedge fund buyer" },
] as const

const proofStatuses = [
  "Proof ready",
  "Can provide after fit review",
  "Needs update",
  "Not applicable yet",
] as const

const steps = [
  {
    title: "Share your buy box",
    body: "Tell VestBlock your markets, asset appetite, pricing, proof status, and deal structures.",
    icon: ClipboardCheck,
  },
  {
    title: "Build a buyer profile",
    body: "Your criteria becomes a cleaner buyer profile for partner review, funding conversations, and seller fit.",
    icon: Network,
  },
  {
    title: "Review better-fit deals",
    body: "When seller or deal context matches your box, VestBlock can introduce the opportunity for your review.",
    icon: BadgeDollarSign,
  },
  {
    title: "Package capital when needed",
    body: "Qualified buyer deals can be organized for No Limit Capital or another funding partner when proof or leverage is the blocker.",
    icon: BadgeDollarSign,
  },
] as const

type FormState = {
  companyName: string
  contactName: string
  email: string
  phone: string
  website: string
  category: string
  marketsServed: string
  assetTypes: string
  priceMin: string
  priceMax: string
  closingSpeed: string
  proofOfFundsStatus: string
  preferredDeals: string
  noGoItems: string
  referralNotes: string
}

type SignupSuccessState = {
  email: string
  registerUrl: string
  loginUrl: string
  growthSystemReady: boolean
  growthSystemEmailSent: boolean
}

const initialForm: FormState = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  category: "local_cash_buyer",
  marketsServed: "",
  assetTypes: "",
  priceMin: "",
  priceMax: "",
  closingSpeed: "",
  proofOfFundsStatus: "Can provide after fit review",
  preferredDeals: "",
  noGoItems: "",
  referralNotes: "",
}

export function BuyerSignupPage() {
  const { user, userProfile } = useAuth()
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [successState, setSuccessState] = useState<SignupSuccessState | null>(null)

  useEffect(() => {
    const email = user?.email || ""
    const fullName =
      userProfile?.full_name ||
      (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "")

    if (!email && !fullName) return

    setForm((current) => ({
      ...current,
      email: current.email || email,
      contactName: current.contactName || fullName,
    }))
  }, [user?.email, user?.user_metadata?.full_name, userProfile?.full_name])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setSuccess(false)
    setError("")
    setSuccessState(null)

    try {
      const response = await fetch("/api/buyers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit buyer profile.")
      }

      setSuccess(true)
      setSuccessState({
        email: form.email,
        registerUrl:
          typeof payload.registerUrl === "string" && payload.registerUrl
            ? payload.registerUrl
            : "/register?redirect=%2Fdashboard%2Fservices",
        loginUrl:
          typeof payload.loginUrl === "string" && payload.loginUrl
            ? payload.loginUrl
            : "/login?redirect=%2Fdashboard%2Fservices",
        growthSystemReady: payload.growthSystemReady !== false,
        growthSystemEmailSent: payload.growthSystemEmailSent === true,
      })
      setForm(initialForm)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit buyer profile.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100">
              <Users className="h-4 w-4 text-cyan-200" />
              Buyer network
            </div>
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                Bring your buy box into VestBlock.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Real estate buyers, fix-and-flip operators, landlords, multifamily investors, and institutional teams share acquisition criteria once. VestBlock can introduce better-fit seller opportunities, help package qualified buyer deals for No Limit Capital funding review, and keep your criteria ready for serious partner review.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step) => {
                const Icon = step.icon

                return (
                  <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-base font-semibold text-white">{step.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{step.body}</p>
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-5 text-sm leading-6 text-amber-50/85">
              VestBlock does not guarantee deal volume, exclusivity, assignments, pricing, or closed transactions. The purpose is to keep buyer criteria clear so better-fit opportunities and partnerships can be handled with more discipline.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="premium-section space-y-5 p-5 md:p-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Buyer buy-box intake</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Share enough detail for VestBlock to understand your acquisition lane, partner fit, and funding needs.
              </p>
            </div>

            {success ? (
              <div className="space-y-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <div className="space-y-2">
                    <p>Your buyer profile was received. VestBlock can now review your criteria before introducing matching opportunities.</p>
                    <p>
                      {successState?.growthSystemReady
                        ? successState.growthSystemEmailSent
                        ? `Your Growth System email was sent to ${successState.email}.`
                        : "Your Growth System is ready for this buyer profile, and account access can be connected with the same email."
                        : "Your buyer profile is saved. VestBlock is still preparing the Growth System side of your intake."}
                    </p>
                    <p>
                      Use the same email to create an account or sign in so your dashboard can show your saved intake and next steps.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="bg-emerald-300 text-slate-950 hover:bg-emerald-200">
                    <Link href={successState?.registerUrl || "/register?redirect=%2Fdashboard%2Fservices"}>
                      Create account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="border-emerald-200/40 bg-transparent text-emerald-50 hover:bg-emerald-50/10 hover:text-white">
                    <Link href={successState?.loginUrl || "/login?redirect=%2Fdashboard%2Fservices"}>
                      Sign in to dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company / buyer name *</Label>
                <Input id="companyName" value={form.companyName} onChange={(event) => updateField("companyName", event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Buyer type *</Label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {buyerCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact name *</Label>
                <Input id="contactName" value={form.contactName} onChange={(event) => updateField("contactName", event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Contact email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" value={form.website} onChange={(event) => updateField("website", event.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="marketsServed">Markets served *</Label>
                <Input id="marketsServed" value={form.marketsServed} onChange={(event) => updateField("marketsServed", event.target.value)} placeholder="Milwaukee WI, Chicago IL, Dallas TX..." required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="assetTypes">Asset types *</Label>
                <Input id="assetTypes" value={form.assetTypes} onChange={(event) => updateField("assetTypes", event.target.value)} placeholder="Single family, small multifamily, land, commercial..." required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceMin">Minimum price</Label>
                <Input id="priceMin" value={form.priceMin} onChange={(event) => updateField("priceMin", event.target.value)} placeholder="$75,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceMax">Maximum price</Label>
                <Input id="priceMax" value={form.priceMax} onChange={(event) => updateField("priceMax", event.target.value)} placeholder="$500,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closingSpeed">Typical close speed</Label>
                <Input id="closingSpeed" value={form.closingSpeed} onChange={(event) => updateField("closingSpeed", event.target.value)} placeholder="7 days, 14 days, 30 days..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proofOfFundsStatus">Proof status</Label>
                <select
                  id="proofOfFundsStatus"
                  value={form.proofOfFundsStatus}
                  onChange={(event) => updateField("proofOfFundsStatus", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {proofStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredDeals">Preferred deals *</Label>
              <Textarea id="preferredDeals" value={form.preferredDeals} onChange={(event) => updateField("preferredDeals", event.target.value)} placeholder="Example: vacant single family under $250k, light rehab, 10%+ margin, owner-occupied excluded..." required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="noGoItems">No-go items</Label>
              <Textarea id="noGoItems" value={form.noGoItems} onChange={(event) => updateField("noGoItems", event.target.value)} placeholder="Example: rural, occupied, structural, title issues, flood zone, below margin..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referralNotes">Referral process or acquisition notes</Label>
              <Textarea id="referralNotes" value={form.referralNotes} onChange={(event) => updateField("referralNotes", event.target.value)} placeholder="How VestBlock should send opportunities, preferred contact method, referral expectations, docs needed, or whether you want fix-and-flip, bridge, DSCR, or ground-up funding review..." />
            </div>

            <Button type="submit" size="lg" disabled={submitting} className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {submitting ? "Submitting..." : "Submit buy box"}
              <Send className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-center text-xs leading-5 text-slate-500">
              Looking for lending opportunities instead?{" "}
              <Link href="/lenders" className="text-cyan-200 hover:text-cyan-100">
                Join the lender network
                <ArrowRight className="ml-1 inline h-3 w-3" />
              </Link>
            </p>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <Home className="mb-3 h-5 w-5 text-cyan-200" />
            <h2 className="font-semibold text-white">Seller context matters</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">VestBlock asks sellers for property, timeline, condition, and price context before making a buyer introduction.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <BadgeDollarSign className="mb-3 h-5 w-5 text-cyan-200" />
            <h2 className="font-semibold text-white">Capital can support action</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">When a buyer likes a deal but needs leverage, VestBlock can help organize the file for No Limit Capital review across fix-and-flip, bridge, DSCR, or ground-up lanes.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <Users className="mb-3 h-5 w-5 text-cyan-200" />
            <h2 className="font-semibold text-white">Your criteria stay separate</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Buy boxes and lender boxes should not be blurred together. Buyers get seller-fit opportunities; lenders get borrower/deal-fit requests.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <Network className="mb-3 h-5 w-5 text-cyan-200" />
            <h2 className="font-semibold text-white">Visibility can support the profile</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Qualified buyers can add more support later if they need a stronger intake process, clearer partner materials, or cleaner funding packaging.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
