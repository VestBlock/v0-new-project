'use client';

import { ChatInterface } from '@/components/chat-interface';
import type { FinancialGoal } from '@/components/financial-goals-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useChat } from 'ai/react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface UserProfileData {
  credit_score: number | null;
  financial_goal: FinancialGoal | null;
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const supabase = getSupabaseClient();

  const [userProfileData, setUserProfileData] =
    useState<UserProfileData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Context from URL params
  const contextType = searchParams.get('context');
  const contextTitle = searchParams.get('title');
  const contextDescription = searchParams.get('description');
  // Add more params if needed, e.g., for roadmap sub-steps

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && !user) {
      router.push('/login?redirect=/chat'); // Keep existing redirect logic
      return;
    }

    const fetchUserProfile = async () => {
      if (!user) {
        setInitialLoading(false);
        return;
      }
      try {
        setProfileError(null);
        const { data, error } = await supabase
          .from('user_profiles')
          .select('credit_score, financial_goal')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        setUserProfileData(data as UserProfileData); // Can be null if no profile
      } catch (err: any) {
        console.error('Error fetching user profile for chat:', err);
        setProfileError(
          err.message || 'Could not load your profile data for the chat.'
        );
      } finally {
        setInitialLoading(false);
      }
    };

    if (user) {
      fetchUserProfile();
    } else if (!authLoading) {
      setInitialLoading(false);
    }
  }, [user, authLoading, isAuthenticated, supabase, router]);

  const initialMessages = [];
  if (contextType && contextTitle) {
    let prompt = `Let's talk about my ${contextType}: "${contextTitle}".`;
    if (contextDescription) {
      prompt += ` Description: "${contextDescription}". What should I know or do about this?`;
    }
    initialMessages.push({
      id: 'context-prompt',
      role: 'user' as const,
      content: prompt,
    });
  }

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: '/api/chat',
    initialMessages: initialMessages,
    body: {
      // This body is merged with the messages array on submit
      creditScore: userProfileData?.credit_score,
      financialGoal: userProfileData?.financial_goal,
      // currentTab: "ChatPage", // Example of additional context
    },
    onError: (err) => {
      console.error('Chat API error:', err);
      // Toast can be handled globally or here
    },
    onFinish: () => {
      // Optional: Clear URL params after initial context message is sent
      if (contextType) {
        // router.replace('/chat', { scroll: false }); // Next 13 App Router way
        window.history.replaceState({}, '', '/chat'); // Simpler for now
      }
    },
  });

  // If initial messages were set and now messages array has more, it means AI responded.
  // We can clear context params from URL to avoid re-triggering if user refreshes.
  // This is handled by onFinish now.

  if (initialLoading || authLoading) {
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
          <p>Please log in to use the AI Chat.</p>
          <Button
            onClick={() => router.push('/login?redirect=/chat')}
            className="mt-4"
          >
            Go to Login
          </Button>
        </main>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 container mx-auto">
          <Card className="p-6 bg-destructive/10 border-destructive text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-destructive">
              Profile Error
            </h2>
            <p className="mb-4">{profileError}</p>
            <Button onClick={() => router.push('/profile')}>
              Go to Profile
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  if (!userProfileData && !initialLoading) {
    // Profile doesn't exist after loading
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 container mx-auto">
          <Card className="p-6 bg-card/80 backdrop-blur text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
            <p className="mb-4 text-muted-foreground">
              We couldn't find your profile. Please set up your profile to use
              the AI chat.
            </p>
            <Button onClick={() => router.push('/profile')}>
              Set Up Profile
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="pt-16 flex-grow flex flex-col overflow-hidden">
        <div className="container mx-auto max-w-3xl flex-grow flex flex-col h-[calc(100vh-4rem)]">
          {' '}
          {/* Adjust height based on nav */}
          <Card className="flex-grow flex flex-col my-4 md:my-6 shadow-xl bg-card/90 backdrop-blur-sm">
            <CardHeader className="border-b">
              <CardTitle className="gradient-text text-xl">
                VestBot AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow p-0 overflow-hidden">
              <ChatInterface
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                error={error}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
