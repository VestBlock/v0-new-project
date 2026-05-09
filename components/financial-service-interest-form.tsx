'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { financialSkillsetPackages } from '@/lib/services/financialSkillsets';

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

export function FinancialServiceInterestForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const packageKey = searchParams.get('package');
    if (!packageKey) return;

    const packageExists = financialSkillsetPackages.some((item) => item.key === packageKey);
    if (!packageExists) return;

    setForm((current) => ({ ...current, packageKey }));
  }, [searchParams]);

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
        title: 'Service request received',
        description: 'VestBlock will review the request and follow up with the next step.',
      });
      setForm(initialForm);
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
        <CardTitle>Request A Financial Service</CardTitle>
        <CardDescription>
          Tell us which package fits your goal. VestBlock will review the request
          and follow up with the next step.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitInterest} className="space-y-5">
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
            Submit Service Request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
