import { NextRequest, NextResponse } from 'next/server';
import { upsertChatConversation, type StoredChatMessage } from '@/lib/chat/history';
import { chatRequestSchema } from '@/lib/chat/schemas';
import { getOpenAIClient } from '@/lib/openai-server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { captureServerEvent } from '@/lib/analytics/server';
import { analyticsEvents } from '@/lib/analytics/events';
import { getChatAssistant } from '@/lib/chat/assistants';

export const runtime = 'nodejs';

function buildSystemPrompt(input: {
  assistantType?: string;
  context?: string;
  creditScore?: number | null;
  financialGoal?: { title: string; customDetails?: string } | null;
}) {
  const assistant = getChatAssistant(input.assistantType);
  const parts = [
    assistant.systemPrompt,
    `Keep responses clear, useful, and realistic. Do not make guarantees. When the topic touches funding, credit, legal, or compliance-sensitive decisions, stay careful and factual.`,
    `Favor actionable next steps, simple prioritization, and concise explanations over generic encouragement.`,
  ];

  if (typeof input.creditScore === 'number') {
    parts.push(`The user's current credit score is ${input.creditScore}. Tailor advice to that starting point when relevant.`);
  }

  if (input.financialGoal?.title) {
    parts.push(`The user's primary financial goal is: ${input.financialGoal.title}.`);
    if (input.financialGoal.customDetails) {
      parts.push(`Additional goal context: ${input.financialGoal.customDetails}`);
    }
  }

  if (input.context) {
    parts.push(`Extra context for this conversation: ${input.context}`);
  }

  return parts.join('\n\n');
}

function normalizeMessages(messages: Array<{ id?: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt?: string | Date }>): StoredChatMessage[] {
  return messages
    .filter((message) => ['user', 'assistant', 'system'].includes(message.role) && message.content.trim().length > 0)
    .map((message, index) => ({
      id: message.id || `message-${index}`,
      role: message.role,
      content: message.content.trim(),
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : typeof message.createdAt === 'string'
            ? message.createdAt
            : new Date().toISOString(),
    }));
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = chatRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid chat request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id, messages, context, creditScore, financialGoal, assistantType } = parsed.data;
    const chatId = id || crypto.randomUUID();
    const normalizedMessages = normalizeMessages(messages).filter((message) => message.role !== 'system');

    if (normalizedMessages.length === 0) {
      return NextResponse.json({ error: 'At least one user or assistant message is required.' }, { status: 400 });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 });
    }

    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt({
            assistantType,
            context,
            creditScore,
            financialGoal,
          }),
        },
        ...normalizedMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    });

    const encoder = new TextEncoder();
    let assistantResponse = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (!text) continue;
            assistantResponse += text;
            controller.enqueue(encoder.encode(text));
          }

          if (user && assistantResponse.trim()) {
            const storedMessages = [
              ...normalizedMessages,
              {
                id: `${chatId}-assistant`,
                role: 'assistant' as const,
                content: assistantResponse.trim(),
                createdAt: new Date().toISOString(),
              },
            ];

            await upsertChatConversation({
              chatId,
              userId: user.id,
      assistantType: assistantType || 'vestbot',
      messages: storedMessages,
    });

            void captureServerEvent({
              distinctId: user.id,
              event: analyticsEvents.chatMessageSubmitted,
              properties: {
                chatId,
                assistantType: assistantType || 'vestbot',
                messageCount: normalizedMessages.length,
                hasContext: Boolean(context),
                hasFinancialGoal: Boolean(financialGoal?.title),
                sourcePath: '/chat',
              },
            });
          }
        } catch (error) {
          controller.error(error);
          return;
        }

        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-VestBlock-Chat-Id': chatId,
      },
    });
  } catch (error: any) {
    console.error('[api/chat] error:', error);

    if (error?.error?.type === 'insufficient_quota') {
      return NextResponse.json({ error: 'API quota exceeded. Please try again later.' }, { status: 429 });
    }

    if (error?.error?.type === 'invalid_api_key') {
      return NextResponse.json({ error: 'API configuration error. Please contact support.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error?.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'VestBlock chat API is running.',
      supportsPersistence: true,
      historyRoute: '/api/chat/history',
    },
    { status: 200 },
  );
}
