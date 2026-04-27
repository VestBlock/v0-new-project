'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Save,
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

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

function statusVariant(status?: string) {
  if (status === 'completed') return 'default';
  if (status === 'failed') return 'destructive';
  return 'secondary';
}

function priorityVariant(priority?: string) {
  if (priority === 'urgent' || priority === 'high') return 'destructive';
  if (priority === 'low') return 'outline';
  return 'secondary';
}

function timelineVariant(severity?: string) {
  if (severity === 'danger') return 'destructive';
  if (severity === 'success') return 'default';
  if (severity === 'warning') return 'secondary';
  return 'outline';
}

function JsonPreview({ value }: { value: unknown }) {
  if (!value) return <p className="text-sm text-muted-foreground">No data.</p>;
  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = use(params);
  const { user, userProfile, isAuthenticated, isLoading: authLoading } =
    useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [taskStatusDrafts, setTaskStatusDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const isAdminEmail =
    user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const isAdmin = userProfile?.role === 'admin' || Boolean(isAdminEmail);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to load report.');
      }
      setData(result);
      setStatus(result.report?.status || 'uploaded');
      setAdminNotes(result.report?.admin_notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=/admin-panel/reports/${reportId}`);
      return;
    }
    if (!isAdmin) {
      setError('Admin access required.');
      setLoading(false);
      return;
    }
    loadReport();
  }, [authLoading, isAuthenticated, isAdmin, reportId, router]);

  const saveStatus = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/credit-reports/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          status,
          adminNotes,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to update report.');
      }
      await loadReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update report.');
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (taskId: string, currentStatus: string) => {
    setSavingTaskId(taskId);
    setError('');
    try {
      const response = await fetch('/api/admin/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          status: taskStatusDrafts[taskId] || currentStatus,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to update task.');
      }
      await loadReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update task.');
    } finally {
      setSavingTaskId(null);
    }
  };

  const runReportAction = async (action: string) => {
    setRunningAction(action);
    setError('');
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to run report action.');
      }
      await loadReport();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to run report action.'
      );
    } finally {
      setRunningAction(null);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-24">
        <Alert variant="destructive">
          <AlertTitle>Report unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  const report = data.report;
  const profile = data.profile;
  const summary = data.operationalSummary;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="container mx-auto max-w-6xl space-y-6">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/admin-panel">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to admin
          </Link>
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Admin notice</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Credit Report Detail
            </h1>
            <p className="text-muted-foreground">
              {profile?.full_name || report.user_email || 'Unknown user'}
            </p>
          </div>
          <Badge variant={statusVariant(report.status)}>{report.status || 'uploaded'}</Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-cyan-500" />
                    Operator Summary
                  </CardTitle>
                  <CardDescription>
                    Current workflow health and the next best admin action.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm font-medium">{summary.nextBestAction}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={summary.hasCompletedAnalysis ? 'default' : 'secondary'}>
                      Analysis {summary.hasCompletedAnalysis ? 'complete' : 'pending'}
                    </Badge>
                    <Badge variant={summary.hasGeneratedLetters ? 'default' : 'secondary'}>
                      Letters {summary.hasGeneratedLetters ? 'ready' : 'pending'}
                    </Badge>
                    <Badge variant={summary.hasOpenTasks ? 'destructive' : 'outline'}>
                      {summary.hasOpenTasks ? 'Open tasks' : 'No open tasks'}
                    </Badge>
                    <Badge variant={summary.hasFailedEmail ? 'destructive' : 'outline'}>
                      {summary.hasFailedEmail ? 'Email issue' : 'Email healthy'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Report</CardTitle>
                <CardDescription>File, user, and workflow metadata.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">File</p>
                  <p className="font-medium">{report.file_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Uploaded</p>
                  <p className="font-medium">
                    {formatDate(report.uploaded_at || report.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium">{formatDate(report.completed_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email alert</p>
                  <p className="font-medium">
                    {report.email_alert_sent ? 'Sent' : 'Not sent'}
                  </p>
                </div>
                {data.signedFileUrl && (
                  <div className="md:col-span-2">
                    <Button asChild variant="outline">
                      <a href={data.signedFileUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open uploaded file
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Workflow Timeline</CardTitle>
                <CardDescription>
                  Uploads, analysis jobs, letters, email alerts, admin activity,
                  and task updates in one place.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data.timeline || data.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No timeline events found.</p>
                ) : (
                  data.timeline.map((event: any) => (
                    <div key={event.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{event.label}</p>
                          {event.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <Badge variant={timelineVariant(event.severity)}>
                          {event.status || event.kind}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{event.kind}</span>
                        <span>{formatDate(event.timestamp)}</span>
                        {event.href && (
                          <Link className="font-medium text-cyan-600" href={event.href}>
                            Open related item
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analysis Data</CardTitle>
                <CardDescription>Stored analysis and dispute-letter metadata.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <JsonPreview value={report.analysis_json || report.ai_analysis} />
                <Separator />
                <JsonPreview value={report.dispute_letters_json} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generated Letters</CardTitle>
                <CardDescription>Dispute letters connected to this user/report.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.letters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No letters found.</p>
                ) : (
                  data.letters.map((letter: any) => (
                    <div key={letter.id} className="rounded-md border p-3">
                      <p className="font-medium">
                        {letter.bureau || letter.creditor_name || letter.account_name || 'Letter'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {letter.letter_type} - {letter.status} -{' '}
                        {formatDate(letter.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Manual Review</CardTitle>
                <CardDescription>Update status and leave internal notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  rows={5}
                  placeholder="Internal admin notes"
                />
                <Button onClick={saveStatus} disabled={saving} className="w-full">
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save review
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operator Actions</CardTitle>
                <CardDescription>
                  Recover common workflow gaps without leaving this report.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => runReportAction('rerun_analysis')}
                  disabled={Boolean(runningAction)}
                >
                  {runningAction === 'rerun_analysis' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Rerun analysis
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => runReportAction('resend_upload_confirmation')}
                  disabled={Boolean(runningAction)}
                >
                  {runningAction === 'resend_upload_confirmation' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Resend upload emails
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => runReportAction('resend_analysis_completed')}
                  disabled={Boolean(runningAction)}
                >
                  {runningAction === 'resend_analysis_completed' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Resend analysis-ready emails
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => runReportAction('create_followup_task')}
                  disabled={Boolean(runningAction)}
                >
                  {runningAction === 'create_followup_task' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardList className="mr-2 h-4 w-4" />
                  )}
                  Create follow-up task
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Name:</span>{' '}
                  {profile?.full_name || 'Unknown'}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  {profile?.email || report.user_email || 'Unknown'}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin-panel/users/${report.user_id}`}>Open user</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Admin Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data.tasks || data.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks found.</p>
                ) : (
                  data.tasks.map((task: any) => (
                    <div key={task.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {task.description}
                            </p>
                          )}
                        </div>
                        <Badge variant={priorityVariant(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Due {formatDate(task.due_at)} - {task.task_type}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
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
                            {taskStatuses.map((item) => (
                              <SelectItem key={item} value={item}>
                                {item}
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
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Events
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.emailEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events found.</p>
                ) : (
                  data.emailEvents.map((event: any) => (
                    <div key={event.id} className="rounded-md border p-3">
                      <p className="font-medium">{event.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.status} - {formatDate(event.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
