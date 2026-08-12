"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Banknote, CheckCircle2, ClipboardCheck, Landmark, Network, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"

const lenderTypes = [
  { value: "private_lender", label: "Private lender" },
  { value: "hard_money", label: "Hard money" },
  { value: "dscr", label: "DSCR" },
  { value: "fix_and_flip", label: "Fix and flip" },
  { value: "bridge", label: "Bridge" },
  { value: "commercial", label: "Commercial" },
] as const

const steps = [
  {
    title: "Submit your lending box",
    body: "Tell VestBlock your states, loan sizes, borrower fit, asset appetite, and no-go items.",
    icon: ClipboardCheck,
  },
  {
    title: "Clarify what you fund",
    body: "Your lending box helps VestBlock understand which deals should reach you and which should not.",
    icon: Network,
  },
  {
    title: "Review aligned deals",
    body: "When a seller, borrower, or operator fits your criteria, VestBlock can send the opportunity to your team for review.",
    icon: Banknote,
  },
] as const

type FormState = {
  companyName: string
  contactName: string
  email: string
  phone: string
  website: string
  category: string
  statesServed: string
  loanAmountMin: string
  loanAmountMax: string
  minCreditScore: string
  speedToClose: string
  preferredDeals: string
  noGoItems: string
  referralNotes: string
}

const initialForm: FormState = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  category: "private_lender",
  statesServed: "",
  loanAmountMin: "",
  loanAmountMax: "",
  minCreditScore: "",
  speedToClose: "",
  preferredDeals: "",
  noGoItems: "",
  referralNotes: "",
}

export function LenderSignupPage() {
  const { user, userProfile } = useAuth()
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

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
    setError("")
    setSuccess(false)

    try {
      const response = await fetch("/api/lenders/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit lender profile.")
      }

      setSuccess(true)
      setForm(initialForm)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit lender profile.")
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
              <Landmark className="h-4 w-4 text-cyan-200" />
              Lender network
            </div>
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                Get real estate deals routed to your lending box.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Private lenders, hard money lenders, DSCR lenders, bridge lenders, and commercial capital providers can share criteria once. VestBlock uses that lending box to route seller, buyer, borrower, and operator opportunities that appear worth your review.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
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
              VestBlock does not guarantee deal volume, approvals, terms, funding outcomes, or closed referrals. The purpose is to keep lender criteria clear so opportunities are routed to the right capital partner faster.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="premium-section space-y-5 p-5 md:p-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Lender signup</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Share enough criteria for VestBlock to understand what you fund, where you fund, and what should never be sent to you.
              </p>
            </div>

            {success ? (
              <div className="flex gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span>Your lender profile was received. VestBlock can now use your criteria when routing matching real estate opportunities for review.</span>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company / lender name *</Label>
                <Input id="companyName" value={form.companyName} onChange={(event) => updateField("companyName", event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Lending type *</Label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {lenderTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
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
              <div className="space-y-2">
                <Label htmlFor="statesServed">States served *</Label>
                <Input id="statesServed" value={form.statesServed} onChange={(event) => updateField("statesServed", event.target.value)} placeholder="IL, WI, IN, TX" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="speedToClose">Typical speed to close</Label>
                <Input id="speedToClose" value={form.speedToClose} onChange={(event) => updateField("speedToClose", event.target.value)} placeholder="7-14 days, 30 days..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loanAmountMin">Minimum loan amount</Label>
                <Input id="loanAmountMin" value={form.loanAmountMin} onChange={(event) => updateField("loanAmountMin", event.target.value)} placeholder="$75,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loanAmountMax">Maximum loan amount</Label>
                <Input id="loanAmountMax" value={form.loanAmountMax} onChange={(event) => updateField("loanAmountMax", event.target.value)} placeholder="$2,000,000" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="minCreditScore">Minimum borrower credit, DSCR, liquidity, or requirements</Label>
                <Input id="minCreditScore" value={form.minCreditScore} onChange={(event) => updateField("minCreditScore", event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredDeals">Preferred deals / borrowers *</Label>
              <Textarea id="preferredDeals" value={form.preferredDeals} onChange={(event) => updateField("preferredDeals", event.target.value)} placeholder="Example: investor borrowers, non-owner occupied, fix-and-flip, DSCR rentals, bridge loans, specific asset classes..." required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="noGoItems">No-go items</Label>
              <Textarea id="noGoItems" value={form.noGoItems} onChange={(event) => updateField("noGoItems", event.target.value)} placeholder="Example: owner-occupied, rural land, credit below X, no entity, no rehab budget..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referralNotes">Referral process or partner notes</Label>
              <Textarea id="referralNotes" value={form.referralNotes} onChange={(event) => updateField("referralNotes", event.target.value)} placeholder="How VestBlock should send opportunities, required docs, referral expectations, contact process..." />
            </div>

            <Button type="submit" size="lg" disabled={submitting} className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {submitting ? "Submitting..." : "Join lender network"}
              <Send className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-center text-xs leading-5 text-slate-500">
              Looking for money for your own property deal?{" "}
              <Link href="/real-estate-funding" className="text-cyan-200 hover:text-cyan-100">
                Use the funding review path
                <ArrowRight className="ml-1 inline h-3 w-3" />
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  )
}
