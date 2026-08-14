'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

const initialForm = { name: '', email: '', phone: '', companyName: '', role: '', useCase: '', pilotWindow: '', notes: '' }
const fieldClass = 'min-h-12 rounded-none border-white/15 bg-white/[0.035] text-white placeholder:text-slate-600 focus-visible:ring-[#d7f80b]'

function sourcePath() {
  return typeof window === 'undefined' ? '/dealvault' : window.location.pathname || '/dealvault'
}

export function DealVaultPilotInterestForm() {
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savedFor, setSavedFor] = useState('')
  const { toast } = useToast()

  const update = (name: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [name]: value }))

  async function submitInterest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/dealvault/pilot-interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, sourcePath: sourcePath() }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to submit demo request.')
      setSavedFor(form.companyName || form.name)
      setForm(initialForm)
      toast({ title: 'Demo request received', description: 'VestBlock will review the request and follow up with the next step.' })
    } catch (error) {
      toast({ title: 'Demo request not sent', description: error instanceof Error ? error.message : 'Unable to submit demo request.', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="dealvault-demo" className="border border-white/12 bg-white/[0.025] p-6 sm:p-8" aria-labelledby="dealvault-demo-title">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-[#d7f80b]">Demo request</p>
      <h3 id="dealvault-demo-title" className="mt-3 text-2xl font-medium text-white">Describe your record workflow.</h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">No wallet is required. Share enough context for the VestBlock team to evaluate fit; do not include passwords, account numbers, or private deal documents.</p>

      {savedFor ? <div role="status" className="mt-6 border-l-2 border-[#d7f80b] bg-[#d7f80b]/[0.06] px-4 py-3 text-sm text-slate-300">Request saved for <strong className="text-white">{savedFor}</strong>. VestBlock will follow up with the appropriate next step.</div> : null}

      <form onSubmit={submitInterest} className="mt-8 space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="dealvault-name">Name</Label><Input id="dealvault-name" className={fieldClass} value={form.name} onChange={(event) => update('name', event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="dealvault-email">Email</Label><Input id="dealvault-email" className={fieldClass} type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="dealvault-phone">Phone</Label><Input id="dealvault-phone" className={fieldClass} value={form.phone} onChange={(event) => update('phone', event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="dealvault-company">Company or team</Label><Input id="dealvault-company" className={fieldClass} value={form.companyName} onChange={(event) => update('companyName', event.target.value)} /></div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2"><Label>Role</Label><Select value={form.role} onValueChange={(value) => update('role', value)}><SelectTrigger className={fieldClass}><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent><SelectItem value="investor">Investor</SelectItem><SelectItem value="private_lender">Private lender</SelectItem><SelectItem value="contractor">Contractor</SelectItem><SelectItem value="agency">Agency or studio</SelectItem><SelectItem value="consulting_firm">Consulting firm</SelectItem><SelectItem value="staffing_recruiting">Staffing or recruiting</SelectItem><SelectItem value="referral_partner">Referral partner</SelectItem><SelectItem value="real_estate_team">Real-estate team</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Primary need</Label><Select value={form.useCase} onValueChange={(value) => update('useCase', value)}><SelectTrigger className={fieldClass}><SelectValue placeholder="Select need" /></SelectTrigger><SelectContent><SelectItem value="proof_records">Proof records</SelectItem><SelectItem value="payout_ledger">Payout ledger</SelectItem><SelectItem value="milestone_tracking">Milestone tracking</SelectItem><SelectItem value="partner_approvals">Partner approvals</SelectItem><SelectItem value="placement_referral_fees">Placement or referral fees</SelectItem><SelectItem value="full_workflow">Full record workflow</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Timing</Label><Select value={form.pilotWindow} onValueChange={(value) => update('pilotWindow', value)}><SelectTrigger className={fieldClass}><SelectValue placeholder="Select timing" /></SelectTrigger><SelectContent><SelectItem value="immediately">Immediately</SelectItem><SelectItem value="this_month">This month</SelectItem><SelectItem value="next_30_days">Next 30 days</SelectItem><SelectItem value="exploring">Exploring</SelectItem></SelectContent></Select></div>
        </div>

        <div className="space-y-2"><Label htmlFor="dealvault-notes">What needs a stronger record?</Label><Textarea id="dealvault-notes" className={`${fieldClass} min-h-32`} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Describe the agreement, payout, milestone, or approval workflow." /></div>

        <Button type="submit" className="min-h-12 w-full rounded-none bg-[#d7f80b] font-semibold text-[#06090c] hover:bg-[#ecff5d]" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Request private demo
        </Button>
      </form>
    </section>
  )
}
