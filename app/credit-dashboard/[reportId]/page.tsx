import Link from 'next/link';
import { getSupabaseServerSingleton } from '@/lib/supabase/server';
import type { RoadmapData } from '@/types/supabase';
import { CreditRoadmapDisplay } from '@/components/credit-roadmap-display';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditReportStatusCard } from '@/components/credit-report-status-card';
import { AlertCircle, CheckCircle, FileText, Info, UploadCloud } from 'lucide-react';
import { notFound } from 'next/navigation';

interface CreditReportData {
  id: string;
  ai_analysis?: string | null;
  created_at?: string | null;
  uploaded_at?: string | null;
  completed_at?: string | null;
  file_name?: string | null;
  name?: string | null;
  status?: string | null;
  analysis_json?: {
    negative_items?: unknown[];
    grouped_letters?: unknown[];
    generated_letter_count?: number;
  } | null;
  analysis_result?: unknown;
  dispute_letters_json?: unknown;
}

interface FullRoadmapData extends RoadmapData {
  // For clarity, though RoadmapData already has steps
  // Potentially add other top-level roadmap fields here if your AI generates them
}

interface PageProps {
  params: Promise<{
    reportId: string
  }>
}

async function getCreditDashboardData(
  reportId: string,
  userId: string,
): Promise<{
  report: CreditReportData | null;
  roadmap: FullRoadmapData | null;
  error?: string;
}> {
  const supabase = getSupabaseServerSingleton();

  // Fetch the credit report analysis
  const { data: reportData, error: reportError } = await supabase
    .from('credit_reports')
    .select('*')
    .eq('id', reportId)
    .eq('user_id', userId)
    .single();

  if (reportError || !reportData) {
    console.error(
      `Error fetching credit report ${reportId} for user ${userId}:`,
      reportError?.message
    );
    return {
      report: null,
      roadmap: null,
      error: reportError?.message || 'Credit report not found or access denied.',
    };
  }

  // Fetch the corresponding roadmap
  const { data: roadmapData, error: roadmapError } = await supabase
    .from('credit_improvement_roadmaps')
    .select('roadmap_data, generated_at')
    .eq('credit_report_id', reportId)
    .eq('user_id', userId)
    .single();

  if (roadmapError || !roadmapData) {
    console.warn(
      `Roadmap not found for credit report ${reportId} (user ${userId}). This might be okay if generation is pending or failed. Error: ${roadmapError?.message}`,
    );
    return {
      report: reportData as CreditReportData,
      roadmap: null,
      error: roadmapError?.message,
    };
  }

  // roadmap_data.roadmap_data should be the object { steps: [...] }
  const parsedRoadmap = roadmapData.roadmap_data as FullRoadmapData;

  return {
    report: reportData as CreditReportData,
    roadmap: parsedRoadmap,
  };
}

function getAnalysisSummary(report: CreditReportData) {
  const analysis = report.analysis_json;
  if (!analysis) return [];

  const negativeItems = Array.isArray(analysis.negative_items)
    ? analysis.negative_items.length
    : null;
  const groupedLetters = Array.isArray(analysis.grouped_letters)
    ? analysis.grouped_letters.length
    : null;
  const generatedLetterCount = Number(analysis.generated_letter_count);

  return [
    negativeItems !== null
      ? `${negativeItems} negative item${negativeItems === 1 ? '' : 's'} identified`
      : null,
    groupedLetters !== null
      ? `${groupedLetters} dispute group${groupedLetters === 1 ? '' : 's'} prepared`
      : null,
    Number.isFinite(generatedLetterCount)
      ? `${generatedLetterCount} dispute letter${
          generatedLetterCount === 1 ? '' : 's'
        } generated`
      : null,
  ].filter(Boolean) as string[];
}

export default async function CreditDashboardPage({ params }: PageProps) {
  const supabase = getSupabaseServerSingleton();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Or redirect to login
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertCircle /> Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to view your credit dashboard.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { reportId } = await params;
  const { report, roadmap, error } = await getCreditDashboardData(
    reportId,
    user.id
  );

  if (error && !report) {
    // Critical error, report itself not found
    notFound();
  }

  if (!report) {
    // Should be caught by the above, but as a fallback
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertCircle /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Could not load credit report data. Please try again later.</p>
            {error && <p className="text-sm text-muted-foreground mt-2">Details: {error}</p>}
          </CardContent>
        </Card>
      </div>
    )
  }

  const analysisSummary = getAnalysisSummary(report);
  const submittedAt = report.uploaded_at || report.created_at;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Your Credit Dashboard</h1>
        <p className="text-muted-foreground">
          Analysis of your credit report submitted on{' '}
          {submittedAt
            ? new Date(submittedAt).toLocaleDateString()
            : 'your recent upload'}
          .
        </p>
      </header>

      <CreditReportStatusCard report={report} showActions={false} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Section for Personalized Roadmap */}
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle className="h-6 w-6 text-green-500" />
                Personalized Credit Improvement Roadmap
              </CardTitle>
              <CardDescription>
                Actionable steps based on your credit report analysis to help you improve your financial health.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {roadmap && roadmap.steps && roadmap.steps.length > 0 ? (
                <CreditRoadmapDisplay roadmapSteps={roadmap.steps} />
              ) : (
                <div className="text-center py-8">
                  <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-semibold">Roadmap Not Available</p>
                  <p className="text-sm text-muted-foreground">
                    {error
                      ? `There was an issue generating your roadmap: ${error}`
                      : "Your personalized roadmap is currently being generated or could not be created."}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please check back later or try re-analyzing your report if the issue persists.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <Button asChild variant="outline">
                      <Link href="/credit-upload">
                        <UploadCloud className="h-4 w-4" />
                        Upload Another Report
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section for General AI Analysis */}
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-6 w-6 text-blue-500" />
                AI Credit Report Analysis
              </CardTitle>
              <CardDescription>A detailed textual analysis of your uploaded credit report.</CardDescription>
            </CardHeader>
            <CardContent>
              {report.ai_analysis ? (
                <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line">
                  {report.ai_analysis}
                </div>
              ) : analysisSummary.length > 0 ? (
                <div className="space-y-3">
                  {analysisSummary.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                  <Button asChild variant="outline" size="sm">
                    <Link href="/tools/my-dispute-letters">
                      View Dispute Letters
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No detailed analysis text is available yet. Check the review
                  status above for the current processing step.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
