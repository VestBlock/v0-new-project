import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/supabase';

export type StoredChatMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
};

export type ChatConversationSummary = {
  id: string;
  title: string;
  assistantType: string;
  updatedAt: string;
  createdAt: string;
  preview: string;
  messageCount: number;
};

function normalizeStoredMessage(message: unknown, index: number): StoredChatMessage | null {
  if (!message || typeof message !== 'object') return null;

  const role = String((message as { role?: unknown }).role || '');
  const content = String((message as { content?: unknown }).content || '').trim();
  if (!content || !['user', 'assistant', 'system'].includes(role)) return null;

  const rawCreatedAt = (message as { createdAt?: unknown }).createdAt;
  const createdAt =
    rawCreatedAt instanceof Date
      ? rawCreatedAt.toISOString()
      : typeof rawCreatedAt === 'string'
        ? rawCreatedAt
        : undefined;

  return {
    id: String((message as { id?: unknown }).id || `message-${index}`),
    role: role as StoredChatMessage['role'],
    content,
    createdAt,
  };
}

export function normalizeStoredMessages(messages: unknown): StoredChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message, index) => normalizeStoredMessage(message, index))
    .filter((message): message is StoredChatMessage => Boolean(message));
}

export function buildChatTitle(messages: StoredChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) return 'New VestBot conversation';

  const cleaned = firstUserMessage.content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New VestBot conversation';
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned;
}

export async function upsertChatConversation(input: {
  chatId: string;
  userId: string;
  assistantType?: string;
  messages: StoredChatMessage[];
}) {
  const admin = createAdminClient();
  const title = buildChatTitle(input.messages);

  const payload = {
    id: input.chatId,
    user_id: input.userId,
    title,
    assistant_type: input.assistantType || 'vestbot',
    messages: input.messages as unknown as Json,
  };

  const { data, error } = await admin
    .from('chat_history')
    .upsert(payload, { onConflict: 'id' })
    .select('id, user_id, title, assistant_type, messages, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listChatConversations(userId: string): Promise<ChatConversationSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('chat_history')
    .select('id, title, assistant_type, messages, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => {
    const messages = normalizeStoredMessages(row.messages);
    const previewSource =
      messages.find((message) => message.role === 'assistant') ||
      messages.find((message) => message.role === 'user');

    return {
      id: row.id,
      title: row.title || buildChatTitle(messages),
      assistantType: row.assistant_type || 'vestbot',
      updatedAt: row.updated_at || row.created_at,
      createdAt: row.created_at,
      preview: previewSource?.content || 'Conversation saved',
      messageCount: messages.length,
    };
  });
}

export async function getChatConversation(userId: string, chatId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('chat_history')
    .select('id, title, assistant_type, messages, created_at, updated_at')
    .eq('user_id', userId)
    .eq('id', chatId)
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    title: data.title || 'VestBot conversation',
    assistantType: data.assistant_type || 'vestbot',
    createdAt: data.created_at,
    updatedAt: data.updated_at || data.created_at,
    messages: normalizeStoredMessages(data.messages),
  };
}
