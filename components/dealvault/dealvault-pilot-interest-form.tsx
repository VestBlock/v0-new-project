'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  companyName: '',
  role: '',
  useCase: '',
  pilotWindow: '',
  notes: '',
};

function getCurrentSourcePath() {
  if (typeof window === 'undefined') return '/dealvault';
  return window.location.pathname || '/dealvault';
}

export function DealVaultPilotInterestForm() {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const updateField = (name: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitInterest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/dealvault/pilot-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sourcePath: getCurrentSourcePath() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit demo request.');
      }

      toast({
        title: 'Demo request received',
        description: 'VestBlock will review the DealVault request and follow up with the next step.',
      });
      setForm(initialForm);
    } catch (error) {
      toast({
        title: 'Demo request not sent',
        description:
          error instanceof Error ? error.message : 'Unable to submit demo request.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card id="dealvault-demo" className="border-cyan-500/20">
      <CardHeader>
        <CardTitle>Request A Private DealVault Demo</CardTitle>
        <CardDescription>
          No wallet connect required. Tell VestBlock how your team wants to use DealVault and we
          will review the request and follow up with the next step.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitInterest} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dealvault-name">Name</Label>
              <Input
                id="dealvault-name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealvault-email">Email</Label>
              <Input
                id="dealvault-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealvault-phone">Phone</Label>
              <Input
                id="dealvault-phone"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealvault-company">Company / Team</Label>
              <Input
                id="dealvault-company"
                value={form.companyName}
                onChange={(event) => updateField('companyName', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(value) => updateField('role', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="investor">Investor</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="private_lender">Private lender</SelectItem>
                  <SelectItem value="agency">Agency / studio</SelectItem>
                  <SelectItem value="consulting_firm">Consulting firm</SelectItem>
                  <SelectItem value="staffing_recruiting">Staffing / recruiting</SelectItem>
                  <SelectItem value="referral_partner">Referral partner</SelectItem>
                  <SelectItem value="creative_finance_team">Creative finance team</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary use case</Label>
              <Select value={form.useCase} onValueChange={(value) => updateField('useCase', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select use case" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proof_records">Proof records</SelectItem>
                  <SelectItem value="payout_ledger">Payout ledger</SelectItem>
                  <SelectItem value="milestone_tracking">Milestone tracking</SelectItem>
                  <SelectItem value="vendor_or_partner_approvals">Vendor or partner approvals</SelectItem>
                  <SelectItem value="placement_or_referral_fees">Placement or referral fee tracking</SelectItem>
                  <SelectItem value="full_workflow">Full proof, payout, and milestone package</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Desired demo window</Label>
              <Select
                value={form.pilotWindow}
                onValueChange={(value) => updateField('pilotWindow', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediately">Immediately</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="next_30_days">Next 30 days</SelectItem>
                  <SelectItem value="exploring">Just exploring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dealvault-notes">Notes</Label>
            <Textarea
              id="dealvault-notes"
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Tell VestBlock how you want to use agreement tracking, payout ledgers, milestone records, or partner approvals."
              rows={4}
            />
          </div>

          <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Request Private Demo
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
