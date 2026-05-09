'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ChatInterface } from '@/components/chat-interface';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useChat } from '@ai-sdk/react';
import { AlertTriangle, Loader2, MessageSquarePlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FinancialGoal } from '@/components/financial-goals-selector';
import { chatAssistantList, getChatAssistant, type ChatAssistantType } from '@/lib/chat/assistants';

interface UserProfileData {
  credit_score: number | null;
  financial_goal: FinancialGoal | null;
}

interface ChatHistorySummary {
  id: string;
  title: string;
  assistantType: string;
  updatedAt: string;
  createdAt: string;
  preview: string;
  messageCount: number;
}

interface StoredConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
}

function createChatId() {
  return crypto.randomUUID();
}

function formatRelativeChatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const supabase = getSupabaseClient();

  const [userProfileData, setUserProfileData] = useState<UserProfileData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<ChatHistorySummary[]>([]);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState(() => searchParams.get('chat') || createChatId());

  const contextType = searchParams.get('context');
  const contextTitle = searchParams.get('title');
  const contextDescription = searchParams.get('description');
  const selectedChatId = searchParams.get('chat');
  const selectedAssistantType = (searchParams.get('assistant') as ChatAssistantType | null) || 'vestbot';
  const assistant = getChatAssistant(selectedAssistantType);

  const initialMessages = useMemo(() => {
    if (!contextType || !contextTitle || selectedChatId) return [];

    let prompt = `Let's talk about my ${contextType}: "${contextTitle}".`;
    if (contextDescription) {
      prompt += ` Description: "${contextDescription}". What should I know or do about this?`;
    }

    return [
      {
        id: 'context-prompt',
        role: 'user' as const,
        content: prompt,
      },
    ];
  }, [contextType, contextTitle, contextDescription, selectedChatId]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    setInput,
  } = useChat({
    id: chatSessionId,
    api: '/api/chat',
    streamProtocol: 'text',
    initialMessages,
    body: {
      creditScore: userProfileData?.credit_score,
      financialGoal: userProfileData?.financial_goal,
      assistantType: selectedAssistantType,
    },
    onResponse: async () => {
      await refreshHistory();
    },
    onFinish: async () => {
      if (contextType && !selectedChatId) {
        window.history.replaceState(
          {},
          '',
          `/chat?chat=${chatSessionId}&assistant=${selectedAssistantType}`
        );
      }
      await refreshHistory();
    },
    onError: (err) => {
      console.error('Chat API error:', err);
    },
  });

  const refreshHistory = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      setHistoryError(null);
      const response = await fetch('/api/chat/history', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to load conversation history.');
      }

      const data = await response.json();
      setHistoryItems(data.conversations || []);
    } catch (err: any) {
      console.error('Failed to refresh chat history:', err);
      setHistoryError(err.message || 'Failed to load conversation history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [isAuthenticated, user]);

  async function loadConversation(id: string) {
    try {
      setLoadingConversationId(id);
      setHistoryError(null);

      const response = await fetch(`/api/chat/history/${id}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to load the selected conversation.');
      }

      const data = await response.json();
      const nextMessages = (data.conversation?.messages || []).map((message: StoredConversationMessage) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      }));

      setChatSessionId(id);
      setMessages(nextMessages);
      setInput('');
      router.replace(`/chat?chat=${id}&assistant=${data.conversation?.assistantType || 'vestbot'}`);
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      setHistoryError(err.message || 'Failed to load the selected conversation.');
    } finally {
      setLoadingConversationId(null);
    }
  }

  function startNewConversation(nextAssistantType: ChatAssistantType = selectedAssistantType) {
    const nextChatId = createChatId();
    setChatSessionId(nextChatId);
    setMessages([]);
    setInput('');
    router.replace(`/chat?assistant=${nextAssistantType}`);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && !user) {
      router.push('/login?redirect=/chat');
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
        setUserProfileData(data as UserProfileData);
      } catch (err: any) {
        console.error('Error fetching user profile for chat:', err);
        setProfileError(err.message || 'Could not load your profile data for the chat.');
      } finally {
        setInitialLoading(false);
      }
    };

    if (user) {
      fetchUserProfile();
      refreshHistory();
    } else if (!authLoading) {
      setInitialLoading(false);
    }
  }, [user, authLoading, isAuthenticated, supabase, router, refreshHistory]);

  useEffect(() => {
    if (!selectedChatId) {
      if (!contextType) {
        setChatSessionId((current) => current || createChatId());
      }
      return;
    }

    if (selectedChatId === chatSessionId && messages.length > 0) return;
    loadConversation(selectedChatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId]);

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
          <Button onClick={() => router.push('/login?redirect=/chat')} className="mt-4">
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
            <h2 className="text-xl font-bold mb-2 text-destructive">Profile Error</h2>
            <p className="mb-4">{profileError}</p>
            <Button onClick={() => router.push('/profile')}>Go to Profile</Button>
          </Card>
        </main>
      </div>
    );
  }

  if (!userProfileData && !initialLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 container mx-auto">
          <Card className="p-6 bg-card/80 backdrop-blur text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
            <p className="mb-4 text-muted-foreground">
              We couldn't find your profile. Please set up your profile to use the AI chat.
            </p>
            <Button onClick={() => router.push('/profile')}>Set Up Profile</Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="pt-16 flex-grow px-4 pb-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <Card className="bg-card/90 backdrop-blur-sm lg:sticky lg:top-20 h-fit">
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Saved Chats</CardTitle>
                    <CardDescription>Keep financial and product conversations organized.</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startNewConversation()}>
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    New
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading chats...
                  </div>
                ) : historyItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Your saved VestBot conversations will show up here after your first chat.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyItems.map((conversation) => {
                      const isActive = conversation.id === chatSessionId;
                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => loadConversation(conversation.id)}
                          className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                            isActive
                              ? 'border-cyan-500 bg-cyan-50/80'
                              : 'border-border hover:border-cyan-300 hover:bg-muted/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{conversation.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {conversation.preview}
                              </p>
                            </div>
                            {loadingConversationId === conversation.id ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-500" />
                            ) : null}
                          </div>
                          <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            {conversation.assistantType.replace(/_/g, ' ')} · {conversation.messageCount} messages · {formatRelativeChatTime(conversation.updatedAt)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {historyError ? <p className="mt-3 text-xs text-destructive">{historyError}</p> : null}
              </CardContent>
            </Card>

            <Card className="min-h-[700px] flex flex-col shadow-xl bg-card/90 backdrop-blur-sm">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="gradient-text text-xl">{assistant.label}</CardTitle>
                  <Badge variant="outline">{assistant.badge}</Badge>
                </div>
                <CardDescription>
                  {assistant.summary}
                </CardDescription>
                <div className="flex flex-wrap gap-2 pt-2">
                  {chatAssistantList.map((option) => (
                    <Button
                      key={option.key}
                      type="button"
                      size="sm"
                      variant={option.key === selectedAssistantType ? 'default' : 'outline'}
                      onClick={() => startNewConversation(option.key)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
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
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <p className="ml-3 text-sm text-muted-foreground">
            Loading your conversations...
          </p>
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
