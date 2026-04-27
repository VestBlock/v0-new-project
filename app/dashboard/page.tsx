'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertCircle,
  FileText,
  Loader2,
  Rocket,
  ShieldCheck,
  Star,
  UploadCloud,
} from 'lucide-react';
import { InteractiveRoadmap } from '@/components/interactive-roadmap';
import { CreditCardsTab } from '@/components/credit-cards-tab';
import { SideHustlesTab } from '@/components/side-hustles-tab';
import { CreditScoreTab } from '@/components/credit-score-tab';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditReportStatusCard } from '@/components/credit-report-status-card';

type DashboardCreditReport = {
  id: string;
  file_name?: string | null;
  name?: string | null;
  status?: string | null;
  created_at?: string | null;
  uploaded_at?: string | null;
  completed_at?: string | null;
  analysis_json?: unknown;
  analysis_result?: unknown;
  dispute_letters_json?: unknown;
};

export default function DashboardPage() {
  const { user, userProfile, fetchUserProfile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const params = useSearchParams();
  const token = params.get('token');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [creditReports, setCreditReports] = useState<DashboardCreditReport[]>(
    []
  );
  const [reportsError, setReportsError] = useState('');

  useEffect(() => {
    if (!token || !user) return;
    setPaymentLoading(true);
    // Call capture endpoint and update DB
    fetch('/api/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID: token, userId: user.id }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          // Refresh your auth/userProfile context
          fetchUserProfile(user);
          // Remove ?token= from URL
          router.replace('/credit-upload');
        } else throw new Error(json.error);
      })
      .catch(console.error)
      .finally(() => setPaymentLoading(false));
  }, [token, user, fetchUserProfile, router]);

  const handleCheckout = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.id,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Create-order failed:', errText);
        throw new Error('Unable to initiate payment.');
      }

      const json = await res.json();

      if (!json.success) {
        console.error('PayPal API error:', json.error);
        throw new Error(json.error || 'Payment initialization failed.');
      }

      const links = json.data.links;
      if (!Array.isArray(links)) {
        console.error('Missing links in PayPal response:', json.data);
        throw new Error('Invalid PayPal response format.');
      }

      const approveLink = links.find((l: any) => l.rel === 'approve')?.href;
      if (!approveLink) {
        throw new Error('PayPal approval link not found.');
      }

      router.replace(approveLink);
    } catch (error) {
      console.error(error);
      alert('Unable to start payment. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user && user.email === adminEmail) {
      setIsAdmin(true);
    }
  }, [user]);

  const isProMember = userProfile?.is_subscribed || isAdmin;

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const userId = user.id;
    const supabase = getSupabaseClient();

    async function loadCreditReports() {
      setReportsLoading(true);
      setReportsError('');

      const { data, error } = await supabase
        .from('credit_reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!isMounted) return;

      if (error) {
        console.warn('[dashboard] credit report load failed:', error.message);
        setReportsError(
          'Credit report status is temporarily unavailable. Your uploads are still stored securely.'
        );
        setCreditReports([]);
      } else {
        setCreditReports((data || []) as DashboardCreditReport[]);
      }

      setReportsLoading(false);
    }

    loadCreditReports();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (!userProfile || paymentLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back!</h2>
          <p className="text-muted-foreground">
            Here's your financial command center.
          </p>
        </div>
        {isProMember && (
          <Badge
            variant="secondary"
            className="flex items-center gap-2 text-lg py-2 px-4 bg-green-100 text-green-800 border-green-200"
          >
            <ShieldCheck className="h-5 w-5" />
            <span>Pro Member</span>
          </Badge>
        )}
      </div>

      {!isProMember && (
        <Alert>
          <Rocket className="h-4 w-4" />
          <AlertTitle>Unlock Your Full Potential!</AlertTitle>
          <AlertDescription>
            Upgrade to Pro to access our full suite of AI-powered tools,
            including the Super Dispute Letter generator and personalized
            financial roadmaps.
          </AlertDescription>
          <div className="mt-4">
            <Button
              asChild
              className="cursor-pointer"
              onClick={handleCheckout}
              disabled={loading}
            >
              <a>
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                ) : (
                  <Star className="mr-2 h-4 w-4" />
                )}
                Upgrade to Pro - $75
              </a>
            </Button>
          </div>
        </Alert>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">
              Credit Repair Workflow
            </h3>
            <p className="text-sm text-muted-foreground">
              Track uploads, analysis status, and generated dispute outputs.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/credit-upload')}
            className="w-full sm:w-auto"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Report
          </Button>
        </div>

        {reportsLoading ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your recent credit reports...
            </CardContent>
          </Card>
        ) : reportsError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Report Status Unavailable</AlertTitle>
            <AlertDescription>{reportsError}</AlertDescription>
          </Alert>
        ) : creditReports.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {creditReports.map((report) => (
              <CreditReportStatusCard
                key={report.id}
                report={report}
                compact
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                No Credit Reports Yet
              </CardTitle>
              <CardDescription>
                Upload a report to start the credit analysis, dispute letter,
                and admin alert workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/credit-upload')}>
                <UploadCloud className="h-4 w-4" />
                Upload First Report
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <Tabs defaultValue="roadmap" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="credit-score">Credit Score</TabsTrigger>
          <TabsTrigger value="credit-cards" disabled={!isProMember}>
            Credit Cards
            {!isProMember && <Badge className="ml-2">Pro</Badge>}
          </TabsTrigger>
          <TabsTrigger value="side-hustles" disabled={!isProMember}>
            Side Hustles
            {!isProMember && <Badge className="ml-2">Pro</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="space-y-4">
          <InteractiveRoadmap />
        </TabsContent>
        <TabsContent value="credit-score">
          <CreditScoreTab />
        </TabsContent>
        <TabsContent value="credit-cards">
          {isProMember ? (
            <CreditCardsTab />
          ) : (
            <ProFeatureLock onClick={handleCheckout} disabled={loading} />
          )}
        </TabsContent>
        <TabsContent value="side-hustles">
          {isProMember ? (
            <SideHustlesTab />
          ) : (
            <ProFeatureLock onClick={handleCheckout} disabled={loading} />
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

const ProFeatureLock = ({ onClick, disabled }: any) => (
  <Card className="flex flex-col items-center justify-center p-8 text-center">
    <CardHeader>
      <CardTitle>
        <Star className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
        This is a Pro Feature
      </CardTitle>
      <CardDescription>
        Upgrade your account to access this powerful tool and much more.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button onClick={onClick} disabled={disabled}>
        <a>Upgrade to Pro</a>
      </Button>
    </CardContent>
  </Card>
);
