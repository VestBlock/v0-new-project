'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { evaluateCardFundingReadiness } from '@/lib/funding/cardStacking';

const initialAnswers = {
  businessStage: 'operating',
  businessAgeMonths: '0',
  monthlyRevenue: '0',
  personalCreditScore: '700_739',
  currentUtilization: '10_29',
  recentInquiries: '0_1',
  hasEin: false,
  hasBusinessBank: false,
  hasBusinessCreditCard: false,
  requestedFundingAmount: '25000',
  useOfFunds: '',
};

function resultCopy(tier?: string) {
  if (tier === 'strong_candidate') {
    return {
      headline: 'Likely funding-ready',
      description:
        'This profile appears strong enough to explore funding options now, subject to document review and lender terms.',
      action: 'Apply With Funding Partner',
      variant: 'default' as const,
    };
  }

  if (tier === 'review_ready') {
    return {
      headline: 'Potentially eligible with cleanup',
      description:
        'This profile may qualify, but the next move should be careful. A few prep items could improve approval odds, limits, or terms.',
      action: 'Improve My Eligibility',
      variant: 'secondary' as const,
    };
  }

  return {
    headline: 'Not ready yet',
    description:
      'This profile should improve readiness before applying. VestBlock can help organize the credit, business setup, and documentation work.',
    action: 'Join The $300 Readiness Plan',
    variant: 'outline' as const,
  };
}

export function FundingEligibilityChecker() {
  const [answers, setAnswers] = useState(initialAnswers);
  const [submitted, setSubmitted] = useState(false);

  const readiness = useMemo(() => {
    if (!submitted) return null;

    return evaluateCardFundingReadiness({
      businessStage: answers.businessStage,
      businessAgeMonths: Number(answers.businessAgeMonths || 0),
      monthlyRevenue: Number(answers.monthlyRevenue || 0),
      personalCreditScore: answers.personalCreditScore,
      currentUtilization: answers.currentUtilization,
      recentInquiries: answers.recentInquiries,
      hasEin: answers.hasEin,
      hasBusinessBank: answers.hasBusinessBank,
      hasBusinessCreditCard: answers.hasBusinessCreditCard,
      requestedFundingAmount: Number(answers.requestedFundingAmount || 0),
      useOfFunds: answers.useOfFunds,
    });
  }, [answers, submitted]);

  const copy = resultCopy(readiness?.tier);
  const updateField = (name: string, value: string | boolean) => {
    setAnswers((current) => ({ ...current, [name]: value }));
  };

  return (
    <Card className="border-2 border-cyan-500/20">
      <CardHeader>
        <Badge className="w-fit bg-cyan-600 text-white">Free instant check</Badge>
        <CardTitle className="text-2xl">See If Your Business Is Funding-Ready</CardTitle>
        <CardDescription>
          Answer a few questions and get an instant readiness score before you pay for anything.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Credit range</Label>
              <Select
                value={answers.personalCreditScore}
                onValueChange={(value) => updateField('personalCreditScore', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="740_plus">740+</SelectItem>
                  <SelectItem value="700_739">700-739</SelectItem>
                  <SelectItem value="660_699">660-699</SelectItem>
                  <SelectItem value="620_659">620-659</SelectItem>
                  <SelectItem value="under_620">Under 620</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Utilization</Label>
              <Select
                value={answers.currentUtilization}
                onValueChange={(value) => updateField('currentUtilization', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under_10">Under 10%</SelectItem>
                  <SelectItem value="10_29">10%-29%</SelectItem>
                  <SelectItem value="30_49">30%-49%</SelectItem>
                  <SelectItem value="50_74">50%-74%</SelectItem>
                  <SelectItem value="75_plus">75%+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recent inquiries</Label>
              <Select
                value={answers.recentInquiries}
                onValueChange={(value) => updateField('recentInquiries', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0_1">0-1</SelectItem>
                  <SelectItem value="2_3">2-3</SelectItem>
                  <SelectItem value="4_6">4-6</SelectItem>
                  <SelectItem value="7_plus">7+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="businessAgeMonths">Business age in months</Label>
              <Input
                id="businessAgeMonths"
                type="number"
                min="0"
                value={answers.businessAgeMonths}
                onChange={(event) => updateField('businessAgeMonths', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyRevenue">Monthly revenue</Label>
              <Input
                id="monthlyRevenue"
                type="number"
                min="0"
                value={answers.monthlyRevenue}
                onChange={(event) => updateField('monthlyRevenue', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestedFundingAmount">Funding goal</Label>
              <Input
                id="requestedFundingAmount"
                type="number"
                min="0"
                value={answers.requestedFundingAmount}
                onChange={(event) =>
                  updateField('requestedFundingAmount', event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['hasEin', 'Have EIN'],
              ['hasBusinessBank', 'Business bank account'],
              ['hasBusinessCreditCard', 'Existing business card'],
            ].map(([name, label]) => (
              <label key={name} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <Checkbox
                  checked={Boolean(answers[name as keyof typeof answers])}
                  onCheckedChange={(checked) => updateField(name, checked === true)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="useOfFunds">Use of funds</Label>
            <Textarea
              id="useOfFunds"
              value={answers.useOfFunds}
              onChange={(event) => updateField('useOfFunds', event.target.value)}
              placeholder="Inventory, equipment, ads, payroll bridge, expansion, real estate deal costs..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
            <CreditCard className="mr-2 h-4 w-4" />
            Check Eligibility For Free
          </Button>
        </form>

        <div className="space-y-4">
          {!readiness ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>No payment required</AlertTitle>
              <AlertDescription>
                This free check helps you decide whether to apply now or use VestBlock to get funding-ready first.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-md border p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge variant={copy.variant}>{copy.headline}</Badge>
                  <span className="font-semibold">{readiness.score}/100</span>
                </div>
                <Progress value={readiness.score} />
                <p className="mt-3 text-sm text-muted-foreground">{copy.description}</p>
              </div>

              {readiness.risks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">What may hold you back</h3>
                  {readiness.risks.slice(0, 4).map((risk) => (
                    <p key={risk} className="flex gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span>{risk}</span>
                    </p>
                  ))}
                </div>
              )}

              <div className="grid gap-2">
                {readiness.tier === 'strong_candidate' ? (
                  <Button asChild>
                    <a
                      href="https://thefundingplaybook.com/homepage?am_id=VestBlock"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {copy.action}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/funding/business-funding-strategy">{copy.action}</Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <a href="#funding-application">Submit Funding Lead</a>
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
