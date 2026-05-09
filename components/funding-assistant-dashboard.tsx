'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileCheck2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { vestblockFundingMockProfiles } from '@/lib/funding/mock-data';
import type {
  FundingPaymentPlan,
  FundingProfile,
  FundingProgressSummary,
  FundingRecommendation,
  FundingSequenceItemWithProduct,
} from '@/lib/funding/types';

const initialProfile: FundingProfile = {
  mode: 'business',
  funding_goal_amount: 50000,
  funding_goal_reason: '',
  fico_estimate: 700,
  income_range: '$8,000-$12,000/mo',
  monthly_debt_payments: 0,
  credit_utilization: 18,
  recent_inquiries_count: 1,
  new_accounts_24_months: 1,
  has_llc: false,
  business_name: '',
  business_start_date: '',
  business_revenue_range: '$0-$25K',
  business_industry: '',
  ein_available: false,
};

function currency(value?: number | null) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusTone(status: string) {
  if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
  if (status === 'denied') return 'bg-rose-500/15 text-rose-300 border-rose-400/30';
  if (status === 'pending') return 'bg-amber-500/15 text-amber-200 border-amber-400/30';
  if (status === 'applied' || status === 'opened') {
    return 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30';
  }
  return 'bg-white/5 text-slate-200 border-white/10';
}

export function FundingAssistantDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [profile, setProfile] = useState<FundingProfile>(initialProfile);
  const [recommendation, setRecommendation] = useState<FundingRecommendation | null>(null);
  const [sequenceItems, setSequenceItems] = useState<FundingSequenceItemWithProduct[]>([]);
  const [progress, setProgress] = useState<FundingProgressSummary | null>(null);
  const [plans, setPlans] = useState<FundingPaymentPlan[]>([]);
  const [recommendedPlanId, setRecommendedPlanId] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [approvalItem, setApprovalItem] = useState<FundingSequenceItemWithProduct | null>(null);
  const [approvalLimit, setApprovalLimit] = useState('');
  const [approvalDate, setApprovalDate] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/dashboard/funding');
      return;
    }

    let active = true;
    async function loadFundingAssistant() {
      try {
        const [profileRes, recommendationRes, progressRes] = await Promise.all([
          fetch('/api/funding/profile'),
          fetch('/api/funding/recommendation'),
          fetch('/api/funding/progress'),
        ]);

        const profileJson = await profileRes.json();
        const recommendationJson = await recommendationRes.json();
        const progressJson = await progressRes.json();

        if (!active) return;

        if (profileJson.profile) {
          setProfile({
            ...initialProfile,
            ...profileJson.profile,
          });
        }

        setRecommendation(recommendationJson.recommendation ?? null);
        setSequenceItems(recommendationJson.sequenceItems ?? []);
        setProgress(progressJson.progress ?? null);
        setDisclaimer(recommendationJson.disclaimer ?? '');
      } catch (error) {
        console.error('[funding-dashboard] load failed:', error);
        if (!active) return;
        toast({
          title: 'Funding assistant unavailable',
          description: 'VestBlock could not load your funding data right now.',
          variant: 'destructive',
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFundingAssistant();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, router, toast]);

  async function refreshProgress() {
    const response = await fetch('/api/funding/progress');
    const json = await response.json();
    setProgress(json.progress ?? null);
  }

  async function generateStrategy() {
    setSavingStrategy(true);
    try {
      const profileRes = await fetch('/api/funding/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const profileJson = await profileRes.json();

      if (!profileRes.ok) {
        throw new Error(profileJson.error || 'Unable to save funding profile.');
      }

      const recommendationRes = await fetch('/api/funding/recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const recommendationJson = await recommendationRes.json();

      if (!recommendationRes.ok) {
        throw new Error(
          recommendationJson.error || 'Unable to generate funding recommendation.'
        );
      }

      setProfile({
        ...profile,
        ...recommendationJson.profile,
      });
      setRecommendation(recommendationJson.recommendation);
      setSequenceItems(recommendationJson.sequenceItems ?? []);
      setDisclaimer(recommendationJson.disclaimer ?? '');
      setPlans([]);
      await refreshProgress();

      toast({
        title: 'Funding strategy generated',
        description: 'Your readiness score, path, and sequence are ready.',
      });
    } catch (error) {
      toast({
        title: 'Strategy not generated',
        description:
          error instanceof Error
            ? error.message
            : 'VestBlock could not generate the funding strategy.',
        variant: 'destructive',
      });
    } finally {
      setSavingStrategy(false);
    }
  }

  async function updateSequenceStatus(
    item: FundingSequenceItemWithProduct,
    status: string
  ) {
    const response = await fetch(`/api/funding/applications/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || 'Unable to update status.');
    }

    setSequenceItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, ...json.sequenceItem } : entry
      )
    );
    await refreshProgress();
  }

  async function openApplication(item: FundingSequenceItemWithProduct) {
    const targetUrl = item.product?.affiliate_url || item.product?.application_url;
    if (!targetUrl) {
      toast({
        title: 'No external application link',
        description:
          'This step is an internal readiness or strategy step. There is no direct issuer link for it yet.',
      });
      return;
    }

    try {
      await updateSequenceStatus(item, 'opened');
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({
        title: 'Unable to mark step opened',
        description:
          error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      });
    }
  }

  async function submitApproval() {
    if (!approvalItem?.id || !approvalLimit) return;

    const response = await fetch('/api/funding/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sequence_item_id: approvalItem.id,
        approved_limit: Number(approvalLimit),
        approval_date: approvalDate || null,
        notes: approvalNotes || null,
      }),
    });
    const json = await response.json();

    if (!response.ok) {
      toast({
        title: 'Approval not saved',
        description: json.error || 'VestBlock could not save the approval.',
        variant: 'destructive',
      });
      return;
    }

    setSequenceItems((current) =>
      current.map((entry) =>
        entry.id === approvalItem.id ? { ...entry, ...json.sequenceItem } : entry
      )
    );
    setProgress(json.progress ?? null);
    setApprovalItem(null);
    setApprovalLimit('');
    setApprovalDate('');
    setApprovalNotes('');
    toast({
      title: 'Approval recorded',
      description: 'The funding total and sequence progress were updated.',
    });
  }

  async function loadPaymentPlans(selectedPlan?: string) {
    setLoadingPlans(true);
    try {
      const response = await fetch('/api/funding/payment-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation_id: recommendation?.id ?? null,
          selected_plan: selectedPlan ?? null,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Unable to load payment plans.');
      }

      setPlans(json.plans ?? []);
      setRecommendedPlanId(json.recommendedPlanId ?? null);

      if (selectedPlan) {
        toast({
          title: 'Assisted review requested',
          description:
            'VestBlock saved your plan preference so admin follow-up can start from the right lane.',
        });
      }
    } catch (error) {
      toast({
        title: 'Payment plans unavailable',
        description:
          error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPlans(false);
    }
  }

  function loadMockProfile(key: keyof typeof vestblockFundingMockProfiles) {
    setProfile((current) => ({
      ...current,
      ...vestblockFundingMockProfiles[key],
    }));
  }

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <main className="space-y-8 px-4 py-6 md:px-8">
      <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.98))] p-6 text-white shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit border border-cyan-300/30 bg-cyan-500/15 text-cyan-100">
              VestBlock Funding Assistant
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Find the safest path to business funding, personal funding, or a hybrid capital strategy.
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
                Build your readiness profile, generate a deterministic funding strategy, track every application step,
                and keep admin follow-up organized in one place.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-white/10 bg-white/5 text-white">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">User</div>
                <div className="mt-1 text-sm font-medium">{user?.email || 'Signed in'}</div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/5 text-white">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Readiness</div>
                <div className="mt-1 text-2xl font-semibold">
                  {recommendation?.readiness_score ?? profile.readiness_score ?? '--'}
                </div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/5 text-white">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Approved</div>
                <div className="mt-1 text-2xl font-semibold">
                  {currency(progress?.totalApprovedLimit)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-cyan-500/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle>Funding profile</CardTitle>
            <CardDescription>
              This profile drives readiness scoring, strategy selection, timing, and admin follow-up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  key: 'business',
                  label: 'Business Funding',
                  icon: BriefcaseBusiness,
                  copy: 'Use an entity-first business credit strategy.',
                },
                {
                  key: 'personal',
                  label: 'Personal Credit Funding',
                  icon: CreditCard,
                  copy: 'Use a personal-file-first approach.',
                },
                {
                  key: 'hybrid',
                  label: 'Hybrid Funding',
                  icon: WalletCards,
                  copy: 'Blend business and personal lanes carefully.',
                },
              ].map((option) => {
                const Icon = option.icon;
                const active = profile.mode === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      setProfile((current) => ({
                        ...current,
                        mode: option.key as FundingProfile['mode'],
                      }))
                    }
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      active
                        ? 'border-cyan-400/40 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <Icon className="h-4 w-4 text-cyan-300" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{option.label}</div>
                        <div className="text-xs text-slate-400">{option.copy}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {process.env.NODE_ENV !== 'production' ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-medium text-white">Development mock profiles</div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadMockProfile('strongBusinessUser')}>
                    Strong business
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => loadMockProfile('weakPersonalCreditUser')}>
                    Weak personal
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => loadMockProfile('hybridUser')}>
                    Hybrid
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMockProfile('repairFirstHighUtilizationUser')}
                  >
                    Repair first
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="funding_goal_amount">Funding goal amount</Label>
                <Input
                  id="funding_goal_amount"
                  type="number"
                  value={profile.funding_goal_amount ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      funding_goal_amount: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fico_estimate">Estimated FICO score</Label>
                <Input
                  id="fico_estimate"
                  type="number"
                  min="300"
                  max="850"
                  value={profile.fico_estimate ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      fico_estimate: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="funding_goal_reason">Funding goal reason</Label>
              <Textarea
                id="funding_goal_reason"
                rows={3}
                value={profile.funding_goal_reason ?? ''}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    funding_goal_reason: event.target.value,
                  }))
                }
                placeholder="Equipment, inventory, cash-flow bridge, launch runway, real estate deal reserve..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Income range</Label>
                <Select
                  value={profile.income_range ?? '$8,000-$12,000/mo'}
                  onValueChange={(value) =>
                    setProfile((current) => ({ ...current, income_range: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Under $4,000/mo">Under $4,000/mo</SelectItem>
                    <SelectItem value="$4,000-$8,000/mo">$4,000-$8,000/mo</SelectItem>
                    <SelectItem value="$8,000-$12,000/mo">$8,000-$12,000/mo</SelectItem>
                    <SelectItem value="$12,000-$20,000/mo">$12,000-$20,000/mo</SelectItem>
                    <SelectItem value="$20,000+/mo">$20,000+/mo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly_debt_payments">Monthly debt payments</Label>
                <Input
                  id="monthly_debt_payments"
                  type="number"
                  min="0"
                  value={profile.monthly_debt_payments ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      monthly_debt_payments: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="credit_utilization">Credit utilization %</Label>
                <Input
                  id="credit_utilization"
                  type="number"
                  min="0"
                  max="100"
                  value={profile.credit_utilization ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      credit_utilization: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recent_inquiries_count">Recent inquiries count</Label>
                <Input
                  id="recent_inquiries_count"
                  type="number"
                  min="0"
                  value={profile.recent_inquiries_count ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      recent_inquiries_count: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_accounts_24_months">New accounts in 24 months</Label>
                <Input
                  id="new_accounts_24_months"
                  type="number"
                  min="0"
                  value={profile.new_accounts_24_months ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      new_accounts_24_months: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
            </div>

            {profile.mode !== 'personal' ? (
              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <BriefcaseBusiness className="h-4 w-4 text-cyan-300" />
                  Business readiness
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business name</Label>
                    <Input
                      id="business_name"
                      value={profile.business_name ?? ''}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          business_name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_start_date">Business start date</Label>
                    <Input
                      id="business_start_date"
                      type="date"
                      value={profile.business_start_date ?? ''}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          business_start_date: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Business revenue range</Label>
                    <Select
                      value={profile.business_revenue_range ?? '$0-$25K'}
                      onValueChange={(value) =>
                        setProfile((current) => ({
                          ...current,
                          business_revenue_range: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="$0-$25K">$0-$25K</SelectItem>
                        <SelectItem value="$25K-$50K">$25K-$50K</SelectItem>
                        <SelectItem value="$50K-$100K">$50K-$100K</SelectItem>
                        <SelectItem value="$100K-$250K">$100K-$250K</SelectItem>
                        <SelectItem value="$250K+">$250K+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_industry">Business industry</Label>
                    <Input
                      id="business_industry"
                      value={profile.business_industry ?? ''}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          business_industry: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      profile.has_llc
                        ? 'border-cyan-400/40 bg-cyan-500/10'
                        : 'border-white/10 bg-white/[0.02]'
                    )}
                    onClick={() =>
                      setProfile((current) => ({ ...current, has_llc: !current.has_llc }))
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white">Has LLC or corporation</div>
                        <div className="text-xs text-slate-400">
                          Entity setup matters for business-first funding.
                        </div>
                      </div>
                      {profile.has_llc ? <BadgeCheck className="h-5 w-5 text-cyan-300" /> : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      profile.ein_available
                        ? 'border-cyan-400/40 bg-cyan-500/10'
                        : 'border-white/10 bg-white/[0.02]'
                    )}
                    onClick={() =>
                      setProfile((current) => ({
                        ...current,
                        ein_available: !current.ein_available,
                      }))
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white">EIN available</div>
                        <div className="text-xs text-slate-400">
                          Needed for clean business application packaging.
                        </div>
                      </div>
                      {profile.ein_available ? (
                        <BadgeCheck className="h-5 w-5 text-cyan-300" />
                      ) : null}
                    </div>
                  </button>
                </div>
              </div>
            ) : null}

            <Button
              className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              onClick={generateStrategy}
              disabled={savingStrategy}
            >
              {savingStrategy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate My Funding Strategy
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-cyan-500/15 bg-slate-950/70">
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                VestBlock uses deterministic readiness rules first, then organizes the path and sequence around that score.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!recommendation ? (
                <Alert className="border-cyan-500/20 bg-cyan-500/5">
                  <Target className="h-4 w-4" />
                  <AlertTitle>No strategy yet</AlertTitle>
                  <AlertDescription>
                    Fill out your profile and generate the strategy to unlock the readiness score, estimated range, and application tracker.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="border-white/10 bg-white/[0.03]">
                      <CardContent className="p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Readiness score</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-3xl font-semibold text-white">
                            {recommendation.readiness_score}
                          </span>
                          <Badge className="border-cyan-400/30 bg-cyan-500/10 text-cyan-100">
                            {profile.risk_level || 'pending'} risk
                          </Badge>
                        </div>
                        <Progress
                          value={recommendation.readiness_score}
                          className="mt-4 bg-white/10"
                        />
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/[0.03]">
                      <CardContent className="p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated funding range</div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {currency(recommendation.estimated_funding_min)} to{' '}
                          {currency(recommendation.estimated_funding_max)}
                        </div>
                        <div className="mt-2 text-sm text-slate-400">
                          Issuer decisions may vary based on the real file, timing, and documentation.
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100">
                        Recommended path: {titleCase(recommendation.recommended_path)}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-300">{recommendation.strategy_summary}</p>
                  </div>

                  {recommendation.warnings?.length ? (
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-white">Warnings</div>
                      {recommendation.warnings.map((warning) => (
                        <div
                          key={warning}
                          className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3 text-sm text-amber-100"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <Alert className="border-white/10 bg-white/[0.03]">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Funding disclaimer</AlertTitle>
                    <AlertDescription>{disclaimer}</AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyan-500/15 bg-slate-950/70">
            <CardHeader>
              <CardTitle>Progress summary</CardTitle>
              <CardDescription>
                Track application velocity, approvals, and the next recommended action.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[
                {
                  label: 'Applications opened',
                  value: progress?.openedCount ?? 0,
                  icon: CircleDollarSign,
                },
                {
                  label: 'Applications applied',
                  value: progress?.appliedCount ?? 0,
                  icon: FileCheck2,
                },
                {
                  label: 'Approved count',
                  value: progress?.approvedCount ?? 0,
                  icon: CheckCircle2,
                },
                {
                  label: 'Denied count',
                  value: progress?.deniedCount ?? 0,
                  icon: ShieldAlert,
                },
              ].map(({ label, value, icon: MetricIcon }) => {
                return (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">{label}</span>
                      <MetricIcon className="h-4 w-4 text-cyan-300" />
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">{String(value)}</div>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm text-slate-400">Total approved funding</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {currency(progress?.totalApprovedLimit)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm text-slate-400">Next recommended step</div>
                <div className="mt-2 text-sm font-medium text-white">
                  {progress?.nextRecommendedItem?.product?.product_name || 'Generate a strategy to begin.'}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {progress?.nextRecommendedItem
                    ? `Recommended day ${progress.nextRecommendedItem.recommended_day || 0}`
                    : 'VestBlock will surface the next step after your strategy is generated.'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Application sequence tracker</h2>
            <p className="text-sm text-slate-400">
              Move each step forward without auto-submitting any applications.
            </p>
          </div>
          <Badge className="w-fit border border-white/10 bg-white/[0.04] text-slate-200">
            {sequenceItems.length} steps
          </Badge>
        </div>

        {sequenceItems.length === 0 ? (
          <Card className="border-white/10 bg-slate-950/70">
            <CardContent className="p-6 text-sm text-slate-400">
              No sequence items yet. Generate a funding strategy to unlock the tracked sequence.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sequenceItems.map((item) => (
              <Card key={item.id} className="border-white/10 bg-slate-950/70">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-white/10 bg-white/[0.04] text-slate-200">
                          Step {item.sequence_order}
                        </Badge>
                        <Badge className={cn('border', statusTone(item.status))}>
                          {titleCase(item.status)}
                        </Badge>
                        <Badge variant="outline">Day {item.recommended_day || 0}</Badge>
                      </div>

                      <div>
                        <div className="text-lg font-semibold text-white">
                          {item.product?.product_name || 'Manual funding step'}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-400">
                          <span>{item.product?.issuer || 'VestBlock'}</span>
                          <span>{titleCase(item.product?.type || 'manual')}</span>
                          {item.product?.estimated_limit_min || item.product?.estimated_limit_max ? (
                            <span>
                              {currency(item.product?.estimated_limit_min)} to{' '}
                              {currency(item.product?.estimated_limit_max)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {(item.product?.truthful_application_notes || item.user_notes) && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                          {item.product?.truthful_application_notes || item.user_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 lg:min-w-[260px]">
                      <Button
                        variant="secondary"
                        className="justify-between"
                        onClick={() => openApplication(item)}
                      >
                        Open Application
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['opened', 'Mark Opened'],
                          ['applied', 'Mark Applied'],
                          ['pending', 'Mark Pending'],
                          ['approved', 'Mark Approved'],
                          ['denied', 'Mark Denied'],
                          ['skipped', 'Skip'],
                        ].map(([status, label]) => (
                          <Button
                            key={status}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (status === 'approved') {
                                setApprovalItem(item);
                                setApprovalLimit(item.approved_limit ? String(item.approved_limit) : '');
                                setApprovalDate(
                                  item.approved_at ? item.approved_at.slice(0, 10) : ''
                                );
                                setApprovalNotes(item.user_notes || '');
                                return;
                              }

                              updateSequenceStatus(item, status).catch((error) =>
                                toast({
                                  title: 'Status not updated',
                                  description:
                                    error instanceof Error
                                      ? error.message
                                      : 'Try again in a moment.',
                                  variant: 'destructive',
                                })
                              );
                            }}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-cyan-500/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle>Unlock full funding roadmap / assisted strategy</CardTitle>
            <CardDescription>
              Choose the lane that matches how much support you want from VestBlock.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => loadPaymentPlans()}
                disabled={loadingPlans}
              >
                {loadingPlans ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="mr-2 h-4 w-4" />
                )}
                View Payment Options
              </Button>
              <Button
                variant="outline"
                onClick={() => loadPaymentPlans('assisted_funding_package')}
                disabled={!recommendation || loadingPlans}
              >
                Request Assisted Review
              </Button>
            </div>

            {plans.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={cn(
                      'rounded-2xl border p-4',
                      recommendedPlanId === plan.id
                        ? 'border-cyan-400/40 bg-cyan-500/10'
                        : 'border-white/10 bg-white/[0.03]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{plan.name}</div>
                        <div className="mt-1 text-sm text-slate-400">{plan.description}</div>
                      </div>
                      {recommendedPlanId === plan.id ? (
                        <Badge className="border-cyan-300/30 bg-cyan-500/15 text-cyan-100">
                          Recommended
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-4 text-2xl font-semibold text-white">
                      {plan.price > 0 ? currency(plan.discountedPrice ?? plan.price) : 'Custom'}
                    </div>
                    <div className="mt-4 space-y-2">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex gap-2 text-sm text-slate-300">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="mt-4 w-full"
                      variant={plan.requiresAdminReview ? 'default' : 'outline'}
                      onClick={() => loadPaymentPlans(plan.id)}
                    >
                      {plan.ctaLabel}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                Pull the plan set after your strategy is ready to see the recommended next commercial lane.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle>Funding operating notes</CardTitle>
            <CardDescription>
              The assistant organizes strategy and timing without pretending to control lender outcomes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 font-medium text-white">
                <ShieldAlert className="h-4 w-4 text-amber-300" />
                Compliance guardrails
              </div>
              <p className="mt-2">
                VestBlock does not auto-submit applications, auto-fill lender forms, store SSNs in the frontend, or
                encourage inaccurate credit or business data.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 font-medium text-white">
                <Target className="h-4 w-4 text-cyan-300" />
                Best use case
              </div>
              <p className="mt-2">
                Use this workflow to decide whether to apply now, build first, or repair first, then track each move
                with less noise and less guessing.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 font-medium text-white">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                Human support lane
              </div>
              <p className="mt-2">
                Once you choose an assisted plan, admin follow-up can review the sequence, highlight blockers, and keep
                your process organized without promising approvals.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={Boolean(approvalItem)} onOpenChange={(open) => !open && setApprovalItem(null)}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Record approval</DialogTitle>
            <DialogDescription className="text-slate-400">
              Save the approved amount and notes for this funding step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-medium">{approvalItem?.product?.product_name || 'Funding step'}</div>
              <div className="mt-1 text-sm text-slate-400">{approvalItem?.product?.issuer || 'VestBlock'}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="approval_limit">Approved limit</Label>
              <Input
                id="approval_limit"
                type="number"
                value={approvalLimit}
                onChange={(event) => setApprovalLimit(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval_date">Approval date</Label>
              <Input
                id="approval_date"
                type="date"
                value={approvalDate}
                onChange={(event) => setApprovalDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval_notes">Notes</Label>
              <Textarea
                id="approval_notes"
                rows={4}
                value={approvalNotes}
                onChange={(event) => setApprovalNotes(event.target.value)}
              />
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApprovalItem(null)}>
                Cancel
              </Button>
              <Button onClick={submitApproval}>Save approval</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
