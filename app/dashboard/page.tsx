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
import { Rocket, ShieldCheck, Star, Loader2 } from 'lucide-react';
import { InteractiveRoadmap } from '@/components/interactive-roadmap';
import { CreditCardsTab } from '@/components/credit-cards-tab';
import { SideHustlesTab } from '@/components/side-hustles-tab';
import { CreditScoreTab } from '@/components/credit-score-tab';
import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardPage() {
  const { user, userProfile, fetchUserProfile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const params = useSearchParams();
  const token = params.get('token');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  console.debug('🚀 ~ DashboardPage ~ token:', token);

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
      console.debug('🚀 ~ DashboardPage ~ user:', user?.id);
      const res = await fetch('/api/create-order', {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.id,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.debug('🚀 ~ PricingSection ~ res:', res);
      if (!res.ok) {
        const errText = await res.text();
        console.error('Create-order failed:', errText);
        throw new Error('Unable to initiate payment.');
      }

      const json = await res.json();
      console.log('PayPal create response:', json);

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
      console.log('Approve link:', approveLink);
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
