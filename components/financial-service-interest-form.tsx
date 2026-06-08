'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  financialSkillsetPackages,
  getFinancialSkillsetPackage,
} from '@/lib/services/financialSkillsets';

const initialForm = {
  packageKey: 'funding_readiness_snapshot',
  name: '',
  email: '',
  phone: '',
  businessName: '',
  monthlyRevenueRange: '',
  creditScoreRange: '',
  timeline: '',
  primaryGoal: '',
  notes: '',
};

function getValidPackageKey(value: string | null) {
  if (!value) return initialForm.packageKey;

  const packageExists = financialSkillsetPackages.some((item) => item.key === value);
  return packageExists ? value : initialForm.packageKey;
}

function createInitialForm(packageKey = initialForm.packageKey) {
  return { ...initialForm, packageKey };
}

export function FinancialServiceInterestForm() {
  const searchParams = useSearchParams();
  const defaultPackageKey = getValidPackageKey(searchParams.get('package'));
  const [form, setForm] = useState(() => createInitialForm(defaultPackageKey));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<{
    businessName: string;
    packageTitle: string;
    deliverableStatus: string;
  } | null>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const deliverableStatusLabel =
    submissionState?.deliverableStatus === 'sent_to_client'
      ? isAuthenticated
        ? 'Ready in your account'
        : 'Ready after account setup'
      : submissionState?.deliverableStatus === 'ready_for_review'
        ? 'Being reviewed'
        : submissionState?.deliverableStatus === 'queued'
          ? 'Queued for follow-up'
          : submissionState?.deliverableStatus === 'generating'
            ? 'In progress'
            : 'Saved';

  const updateField = (name: string, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitInterest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/service-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit service request.');
      }

      toast({
        title: 'Prep review request received',
        description: 'VestBlock will confirm the right scope and next step before any payment is collected.',
      });
      const selectedPackage = getFinancialSkillsetPackage(form.packageKey);
      setSubmissionState({
        businessName: form.businessName || form.name,
        packageTitle: selectedPackage?.title || 'Prep review',
        deliverableStatus: data.deliverableStatus || 'requested',
      });
      setForm(createInitialForm(defaultPackageKey));
    } catch (error) {
      toast({
        title: 'Request not sent',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to submit service request.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card id="request-service" className="border-cyan-500/20">
      <CardHeader>
        <CardTitle>Request A Prep Review</CardTitle>
        <CardDescription>
          Tell us which review fits your goal. VestBlock will confirm the right
          scope and next step before any payment is collected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitInterest} className="space-y-5">
          {submissionState ? (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {submissionState.packageTitle} request saved for {submissionState.businessName}
              </p>
              <p className="mt-1">
                Status: {deliverableStatusLabel}. VestBlock will confirm scope, next step, and any payment only after review.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button asChild size="sm">
                  <Link href={isAuthenticated ? '/dashboard/services' : '/register?redirect=/dashboard/services'}>
                    {isAuthenticated ? 'View My Account' : 'Create Account for Dashboard Access'}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/services">Compare Other Services</Link>
                </Button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Package</Label>
            <Select
              value={form.packageKey}
              onValueChange={(value) => updateField('packageKey', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {financialSkillsetPackages.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.title} ({item.price})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(event) => updateField('businessName', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="monthlyRevenueRange">Monthly revenue range</Label>
              <Input
                id="monthlyRevenueRange"
                value={form.monthlyRevenueRange}
                onChange={(event) =>
                  updateField('monthlyRevenueRange', event.target.value)
                }
                placeholder="e.g., $5k-$15k"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditScoreRange">Credit score range</Label>
              <Input
                id="creditScoreRange"
                value={form.creditScoreRange}
                onChange={(event) =>
                  updateField('creditScoreRange', event.target.value)
                }
                placeholder="e.g., 680-720"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeline">Timeline</Label>
              <Input
                id="timeline"
                value={form.timeline}
                onChange={(event) => updateField('timeline', event.target.value)}
                placeholder="e.g., this month"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryGoal">Primary goal</Label>
            <Input
              id="primaryGoal"
              value={form.primaryGoal}
              onChange={(event) => updateField('primaryGoal', event.target.value)}
              placeholder="Funding, grant prep, business credit, debt payoff, real estate deal..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Add any details VestBlock should review before follow-up."
              rows={4}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Submit Prep Review Request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
