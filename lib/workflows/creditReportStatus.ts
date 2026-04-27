export const creditReportStatusValues = [
  'uploaded',
  'extracting_text',
  'text_extracted',
  'analyzing',
  'completed',
  'failed',
  'needs_review',
] as const;

export type CreditReportStatus = (typeof creditReportStatusValues)[number];

export type CreditReportStatusView = {
  status: CreditReportStatus;
  label: string;
  tone: 'default' | 'success' | 'warning' | 'destructive' | 'secondary';
  progress: number;
  headline: string;
  description: string;
  nextStep: string;
};

type LooseReport = {
  status?: unknown;
  completed_at?: unknown;
  analysis_json?: unknown;
  analysis_result?: unknown;
  ai_analysis?: unknown;
  error_message?: unknown;
};

const statusCopy: Record<CreditReportStatus, CreditReportStatusView> = {
  uploaded: {
    status: 'uploaded',
    label: 'Uploaded',
    tone: 'secondary',
    progress: 18,
    headline: 'Report received',
    description:
      'Your credit report is securely stored and queued for the VestBlock credit repair workflow.',
    nextStep:
      'VestBlock will extract report details, review negative items, and prepare dispute opportunities.',
  },
  extracting_text: {
    status: 'extracting_text',
    label: 'Extracting text',
    tone: 'default',
    progress: 35,
    headline: 'Reading your report',
    description:
      'VestBlock is extracting report text so the analysis can identify accounts, bureaus, and dispute signals.',
    nextStep:
      'Keep an eye on this page. You will receive an email when your analysis is ready.',
  },
  text_extracted: {
    status: 'text_extracted',
    label: 'Text extracted',
    tone: 'default',
    progress: 52,
    headline: 'Report text captured',
    description:
      'The report text was captured and is ready for AI review and dispute letter preparation.',
    nextStep:
      'The next step is analysis. If anything looks unclear, an operator can move the report to review.',
  },
  analyzing: {
    status: 'analyzing',
    label: 'Analyzing',
    tone: 'default',
    progress: 72,
    headline: 'Analysis in progress',
    description:
      'VestBlock is reviewing negative items, grouping dispute opportunities, and preparing next actions.',
    nextStep:
      'When analysis finishes, your dashboard will show the result and any generated dispute letters.',
  },
  completed: {
    status: 'completed',
    label: 'Completed',
    tone: 'success',
    progress: 100,
    headline: 'Analysis ready',
    description:
      'Your credit analysis is complete and any available dispute letter outputs are ready to review.',
    nextStep:
      'Review the analysis, download letters if available, and continue through the credit repair plan.',
  },
  failed: {
    status: 'failed',
    label: 'Needs attention',
    tone: 'destructive',
    progress: 100,
    headline: 'Processing needs attention',
    description:
      'VestBlock could not finish the automated analysis for this upload. The admin team is alerted.',
    nextStep:
      'You can upload a clearer copy or wait for a manual follow-up if the file needs review.',
  },
  needs_review: {
    status: 'needs_review',
    label: 'Manual review',
    tone: 'warning',
    progress: 88,
    headline: 'Manual review needed',
    description:
      'This report needs an operator review before VestBlock can complete the credit repair workflow.',
    nextStep:
      'The admin team can review the report, update the status, and follow up with the next action.',
  },
};

export function normalizeCreditReportStatus(
  rawStatus?: unknown,
  report?: LooseReport | null
): CreditReportStatus {
  if (
    typeof rawStatus === 'string' &&
    creditReportStatusValues.includes(rawStatus as CreditReportStatus)
  ) {
    return rawStatus as CreditReportStatus;
  }

  if (report?.completed_at || report?.analysis_json || report?.analysis_result) {
    return 'completed';
  }

  if (report?.error_message) {
    return 'failed';
  }

  return 'uploaded';
}

export function getCreditReportStatusView(
  rawStatus?: unknown,
  report?: LooseReport | null
) {
  return statusCopy[normalizeCreditReportStatus(rawStatus, report)];
}
