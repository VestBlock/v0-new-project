'use client';

import type { FinancialGoal } from '@/components/financial-goals-selector';
import type { RoadmapStep } from '@/components/interactive-roadmap';
import { InteractiveRoadmap } from '@/components/interactive-roadmap'; // Corrected: Named import
import { PremadeRoadmapGenerator } from '@/components/premade-roadmap-generator';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { AlertTriangle, Loader2, Target, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface UserProfileData {
  credit_score: number | null;
  financial_goal: FinancialGoal | null;
}

interface UserRoadmap {
  id: string;
  user_id: string;
  financial_goal_id?: string;
  roadmap_data: { steps: RoadmapStep[] };
  created_at: string;
}

export default function RoadmapPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapStep[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('premade');
  const [chatQuery, setChatQuery] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && !user) {
      router.push('/login?redirect=/roadmap');
      return;
    }

    const fetchData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Fetch User Profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('credit_score, financial_goal')
          .eq('id', user.id) // Corrected: query by 'id' which is user_id
          .single();

        if (profileError && profileError.code !== 'PGRST116')
          throw profileError;
        if (!profileData) {
          setError('Profile not found. Please complete your profile first.');
          setIsLoading(false);
          return;
        }
        setUserProfile(profileData as UserProfileData);

        // Fetch Existing Roadmap
        const { data: roadmapData, error: roadmapError } = await supabase
          .from('user_roadmaps')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (roadmapError && roadmapError.code !== 'PGRST116')
          throw roadmapError;
        if (roadmapData) {
          setRoadmap(roadmapData.roadmap_data.steps as RoadmapStep[]);
        } else {
          setRoadmap([]);
        }
      } catch (err: any) {
        console.error('Error fetching roadmap data:', err);
        setError(err.message || 'Failed to load roadmap information.');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) fetchData();
    else if (!authLoading) setIsLoading(false);
  }, [user, authLoading, isAuthenticated, supabase, router]);

  const handleGenerateRoadmap = async () => {
    if (!userProfile || !userProfile.financial_goal) {
      setError(
        'Please select a financial goal in your profile before generating a roadmap.'
      );
      return;
    }

    if (!userProfile.credit_score) {
      setError(
        'Please add your credit score in your profile before generating a roadmap.'
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch('/api/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditScore: userProfile.credit_score,
          financialGoal: userProfile.financial_goal,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate roadmap.');
      }
      const newRoadmap = await response.json();
      setRoadmap(newRoadmap.roadmap_data.steps as RoadmapStep[]);
      setActiveTab('custom');
    } catch (err: any) {
      console.error('Error generating roadmap:', err);
      setError(
        err.message ||
          'An unexpected error occurred while generating the roadmap.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAskAboutStep = (step: RoadmapStep) => {
    setChatQuery(
      `Tell me more about this step: "${step.title}". What are the best strategies to accomplish this?`
    );
    setIsChatOpen(true);
    console.log('Asking about step:', step.title);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
        </main>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 text-center">
          <p>Please log in to view your roadmap.</p>
          <Button
            onClick={() => router.push('/login?redirect=/roadmap')}
            className="mt-4"
          >
            Go to Login
          </Button>
        </main>
      </div>
    );
  }

  if (error && !isGenerating) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 container mx-auto">
          <Card className="p-6 bg-destructive/10 border-destructive text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-destructive">
              Roadmap Error
            </h2>
            <p className="mb-4">{error}</p>
            {error.includes('Profile not found') ||
            error.includes('financial goal') ||
            error.includes('credit score') ? (
              <Button onClick={() => router.push('/profile')}>
                Go to Profile
              </Button>
            ) : (
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            )}
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 md:pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-4">
              Your Financial Roadmap
            </h1>
            <p className="text-muted-foreground text-lg">
              Choose from proven roadmaps or generate a custom plan based on
              your profile
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="premade" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Premade Roadmaps
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Custom Roadmap
              </TabsTrigger>
            </TabsList>

            <TabsContent value="premade" className="mt-6">
              <PremadeRoadmapGenerator
                onRoadmapSelect={(roadmap) =>
                  console.log('Selected roadmap:', roadmap)
                }
              />
            </TabsContent>

            <TabsContent value="custom" className="mt-6">
              <div className="space-y-6">
                {userProfile?.financial_goal && (
                  <Card className="bg-card/80 backdrop-blur">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            Your Goal: {userProfile.financial_goal.title}
                          </CardTitle>
                          <CardDescription>
                            {userProfile.financial_goal.description}
                          </CardDescription>
                        </div>
                        {!roadmap && userProfile?.credit_score && (
                          <Button
                            onClick={handleGenerateRoadmap}
                            disabled={isGenerating}
                            className="bg-cyan-500 hover:bg-cyan-600"
                          >
                            {isGenerating ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Target className="mr-2 h-4 w-4" />
                            )}
                            {isGenerating
                              ? 'Generating...'
                              : 'Generate Custom Roadmap'}
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                )}

                {isGenerating && (
                  <Card className="p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Generating your personalized roadmap... This may take a
                      moment.
                    </p>
                  </Card>
                )}

                {error && isGenerating && (
                  <Card className="p-4 bg-destructive/10 border-destructive text-center my-4">
                    <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive">{error}</p>
                  </Card>
                )}

                {!isGenerating && roadmap && roadmap.length > 0 ? (
                  <Card className="bg-card/80 backdrop-blur">
                    <CardHeader>
                      <CardTitle>Your Custom Roadmap Steps</CardTitle>
                      <CardDescription>
                        Follow these personalized steps. Click on any step to
                        discuss it with VestBot AI.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <InteractiveRoadmap
                        roadmapSteps={roadmap}
                        onAskAboutStep={handleAskAboutStep}
                      />
                    </CardContent>
                  </Card>
                ) : (
                  !isGenerating &&
                  !error && (
                    <Card className="p-8 text-center bg-card/80 backdrop-blur">
                      <Target className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                      <h2 className="text-xl font-semibold mb-2">
                        Ready for Your Custom Roadmap?
                      </h2>
                      {!userProfile?.financial_goal ? (
                        <p className="text-muted-foreground mb-4">
                          Please select a financial goal in your profile first.
                        </p>
                      ) : !userProfile?.credit_score ? (
                        <p className="text-muted-foreground mb-4">
                          Please add your credit score in your profile first.
                        </p>
                      ) : (
                        <p className="text-muted-foreground mb-4">
                          Click the button above to generate your personalized
                          steps.
                        </p>
                      )}

                      {(!userProfile?.financial_goal ||
                        !userProfile?.credit_score) && (
                        <Button onClick={() => router.push('/profile')}>
                          Go to Profile
                        </Button>
                      )}
                    </Card>
                  )
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
