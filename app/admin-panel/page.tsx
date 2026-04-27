'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock3,
  ClipboardList,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
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
    totalOpenTasks: number;
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

const leadStatusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  closed: 'Closed',
};

const leadTypeLabels: Record<string, string> = {
  sell_house: 'Sell House',
  real_estate: 'Real Estate Funding',
  ai_assistant: 'AI Assistant',
};

const envLabels: Record<keyof AdminDashboard['automation']['env'], string> = {
  cronSecretConfigured: 'CRON_SECRET',
  resendConfigured: 'RESEND_API_KEY',
  adminAlertEmailConfigured: 'ADMIN_ALERT_EMAIL',
  fromEmailConfigured: 'FROM_EMAIL',
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

export default function AdminPanelPage() {
  const { user, userProfile, isAuthenticated, isLoading: authLoading } =
    useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [taskStatusDrafts, setTaskStatusDrafts] = useState<Record<string, string>>({});
  const [leadStatusDrafts, setLeadStatusDrafts] = useState<Record<string, string>>({});
  const [savingReportId, setSavingReportId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
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

  const isAdminEmail =
    user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const isAdmin = userProfile?.role === 'admin' || Boolean(isAdminEmail);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
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
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/admin-panel');
      return;
    }
    if (!isAdmin) {
      setError('Admin access required.');
      setLoading(false);
      return;
    }
    loadDashboard();
  }, [authLoading, isAuthenticated, isAdmin, router]);

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
        label: 'Open Tasks',
        value: dashboard.overview.totalOpenTasks,
        icon: ClipboardList,
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
              Credit repair operations, users, alerts, payments, and follow-up
              work.
            </p>
          </div>
          <Button variant="outline" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
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

        <Tabs defaultValue="reports" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="reports">Credit Reports</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

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

          <TabsContent value="automation">
            <div className="space-y-4">
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

              <div className="grid gap-4 lg:grid-cols-3">
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
