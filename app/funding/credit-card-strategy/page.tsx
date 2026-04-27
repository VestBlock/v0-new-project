'use client';

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';

type FundingReadiness = {
  score: number;
  tier: 'needs_prep' | 'review_ready' | 'strong_candidate';
  label: string;
  summary: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
};

type FundingRequest = {
  id: string;
  status: string;
  payment_status: string;
};

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  businessName: '',
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
  consentHardInquiries: false,
  consentNoGuarantee: false,
  consentTermsReview: false,
};

function tierVariant(tier?: string) {
  if (tier === 'strong_candidate') return 'default';
  if (tier === 'review_ready') return 'secondary';
  return 'outline';
}

export default function CreditCardStrategyPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [capturingPayment, setCapturingPayment] = useState(false);
  const [readiness, setReadiness] = useState<FundingReadiness | null>(null);
  const [fundingRequest, setFundingRequest] = useState<FundingRequest | null>(null);
  const [canCheckout, setCanCheckout] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setForm((current) => ({ ...current, email: user.email || current.email }));
    }
  }, [user]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/funding/credit-card-strategy');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!user?.id || capturingPayment || paymentComplete) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const requestId = params.get('requestId');

    if (!token || !requestId) return;

    setCapturingPayment(true);
    fetch('/api/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderID: token,
        userId: user.id,
        requestId,
        productType: 'funding_strategy_review',
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Unable to capture payment.');
        }
        setPaymentComplete(true);
        toast({
          title: 'Payment received',
          description:
            'Your funding strategy review is paid and queued for admin review.',
        });
        window.history.replaceState({}, '', '/funding/credit-card-strategy');
      })
      .catch((error) => {
        toast({
          title: 'Payment needs review',
          description:
            error instanceof Error
              ? error.message
              : 'VestBlock could not confirm the payment automatically.',
          variant: 'destructive',
        });
      })
      .finally(() => setCapturingPayment(false));
  }, [capturingPayment, paymentComplete, toast, user?.id]);

  const canSubmit = useMemo(
    () =>
      form.fullName.trim().length > 1 &&
      form.businessName.trim().length > 1 &&
      form.useOfFunds.trim().length >= 10 &&
      form.consentHardInquiries &&
      form.consentNoGuarantee &&
      form.consentTermsReview,
    [form]
  );

  const updateField = (name: string, value: string | boolean) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setReadiness(null);
    setFundingRequest(null);
    setCanCheckout(false);

    try {
      const response = await fetch('/api/funding-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit funding strategy request.');
      }

      setReadiness(data.readiness);
      setFundingRequest(data.request);
      setCanCheckout(Boolean(data.canCheckout));
      toast({
        title: 'Readiness review created',
        description: data.canCheckout
          ? 'You can now purchase the strategy review.'
          : 'The readiness plan recommends prep before card funding.',
      });
    } catch (error) {
      toast({
        title: 'Request not submitted',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to create the funding strategy request.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startCheckout = async () => {
    if (!user?.id || !fundingRequest?.id) return;

    setCheckoutLoading(true);
    try {
      const returnPath = `/funding/credit-card-strategy?requestId=${fundingRequest.id}`;
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          productType: 'funding_strategy_review',
          requestId: fundingRequest.id,
          returnPath,
        }),
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Unable to start PayPal checkout.');
      }

      const approveLink = json.data?.links?.find(
        (link: { rel: string; href: string }) => link.rel === 'approve'
      );

      if (!approveLink?.href) {
        throw new Error('PayPal approval link was not returned.');
      }

      window.location.href = approveLink.href;
    } catch (error) {
      toast({
        title: 'Checkout unavailable',
        description:
          error instanceof Error ? error.message : 'Unable to start checkout.',
        variant: 'destructive',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (isLoading || capturingPayment) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-24">
      <div className="container mx-auto max-w-6xl space-y-8">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit">Business funding strategy</Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Credit card stacking strategy review
            </h1>
            <p className="text-lg text-muted-foreground">
              Get a structured readiness review before you pursue business
              credit card funding. VestBlock checks credit range, utilization,
              inquiries, business setup, revenue story, and use-of-funds clarity
              so you know what to fix before applications.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">Review price</p>
                <p className="text-2xl font-bold">$297</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">Workflow</p>
                <p className="text-2xl font-bold">Automated</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">Admin review</p>
                <p className="text-2xl font-bold">Queued</p>
              </div>
            </div>
          </div>

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Compliance-first funding support</AlertTitle>
            <AlertDescription>
              This service organizes strategy and readiness. It does not
              guarantee approvals, credit limits, rates, or funding. No
              application should be submitted until you review the lender terms,
              fees, inquiries, and repayment obligations.
            </AlertDescription>
          </Alert>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Readiness assessment</CardTitle>
              <CardDescription>
                Submit your profile, generate a readiness score, and unlock the
                paid review only when the profile is ready enough to evaluate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitRequest} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(event) => updateField('fullName', event.target.value)}
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(event) => updateField('phone', event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business name</Label>
                    <Input
                      id="businessName"
                      value={form.businessName}
                      onChange={(event) =>
                        updateField('businessName', event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Business stage</Label>
                    <Select
                      value={form.businessStage}
                      onValueChange={(value) => updateField('businessStage', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="startup">Startup</SelectItem>
                        <SelectItem value="operating">Operating</SelectItem>
                        <SelectItem value="scaling">Scaling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessAgeMonths">Business age in months</Label>
                    <Input
                      id="businessAgeMonths"
                      type="number"
                      min="0"
                      value={form.businessAgeMonths}
                      onChange={(event) =>
                        updateField('businessAgeMonths', event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRevenue">Monthly revenue</Label>
                    <Input
                      id="monthlyRevenue"
                      type="number"
                      min="0"
                      value={form.monthlyRevenue}
                      onChange={(event) =>
                        updateField('monthlyRevenue', event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Personal credit range</Label>
                    <Select
                      value={form.personalCreditScore}
                      onValueChange={(value) =>
                        updateField('personalCreditScore', value)
                      }
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
                    <Label>Current revolving utilization</Label>
                    <Select
                      value={form.currentUtilization}
                      onValueChange={(value) =>
                        updateField('currentUtilization', value)
                      }
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
                    <Label>Recent hard inquiries</Label>
                    <Select
                      value={form.recentInquiries}
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

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['hasEin', 'Business has EIN'],
                    ['hasBusinessBank', 'Business bank account is open'],
                    ['hasBusinessCreditCard', 'Business card already exists'],
                  ].map(([name, label]) => (
                    <label
                      key={name}
                      className="flex items-center gap-2 rounded-md border p-3 text-sm"
                    >
                      <Checkbox
                        checked={Boolean(form[name as keyof typeof form])}
                        onCheckedChange={(checked) =>
                          updateField(name, checked === true)
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="requestedFundingAmount">Funding amount</Label>
                    <Input
                      id="requestedFundingAmount"
                      type="number"
                      min="0"
                      value={form.requestedFundingAmount}
                      onChange={(event) =>
                        updateField('requestedFundingAmount', event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="useOfFunds">Use of funds</Label>
                    <Textarea
                      id="useOfFunds"
                      value={form.useOfFunds}
                      onChange={(event) =>
                        updateField('useOfFunds', event.target.value)
                      }
                      placeholder="Example: inventory, ads, payroll bridge, equipment, expansion, or real estate project expenses."
                      rows={4}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border p-4">
                  {[
                    [
                      'consentHardInquiries',
                      'I understand card funding applications may create hard inquiries and repayment obligations.',
                    ],
                    [
                      'consentNoGuarantee',
                      'I understand VestBlock does not guarantee approvals, limits, rates, or funding.',
                    ],
                    [
                      'consentTermsReview',
                      'I agree to review lender terms, APRs, fees, and repayment risk before any application.',
                    ],
                  ].map(([name, label]) => (
                    <label key={name} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={Boolean(form[name as keyof typeof form])}
                        onCheckedChange={(checked) =>
                          updateField(name, checked === true)
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Generate Readiness Review
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Strategy output</CardTitle>
                <CardDescription>
                  Your score decides whether the paid review is the next step or
                  prep work should happen first.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!readiness ? (
                  <p className="text-sm text-muted-foreground">
                    Submit the assessment to create a saved admin-visible request.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant={tierVariant(readiness.tier)}>
                          {readiness.label}
                        </Badge>
                        <span className="font-semibold">{readiness.score}/100</span>
                      </div>
                      <Progress value={readiness.score} />
                    </div>
                    <p className="text-sm">{readiness.summary}</p>
                    {paymentComplete && (
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Paid review queued</AlertTitle>
                        <AlertDescription>
                          VestBlock has logged this as a paid funding strategy
                          review for admin follow-up.
                        </AlertDescription>
                      </Alert>
                    )}
                    {readiness.risks.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">Watch items</h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {readiness.risks.slice(0, 4).map((item) => (
                            <li key={item} className="flex gap-2">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Next steps</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {readiness.nextSteps.slice(0, 5).map((item) => (
                          <li key={item} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {canCheckout ? (
                      <Button
                        className="w-full"
                        onClick={startCheckout}
                        disabled={checkoutLoading}
                      >
                        {checkoutLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="mr-2 h-4 w-4" />
                        )}
                        Pay $297 For Strategy Review
                      </Button>
                    ) : (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Prep recommended first</AlertTitle>
                        <AlertDescription>
                          This profile should improve readiness before buying a
                          card funding review. Focus on the listed next steps,
                          then resubmit.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
