'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, Download, Filter, Search, ShieldCheck, Sparkles, WalletCards, AlertTriangle, ArrowUpRight, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type {
  FundingPayment,
  FundingProfile,
  FundingRecommendation,
  FundingSequenceItemWithProduct,
} from '@/lib/funding/types';

export type FundingAdminRecord = {
  userEmail: string | null;
  userName: string | null;
  profile: FundingProfile;
  recommendation: FundingRecommendation | null;
  sequenceItems: FundingSequenceItemWithProduct[];
  payment: FundingPayment | null;
  totalApproved: number;
  latestStatus: string;
  createdAt: string | null;
};

function money(value?: number | null) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function titleCase(value?: string | null) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function badgeTone(value?: string | null) {
  if (value === 'low' || value === 'approved' || value === 'paid') {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  }
  if (value === 'high' || value === 'repair_first' || value === 'denied') {
    return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  }
  if (value === 'moderate' || value === 'build_first' || value === 'pending') {
    return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  }
  return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
}

function downloadCsv(rows: FundingAdminRecord[]) {
  const lines = [
    [
      'user_email',
      'mode',
      'fico_estimate',
      'readiness_score',
      'risk_level',
      'recommended_path',
      'funding_goal_amount',
      'total_approved',
      'latest_status',
      'payment_status',
      'created_at',
    ].join(','),
    ...rows.map((row) =>
      [
        row.userEmail || '',
        row.profile.mode,
        row.profile.fico_estimate ?? '',
        row.recommendation?.readiness_score ?? row.profile.readiness_score ?? '',
        row.profile.risk_level ?? '',
        row.recommendation?.recommended_path ?? '',
        row.profile.funding_goal_amount ?? '',
        row.totalApproved,
        row.latestStatus,
        row.payment?.status ?? '',
        row.createdAt ?? '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vestblock-funding-pipeline.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function FundingAdminDashboard({
  records,
}: {
  records: FundingAdminRecord[];
}) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('all');
  const [path, setPath] = useState('all');
  const [risk, setRisk] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [selected, setSelected] = useState<FundingAdminRecord | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setSearch(params.get('search') || '');
    setMode(params.get('mode') || 'all');
    setPath(params.get('path') || 'all');
    setRisk(params.get('risk') || 'all');
    setPaymentStatus(params.get('payment') || 'all');
  }, []);

  const filtered = records.filter((record) => {
    const haystack = `${record.userEmail || ''} ${record.userName || ''} ${
      record.profile.business_name || ''
    }`.toLowerCase();

    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (mode !== 'all' && record.profile.mode !== mode) return false;
    if (path !== 'all' && record.recommendation?.recommended_path !== path) return false;
    if (risk !== 'all' && record.profile.risk_level !== risk) return false;
    if (paymentStatus !== 'all' && (record.payment?.status || 'not_started') !== paymentStatus) {
      return false;
    }

    return true;
  });

  const summary = {
    profiles: records.length,
    applyNowReady: records.filter(
      (record) => record.recommendation?.recommended_path === 'apply_now'
    ).length,
    approvals: records.reduce(
      (sum, record) =>
        sum + record.sequenceItems.filter((item) => item.status === 'approved').length,
      0
    ),
    totalApproved: records.reduce((sum, record) => sum + record.totalApproved, 0),
    activePlans: records.filter((record) =>
      ['pending', 'paid', 'completed'].includes(String(record.payment?.status || ''))
    ).length,
  };

  const queue = useMemo(() => {
    const needsReview = records
      .filter((record) =>
        ['repair_first', 'build_first', 'hybrid_sequence'].includes(
          String(record.recommendation?.recommended_path || '')
        ) || ['pending', 'applied'].includes(String(record.latestStatus || ''))
      )
      .sort((a, b) => (b.recommendation?.readiness_score || 0) - (a.recommendation?.readiness_score || 0))
      .slice(0, 5);

    const waitingOnPayment = records
      .filter((record) => ['pending', 'not_started'].includes(String(record.payment?.status || 'not_started')))
      .filter((record) => Boolean(record.recommendation))
      .slice(0, 4);

    const readyToRoute = records
      .filter((record) => record.recommendation?.recommended_path === 'apply_now')
      .sort((a, b) => (b.recommendation?.readiness_score || 0) - (a.recommendation?.readiness_score || 0))
      .slice(0, 4);

    return { needsReview, waitingOnPayment, readyToRoute };
  }, [records]);

  const resetFilters = () => {
    setSearch('');
    setMode('all');
    setPath('all');
    setRisk('all');
    setPaymentStatus('all');
  };

  return (
    <div className="space-y-6 px-4 py-6 md:px-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Funding pipeline
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Review user readiness, recommended path, approved totals, and payment-plan status in one operating view.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => downloadCsv(filtered)}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Funding profiles', value: summary.profiles, icon: Sparkles },
          { label: 'Apply-now ready', value: summary.applyNowReady, icon: ShieldCheck },
          { label: 'Approved applications', value: summary.approvals, icon: WalletCards },
          { label: 'Approved total', value: money(summary.totalApproved), icon: CircleDollarSign },
          { label: 'Active payment plans', value: summary.activePlans, icon: Download },
        ].map((item) => (
          <Card key={item.label} className="border-cyan-500/15 bg-slate-950/70">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">
                {item.label}
              </CardTitle>
              <item.icon className="h-4 w-4 text-cyan-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-white">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="border-cyan-500/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-cyan-300" />
              Priority queue
            </CardTitle>
            <CardDescription>
              Operator-first funding work: assisted review, readiness clean-up, and users waiting on next steps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.needsReview.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">
                No records currently need assisted review.
              </div>
            ) : (
              queue.needsReview.map((record) => (
                <button
                  key={`review-${record.profile.id}`}
                  type="button"
                  onClick={() => setSelected(record)}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-400/40 hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">
                        {record.userEmail || record.profile.business_name || 'VestBlock user'}
                      </span>
                      <Badge className={cn('border', badgeTone(record.recommendation?.recommended_path))}>
                        {titleCase(record.recommendation?.recommended_path || 'pending')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">
                      {record.profile.business_name || titleCase(record.profile.mode)} · readiness{' '}
                      {record.recommendation?.readiness_score ?? record.profile.readiness_score ?? '--'} · latest{' '}
                      {titleCase(record.latestStatus)}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {record.recommendation?.strategy_summary || 'Waiting on review guidance.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-300">
                    <span className="text-sm">Open record</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/15 bg-slate-950/70">
          <CardHeader>
            <CardTitle>Operator lanes</CardTitle>
            <CardDescription>
              The fast view of where funding follow-up is getting stuck.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
                <p className="text-sm text-slate-400">Waiting on payment</p>
                <p className="mt-2 text-2xl font-semibold text-white">{queue.waitingOnPayment.length}</p>
                <p className="mt-1 text-xs text-slate-500">Profiles ready for plan selection or checkout follow-up</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                <p className="text-sm text-slate-400">Ready to route</p>
                <p className="mt-2 text-2xl font-semibold text-white">{queue.readyToRoute.length}</p>
                <p className="mt-1 text-xs text-slate-500">Users who look strong enough for the apply-now path</p>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">Filter presets</p>
                  <p className="text-sm text-slate-400">Jump to the queue you need without rebuilding filters by hand.</p>
                </div>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setPath('repair_first'); setRisk('all'); }}>
                  Repair first
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPath('build_first'); setRisk('all'); }}>
                  Build first
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPath('apply_now'); setRisk('low'); }}>
                  Apply now
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPaymentStatus('pending'); }}>
                  Pending payment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-cyan-500/15 bg-slate-950/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-cyan-300" />
            Filters
          </CardTitle>
          <CardDescription>Narrow the funding queue by mode, path, risk, or payment status.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user or business"
                className="pl-9"
              />
            </div>
          </div>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger>
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={path} onValueChange={setPath}>
            <SelectTrigger>
              <SelectValue placeholder="Path" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All paths</SelectItem>
              <SelectItem value="apply_now">Apply now</SelectItem>
              <SelectItem value="build_first">Build first</SelectItem>
              <SelectItem value="repair_first">Repair first</SelectItem>
              <SelectItem value="business_first">Business first</SelectItem>
              <SelectItem value="personal_first">Personal first</SelectItem>
              <SelectItem value="hybrid_sequence">Hybrid sequence</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid gap-4 md:grid-cols-2">
            <Select value={risk} onValueChange={setRisk}>
              <SelectTrigger>
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All risk</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="elevated">Elevated</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment</SelectItem>
                <SelectItem value="not_started">Not started</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/15 bg-slate-950/70">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>FICO</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Recommended path</TableHead>
                <TableHead>Funding goal</TableHead>
                <TableHead>Total approved</TableHead>
                <TableHead>Latest status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="border-white/10">
                  <TableCell colSpan={10} className="py-8 text-center text-sm text-slate-400">
                    No funding records match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((record) => (
                  <TableRow
                    key={record.profile.id}
                    className="cursor-pointer border-white/10 hover:bg-white/[0.03]"
                    onClick={() => setSelected(record)}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-white">{record.userEmail || 'Unknown user'}</div>
                        <div className="text-xs text-slate-400">
                          {record.userName || record.profile.business_name || 'VestBlock user'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{titleCase(record.profile.mode)}</TableCell>
                    <TableCell>{record.profile.fico_estimate ?? '--'}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-white">
                          {record.recommendation?.readiness_score ?? record.profile.readiness_score ?? '--'}
                        </div>
                        <Badge className={cn('border', badgeTone(record.profile.risk_level))}>
                          {record.profile.risk_level || 'pending'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border', badgeTone(record.recommendation?.recommended_path))}>
                        {titleCase(record.recommendation?.recommended_path || 'pending')}
                      </Badge>
                    </TableCell>
                    <TableCell>{money(record.profile.funding_goal_amount)}</TableCell>
                    <TableCell>{money(record.totalApproved)}</TableCell>
                    <TableCell>
                      <Badge className={cn('border', badgeTone(record.latestStatus))}>
                        {titleCase(record.latestStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border', badgeTone(record.payment?.status || 'not_started'))}>
                        {titleCase(record.payment?.status || 'not_started')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '--'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Funding detail</SheetTitle>
            <SheetDescription className="text-slate-400">
              Profile, recommendation, sequence, approved funding, and payment lane for this user.
            </SheetDescription>
          </SheetHeader>

          {selected ? (
            <div className="mt-6 space-y-6">
              <Card className="border-white/10 bg-white/[0.03]">
                <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">User</div>
                    <div className="mt-1 font-medium">{selected.userEmail || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Business</div>
                    <div className="mt-1 font-medium">{selected.profile.business_name || 'Not provided'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Mode</div>
                    <div className="mt-1 font-medium">{titleCase(selected.profile.mode)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Approved total</div>
                    <div className="mt-1 font-medium">{money(selected.totalApproved)}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader>
                  <CardTitle className="text-lg">Recommendation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn('border', badgeTone(selected.profile.risk_level))}>
                      {selected.profile.risk_level || 'pending'} risk
                    </Badge>
                    <Badge className={cn('border', badgeTone(selected.recommendation?.recommended_path))}>
                      {titleCase(selected.recommendation?.recommended_path || 'pending')}
                    </Badge>
                  </div>
                  <div>
                    Readiness score:{' '}
                    <span className="font-medium text-white">
                      {selected.recommendation?.readiness_score ?? selected.profile.readiness_score ?? '--'}
                    </span>
                  </div>
                  <div>
                    Estimated range:{' '}
                    <span className="font-medium text-white">
                      {money(selected.recommendation?.estimated_funding_min)} to{' '}
                      {money(selected.recommendation?.estimated_funding_max)}
                    </span>
                  </div>
                  <p>{selected.recommendation?.strategy_summary || 'No recommendation summary yet.'}</p>
                  <div className="space-y-2">
                    <div className="font-medium text-white">Warnings</div>
                    {(selected.recommendation?.warnings || []).length ? (
                      selected.recommendation?.warnings.map((warning) => (
                        <div key={warning} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                          {warning}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500">No warnings recorded.</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader>
                  <CardTitle className="text-lg">Sequence progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selected.sequenceItems.length ? (
                    selected.sequenceItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Step {item.sequence_order}</Badge>
                          <Badge className={cn('border', badgeTone(item.status))}>
                            {titleCase(item.status)}
                          </Badge>
                        </div>
                        <div className="mt-2 font-medium text-white">
                          {item.product?.product_name || 'Manual funding step'}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          {item.product?.issuer || 'VestBlock'} · Day {item.recommended_day || 0}
                        </div>
                        {item.approved_limit ? (
                          <div className="mt-2 text-sm text-emerald-200">
                            Approved: {money(item.approved_limit)}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No sequence items saved.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader>
                  <CardTitle className="text-lg">Payment lane</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-300">
                  <div>Plan: <span className="text-white">{titleCase(selected.payment?.payment_plan || 'not_started')}</span></div>
                  <div>Status: <span className="text-white">{titleCase(selected.payment?.status || 'not_started')}</span></div>
                  <div>Amount due: <span className="text-white">{money(selected.payment?.amount_due)}</span></div>
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-slate-400">
                    Admin notes placeholder: funding notes are not editable from this view yet, but the record is ready for assisted-review workflow expansion.
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
