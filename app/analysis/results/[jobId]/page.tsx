'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Upload,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AnalysisJob {
  id: string;
  status: string;
  original_file_name: string;
  created_at: string;
  uploaded_at: string;
  financial_goal_title: string;
  financial_goal_details: any;
}

export default function AnalysisResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const supabase = getSupabaseClient();

  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const jobId = params.jobId as string;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    fetchAnalysisJob();
  }, [isAuthenticated, jobId]);

  const fetchAnalysisJob = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('analysis_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user?.id)
        .single();

      if (jobError) throw new Error('Analysis not found');
      setJob(jobData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <div>Please log in to view results.</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 pb-16">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="animate-pulse">Loading your analysis...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 pb-16">
          <div className="container mx-auto max-w-4xl">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error || 'Analysis not found'}
              </AlertDescription>
            </Alert>
          </div>
        </main>
      </div>
    );
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'uploaded':
      case 'pending_review':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: Clock,
          title: 'Under Review',
          description: 'Your credit report is being reviewed by our experts.',
        };
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800',
          icon: CheckCircle2,
          title: 'Analysis Complete',
          description: 'Your analysis and dispute letters are ready!',
        };
      default:
        return {
          color: 'bg-blue-100 text-blue-800',
          icon: FileText,
          title: 'Processing',
          description: 'Your credit report is being processed.',
        };
    }
  };

  const statusInfo = getStatusInfo(job.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">
              Credit Analysis Status
            </h1>
            <p className="text-muted-foreground">
              Uploaded on{' '}
              {new Date(job.uploaded_at || job.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Status Card */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon className="h-6 w-6 text-cyan-600" />
                  <div>
                    <CardTitle>{statusInfo.title}</CardTitle>
                    <CardDescription>{statusInfo.description}</CardDescription>
                  </div>
                </div>
                <Badge className={statusInfo.color}>
                  {job.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    File: {job.original_file_name}
                  </span>
                </div>

                {job.financial_goal_title && (
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Goal: {job.financial_goal_title}
                    </span>
                  </div>
                )}

                {job.status === 'pending_review' ||
                job.status === 'uploaded' ? (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertTitle>Analysis in Progress</AlertTitle>
                    <AlertDescription>
                      Our experts are reviewing your credit report. You'll
                      receive your comprehensive analysis and custom dispute
                      letters within 24 hours. We'll notify you via email when
                      it's ready.
                    </AlertDescription>
                  </Alert>
                ) : job.status === 'completed' ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Analysis Complete!</AlertTitle>
                    <AlertDescription>
                      Your credit analysis and dispute letters are ready. Check
                      your email for the complete package including all dispute
                      letters and mailing instructions.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* What's Included */}
          <Card>
            <CardHeader>
              <CardTitle>What's Included in Your Analysis</CardTitle>
              <CardDescription>
                Here's what you'll receive once your analysis is complete
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">
                    Comprehensive Analysis
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Detailed credit score breakdown
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Account-by-account review
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Negative items identification
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Improvement recommendations
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">
                    Custom Dispute Letters
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Professional dispute letters for negative items
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Inquiry removal letters
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Step-by-step mailing instructions
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Follow-up timeline and strategy
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
