type TimelineSourceRow = Record<string, any>;

export type CreditReportTimelineEvent = {
  id: string;
  label: string;
  description?: string | null;
  timestamp?: string | null;
  kind:
    | 'report'
    | 'analysis'
    | 'letter'
    | 'email'
    | 'admin_activity'
    | 'task';
  status?: string | null;
  severity: 'info' | 'success' | 'warning' | 'danger';
  href?: string | null;
};

export type CreditReportOperationalSummary = {
  hasFailedEmail: boolean;
  hasOpenTasks: boolean;
  hasGeneratedLetters: boolean;
  hasCompletedAnalysis: boolean;
  latestStatus?: string | null;
  nextBestAction: string;
};

function getTimestamp(row: TimelineSourceRow) {
  return row.created_at || row.updated_at || row.completed_at || row.uploaded_at || null;
}

function statusSeverity(status?: string | null): CreditReportTimelineEvent['severity'] {
  const normalized = String(status || '').toLowerCase();
  if (['failed', 'error', 'email_failed', 'urgent'].includes(normalized)) return 'danger';
  if (['needs_review', 'waiting', 'open', 'in_progress', 'pending_review'].includes(normalized)) {
    return 'warning';
  }
  if (['completed', 'sent', 'generated', 'success'].includes(normalized)) return 'success';
  return 'info';
}

function sortTimeline(events: CreditReportTimelineEvent[]) {
  return events.sort(
    (a, b) =>
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );
}

export function buildCreditReportTimeline(input: {
  report: TimelineSourceRow;
  jobs?: TimelineSourceRow[];
  letters?: TimelineSourceRow[];
  emailEvents?: TimelineSourceRow[];
  activity?: TimelineSourceRow[];
  tasks?: TimelineSourceRow[];
}) {
  const report = input.report;
  const jobs = input.jobs ?? [];
  const letters = input.letters ?? [];
  const emailEvents = input.emailEvents ?? [];
  const activity = input.activity ?? [];
  const tasks = input.tasks ?? [];

  const events: CreditReportTimelineEvent[] = [
    {
      id: `report-uploaded-${report.id}`,
      label: 'Credit report uploaded',
      description: report.file_name || report.file_path || 'Customer report received.',
      timestamp: report.uploaded_at || report.created_at,
      kind: 'report',
      status: 'uploaded',
      severity: 'info',
    },
  ];

  if (report.status) {
    events.push({
      id: `report-status-${report.id}-${report.status}`,
      label: `Report status: ${report.status}`,
      description: report.error_message || report.admin_notes || null,
      timestamp: report.updated_at || report.completed_at || report.created_at,
      kind: 'report',
      status: report.status,
      severity: statusSeverity(report.status),
    });
  }

  if (report.completed_at) {
    events.push({
      id: `report-completed-${report.id}`,
      label: 'Credit analysis completed',
      description: 'The workflow marked this report as completed.',
      timestamp: report.completed_at,
      kind: 'analysis',
      status: 'completed',
      severity: 'success',
    });
  }

  jobs.forEach((job) => {
    events.push({
      id: `job-${job.id}`,
      label: `Analysis job ${job.status || 'updated'}`,
      description: job.error_message || job.original_file_name || job.file_path || null,
      timestamp: getTimestamp(job),
      kind: 'analysis',
      status: job.status,
      severity: statusSeverity(job.status),
      href: job.id ? `/analysis/results/${job.id}` : null,
    });
  });

  letters.forEach((letter) => {
    events.push({
      id: `letter-${letter.id}`,
      label: `Dispute letter ${letter.status || 'created'}`,
      description:
        letter.bureau ||
        letter.creditor_name ||
        letter.account_name ||
        letter.letter_type ||
        'Generated dispute letter.',
      timestamp: getTimestamp(letter),
      kind: 'letter',
      status: letter.status || 'generated',
      severity: 'success',
    });
  });

  emailEvents.forEach((event) => {
    events.push({
      id: `email-${event.id}`,
      label: event.subject || `Email ${event.status || 'event'}`,
      description: event.error_message || event.user_email || event.event_type || null,
      timestamp: getTimestamp(event),
      kind: 'email',
      status: event.status,
      severity: statusSeverity(event.status),
    });
  });

  activity.forEach((item) => {
    events.push({
      id: `activity-${item.id}`,
      label: item.action_type || 'Admin activity',
      description:
        typeof item.metadata_json?.action === 'string'
          ? item.metadata_json.action
          : item.entity_type || null,
      timestamp: getTimestamp(item),
      kind: 'admin_activity',
      status: item.action_type,
      severity: statusSeverity(item.action_type),
    });
  });

  tasks.forEach((task) => {
    events.push({
      id: `task-${task.id}`,
      label: `Task: ${task.title}`,
      description: task.description || task.task_type || null,
      timestamp: task.updated_at || task.created_at || task.due_at,
      kind: 'task',
      status: task.status,
      severity: statusSeverity(task.status),
      href:
        task.entity_type === 'credit_report' && task.entity_id
          ? `/admin-panel/reports/${task.entity_id}`
          : null,
    });
  });

  return sortTimeline(events).slice(0, 75);
}

export function summarizeCreditReportOperations(input: {
  report: TimelineSourceRow;
  letters?: TimelineSourceRow[];
  emailEvents?: TimelineSourceRow[];
  tasks?: TimelineSourceRow[];
}): CreditReportOperationalSummary {
  const report = input.report;
  const letters = input.letters ?? [];
  const emailEvents = input.emailEvents ?? [];
  const tasks = input.tasks ?? [];
  const openTasks = tasks.filter((task) =>
    ['open', 'in_progress', 'waiting'].includes(String(task.status))
  );
  const hasFailedEmail = emailEvents.some((event) => event.status === 'failed');
  const hasGeneratedLetters =
    Boolean(report.dispute_letters_json) || letters.some((letter) => letter.status !== 'failed');
  const hasCompletedAnalysis =
    report.status === 'completed' || Boolean(report.analysis_json || report.ai_analysis);

  let nextBestAction = 'Monitor the report and keep the customer updated.';
  if (report.status === 'failed' || report.error_message) {
    nextBestAction = 'Review the failure, rerun analysis if possible, then contact the customer.';
  } else if (report.status === 'needs_review') {
    nextBestAction = 'Complete manual review and decide whether to generate or revise letters.';
  } else if (!hasCompletedAnalysis) {
    nextBestAction = 'Confirm extraction/analysis is running and escalate if the report is stalled.';
  } else if (!hasGeneratedLetters) {
    nextBestAction = 'Check whether dispute letters should be generated for this analysis.';
  } else if (openTasks.length > 0) {
    nextBestAction = 'Work the open admin tasks and update the customer-facing next step.';
  } else if (hasFailedEmail) {
    nextBestAction = 'Fix failed email delivery and resend the customer/admin notification.';
  } else {
    nextBestAction = 'Mark follow-up complete or schedule the next customer touchpoint.';
  }

  return {
    hasFailedEmail,
    hasOpenTasks: openTasks.length > 0,
    hasGeneratedLetters,
    hasCompletedAnalysis,
    latestStatus: report.status,
    nextBestAction,
  };
}
