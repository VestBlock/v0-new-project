"use client"

import { useState } from "react"
import { CheckCircle2, ClipboardCheck, HandshakeIcon, Send, ShieldCheck, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const points = [
  {
    title: "You keep your full commission",
    body: "A backup cash review is not a listing takeover. If our buyer closes, you close it as the agent on record.",
    icon: HandshakeIcon,
  },
  {
    title: "A real number in writing",
    body: "We put the screening cash-review band in writing so you have a concrete backup for your seller conversation.",
    icon: ClipboardCheck,
  },
  {
    title: "Built for 60+ DOM listings",
    body: "Stale listings are where a standing backup offer changes the conversation. Fresh listings usually don't need us yet.",
    icon: Timer,
  },
] as const

type FormState = {
  agentName: string
  email: string
  phone: string
  brokerage: string
  listingAddress: string
  listPrice: string
  daysOnMarket: string
  notes: string
}

const initialForm: FormState = {
  agentName: "",
  email: "",
  phone: "",
  brokerage: "",
  listingAddress: "",
  listPrice: "",
  daysOnMarket: "",
  notes: "",
}

export function BackupOfferPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const update = (field: keyof FormState, value: string) => setForm((c) => ({ ...c, [field]: value }))

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/backup-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Unable to submit the request.")
      setSuccess(true)
      setForm(initialForm)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit the request.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-6xl">
        <section className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm text-amber-100">
              <ShieldCheck className="h-4 w-4" />
              For listing agents
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              A standing backup offer for your stale listings.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              Any listing past 60 days on market can get a written, no-obligation backup cash review.
              It sits in your file as leverage: your seller sees a real floor, buyers negotiate against it,
              and if our buyer network closes, you keep your full commission.
            </p>

            <div className="grid gap-4">
              {points.map((point) => {
                const Icon = point.icon
                return (
                  <div key={point.title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-white">{point.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{point.body}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="max-w-xl text-xs leading-5 text-slate-500">
              VestBlock provides screening reviews and buyer-network routing. A backup review is not a
              guaranteed offer, price, or closing; final terms depend on condition, payoff, title, and buyer fit.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="premium-section space-y-4 p-5 md:p-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Request a backup review</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                One listing per request. We respond within one business day with next steps.
              </p>
            </div>

            {success ? (
              <div className="flex gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <p>
                  Request received. We review the listing details and follow up within one business day with
                  the screening band and what a written backup looks like for your file.
                </p>
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">{error}</div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agentName">Your name *</Label>
                <Input id="agentName" value={form.agentName} onChange={(e) => update("agentName", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brokerage">Brokerage</Label>
                <Input id="brokerage" value={form.brokerage} onChange={(e) => update("brokerage", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="listingAddress">Listing address *</Label>
                <Input id="listingAddress" value={form.listingAddress} onChange={(e) => update("listingAddress", e.target.value)} placeholder="123 Main St, Dayton, OH 45404" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="listPrice">Current list price</Label>
                <Input id="listPrice" value={form.listPrice} onChange={(e) => update("listPrice", e.target.value)} placeholder="$189,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daysOnMarket">Days on market</Label>
                <Input id="daysOnMarket" value={form.daysOnMarket} onChange={(e) => update("daysOnMarket", e.target.value)} placeholder="74" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Anything we should know?</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Condition, seller motivation, price history, tenant status..." rows={3} />
            </div>

            <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 sm:grid-cols-3">
              <p className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-200" />
                No fee, no obligation
              </p>
              <p className="flex items-center gap-2 text-xs text-slate-300">
                <HandshakeIcon className="h-3.5 w-3.5 shrink-0 text-amber-200" />
                You keep full commission
              </p>
              <p className="flex items-center gap-2 text-xs text-slate-300">
                <Send className="h-3.5 w-3.5 shrink-0 text-amber-200" />
                Response within 1 business day
              </p>
            </div>

            <Button type="submit" size="lg" disabled={submitting} className="w-full bg-amber-300 text-slate-950 hover:bg-amber-200">
              {submitting ? "Submitting..." : "Request backup review"}
              <Send className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </section>
      </div>
    </main>
  )
}
