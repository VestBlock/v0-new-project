import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';

import {
  getCreditReportStatusView,
  type CreditReportStatus,
} from '@/lib/workflows/creditReportStatus';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export type CreditReportStatusCardReport = {
  id: string;
  file_name?: string | null;
  name?: string | null;
  status?: CreditReportStatus | string | null;
  created_at?: string | null;
  uploaded_at?: string | null;
  completed_at?: string | null;
  analysis_json?: unknown;
  analysis_result?: unknown;
  dispute_letters_json?: unknown;
};

type CreditReportStatusCardProps = {
  report: CreditReportStatusCardReport;
  compact?: boolean;
  showActions?: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getGeneratedLetterCount(report: CreditReportStatusCardReport) {
  const letters = report.dispute_letters_json;
  if (
    typeof letters === 'object' &&
    letters !== null &&
    'generated_count' in letters
  ) {
    const count = Number(
      (letters as { generated_count?: unknown }).generated_count
    );
    return Number.isFinite(count) ? count : null;
  }

  const analysis = report.analysis_json;
  if (
    typeof analysis === 'object' &&
    analysis !== null &&
    'generated_letter_count' in analysis
  ) {
    const count = Number(
      (analysis as { generated_letter_count?: unknown }).generated_letter_count
    );
    return Number.isFinite(count) ? count : null;
  }

  return null;
}

function StatusIcon({ status }: { status: CreditReportStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  }

  if (status === 'failed') {
    return <AlertCircle className="h-5 w-5 text-destructive" />;
  }

  if (status === 'needs_review') {
    return <Eye className="h-5 w-5 text-amber-600" />;
  }

  if (status === 'uploaded') {
    return <UploadCloud className="h-5 w-5 text-primary" />;
  }

  return <RefreshCw className="h-5 w-5 text-primary" />;
}

export function CreditReportStatusCard({
  report,
  compact = false,
  showActions = true,
}: CreditReportStatusCardProps) {
  const status = getCreditReportStatusView(report.status, report);
  const fileName = report.file_name || report.name || 'Credit report';
  const uploadedAt = report.uploaded_at || report.created_at;
  const generatedLetterCount = getGeneratedLetterCount(report);

  return (
    <Card
      className={cn(
        'border-border/80',
        status.status === 'completed' && 'border-emerald-200',
        status.status === 'failed' && 'border-destructive/30',
        status.status === 'needs_review' && 'border-amber-300'
      )}
    >
      <CardHeader className={cn('space-y-3', compact && 'pb-3')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <StatusIcon status={status.status} />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle
                className={cn(
                  'text-lg leading-tight',
                  compact && 'text-base'
                )}
              >
                {status.headline}
              </CardTitle>
              <p className="truncate text-sm font-medium text-foreground/80">
                {fileName}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDate(uploadedAt)}
                </span>
                {generatedLetterCount !== null && (
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {generatedLetterCount} letter
                    {generatedLetterCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge variant={status.tone === 'default' ? 'default' : status.tone}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-4', compact && 'pt-0')}>
        <Progress value={status.progress} />
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{status.description}</p>
          {!compact && (
            <p>
              <span className="font-medium">Next step: </span>
              <span className="text-muted-foreground">{status.nextStep}</span>
            </p>
          )}
        </div>
        {showActions && (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/credit-dashboard/${report.id}`}>
                View Report
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {status.status === 'completed' && (
              <Button asChild size="sm" variant="outline">
                <Link href="/tools/my-dispute-letters">Dispute Letters</Link>
              </Button>
            )}
            {status.status === 'failed' && (
              <Button asChild size="sm" variant="outline">
                <Link href="/credit-upload">Upload Clearer Copy</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
