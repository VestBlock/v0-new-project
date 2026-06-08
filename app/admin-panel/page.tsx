'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Copy,
  CreditCard,
  DollarSign,
  FileText,
  Globe2,
  Loader2,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wand2,
  Users,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SamIntelligenceDashboard } from '@/components/admin/sam-intelligence-dashboard';
import { MarketCommandCard } from '@/components/admin/market-command-card';
import { adminDiagnosticSections } from '@/lib/admin/diagnostics';
import {
  adminNavGroups,
  adminNavItems,
  adminPanelTabGroups,
  adminPanelTabs,
  type AdminPanelTab,
} from '@/lib/admin/navigation';
import { vestblockMarketingServices } from '@/lib/content/marketingServices';

type AdminDashboard = {
  overview: {
    totalUsers: number;
    totalCreditReportsUploaded: number;
    totalAnalysesCompleted: number;
    totalPendingAnalyses: number;
    totalDisputeLettersGenerated: number;
    totalPaidUsers: number;
    totalCompletedPayments: number;
    totalFundingLeads: number;
    totalFundingStrategyRequests: number;
    totalPaidFundingStrategyRequests: number;
    totalFundingAssistantProfiles: number;
    totalFundingAssistantRecommendations: number;
    totalFundingAssistantApprovals: number;
    totalFundingAssistantPaidPlans: number;
    totalFundingAssistantAmountApproved: number;
    totalOpenTasks: number;
    totalContentAssets: number;
    totalPublishedContent: number;
    totalAeoTopics: number;
  };
  creditReports: Array<{
    id: string;
    userEmail?: string | null;
    userName?: string | null;
    fileName: string;
    uploadedAt?: string | null;
    status: string;
    disputeLettersGenerated: boolean;
    emailAlertSent: boolean;
    errorMessage?: string | null;
    adminNotes?: string | null;
    analysisUrl: string;
  }>;
  users: Array<{
    id: string;
    profileId?: string;
    email?: string | null;
    fullName?: string | null;
    role: string;
    createdAt?: string | null;
    subscriptionStatus: string;
    uploads: number;
    analyses: number;
    lastActivity?: string | null;
  }>;
  alerts: {
    emailEvents: Array<any>;
    failedEmailEvents: Array<any>;
    newReportAlerts: Array<any>;
    systemErrors: Array<any>;
  };
  recentActivity: Array<{
    id: string;
    label: string;
    type: string;
    createdAt?: string | null;
    href?: string;
  }>;
  payments: Array<any>;
  fundingStrategyRequests: Array<{
    id: string;
    user_id?: string | null;
    user_email?: string | null;
    full_name?: string | null;
    phone?: string | null;
    business_name?: string | null;
    business_stage?: string | null;
    business_age_months?: number | null;
    monthly_revenue?: number | null;
    personal_credit_score?: string | null;
    current_utilization?: string | null;
    recent_inquiries?: string | null;
    has_ein?: boolean | null;
    has_business_bank?: boolean | null;
    has_business_credit_card?: boolean | null;
    requested_funding_amount?: number | null;
    use_of_funds?: string | null;
    readiness_score?: number | null;
    readiness_tier?: string | null;
    readiness_summary?: string | null;
    strengths_json?: string[] | null;
    risks_json?: string[] | null;
    next_steps_json?: string[] | null;
    consent_success_fee?: boolean | null;
    success_fee_rate?: number | null;
    status: string;
    payment_status: string;
    paypal_order_id?: string | null;
    payment_id?: string | null;
    admin_notes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    paid_at?: string | null;
  }>;
  leads: Array<{
    id: string;
    lead_type?: string | null;
    status?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
  automation: {
    env: {
      cronSecretConfigured: boolean;
      resendConfigured: boolean;
      adminAlertEmailConfigured: boolean;
      fromEmailConfigured: boolean;
      outreachMailingAddressConfigured: boolean;
      siteUrlConfigured: boolean;
    };
    payments: {
      paypalEnvironment: string;
      paypalClientConfigured: boolean;
      paypalSecretConfigured: boolean;
      paypalWebhookConfigured: boolean;
      paypalReady: boolean;
      recommendedAction: string;
    };
    dataSources: Array<{
      source: string;
      status: 'available' | 'unavailable';
      message?: string | null;
    }>;
    crons: Array<{
      label: string;
      path: string;
      schedule: string;
      purpose: string;
    }>;
    lifecycleEmails: {
      total: number;
      sent: number;
      skipped: number;
      failed: number;
    };
    recentAutomationActivity: Array<{
      id: string;
      type: string;
      entityType?: string | null;
      entityId?: string | null;
      metadata?: Record<string, unknown> | null;
      createdAt?: string | null;
      href?: string;
    }>;
  };
  tasks: Array<{
    id: string;
    title: string;
    description?: string | null;
    task_type: string;
    status: string;
    priority: string;
    assigned_to?: string | null;
    user_email?: string | null;
    entity_type?: string | null;
    entity_id?: string | null;
    due_at?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
  content: {
    assets: Array<{
      id: string;
      title: string;
      slug: string;
      content_type: 'seo_page' | 'social_post' | 'campaign';
      service_key: string;
      language: string;
      audience?: string | null;
      prompt?: string | null;
      status: 'draft' | 'ready' | 'published' | 'archived';
      platform?: string | null;
      post_type?: string | null;
      seo_title?: string | null;
      meta_description?: string | null;
      excerpt?: string | null;
      body_markdown?: string | null;
      social_caption?: string | null;
      hashtags?: string[] | null;
      cta_label?: string | null;
      cta_url?: string | null;
      publish_path?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
      published_at?: string | null;
    }>;
    summary: {
      total: number;
      byStatus: Record<'draft' | 'ready' | 'published' | 'archived', number>;
      seoPages: number;
      socialPosts: number;
      campaigns: number;
    };
    generator: {
      openAiConfigured: boolean;
      model: string;
    };
  };
  aeo: {
    serviceCount: number;
    aeoTopicCount: number;
    topicClusters: Record<string, number>;
    publishedSeoPages: number;
    spanishContentAssets: number;
    llmSurfaces: string[];
    serviceCoverage: Array<{
      serviceKey: string;
      contentServiceKey: string;
      title: string;
      route: string;
      intent: string;
      priority: number;
      stage: string;
      hasMarketingBrief: boolean;
      staticSeoRoute?: string | null;
      publishedSeoPages: number;
      draftAssets: number;
      socialPosts: number;
      recommendedNextContent: string;
    }>;
    contentGaps: Array<{
      serviceKey: string;
      contentServiceKey: string;
      title: string;
      route: string;
      intent: string;
      priority: number;
      stage: string;
      hasMarketingBrief: boolean;
      staticSeoRoute?: string | null;
      publishedSeoPages: number;
      draftAssets: number;
      socialPosts: number;
      recommendedNextContent: string;
    }>;
  };
  actionCenter: {
    counts: {
      staleReports: number;
      failedReports: number;
      urgentTasks: number;
      failedEmails: number;
      readyContent: number;
      leadFollowups: number;
      fundingNeedsReview: number;
      dataSourceOutages: number;
    };
    staleReports: Array<{
      id: string;
      label: string;
      detail: string;
      ageHours?: number;
      href?: string;
    }>;
    failedReports: Array<{
      id: string;
      label: string;
      detail: string;
      href?: string;
    }>;
    urgentTasks: Array<{
      id: string;
      label: string;
      detail: string;
      href?: string;
    }>;
    readyContent: Array<{
      id: string;
      label: string;
      detail: string;
      href?: string;
    }>;
    leadFollowups: Array<{
      id: string;
      label: string;
      detail: string;
      ageHours?: number;
      href?: string;
    }>;
    fundingNeedsReview: Array<{
      id: string;
      label: string;
      detail: string;
      href?: string;
    }>;
    dataSourceOutages: Array<{
      source: string;
      status: 'available' | 'unavailable';
      message?: string | null;
    }>;
  };
  insights: {
    hardScoreboard: {
      monthlyRevenueTarget: number;
      trailing30Revenue: number;
      revenueGap: number;
      immediateRevenueAngle: string;
      dailyCadence: {
        newLeads24h: { actual: number; target: number; status: 'on_track' | 'behind' };
        totalOutreach24h: { actual: number; target: number; status: 'on_track' | 'behind' };
        partnerOutreach24h: { actual: number; target: number; status: 'on_track' | 'behind' };
        replySignals7d: { actual: number; target: number; status: 'on_track' | 'behind' };
        bookedOrWon7d: { actual: number; target: number; status: 'on_track' | 'behind' };
      };
      pipeline: {
        leadEmailSends24h: number;
        lenderOutreach24h: number;
        buyerOutreach24h: number;
        activeLenderConversations: number;
        activeBuyerConversations: number;
        approvedPartnerMessagesReady: number;
        overduePartnerFollowups: number;
        hotFundingRequests: number;
      };
    };
    revenueSnapshot: {
      completedPaymentVolume: number;
      paidFundingRequests: number;
      approvedFundingAmount: number;
      openHighPriorityTasks: number;
      overdueTasks: number;
      noUploadUsers: number;
    };
    onboardingWatchlist: Array<{
      id: string;
      label: string;
      detail: string;
      href?: string;
    }>;
    disputeMethodMix: Array<{
      letterType: string;
      count: number;
    }>;
    taskLanes: Array<{
      taskType: string;
      total: number;
      open: number;
      urgent: number;
    }>;
    weeklyVelocity: {
      newUsers7d: number;
      uploads7d: number;
      analyses7d: number;
      publishedSeo7d: number;
      paidCustomers7d: number;
    };
  };
};

const statuses = [
  'uploaded',
  'extracting_text',
  'text_extracted',
  'analyzing',
  'completed',
  'failed',
  'needs_review',
];

const taskStatuses = ['open', 'in_progress', 'waiting', 'completed', 'dismissed'];
const leadStatuses = ['new', 'contacted', 'qualified', 'closed'];
const fundingStrategyStatuses = [
  'submitted',
  'awaiting_payment',
  'paid',
  'in_review',
  'strategy_ready',
  'needs_prep',
  'closed',
];
const contentStatuses = ['draft', 'ready', 'published', 'archived'];
const contentTypes = [
  { value: 'seo_page', label: 'SEO page' },
  { value: 'social_post', label: 'Social post' },
  { value: 'campaign', label: 'Campaign' },
] as const;

const leadStatusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  closed: 'Closed',
};

const leadTypeLabels: Record<string, string> = {
  sell_house: 'Sell House',
  real_estate: 'Real Estate Funding',
  ai_assistant: 'AI Receptionist',
  business_funding: 'Business Funding',
  credit_card_funding_strategy: 'Business Funding Strategy',
  website_upgrade: 'Website Upgrade',
};

const envLabels: Record<keyof AdminDashboard['automation']['env'], string> = {
  cronSecretConfigured: 'CRON_SECRET',
  resendConfigured: 'RESEND_API_KEY',
  adminAlertEmailConfigured: 'ADMIN_ALERT_EMAIL',
  fromEmailConfigured: 'FROM_EMAIL',
  outreachMailingAddressConfigured: 'OUTREACH_MAILING_ADDRESS',
  siteUrlConfigured: 'NEXT_PUBLIC_SITE_URL',
};

const paymentEnvLabels: Array<
  [keyof Pick<
    AdminDashboard['automation']['payments'],
    'paypalClientConfigured' | 'paypalSecretConfigured' | 'paypalWebhookConfigured'
  >, string]
> = [
  ['paypalClientConfigured', 'PAYPAL_CLIENT_ID'],
  ['paypalSecretConfigured', 'PAYPAL_CLIENT_SECRET'],
  ['paypalWebhookConfigured', 'PAYPAL_WEBHOOK_ID'],
];

function getAutomationBlockingIssues(dashboard: AdminDashboard) {
  const issues: Array<{ title: string; description: string; action: string }> = [];
  const env = dashboard.automation.env;

  if (!env.outreachMailingAddressConfigured) {
    issues.push({
      title: 'Outbound lead email is blocked',
      description:
        'AUTO_SEND can be enabled, but prospect email should not run until a compliant business mailing address is configured.',
      action: 'Add OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS in the deployment environment.',
    });
  }

  if (!env.fromEmailConfigured || !env.resendConfigured) {
    issues.push({
      title: 'Resend fallback is incomplete',
      description:
        'If Gmail fails, the app needs a verified fallback sender before lead outreach can continue safely.',
      action: 'Confirm FROM_EMAIL and RESEND_API_KEY are configured and verified.',
    });
  }

  return issues;
}

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  try {
    return format(parseISO(value), 'MMM d, yyyy h:mm a');
  } catch {
    return value;
  }
}

function statusVariant(status: string) {
  if (status === 'completed') return 'default';
  if (status === 'failed') return 'destructive';
  return 'secondary';
}

function priorityVariant(priority: string) {
  if (priority === 'urgent' || priority === 'high') return 'destructive';
  if (priority === 'low') return 'outline';
  return 'secondary';
}

function searchable(values: Array<unknown>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return values
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function isAdminPanelTab(value: string | null | undefined): value is AdminPanelTab {
  return Boolean(value && adminPanelTabs.includes(value as AdminPanelTab));
}

function AdminPanelPageContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentAdminRedirect = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [taskStatusDrafts, setTaskStatusDrafts] = useState<Record<string, string>>({});
  const [leadStatusDrafts, setLeadStatusDrafts] = useState<Record<string, string>>({});
  const [fundingStrategyStatusDrafts, setFundingStrategyStatusDrafts] = useState<Record<string, string>>({});
  const [fundingStrategyNoteDrafts, setFundingStrategyNoteDrafts] = useState<Record<string, string>>({});
  const [savingReportId, setSavingReportId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [savingFundingStrategyId, setSavingFundingStrategyId] = useState<string | null>(null);
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('open_work');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');
  const [alertSearch, setAlertSearch] = useState('');
  const [alertStatusFilter, setAlertStatusFilter] = useState('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [paymentLeadSearch, setPaymentLeadSearch] = useState('');
  const [fundingStrategySearch, setFundingStrategySearch] = useState('');
  const [fundingStrategyStatusFilter, setFundingStrategyStatusFilter] = useState('active');
  const [contentSearch, setContentSearch] = useState('');
  const [contentStatusFilter, setContentStatusFilter] = useState('active');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [contentServiceKey, setContentServiceKey] = useState('business_setup');
  const [contentTypeDraft, setContentTypeDraft] = useState<'seo_page' | 'social_post' | 'campaign'>('seo_page');
  const [contentLanguage, setContentLanguage] = useState<'en' | 'es'>('en');
  const [contentPlatform, setContentPlatform] = useState('manual');
  const [contentPostType, setContentPostType] = useState('educational');
  const [contentAudience, setContentAudience] = useState('');
  const [contentPrompt, setContentPrompt] = useState('');
  const [savingContentId, setSavingContentId] = useState<string | null>(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [seedingContent, setSeedingContent] = useState(false);
  const [seedingTopicContent, setSeedingTopicContent] = useState(false);
  const [contentNotice, setContentNotice] = useState('');
  const activeTab = useMemo<AdminPanelTab>(() => {
    const requestedTab = searchParams.get('tab');
    return isAdminPanelTab(requestedTab) ? requestedTab : 'tasks';
  }, [searchParams]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          router.replace(`/login?redirect=${encodeURIComponent(currentAdminRedirect)}`);
          return;
        }
        if (response.status === 403) {
          router.replace('/dashboard');
          return;
        }
        throw new Error(data.error || 'Unable to load admin dashboard.');
      }
      setDashboard(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load admin dashboard.'
      );
    } finally {
      setLoading(false);
    }
  }, [currentAdminRedirect, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(currentAdminRedirect)}`);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [authLoading, currentAdminRedirect, isAuthenticated, loadDashboard, router]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isAdminPanelTab(value)) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const metrics = useMemo(() => {
    if (!dashboard) return [];
    return [
      { label: 'Users', value: dashboard.overview.totalUsers, icon: Users },
      {
        label: 'Reports Uploaded',
        value: dashboard.overview.totalCreditReportsUploaded,
        icon: FileText,
      },
      {
        label: 'Analyses Complete',
        value: dashboard.overview.totalAnalysesCompleted,
        icon: CheckCircle2,
      },
      {
        label: 'Pending Analyses',
        value: dashboard.overview.totalPendingAnalyses,
        icon: AlertCircle,
      },
      {
        label: 'Dispute Letters',
        value: dashboard.overview.totalDisputeLettersGenerated,
        icon: ShieldAlert,
      },
      {
        label: 'Paid Users',
        value:
          dashboard.overview.totalPaidUsers ||
          dashboard.overview.totalCompletedPayments,
        icon: CreditCard,
      },
      {
        label: 'Funding Reviews',
        value: dashboard.overview.totalFundingStrategyRequests,
        icon: DollarSign,
      },
      {
        label: 'Funding Profiles',
        value: dashboard.overview.totalFundingAssistantProfiles,
        icon: ShieldCheck,
      },
      {
        label: 'Funding Approvals',
        value: dashboard.overview.totalFundingAssistantApprovals,
        icon: Bell,
      },
      {
        label: 'Open Tasks',
        value: dashboard.overview.totalOpenTasks,
        icon: ClipboardList,
      },
      {
        label: 'Content Drafts',
        value: dashboard.overview.totalContentAssets,
        icon: Megaphone,
      },
    ];
  }, [dashboard]);

  const filteredReports = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.creditReports.filter((report) => {
      const statusMatches =
        reportStatusFilter === 'all' || report.status === reportStatusFilter;
      return (
        statusMatches &&
        searchable(
          [
            report.userName,
            report.userEmail,
            report.fileName,
            report.status,
            report.errorMessage,
            report.adminNotes,
          ],
          reportSearch
        )
      );
    });
  }, [dashboard, reportSearch, reportStatusFilter]);

  const filteredUsers = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.users.filter((profile) => {
      const roleMatches = userRoleFilter === 'all' || profile.role === userRoleFilter;
      return (
        roleMatches &&
        searchable(
          [
            profile.fullName,
            profile.email,
            profile.role,
            profile.subscriptionStatus,
            profile.id,
          ],
          userSearch
        )
      );
    });
  }, [dashboard, userSearch, userRoleFilter]);

  const filteredTasks = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.tasks.filter((task) => {
      const statusMatches =
        taskStatusFilter === 'all' ||
        (taskStatusFilter === 'open_work'
          ? ['open', 'in_progress', 'waiting'].includes(task.status)
          : task.status === taskStatusFilter);
      const priorityMatches =
        taskPriorityFilter === 'all' || task.priority === taskPriorityFilter;
      return (
        statusMatches &&
        priorityMatches &&
        searchable(
          [
            task.title,
            task.description,
            task.task_type,
            task.status,
            task.priority,
            task.user_email,
            task.entity_type,
            task.entity_id,
          ],
          taskSearch
        )
      );
    });
  }, [dashboard, taskSearch, taskStatusFilter, taskPriorityFilter]);

  const filteredActivity = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.recentActivity.filter((activity) =>
      searchable(
        [activity.label, activity.type, activity.createdAt, activity.href],
        activitySearch
      )
    );
  }, [dashboard, activitySearch]);

  const filteredEmailEvents = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.alerts.emailEvents.filter((event) => {
      const statusMatches =
        alertStatusFilter === 'all' || event.status === alertStatusFilter;
      return (
        statusMatches &&
        searchable(
          [
            event.subject,
            event.user_email,
            event.event_type,
            event.status,
            event.error_message,
          ],
          alertSearch
        )
      );
    });
  }, [dashboard, alertSearch, alertStatusFilter]);

  const filteredSystemErrors = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.alerts.systemErrors.filter((item) =>
      searchable(
        [
          item.subject,
          item.fileName,
          item.event_type,
          item.error_message,
          item.errorMessage,
          item.status,
        ],
        alertSearch
      )
    );
  }, [dashboard, alertSearch]);

  const filteredPayments = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.payments.filter((payment) =>
      searchable(
        [
          payment.id,
          payment.user_id,
          payment.status,
          payment.amount,
          payment.payment_method,
          payment.paypal_transaction_id,
          payment.product_type,
        ],
        paymentLeadSearch
      )
    );
  }, [dashboard, paymentLeadSearch]);

  const filteredLeads = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.leads.filter((lead) =>
      searchable(
        [lead.id, lead.lead_type, lead.status, lead.name, lead.email, lead.phone, lead.notes],
        paymentLeadSearch
      )
    );
  }, [dashboard, paymentLeadSearch]);

  const filteredFundingStrategyRequests = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.fundingStrategyRequests.filter((request) => {
      const statusMatches =
        fundingStrategyStatusFilter === 'all' ||
        (fundingStrategyStatusFilter === 'active'
          ? !['closed', 'strategy_ready'].includes(request.status)
          : request.status === fundingStrategyStatusFilter);

      return (
        statusMatches &&
        searchable(
          [
            request.id,
            request.user_email,
            request.full_name,
            request.phone,
            request.business_name,
            request.business_stage,
            request.readiness_tier,
            request.readiness_score,
            request.status,
            request.payment_status,
            request.admin_notes,
            request.use_of_funds,
          ],
          fundingStrategySearch
        )
      );
    });
  }, [dashboard, fundingStrategySearch, fundingStrategyStatusFilter]);

  const filteredContentAssets = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.content.assets.filter((asset) => {
      const statusMatches =
        contentStatusFilter === 'all' ||
        (contentStatusFilter === 'active'
          ? ['draft', 'ready'].includes(asset.status)
          : asset.status === contentStatusFilter);
      const typeMatches =
        contentTypeFilter === 'all' || asset.content_type === contentTypeFilter;

      return (
        statusMatches &&
        typeMatches &&
        searchable(
          [
            asset.title,
            asset.slug,
            asset.service_key,
            asset.language,
            asset.status,
            asset.platform,
            asset.post_type,
            asset.excerpt,
            asset.social_caption,
            asset.prompt,
          ],
          contentSearch
        )
      );
    });
  }, [dashboard, contentSearch, contentStatusFilter, contentTypeFilter]);

  const updateReportStatus = async (reportId: string, currentStatus: string) => {
    setSavingReportId(reportId);
    try {
      const response = await fetch('/api/admin/credit-reports/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          status: statusDrafts[reportId] || currentStatus,
          adminNotes: noteDrafts[reportId],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update report status.');
      }
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update report status.'
      );
    } finally {
      setSavingReportId(null);
    }
  };

  const updateTaskStatus = async (taskId: string, currentStatus: string) => {
    setSavingTaskId(taskId);
    try {
      const response = await fetch('/api/admin/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          status: taskStatusDrafts[taskId] || currentStatus,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update task.');
      }
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update task.');
    } finally {
      setSavingTaskId(null);
    }
  };

  const updateLeadStatus = async (leadId: string, currentStatus?: string | null) => {
    setSavingLeadId(leadId);
    try {
      const response = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leadId,
          status: leadStatusDrafts[leadId] || currentStatus || 'new',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update lead.');
      }
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update lead.');
    } finally {
      setSavingLeadId(null);
    }
  };

  const updateFundingStrategyRequest = async (
    requestId: string,
    currentStatus: string
  ) => {
    setSavingFundingStrategyId(requestId);
    try {
      const response = await fetch('/api/admin/funding-strategy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          status: fundingStrategyStatusDrafts[requestId] || currentStatus,
          adminNotes: fundingStrategyNoteDrafts[requestId],
          createFollowupTask: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update funding strategy request.');
      }
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update funding strategy request.'
      );
    } finally {
      setSavingFundingStrategyId(null);
    }
  };

  const generateContentAsset = async () => {
    setGeneratingContent(true);
    setError('');
    setContentNotice('');
    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: contentTypeDraft,
          serviceKey: contentServiceKey,
          language: contentLanguage,
          platform: contentPlatform,
          postType: contentPostType,
          audience: contentAudience,
          prompt: contentPrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to generate content.');
      }
      setContentPrompt('');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate content.');
    } finally {
      setGeneratingContent(false);
    }
  };

  const primeAeoContentDraft = (
    service: AdminDashboard['aeo']['serviceCoverage'][number]
  ) => {
    setContentTypeDraft('seo_page');
    setContentServiceKey(service.contentServiceKey);
    setContentLanguage(service.contentServiceKey === 'spanish_business_funding' ? 'es' : 'en');
    setContentPlatform('manual');
    setContentPostType('service landing page');
    setContentAudience(
      service.contentServiceKey === 'spanish_business_funding'
        ? 'Spanish-speaking business owners looking for funding readiness'
        : `people looking for ${service.title.toLowerCase()}`
    );
    setContentPrompt(
      `Create a high-quality, compliance-safe SEO page for ${service.title}. Explain who it helps, when to use it, what VestBlock does, what documents or next steps matter, common questions, and a clear CTA to ${service.route}. Avoid guarantees and thin keyword stuffing.`
    );
    handleTabChange('content');
  };

  const updateContentStatus = async (assetId: string, status: string) => {
    setSavingContentId(assetId);
    setError('');
    setContentNotice('');
    try {
      const response = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assetId, status }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update content.');
      }
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update content.');
    } finally {
      setSavingContentId(null);
    }
  };

  const seedLaunchContent = async () => {
    setSeedingContent(true);
    setError('');
    setContentNotice('');
    try {
      const response = await fetch('/api/admin/content/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: true, overwrite: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to seed launch content.');
      }
      setContentNotice(`Published ${data.seededCount || 0} launch content assets.`);
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to seed launch content.'
      );
    } finally {
      setSeedingContent(false);
    }
  };

  const seedAeoTopicLibrary = async () => {
    setSeedingTopicContent(true);
    setError('');
    setContentNotice('');
    try {
      const response = await fetch('/api/admin/content/seed-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: true, overwrite: false }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to seed AEO topic pages.');
      }
      setContentNotice(
        `Published ${data.seededCount || 0} AEO topic pages without overwriting existing edits.`
      );
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to seed AEO topic pages.'
      );
    } finally {
      setSeedingTopicContent(false);
    }
  };

  const copyTextToClipboard = async (value: string, label: string) => {
    if (!value) return;

    setError('');
    try {
      await navigator.clipboard.writeText(value);
      setContentNotice(`${label} copied to your clipboard.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Unable to copy ${label.toLowerCase()}.`
      );
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
      </main>
    );
  }

  if (error && !dashboard) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-24">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Admin dashboard unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!dashboard) return null;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="container mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VestBlock Admin</h1>
            <p className="text-muted-foreground">
              One command center for tasks, revenue flow, partner ops, growth work,
              and diagnostics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/funding">Funding Pipeline</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/leads">Lead Management</Link>
            </Button>
            <Button variant="outline" onClick={loadDashboard} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Admin notice</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.label}
                </CardTitle>
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Operator Workspaces</CardTitle>
            <CardDescription>
              Jump into the exact admin area you need instead of hunting through tabs
              or one-off tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-3">
            {adminNavGroups.map((group) => {
              const links = adminNavItems.filter(
                (item) => item.group === group.id && item.href !== '/admin-panel'
              )
              if (!links.length) return null

              return (
                <div key={group.id} className="rounded-2xl border p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold">{group.title}</p>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <div className="space-y-2">
                    {links.map((link) => (
                      <div
                        key={link.href}
                        className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">{link.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {link.description}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={link.href}>Open</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Action Center</CardTitle>
              <CardDescription>
                Start here to see what needs attention first across credit reports,
                tasks, leads, funding follow-up, and content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Alert
                  variant={
                    dashboard.actionCenter.counts.failedReports > 0
                      ? 'destructive'
                      : 'success'
                  }
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Failed analyses</AlertTitle>
                  <AlertDescription>
                    {dashboard.actionCenter.counts.failedReports} reports need review.
                  </AlertDescription>
                </Alert>
                <Alert
                  variant={
                    dashboard.actionCenter.counts.staleReports > 0
                      ? 'warning'
                      : 'success'
                  }
                >
                  <Clock3 className="h-4 w-4" />
                  <AlertTitle>Stale reports</AlertTitle>
                  <AlertDescription>
                    {dashboard.actionCenter.counts.staleReports} stuck over 24h.
                  </AlertDescription>
                </Alert>
                <Alert
                  variant={
                    dashboard.actionCenter.counts.urgentTasks > 0
                      ? 'warning'
                      : 'success'
                  }
                >
                  <ClipboardList className="h-4 w-4" />
                  <AlertTitle>Urgent tasks</AlertTitle>
                  <AlertDescription>
                    {dashboard.actionCenter.counts.urgentTasks} high-priority tasks open.
                  </AlertDescription>
                </Alert>
                <Alert
                  variant={
                    dashboard.actionCenter.counts.failedEmails > 0
                      ? 'destructive'
                      : 'success'
                  }
                >
                  <Bell className="h-4 w-4" />
                  <AlertTitle>Failed emails</AlertTitle>
                  <AlertDescription>
                    {dashboard.actionCenter.counts.failedEmails} alerts need attention.
                  </AlertDescription>
                </Alert>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold">Report issues</h3>
                      <p className="text-sm text-muted-foreground">
                        Failed or stale analyses are the fastest trust-killers. Keep this queue short.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleTabChange('reports')}>
                      Open reports
                    </Button>
                  </div>
                  {dashboard.actionCenter.failedReports.length === 0 &&
                  dashboard.actionCenter.staleReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No failed or stale report items right now.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[
                        ...dashboard.actionCenter.failedReports,
                        ...dashboard.actionCenter.staleReports,
                      ]
                        .slice(0, 6)
                        .map((item) => (
                          <div
                            key={`report-action-${item.id}`}
                            className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">{item.label}</p>
                              <p className="truncate text-sm text-muted-foreground">
                                {item.detail}
                                {'ageHours' in item && item.ageHours
                                  ? ` · ${item.ageHours}h old`
                                  : ''}
                              </p>
                            </div>
                            {item.href && (
                              <Button asChild size="sm" variant="outline">
                                <Link href={item.href}>Open</Link>
                              </Button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold">Revenue and follow-up</h3>
                      <p className="text-sm text-muted-foreground">
                        Paid opportunities, stale leads, urgent tasks, and ready content waiting on an operator.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleTabChange('funding-strategy')}>
                        Funding
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/admin/leads?status=new">Leads</Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleTabChange('content')}>
                        Content
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      ...dashboard.actionCenter.urgentTasks.slice(0, 2),
                      ...dashboard.actionCenter.leadFollowups.slice(0, 2),
                      ...dashboard.actionCenter.fundingNeedsReview.slice(0, 1),
                      ...dashboard.actionCenter.readyContent.slice(0, 1),
                    ].map((item) => (
                      <div
                        key={`ops-action-${item.id}`}
                        className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{item.label}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {item.detail}
                            {'ageHours' in item && item.ageHours
                              ? ` · ${item.ageHours}h old`
                              : ''}
                          </p>
                        </div>
                        {item.href && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={item.href}>Open</Link>
                          </Button>
                        )}
                      </div>
                    ))}
                    {dashboard.actionCenter.urgentTasks.length === 0 &&
                      dashboard.actionCenter.leadFollowups.length === 0 &&
                      dashboard.actionCenter.fundingNeedsReview.length === 0 &&
                      dashboard.actionCenter.readyContent.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No urgent ops items right now.
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>
                Data-source and automation signals that can quietly break operator trust.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert
                variant={
                  dashboard.actionCenter.counts.dataSourceOutages > 0 ||
                  dashboard.automation.lifecycleEmails.failed > 0
                    ? 'warning'
                    : 'success'
                }
              >
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>
                  {dashboard.actionCenter.counts.dataSourceOutages > 0
                    ? 'Attention needed'
                    : 'Core systems look healthy'}
                </AlertTitle>
                <AlertDescription>
                  {dashboard.actionCenter.counts.dataSourceOutages > 0
                    ? `${dashboard.actionCenter.counts.dataSourceOutages} data sources are unavailable.`
                    : 'No data-source outages detected in the admin dashboard queries.'}
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Lifecycle email failures</p>
                  <p className="text-2xl font-bold">
                    {dashboard.automation.lifecycleEmails.failed}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Ready content waiting</p>
                  <p className="text-2xl font-bold">
                    {dashboard.actionCenter.counts.readyContent}
                  </p>
                </div>
              </div>

              {dashboard.actionCenter.dataSourceOutages.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.actionCenter.dataSourceOutages.map((issue) => (
                    <div
                      key={issue.source}
                      className="rounded-md border border-amber-500/30 p-3"
                    >
                      <p className="font-medium">{issue.source}</p>
                      <p className="text-sm text-muted-foreground">
                        {issue.message || 'Unavailable'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Dashboard query coverage looks stable. Use the Diagnostics tab for deeper troubleshooting.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Hard Scoreboard</CardTitle>
              <CardDescription>
                The non-negotiable scoreboard for daily cadence, near-term cash, and the fastest revenue angle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Revenue last 30d</p>
                  <p className="text-2xl font-bold">
                    ${dashboard.insights.hardScoreboard.trailing30Revenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Goal: ${dashboard.insights.hardScoreboard.monthlyRevenueTarget.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Revenue gap</p>
                  <p className="text-2xl font-bold">
                    ${dashboard.insights.hardScoreboard.revenueGap.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Remaining to monthly target</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Active lender conversations</p>
                  <p className="text-2xl font-bold">
                    {dashboard.insights.hardScoreboard.pipeline.activeLenderConversations}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Active buyer conversations</p>
                  <p className="text-2xl font-bold">
                    {dashboard.insights.hardScoreboard.pipeline.activeBuyerConversations}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Hot funding requests</p>
                  <p className="text-2xl font-bold">
                    {dashboard.insights.hardScoreboard.pipeline.hotFundingRequests}
                  </p>
                </div>
              </div>

              <Alert
                variant={
                  dashboard.insights.hardScoreboard.revenueGap > 0 ||
                  Object.values(dashboard.insights.hardScoreboard.dailyCadence).some(
                    (metric) => metric.status === 'behind'
                  )
                    ? 'warning'
                    : 'success'
                }
              >
                <Megaphone className="h-4 w-4" />
                <AlertTitle>Best immediate money path</AlertTitle>
                <AlertDescription>
                  {dashboard.insights.hardScoreboard.immediateRevenueAngle}
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {([
                    { label: 'New leads (24h)', metric: dashboard.insights.hardScoreboard.dailyCadence.newLeads24h },
                    { label: 'Real outreach emails (24h)', metric: dashboard.insights.hardScoreboard.dailyCadence.totalOutreach24h },
                    { label: 'Partner outreach (24h)', metric: dashboard.insights.hardScoreboard.dailyCadence.partnerOutreach24h },
                    { label: 'Reply signals (7d)', metric: dashboard.insights.hardScoreboard.dailyCadence.replySignals7d },
                    { label: 'Booked or won (7d)', metric: dashboard.insights.hardScoreboard.dailyCadence.bookedOrWon7d },
                  ] as const).map(({ label, metric }) => (
                    <div key={label} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <Badge variant={metric.status === 'on_track' ? 'success' : 'warning'}>
                          {metric.status === 'on_track' ? 'On track' : 'Behind'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-2xl font-bold">
                        {metric.actual} <span className="text-sm font-normal text-muted-foreground">/ {metric.target}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium">Outbound split (24h)</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Lead emails: {dashboard.insights.hardScoreboard.pipeline.leadEmailSends24h}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Lender emails: {dashboard.insights.hardScoreboard.pipeline.lenderOutreach24h}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Buyer emails: {dashboard.insights.hardScoreboard.pipeline.buyerOutreach24h}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium">Pipeline pressure</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Approved partner messages ready: {dashboard.insights.hardScoreboard.pipeline.approvedPartnerMessagesReady}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Overdue partner follow-ups: {dashboard.insights.hardScoreboard.pipeline.overduePartnerFollowups}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Operator Snapshot</CardTitle>
              <CardDescription>
                A tighter read on revenue, onboarding drag, and what moved in the last week.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Completed payment volume</p>
                  <p className="text-2xl font-bold">
                    ${dashboard.insights.revenueSnapshot.completedPaymentVolume.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Approved funding tracked</p>
                  <p className="text-2xl font-bold">
                    ${dashboard.insights.revenueSnapshot.approvedFundingAmount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Paid funding reviews</p>
                  <p className="text-2xl font-bold">
                    {dashboard.insights.revenueSnapshot.paidFundingRequests}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Overdue admin tasks</p>
                  <p className="text-2xl font-bold">
                    {dashboard.insights.revenueSnapshot.overdueTasks}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">High-priority open tasks</p>
                  <p className="text-2xl font-bold">
                    {dashboard.insights.revenueSnapshot.openHighPriorityTasks}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Users with no upload yet</p>
                  <p className="text-2xl font-bold">
                    {dashboard.insights.revenueSnapshot.noUploadUsers}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">New users (7d)</p>
                  <p className="text-xl font-semibold">
                    {dashboard.insights.weeklyVelocity.newUsers7d}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Uploads (7d)</p>
                  <p className="text-xl font-semibold">
                    {dashboard.insights.weeklyVelocity.uploads7d}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Analyses done (7d)</p>
                  <p className="text-xl font-semibold">
                    {dashboard.insights.weeklyVelocity.analyses7d}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">SEO pages published (7d)</p>
                  <p className="text-xl font-semibold">
                    {dashboard.insights.weeklyVelocity.publishedSeo7d}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Paid customers (7d)</p>
                  <p className="text-xl font-semibold">
                    {dashboard.insights.weeklyVelocity.paidCustomers7d}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Onboarding Watchlist</CardTitle>
                <CardDescription>
                  New customers with no uploaded report yet are the easiest drop-off point to rescue.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.insights.onboardingWatchlist.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Everyone in the recent queue has already uploaded at least one report.
                  </p>
                ) : (
                  dashboard.insights.onboardingWatchlist.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{user.label}</p>
                        <p className="truncate text-sm text-muted-foreground">{user.detail}</p>
                      </div>
                      {user.href && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={user.href}>Open</Link>
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Task Lanes</CardTitle>
                  <CardDescription>
                    Which kinds of work are stacking up the fastest.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dashboard.insights.taskLanes.slice(0, 5).map((lane) => (
                    <div key={lane.taskType} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{lane.taskType}</p>
                        <Badge variant={lane.urgent > 0 ? 'destructive' : 'secondary'}>
                          {lane.open} open
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {lane.total} total · {lane.urgent} urgent/high
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dispute Method Mix</CardTitle>
                  <CardDescription>
                    The methods most active in your live dispute-letter pipeline.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dashboard.insights.disputeMethodMix.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No generated dispute letters yet.
                    </p>
                  ) : (
                    dashboard.insights.disputeMethodMix.slice(0, 5).map((item) => (
                      <div
                        key={item.letterType}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                      >
                        <p className="text-sm font-medium">{item.letterType}</p>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Command Center Sections</CardTitle>
              <CardDescription>
                Switch between the main admin views by workflow instead of one long
                undifferentiated tab row.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminPanelTabGroups.map((group) => (
                <div key={group.title} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {group.title}
                  </p>
                  <TabsList className="flex h-auto flex-wrap justify-start">
                    {group.tabs.map((tab) => (
                      <TabsTrigger key={tab.value} value={tab.value}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              ))}
            </CardContent>
          </Card>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Credit Repair Command Center</CardTitle>
                <CardDescription>
                  New submissions, workflow status, dispute-letter generation,
                  and manual review actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={reportSearch}
                      onChange={(event) => setReportSearch(event.target.value)}
                      placeholder="Search reports by user, email, file, notes, or error"
                      className="pl-9"
                    />
                  </div>
                  <Select value={reportStatusFilter} onValueChange={setReportStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredReports.length} of {dashboard.creditReports.length} reports.
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Letters</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Manual Update</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div className="font-medium">
                              {report.userName || report.userEmail || 'Unknown user'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {report.userEmail}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(report.uploadedAt)}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            {report.fileName}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(report.status)}>
                              {report.status}
                            </Badge>
                            {report.errorMessage && (
                              <div className="mt-1 max-w-[220px] text-xs text-destructive">
                                {report.errorMessage}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {report.disputeLettersGenerated ? 'Generated' : 'Pending'}
                          </TableCell>
                          <TableCell>{report.emailAlertSent ? 'Sent' : 'Not sent'}</TableCell>
                          <TableCell className="min-w-[260px] space-y-2">
                            <Select
                              value={statusDrafts[report.id] || report.status}
                              onValueChange={(value) =>
                                setStatusDrafts((current) => ({
                                  ...current,
                                  [report.id]: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Textarea
                              value={noteDrafts[report.id] ?? report.adminNotes ?? ''}
                              onChange={(event) =>
                                setNoteDrafts((current) => ({
                                  ...current,
                                  [report.id]: event.target.value,
                                }))
                              }
                              placeholder="Admin notes"
                              rows={2}
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                updateReportStatus(report.id, report.status)
                              }
                              disabled={savingReportId === report.id}
                            >
                              {savingReportId === report.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Save
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button asChild size="sm" variant="outline">
                              <Link href={report.analysisUrl}>Open</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="government">
            <SamIntelligenceDashboard />
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Profiles, roles, subscriptions, uploads, analyses, and last
                  activity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search users by name, email, role, or status"
                      className="pl-9"
                    />
                  </div>
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="user">user</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredUsers.length} of {dashboard.users.length} users.
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Uploads</TableHead>
                        <TableHead>Analyses</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <div className="font-medium">
                              {profile.fullName || profile.email || 'Unknown user'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {profile.email}
                            </div>
                          </TableCell>
                          <TableCell>{profile.role}</TableCell>
                          <TableCell>{profile.subscriptionStatus}</TableCell>
                          <TableCell>{profile.uploads}</TableCell>
                          <TableCell>{profile.analyses}</TableCell>
                          <TableCell>{formatDate(profile.createdAt)}</TableCell>
                          <TableCell>{formatDate(profile.lastActivity)}</TableCell>
                          <TableCell>
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin-panel/users/${profile.id}`}>
                                Open
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={alertSearch}
                    onChange={(event) => setAlertSearch(event.target.value)}
                    placeholder="Search alerts by subject, email, event, or error"
                    className="pl-9"
                  />
                </div>
                <Select value={alertStatusFilter} onValueChange={setAlertStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All email statuses</SelectItem>
                    <SelectItem value="sent">sent</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                    <SelectItem value="skipped">skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Email Alerts
                  </CardTitle>
                  <CardDescription>
                    Recent Resend events and skipped or failed alerts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredEmailEvents.length} of {dashboard.alerts.emailEvents.length} email events.
                  </p>
                  {filteredEmailEvents.slice(0, 20).map((event) => (
                    <div key={event.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{event.subject}</p>
                        <Badge
                          variant={
                            event.status === 'failed' ? 'destructive' : 'secondary'
                          }
                        >
                          {event.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {event.user_email || event.event_type}
                      </p>
                      {event.error_message && (
                        <p className="mt-1 text-sm text-destructive">
                          {event.error_message}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Errors</CardTitle>
                  <CardDescription>
                    Failed emails and credit repair workflow errors that need
                    attention.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredSystemErrors.length} of {dashboard.alerts.systemErrors.length} system errors.
                  </p>
                  {filteredSystemErrors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recent system errors.
                    </p>
                  ) : (
                    filteredSystemErrors.map((item, index) => (
                      <div
                        key={item.id || index}
                        className="rounded-md border border-destructive/30 p-3"
                      >
                        <p className="font-medium">
                          {item.subject ||
                            item.fileName ||
                            item.event_type ||
                            'System alert'}
                        </p>
                        <p className="text-sm text-destructive">
                          {item.error_message || item.errorMessage || item.status}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>Admin Task Queue</CardTitle>
                <CardDescription>
                  Follow-up work for failed analyses, paid customers, funding
                  leads, report reviews, and support actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={taskSearch}
                      onChange={(event) => setTaskSearch(event.target.value)}
                      placeholder="Search tasks by title, type, user, or related item"
                      className="pl-9"
                    />
                  </div>
                  <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open_work">Open work</SelectItem>
                      <SelectItem value="all">All statuses</SelectItem>
                      {taskStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="urgent">urgent</SelectItem>
                      <SelectItem value="high">high</SelectItem>
                      <SelectItem value="normal">normal</SelectItem>
                      <SelectItem value="low">low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredTasks.length} of {dashboard.tasks.length} tasks.
                </p>
                {filteredTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No admin tasks found.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Related</TableHead>
                          <TableHead>Update</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell className="min-w-[260px]">
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="mt-1 max-w-[360px] text-xs text-muted-foreground">
                                  {task.description}
                                </div>
                              )}
                              <div className="mt-1 text-xs text-muted-foreground">
                                {task.task_type}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={priorityVariant(task.priority)}>
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(task.status)}>
                                {task.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{task.user_email || 'Unassigned'}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(task.due_at)}
                            </TableCell>
                            <TableCell>
                              {task.entity_type === 'credit_report' && task.entity_id ? (
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/admin-panel/reports/${task.entity_id}`}>
                                    Open
                                  </Link>
                                </Button>
                              ) : task.user_email || task.entity_type ? (
                                <span className="text-sm text-muted-foreground">
                                  {task.entity_type || task.user_email}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell className="min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={taskStatusDrafts[task.id] || task.status}
                                  onValueChange={(value) =>
                                    setTaskStatusDrafts((current) => ({
                                      ...current,
                                      [task.id]: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {taskStatuses.map((status) => (
                                      <SelectItem key={status} value={status}>
                                        {status}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  onClick={() => updateTaskStatus(task.id, task.status)}
                                  disabled={savingTaskId === task.id}
                                >
                                  {savingTaskId === task.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Save'
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aeo">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Service Routes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.aeo.serviceCount}</div>
                    <p className="text-xs text-muted-foreground">Public offers in the service catalog</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">AEO Topics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.aeo.aeoTopicCount}</div>
                    <p className="text-xs text-muted-foreground">Learning pages answer engines can cite</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Published SEO</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.aeo.publishedSeoPages}</div>
                    <p className="text-xs text-muted-foreground">Manual/generated pages live in resources</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Spanish Assets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.aeo.spanishContentAssets}</div>
                    <p className="text-xs text-muted-foreground">Spanish drafts and published posts</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Content Gaps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.aeo.contentGaps.length}</div>
                    <p className="text-xs text-muted-foreground">Services without a published SEO asset</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe2 className="h-5 w-5 text-cyan-600" />
                      LLM Discovery Surfaces
                    </CardTitle>
                    <CardDescription>
                      These public files and hubs help search engines and answer
                      engines understand VestBlock&apos;s service map.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboard.aeo.llmSurfaces.map((surface) => (
                      <div
                        key={surface}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                      >
                        <span className="text-sm font-medium">{surface}</span>
                        <Button asChild size="sm" variant="outline">
                          <Link href={surface}>Open</Link>
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Topic Cluster Coverage</CardTitle>
                    <CardDescription>
                      Keep the learning center balanced across credit repair,
                      funding, business credit, grants, and Spanish funding.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(dashboard.aeo.topicClusters).map(
                      ([cluster, count]) => (
                        <div key={cluster} className="rounded-md border p-3">
                          <p className="text-sm font-medium">{cluster}</p>
                          <p className="text-2xl font-bold">{count}</p>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Service AEO Coverage</CardTitle>
                  <CardDescription>
                    Use this as the content command center. Services with no
                    published SEO page should get one strong page before thin
                    supporting posts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboard.aeo.serviceCoverage.map((service) => (
                    <div key={service.serviceKey} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{service.title}</h3>
                            <Badge variant={service.publishedSeoPages > 0 ? 'default' : 'secondary'}>
                              {service.publishedSeoPages > 0 ? 'covered' : 'needs page'}
                            </Badge>
                            <Badge variant="outline">{service.stage}</Badge>
                            {!service.hasMarketingBrief && (
                              <Badge variant="destructive">missing brief</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {service.recommendedNextContent}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>SEO pages: {service.publishedSeoPages}</span>
                            <span>Drafts: {service.draftAssets}</span>
                            <span>Social posts: {service.socialPosts}</span>
                            <span>Content key: {service.contentServiceKey}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={service.route}>Open Route</Link>
                          </Button>
                          {service.staticSeoRoute && (
                            <Button asChild size="sm" variant="outline">
                              <Link href={service.staticSeoRoute}>Open SEO Page</Link>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => primeAeoContentDraft(service)}
                          >
                            Draft SEO Page
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-cyan-600" />
                      Content Generator
                    </CardTitle>
                    <CardDescription>
                      Create SEO pages, social posts, and campaign drafts for
                      VestBlock services.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!dashboard.content.generator.openAiConfigured && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>OpenAI not configured</AlertTitle>
                        <AlertDescription>
                          Add `OPENAI_API_KEY` before generating content from
                          the dashboard.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Content type</label>
                        <Select
                          value={contentTypeDraft}
                          onValueChange={(value) =>
                            setContentTypeDraft(
                              value as 'seo_page' | 'social_post' | 'campaign'
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {contentTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Language</label>
                        <Select
                          value={contentLanguage}
                          onValueChange={(value) =>
                            setContentLanguage(value as 'en' | 'es')
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service</label>
                      <Select
                        value={contentServiceKey}
                        onValueChange={setContentServiceKey}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {vestblockMarketingServices.map((service) => (
                            <SelectItem key={service.key} value={service.key}>
                              {service.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Platform</label>
                        <Input
                          value={contentPlatform}
                          onChange={(event) =>
                            setContentPlatform(event.target.value)
                          }
                          placeholder="Instagram, TikTok, LinkedIn, manual"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Post style</label>
                        <Input
                          value={contentPostType}
                          onChange={(event) =>
                            setContentPostType(event.target.value)
                          }
                          placeholder="educational, promo, FAQ, carousel"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Audience</label>
                      <Input
                        value={contentAudience}
                        onChange={(event) => setContentAudience(event.target.value)}
                        placeholder="Example: Spanish-speaking business owners in Georgia"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        What should be created?
                      </label>
                      <Textarea
                        value={contentPrompt}
                        onChange={(event) => setContentPrompt(event.target.value)}
                        placeholder="Example: Create a LinkedIn post about getting business documents ready before applying for a grant."
                        rows={5}
                      />
                    </div>

                    <Button
                      onClick={generateContentAsset}
                      disabled={
                        generatingContent ||
                        !dashboard.content.generator.openAiConfigured
                      }
                      className="w-full"
                    >
                      {generatingContent ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      Generate Draft
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={seedLaunchContent}
                      disabled={seedingContent}
                      className="w-full"
                    >
                      {seedingContent ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Globe2 className="mr-2 h-4 w-4" />
                      )}
                      Seed And Publish Launch Content
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={seedAeoTopicLibrary}
                      disabled={seedingTopicContent}
                      className="w-full"
                    >
                      {seedingTopicContent ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Seed AEO Topic Library
                    </Button>
                  </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Assets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {dashboard.content.summary.total}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">SEO Pages</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {dashboard.content.summary.seoPages}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Social Posts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {dashboard.content.summary.socialPosts}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Published</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {dashboard.content.summary.byStatus.published}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-cyan-600" />
                    Content Queue
                  </CardTitle>
                  <CardDescription>
                    Review generated drafts, copy social posts, and publish SEO
                    pages when ready.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contentNotice && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Content update</AlertTitle>
                      <AlertDescription>{contentNotice}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={contentSearch}
                        onChange={(event) => setContentSearch(event.target.value)}
                        placeholder="Search content by title, service, platform, language, or prompt"
                        className="pl-9"
                      />
                    </div>
                    <Select
                      value={contentTypeFilter}
                      onValueChange={setContentTypeFilter}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {contentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={contentStatusFilter}
                      onValueChange={setContentStatusFilter}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active drafts</SelectItem>
                        <SelectItem value="all">All statuses</SelectItem>
                        {contentStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Showing {filteredContentAssets.length} of{' '}
                    {dashboard.content.assets.length} content assets.
                  </p>

                  {filteredContentAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No content assets found.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {filteredContentAssets.map((asset) => (
                        <div key={asset.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">{asset.title}</h3>
                                <Badge variant={statusVariant(asset.status)}>
                                  {asset.status}
                                </Badge>
                                <Badge variant="outline">{asset.content_type}</Badge>
                                <Badge variant="outline">{asset.language}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {asset.service_key}
                                {asset.platform ? ` - ${asset.platform}` : ''}
                                {asset.post_type ? ` - ${asset.post_type}` : ''}
                              </p>
                              {asset.excerpt && (
                                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                                  {asset.excerpt}
                                </p>
                              )}
                              {asset.publish_path && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Publish path: {asset.publish_path}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {asset.publish_path && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    copyTextToClipboard(
                                      `${window.location.origin}${asset.publish_path}`,
                                      'Published page URL'
                                    )
                                  }
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy URL
                                </Button>
                              )}
                              {asset.content_type === 'seo_page' &&
                                asset.body_markdown && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      copyTextToClipboard(
                                        asset.body_markdown || '',
                                        'SEO page markdown'
                                      )
                                    }
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy Markdown
                                  </Button>
                                )}
                              {asset.content_type === 'social_post' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    copyTextToClipboard(
                                      [
                                        asset.social_caption,
                                        asset.hashtags?.join(' '),
                                      ]
                                        .filter(Boolean)
                                        .join('\n\n'),
                                      'Social post copy'
                                    )
                                  }
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy Post
                                </Button>
                              )}
                              {contentStatuses.map((status) => (
                                <Button
                                  key={status}
                                  size="sm"
                                  variant={
                                    asset.status === status ? 'default' : 'outline'
                                  }
                                  onClick={() =>
                                    updateContentStatus(asset.id, status)
                                  }
                                  disabled={savingContentId === asset.id}
                                >
                                  {savingContentId === asset.id &&
                                  asset.status !== status ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    status
                                  )}
                                </Button>
                              ))}
                              {asset.status === 'published' &&
                                asset.publish_path && (
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={asset.publish_path}>Open</Link>
                                  </Button>
                                )}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">
                                Draft body
                              </label>
                              <Textarea
                                readOnly
                                value={asset.body_markdown || ''}
                                rows={8}
                                className="font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">
                                Social caption / manual post copy
                              </label>
                              <Textarea
                                readOnly
                                value={
                                  [
                                    asset.social_caption,
                                    asset.hashtags?.join(' '),
                                  ]
                                    .filter(Boolean)
                                    .join('\n\n') || asset.body_markdown || ''
                                }
                                rows={8}
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="automation">
            <div className="space-y-4">
              <MarketCommandCard />

              {getAutomationBlockingIssues(dashboard).length > 0 && (
                <Alert variant="destructive">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Outreach is not ready to send</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-2">
                      {getAutomationBlockingIssues(dashboard).map((issue) => (
                        <div key={issue.title}>
                          <p className="font-medium text-foreground">{issue.title}</p>
                          <p>{issue.description}</p>
                          <p className="font-medium">{issue.action}</p>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 lg:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      Automation Readiness
                    </CardTitle>
                    <CardDescription>
                      Environment checks for scheduled jobs and email alerts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(dashboard.automation.env).map(
                      ([key, configured]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-md border p-3"
                        >
                          <span className="text-sm font-medium">
                            {envLabels[key as keyof AdminDashboard['automation']['env']]}
                          </span>
                          <Badge variant={configured ? 'default' : 'destructive'}>
                            {configured ? 'configured' : 'missing'}
                          </Badge>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-cyan-600" />
                      Payment Readiness
                    </CardTitle>
                    <CardDescription>
                      PayPal mode and required payment automation settings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <span className="text-sm font-medium">PAYPAL_ENV</span>
                      <Badge
                        variant={
                          dashboard.automation.payments.paypalEnvironment === 'live'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {dashboard.automation.payments.paypalEnvironment}
                      </Badge>
                    </div>
                    {paymentEnvLabels.map(([key, label]) => {
                      const configured = dashboard.automation.payments[key];
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-md border p-3"
                        >
                          <span className="text-sm font-medium">{label}</span>
                          <Badge variant={configured ? 'default' : 'destructive'}>
                            {configured ? 'configured' : 'missing'}
                          </Badge>
                        </div>
                      );
                    })}
                    <Alert
                      variant={
                        dashboard.automation.payments.paypalReady
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      {dashboard.automation.payments.paypalReady ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>
                        {dashboard.automation.payments.paypalReady
                          ? 'PayPal configured'
                          : 'PayPal setup incomplete'}
                      </AlertTitle>
                      <AlertDescription>
                        {dashboard.automation.payments.recommendedAction}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock3 className="h-5 w-5 text-cyan-600" />
                      Scheduled Jobs
                    </CardTitle>
                    <CardDescription>
                      Vercel cron jobs currently expected by VestBlock.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {dashboard.automation.crons.map((cron) => (
                      <div key={cron.path} className="rounded-md border p-4">
                        <p className="font-medium">{cron.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {cron.purpose}
                        </p>
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">Path:</span>{' '}
                            {cron.path}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Schedule:</span>{' '}
                            {cron.schedule}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Lifecycle Emails</CardTitle>
                    <CardDescription>
                      Reminder email events recorded by automation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    {[
                      ['Total', dashboard.automation.lifecycleEmails.total],
                      ['Sent', dashboard.automation.lifecycleEmails.sent],
                      ['Skipped', dashboard.automation.lifecycleEmails.skipped],
                      ['Failed', dashboard.automation.lifecycleEmails.failed],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-2xl font-bold">{value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Data Source Health</CardTitle>
                    <CardDescription>
                      Expected Supabase tables used by admin operations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboard.automation.dataSources.map((source) => (
                      <div
                        key={source.source}
                        className="flex items-start justify-between gap-3 rounded-md border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{source.source}</p>
                          {source.message && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {source.message}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={
                            source.status === 'available' ? 'default' : 'destructive'
                          }
                        >
                          {source.status}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Automation Activity</CardTitle>
                    <CardDescription>
                      Cron-generated activity and email automation events.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboard.automation.recentAutomationActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No recent automation events found.
                      </p>
                    ) : (
                      dashboard.automation.recentAutomationActivity.map((event) => (
                        <div
                          key={event.id}
                          className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-medium">{event.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.entityType || 'system'}
                              {event.entityId ? ` - ${event.entityId}` : ''}
                            </p>
                            {event.metadata && (
                              <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                                {JSON.stringify(event.metadata)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="whitespace-nowrap text-sm text-muted-foreground">
                              {formatDate(event.createdAt)}
                            </span>
                            {event.href && (
                              <Button asChild size="sm" variant="outline">
                                <Link href={event.href}>Open</Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="improvement">
            <Card>
              <CardHeader>
                <CardTitle>Continuous Improvement Engine</CardTitle>
                <CardDescription>
                  Review daily learning runs, queued strategy updates, research briefs,
                  and live tuning experiments without digging through raw tables.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Improvement Review</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Daily wins, losses, queued strategy updates, and operator actions.
                      </p>
                      <Button asChild size="sm">
                        <Link href="/admin/improvement">Open improvement dashboard</Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Research Briefs</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Curated research summaries for funding, credit, SEO, outreach, and automation.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/research">Open research queue</Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Experiments</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Live score adjustments, outreach variants, and recorded winners.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/experiments">Open experiment view</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Scheduled every morning after lead generation: market review, research digest,
                  outreach optimization, content recommendations, and credit or funding workflow refinement.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics">
            <div className="space-y-4">
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Internal diagnostics only</AlertTitle>
                <AlertDescription>
                  These routes are protected and noindexed. Use them for QA,
                  incident review, and operator troubleshooting, not for customer
                  workflows or public sharing.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 xl:grid-cols-2">
                {adminDiagnosticSections.map((section) => (
                  <Card key={section.id}>
                    <CardHeader>
                      <CardTitle>{section.title}</CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {section.links.map((link) => (
                        <div
                          key={link.href}
                          className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="font-medium">{link.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {link.description}
                            </p>
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <Link href={link.href}>Open</Link>
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Uploads, analysis updates, email alerts, payments, and admin
                  actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={activitySearch}
                    onChange={(event) => setActivitySearch(event.target.value)}
                    placeholder="Search activity by label, type, or destination"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredActivity.length} of {dashboard.recentActivity.length} activity items.
                </p>
                {filteredActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex flex-col gap-1 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">{activity.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {formatDate(activity.createdAt)}
                      </span>
                      {activity.href && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={activity.href}>Open</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funding-strategy">
            <Card>
              <CardHeader>
                <CardTitle>Business Funding Strategy</CardTitle>
                <CardDescription>
                  Paid review requests, readiness scoring, consents, payment status,
                  and admin follow-up actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={fundingStrategySearch}
                      onChange={(event) => setFundingStrategySearch(event.target.value)}
                      placeholder="Search strategy requests by customer, business, tier, status, or use of funds"
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={fundingStrategyStatusFilter}
                    onValueChange={setFundingStrategyStatusFilter}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active work</SelectItem>
                      <SelectItem value="all">All statuses</SelectItem>
                      {fundingStrategyStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">Total requests</p>
                    <p className="text-2xl font-bold">
                      {dashboard.overview.totalFundingStrategyRequests}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">Paid reviews</p>
                    <p className="text-2xl font-bold">
                      {dashboard.overview.totalPaidFundingStrategyRequests}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-muted-foreground">Plan price</p>
                    <p className="text-2xl font-bold">$300 + 10%</p>
                  </div>
                </div>

                {filteredFundingStrategyRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No funding strategy requests found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredFundingStrategyRequests.map((request) => (
                      <div key={request.id} className="rounded-md border p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {request.business_name ||
                                  request.full_name ||
                                  request.user_email ||
                                  'Funding strategy request'}
                              </p>
                              <Badge variant={statusVariant(request.status)}>
                                {request.status}
                              </Badge>
                              <Badge
                                variant={
                                  request.payment_status === 'paid'
                                    ? 'default'
                                    : 'secondary'
                                }
                              >
                                {request.payment_status}
                              </Badge>
                              <Badge variant="outline">
                                Score {request.readiness_score ?? 0}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {request.user_email || 'No email'}
                              {request.phone ? ` - ${request.phone}` : ''} - submitted{' '}
                              {formatDate(request.created_at)}
                            </p>
                            <p className="text-sm">
                              {request.readiness_summary || 'No readiness summary saved.'}
                            </p>
                            <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                              <span>
                                Credit: {request.personal_credit_score || 'unknown'}
                              </span>
                              <span>
                                Utilization: {request.current_utilization || 'unknown'}
                              </span>
                              <span>
                                Inquiries: {request.recent_inquiries || 'unknown'}
                              </span>
                              <span>
                                EIN: {request.has_ein ? 'yes' : 'no'}
                              </span>
                              <span>
                                Business bank: {request.has_business_bank ? 'yes' : 'no'}
                              </span>
                              <span>
                                Funding ask: $
                                {Number(request.requested_funding_amount || 0).toLocaleString()}
                              </span>
                              <span>
                                Success fee: {request.consent_success_fee ? 'accepted' : 'missing'}
                              </span>
                            </div>
                            {request.use_of_funds && (
                              <p className="line-clamp-3 text-xs text-muted-foreground">
                                Use of funds: {request.use_of_funds}
                              </p>
                            )}
                          </div>
                          <div className="min-w-[240px] space-y-2">
                            <Select
                              value={
                                fundingStrategyStatusDrafts[request.id] ||
                                request.status ||
                                'submitted'
                              }
                              onValueChange={(value) =>
                                setFundingStrategyStatusDrafts((current) => ({
                                  ...current,
                                  [request.id]: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fundingStrategyStatuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Textarea
                              value={
                                fundingStrategyNoteDrafts[request.id] ??
                                request.admin_notes ??
                                ''
                              }
                              onChange={(event) =>
                                setFundingStrategyNoteDrafts((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              placeholder="Admin notes"
                              rows={3}
                            />
                            <Button
                              className="w-full"
                              size="sm"
                              onClick={() =>
                                updateFundingStrategyRequest(request.id, request.status)
                              }
                              disabled={savingFundingStrategyId === request.id}
                            >
                              {savingFundingStrategyId === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Save Review Status'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payments And Leads</CardTitle>
                <CardDescription>
                  Completed customers, payment events, and funding lead activity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={paymentLeadSearch}
                    onChange={(event) => setPaymentLeadSearch(event.target.value)}
                    placeholder="Search payments and leads by email, name, status, amount, or transaction"
                    className="pl-9"
                  />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="font-semibold">
                      Payments ({filteredPayments.length}/{dashboard.payments.length})
                    </h3>
                    {filteredPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No payment records found.
                    </p>
                  ) : (
                    filteredPayments.map((payment) => (
                      <div key={payment.id} className="rounded-md border p-3">
                        <p className="font-medium">
                          {payment.status} {payment.amount ? `$${payment.amount}` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.payment_method || 'PayPal'} -{' '}
                          {payment.product_type || 'vestblock_pro'} -{' '}
                          {formatDate(payment.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-semibold">
                        Funding Leads ({filteredLeads.length}/{dashboard.leads.length})
                      </h3>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/leads">Open Lead Manager</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/buyers">Open Buyer Network</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/lenders">Open Lender Network</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/reports/daily">Open Daily Reports</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/admin/seo-opportunities">Open SEO Opportunities</Link>
                      </Button>
                    </div>
                    {filteredLeads.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No lead records found.
                      </p>
                    ) : (
                      filteredLeads.map((lead) => (
                        <div key={lead.id} className="rounded-md border p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {lead.name || lead.email || leadTypeLabels[lead.lead_type || ''] || 'Funding lead'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {lead.email || 'No email'}{lead.phone ? ` - ${lead.phone}` : ''}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {leadTypeLabels[lead.lead_type || ''] || lead.lead_type || 'Lead'} - submitted{' '}
                                {formatDate(lead.created_at)}
                              </p>
                              {lead.notes && (
                                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                  {lead.notes}
                                </p>
                              )}
                            </div>
                            <Badge variant={statusVariant(lead.status || 'new')}>
                              {leadStatusLabels[lead.status || 'new'] || lead.status || 'New'}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Select
                              value={leadStatusDrafts[lead.id] || lead.status || 'new'}
                              onValueChange={(value) =>
                                setLeadStatusDrafts((current) => ({
                                  ...current,
                                  [lead.id]: value,
                                }))
                              }
                            >
                              <SelectTrigger className="sm:w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {leadStatuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {leadStatusLabels[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => updateLeadStatus(lead.id, lead.status)}
                              disabled={savingLeadId === lead.id}
                            >
                              {savingLeadId === lead.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Save Status'
                              )}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

export default function AdminPanelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <p className="ml-3 text-sm text-muted-foreground">
            Loading admin panel...
          </p>
        </div>
      }
    >
      <AdminPanelPageContent />
    </Suspense>
  );
}
