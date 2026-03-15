'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  AnalysisJob,
  RoadmapData,
  AiCreditCardRecommendation,
  AiSideHustleRecommendation,
} from '@/types/supabase';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Download,
  MessageSquare,
  FileWarning,
} from 'lucide-react';
import InteractiveRoadmap from '@/components/interactive-roadmap'; // Ensure this component exists and is robust
import CreditCardsTab from '@/components/credit-cards-tab'; // Ensure this component exists and is robust
import SideHustlesTab from '@/components/side-hustles-tab'; // Ensure this component exists and is robust
import { ChatInterface } from '@/components/chat-interface'; // Ensure this component exists and is robust
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

interface AnalysisResultClientViewProps {
  initialJobDetails: AnalysisJob;
  jobId: string;
  userId: string;
}

const POLLING_INTERVAL = 7000; // 7 seconds
const MAX_POLLING_ATTEMPTS = 120; // Approx 14 minutes (7s * 120)

export default function AnalysisResultClientView({
  initialJobDetails,
  jobId,
  userId,
}: AnalysisResultClientViewProps) {
  const [jobDetails, setJobDetails] = useState<AnalysisJob>(initialJobDetails);
  const [isLoadingJob, setIsLoadingJob] = useState<boolean>(
    initialJobDetails.status !== 'completed' &&
      initialJobDetails.status !== 'failed'
  );
  const [error, setError] = useState<string | null>(null);
  const pollingAttemptsRef = useRef(0);
  const supabase = getSupabaseClient();
  const { toast } = useToast();

  const fetchJobStatus = useCallback(async () => {
    if (!supabase) {
      console.error('[Client View] Supabase client not available for polling.');
      setError(
        'Connection issue: Could not update analysis status. Please refresh.'
      );
      setIsLoadingJob(false);
      return;
    }

    pollingAttemptsRef.current += 1;
    console.log(
      `[Client View] Polling for job status. Attempt: ${pollingAttemptsRef.current}`
    );

    try {
      const { data, error: fetchError } = await supabase
        .from('analysis_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        console.error('[Client View] Error fetching job status:', fetchError);
        if (pollingAttemptsRef.current > 3) {
          // Only set persistent error after a few failed attempts
          setError(
            `Failed to update status: ${fetchError.message}. You might need to refresh.`
          );
          setIsLoadingJob(false); // Stop loading if polling consistently fails
        }
        return;
      }

      if (data) {
        console.log('[Client View] Fetched job data. Status:', data.status);
        setJobDetails(data as AnalysisJob);
        if (data.status === 'completed' || data.status === 'failed') {
          setIsLoadingJob(false);
          if (data.status === 'completed') {
            toast({
              title: 'Analysis Complete!',
              description: 'Your financial analysis results are ready.',
              variant: 'success',
            });
          } else {
            // data.status === "failed"
            const errorMessage =
              data.error_message ||
              'An unknown error occurred during analysis.';
            toast({
              title: 'Analysis Failed',
              description: errorMessage,
              variant: 'destructive',
            });
            setError(errorMessage); // Set the specific error from the job
          }
        } else {
          setIsLoadingJob(true); // Still processing
        }
      }
    } catch (e: any) {
      console.error(
        '[Client View] Unexpected error during job status fetch:',
        e
      );
      setError(
        'An unexpected error occurred while fetching updates. Please refresh.'
      );
      setIsLoadingJob(false);
    }
  }, [jobId, userId, supabase, toast]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isLoadingJob && pollingAttemptsRef.current < MAX_POLLING_ATTEMPTS) {
      intervalId = setInterval(fetchJobStatus, POLLING_INTERVAL);
    } else if (
      isLoadingJob &&
      pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS
    ) {
      console.warn(
        '[Client View] Max polling attempts reached. Stopping polling.'
      );
      setError(
        'Analysis is taking longer than expected. The process may have stalled. Please check back later or contact support.'
      );
      setIsLoadingJob(false);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoadingJob, fetchJobStatus]);

  const getStatusMessage = (status: string | null): string => {
    if (!status) return 'Status unknown...';
    switch (status) {
      case 'pending_upload':
        return 'Preparing for upload...';
      case 'pdfco_uploading':
        return 'Uploading file securely...';
      case 'pdfco_processing':
        return 'Extracting text from PDF (this may take a moment)...';
      case 'text_extracted':
        return 'Text extracted. Preparing for AI analysis...';
      case 'ai_processing':
        return 'AI is analyzing your report and generating insights (this can take up to 2 minutes)...';
      case 'completed':
        return 'Your financial analysis and roadmap are ready!';
      case 'failed':
        return 'Analysis failed. See details below.';
      default:
        return `Processing: ${status.replace(/_/g, ' ')}...`;
    }
  };

  const renderStatusIndicator = () => {
    const status = jobDetails.status;
    const message = getStatusMessage(status);

    if (status === 'completed') {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          <span>{message}</span>
        </div>
      );
    }
    if (status === 'failed') {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{message}</AlertTitle>
          <AlertDescription>
            {jobDetails.error_message || 'An unknown error occurred.'}
            <p className="mt-2">
              Please try uploading your report again. If the problem persists,
              contact support with Job ID: {jobId}.
            </p>
          </AlertDescription>
          <Button asChild className="mt-4">
            <Link href="/enhanced-credit-analyzer">Try New Analysis</Link>
          </Button>
        </Alert>
      );
    }
    if (isLoadingJob) {
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{message}</span>
        </div>
      );
    }
    // Default/unknown status
    return (
      <div className="flex items-center space-x-2 text-gray-600">
        <Clock className="h-5 w-5" />
        <span>{message}</span>
      </div>
    );
  };

  if (
    isLoadingJob &&
    jobDetails.status !== 'completed' &&
    jobDetails.status !== 'failed'
  ) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            Analyzing Your Financial Report
          </CardTitle>
          <CardDescription>
            We're currently processing your document. This might take a few
            minutes. Please keep this page open.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-6 py-12">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="text-xl font-medium">
            {getStatusMessage(jobDetails.status)}
          </p>
          <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2.5 rounded-full animate-pulse"
              style={{
                width: `${
                  (pollingAttemptsRef.current / MAX_POLLING_ATTEMPTS) * 50 + 25
                }%`,
              }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground">
            Your comprehensive financial roadmap is being generated...
          </p>
        </CardContent>
      </Card>
    );
  }

  // If job failed, the status indicator (which includes an Alert) is the primary content.
  if (jobDetails.status === 'failed') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Analysis Results</h1>
        {renderStatusIndicator()}
      </div>
    );
  }

  // If there's a general polling error after loading has stopped (and not a specific job failure)
  if (error && !isLoadingJob && jobDetails.status !== 'failed') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Updating Status</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Refresh Page
        </Button>
      </Alert>
    );
  }

  // Data for completed jobs
  const roadmapData = jobDetails.ai_roadmap_data as RoadmapData | null;
  const creditCardRecommendations =
    jobDetails.ai_credit_card_recommendations as
      | AiCreditCardRecommendation[]
      | null;
  const sideHustleRecommendations =
    jobDetails.ai_side_hustle_recommendations as
      | AiSideHustleRecommendation[]
      | null;
  const analysisSummary = jobDetails.ai_summary;
  const detailedAnalysis = jobDetails.ai_detailed_analysis; // Assuming this is a JSON object or string

  if (jobDetails.status === 'completed' && (!roadmapData || !analysisSummary)) {
    // This case indicates a potential issue with the AI processing or data saving step.
    return (
      <Alert variant="warning">
        <FileWarning className="h-4 w-4" />
        <AlertTitle>Analysis Data Incomplete</AlertTitle>
        <AlertDescription>
          The analysis process completed, but some key information (like the
          roadmap or summary) seems to be missing. This might be a temporary
          issue. Please try refreshing, or contact support if the problem
          persists. Job ID: {jobId}
        </AlertDescription>
        <div className="mt-4 space-x-3">
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh
          </Button>
          <Button asChild>
            <Link href="/credit-upload">Go to Dashboard</Link>
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Your Financial Analysis Results
          </h1>
          <p className="text-muted-foreground">Job ID: {jobId}</p>
        </div>
        {renderStatusIndicator()}
      </div>

      {jobDetails.is_likely_credit_report === false &&
        jobDetails.status === 'completed' && (
          <Alert variant="warning">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Document Type Note</AlertTitle>
            <AlertDescription>
              The uploaded document does not appear to be a standard credit
              report. The analysis provided is based on the text extracted, but
              its relevance to credit improvement may be limited.
            </AlertDescription>
          </Alert>
        )}

      {analysisSummary && (
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap prose dark:prose-invert max-w-none">
              {analysisSummary}
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="roadmap" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
          <TabsTrigger value="roadmap">Action Plan</TabsTrigger>
          <TabsTrigger value="credit_cards">Card Ideas</TabsTrigger>
          <TabsTrigger value="side_hustles">Income Ideas</TabsTrigger>
          <TabsTrigger value="ask_vestbot">
            <MessageSquare className="mr-2 h-4 w-4" /> Ask VestBot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap">
          {roadmapData && roadmapData.steps && roadmapData.steps.length > 0 ? (
            <InteractiveRoadmap roadmapData={roadmapData} />
          ) : (
            <Card>
              <CardContent className="pt-6 text-muted-foreground">
                No detailed action plan available for this analysis.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="credit_cards">
          {creditCardRecommendations && creditCardRecommendations.length > 0 ? (
            <CreditCardsTab recommendations={creditCardRecommendations} />
          ) : (
            <Card>
              <CardContent className="pt-6 text-muted-foreground">
                No specific credit card recommendations generated.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="side_hustles">
          {sideHustleRecommendations && sideHustleRecommendations.length > 0 ? (
            <SideHustlesTab recommendations={sideHustleRecommendations} />
          ) : (
            <Card>
              <CardContent className="pt-6 text-muted-foreground">
                No specific side hustle recommendations generated.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ask_vestbot">
          <ChatInterface
            jobId={jobId}
            userId={userId}
            initialAnalysisContext={{
              summary: analysisSummary,
              roadmapSteps: roadmapData?.steps,
              creditCardRecs: creditCardRecommendations,
              sideHustleRecs: sideHustleRecommendations,
              extractedText: jobDetails.extracted_text?.substring(0, 2000), // Pass a snippet for context
              financialGoal: jobDetails.financial_goal_title,
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Optional: Raw detailed analysis for debugging or power users */}
      {/* process.env.NODE_ENV === 'development' && detailedAnalysis && (
        <Card>
          <CardHeader><CardTitle>Raw Detailed Analysis (Dev Only)</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto max-h-96">
              {typeof detailedAnalysis === 'string' ? detailedAnalysis : JSON.stringify(detailedAnalysis, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )*/}

      <div className="mt-10 flex flex-col sm:flex-row justify-end items-center gap-3">
        <Button
          variant="outline"
          onClick={() => alert('PDF download functionality to be implemented.')}
          disabled
        >
          <Download className="mr-2 h-4 w-4" /> Download Report (PDF)
        </Button>
        <Button asChild size="lg">
          <Link href="/credit-upload">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
