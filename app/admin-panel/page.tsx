'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
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
  leads: Array<any>;
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
  const [savingReportId, setSavingReportId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

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
              <CardContent className="overflow-x-auto">
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
                    {dashboard.creditReports.map((report) => (
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
              <CardContent className="overflow-x-auto">
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
                    {dashboard.users.map((profile) => (
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
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
                  {dashboard.alerts.emailEvents.slice(0, 20).map((event) => (
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
                  {dashboard.alerts.systemErrors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recent system errors.
                    </p>
                  ) : (
                    dashboard.alerts.systemErrors.map((item, index) => (
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
              <CardContent className="overflow-x-auto">
                {dashboard.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No admin tasks found.
                  </p>
                ) : (
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
                      {dashboard.tasks.map((task) => (
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
                )}
              </CardContent>
            </Card>
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
                {dashboard.recentActivity.map((activity) => (
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
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="font-semibold">Payments</h3>
                  {dashboard.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No payment records found.
                    </p>
                  ) : (
                    dashboard.payments.map((payment) => (
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
                  <h3 className="font-semibold">Funding Leads</h3>
                  {dashboard.leads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No lead records found.
                    </p>
                  ) : (
                    dashboard.leads.map((lead) => (
                      <div key={lead.id} className="rounded-md border p-3">
                        <p className="font-medium">
                          {lead.name || lead.email || lead.lead_type}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lead.lead_type} - {lead.status}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
