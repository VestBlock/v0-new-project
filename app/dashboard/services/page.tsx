'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { WorkspaceActivityPanel } from '@/components/workspace-activity-panel';
import { NetworkIntakePanel } from '@/components/dashboard/network-intake-panel';
import { captureClientEvent } from '@/lib/analytics/client';
import { analyticsEvents } from '@/lib/analytics/events';

type DashboardServiceDeliverable = {
  leadId: string;
  submittedAt?: string | null;
  updatedAt?: string | null;
  leadStatus?: string | null;
  packageKey: string;
  packageTitle: string;
  businessName?: string | null;
  primaryGoal?: string | null;
  templateKey?: string | null;
  templateTitle?: string | null;
  templateIndustry?: string | null;
  templateFirstFocus?: string[];
  deliverable?: {
    status: 'requested' | 'generating' | 'ready_for_review' | 'sent_to_client' | 'failed';
    title?: string | null;
    summary?: string | null;
    previewText?: string | null;
    generatedAt?: string | null;
    customerSentAt?: string | null;
    deliverableJson?: {
      sections?: Array<{
        heading: string;
        body: string;
        bullets?: string[];
      }>;
      recommendedActions?: string[];
      customerMessage?: string;
    } | null;
    errorMessage?: string | null;
  } | null;
};

function formatTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return format(new Date(value), 'MMM d, yyyy h:mm a');
  } catch {
    return null;
  }
}

const statusCopy: Record<string, { label: string; tone: string; description: string }> = {
  requested: {
    label: 'Requested',
    tone: 'bg-slate-500 text-white',
    description: 'Your request has been received.',
  },
  generating: {
    label: 'Preparing',
    tone: 'bg-cyan-600 text-white',
    description: 'VestBlock is preparing your recommendations now.',
  },
  ready_for_review: {
    label: 'In Review',
    tone: 'bg-amber-500 text-black',
    description: 'Your recommendations are being reviewed before they are released.',
  },
  sent_to_client: {
    label: 'Delivered',
    tone: 'bg-emerald-600 text-white',
    description: 'Your recommendations are ready to review below.',
  },
  failed: {
    label: 'Needs Attention',
    tone: 'bg-red-600 text-white',
    description: 'VestBlock is reviewing your request manually.',
  },
};

export default function DashboardServicesPage() {
  const [deliverables, setDeliverables] = useState<DashboardServiceDeliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDeliverables() {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch('/api/service-deliverables');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load service deliverables.');
        }

        if (isMounted) {
          setDeliverables(data.deliverables || []);
          captureClientEvent(analyticsEvents.serviceDashboardLoaded, {
            deliverable_count: (data.deliverables || []).length,
          });
        }
      } catch (error) {
        if (isMounted) {
          setError(
            error instanceof Error
              ? error.message
              : 'Unable to load service deliverables.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDeliverables();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-24">
      <div className="container mx-auto max-w-6xl space-y-8">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge className="mb-3 bg-cyan-600 text-white">Network workspace</Badge>
            <h1 className="text-4xl font-bold tracking-tight">Your VestBlock deal workspace</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Review saved requests, seller or buyer criteria, lender notes, DealVault next steps, and partner follow-up.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/get-started">Choose Another Service</Link>
            </Button>
            <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
              <Link href="/pricing">Compare Offers</Link>
            </Button>
          </div>
        </section>

        <NetworkIntakePanel />

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-10">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
              <p className="text-sm text-muted-foreground">Loading your saved plans and updates...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-red-500/20">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium">We could not load your service dashboard.</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : deliverables.length === 0 ? (
          <Card>
            <CardContent className="space-y-6 py-10">
              <div>
                <p className="font-medium">Your starter workspace is being prepared.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Refresh in a moment. If this is a new account, VestBlock is preparing your starter workspace now.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="font-medium">Visibility plans</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Preview sample page ideas and next-step recommendations before you submit, then review updates here.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/visibility-expansion">
                      Open Visibility
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-medium">AI receptionist plans</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose the right lead-capture or booking package, then come back here to review saved next steps.
                  </p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link href="/ai-assistant">
                      Open AI Receptionist
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <WorkspaceActivityPanel />
            {deliverables.map((item) => {
              const status = item.deliverable?.status || 'requested';
              const statusMeta = statusCopy[status] || statusCopy.requested;
              const sections = item.deliverable?.deliverableJson?.sections || [];
              const actions = item.deliverable?.deliverableJson?.recommendedActions || [];
              const showDeliveredContent = status === 'sent_to_client';
              const submittedAt = formatTimestamp(item.submittedAt);
              const generatedAt = formatTimestamp(item.deliverable?.generatedAt);
              const deliveredAt = formatTimestamp(item.deliverable?.customerSentAt);
              const lastUpdatedAt = formatTimestamp(
                item.deliverable?.customerSentAt ||
                  item.updatedAt ||
                  item.deliverable?.generatedAt ||
                  item.submittedAt
              );

              return (
                <Card key={item.leadId} className="border-cyan-500/20">
                  <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-cyan-600" />
                        <CardTitle>{item.packageTitle}</CardTitle>
                      </div>
                      <CardDescription>{statusMeta.description}</CardDescription>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <Badge className={statusMeta.tone}>{statusMeta.label}</Badge>
                      {submittedAt ? (
                        <p className="text-xs text-muted-foreground">
                          Submitted {submittedAt}
                        </p>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-sm font-medium">Business</p>
                        <p className="text-sm text-muted-foreground">{item.businessName || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Template</p>
                        <p className="text-sm text-muted-foreground">
                          {item.templateTitle || item.templateIndustry || 'Custom setup'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Goal</p>
                        <p className="text-sm text-muted-foreground">{item.primaryGoal || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Delivery</p>
                        <p className="text-sm text-muted-foreground">
                          {deliveredAt
                            ? `Delivered ${deliveredAt}`
                            : status === 'ready_for_review'
                              ? 'Being reviewed before delivery'
                              : generatedAt && status === 'generating'
                                ? `Started ${generatedAt}`
                              : status === 'failed'
                                ? 'Manual follow-up in progress'
                                : 'Pending'}
                        </p>
                      </div>
                      <div className="xl:col-span-1">
                        <p className="text-sm font-medium">Last updated</p>
                        <p className="text-sm text-muted-foreground">
                          {lastUpdatedAt || 'Waiting for the first update'}
                        </p>
                      </div>
                    </div>

                    {item.templateTitle || item.templateFirstFocus?.length ? (
                      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                        <p className="font-medium">
                          {item.templateTitle
                            ? `${item.templateTitle} starter workspace`
                            : 'Starter workspace'}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          VestBlock saved this request with an industry-ready starting point so your first actions are not generic.
                        </p>
                        {item.templateFirstFocus?.length ? (
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {item.templateFirstFocus.map((focus) => (
                              <li key={focus} className="flex gap-2">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                                <span>{focus}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    {item.deliverable?.summary ? (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                        <p className="font-medium">Summary</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {item.deliverable.summary}
                        </p>
                      </div>
                    ) : null}

                    {showDeliveredContent ? (
                      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
                        <div className="space-y-4">
                          {sections.map((section) => (
                            <div key={section.heading} className="rounded-lg border p-4">
                              <p className="font-medium">{section.heading}</p>
                              <p className="mt-2 text-sm text-muted-foreground">{section.body}</p>
                              {section.bullets?.length ? (
                                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                                  {section.bullets.map((bullet) => (
                                    <li key={bullet} className="flex gap-2">
                                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                                      <span>{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-lg border p-4">
                            <p className="font-medium">Recommended next steps</p>
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {actions.length ? (
                                actions.map((action) => (
                                  <li key={action} className="flex gap-2">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                                    <span>{action}</span>
                                  </li>
                                ))
                              ) : (
                                <li className="text-muted-foreground">Your next steps will appear here after review.</li>
                              )}
                            </ul>
                          </div>

                          {item.deliverable?.deliverableJson?.customerMessage ? (
                            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                              <p className="flex items-center gap-2 font-medium">
                                <Mail className="h-4 w-4 text-cyan-600" />
                                VestBlock note
                              </p>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {item.deliverable.deliverableJson.customerMessage}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4">
                        <div className="flex items-start gap-3">
                          <Clock3 className="mt-0.5 h-4 w-4 text-cyan-600" />
                          <div>
                            <p className="font-medium">Status update</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {status === 'requested' &&
                                'We received your request and will prepare the next recommendations.'}
                              {status === 'generating' &&
                                'VestBlock is preparing your recommendations now.'}
                              {status === 'ready_for_review' &&
                                'Your recommendations are being reviewed before they are released here.'}
                              {status === 'failed' &&
                                'This request needs manual attention. VestBlock will review it and follow up.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
