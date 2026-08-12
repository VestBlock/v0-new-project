'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

export interface VestBlockChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date | string;
}

interface UseVestBlockChatOptions {
  id: string;
  api?: string;
  initialMessages?: VestBlockChatMessage[];
  body?: Record<string, unknown>;
  onResponse?: (response: Response) => void | Promise<void>;
  onFinish?: (message: VestBlockChatMessage) => void | Promise<void>;
  onError?: (error: Error) => void;
}

function createMessageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function readError(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string') return payload.error;
  } catch {
    // The response is not JSON, so fall through to the status message.
  }

  return `Chat request failed (${response.status}).`;
}

export function useVestBlockChat({
  id,
  api = '/api/chat',
  initialMessages = [],
  body = {},
  onResponse,
  onFinish,
  onError,
}: UseVestBlockChatOptions) {
  const [messages, setMessages] = useState<VestBlockChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const messagesRef = useRef(messages);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  }, []);

  const handleSubmit = useCallback(
    async (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();

      const content = input.trim();
      if (!content || isLoading) return;

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      const userMessage: VestBlockChatMessage = {
        id: createMessageId('user'),
        role: 'user',
        content,
        createdAt: new Date(),
      };
      const outboundMessages = [...messagesRef.current, userMessage];

      setMessages(outboundMessages);
      setInput('');
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(api, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, messages: outboundMessages, ...body }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        await onResponse?.(response);

        if (!response.body) {
          throw new Error('The chat response did not include a readable stream.');
        }

        const assistantId = createMessageId('assistant');
        const assistantMessage: VestBlockChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
        };

        setMessages((current) => [...current, assistantMessage]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          assistantContent += decoder.decode(value, { stream: true });
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: assistantContent }
                : message,
            ),
          );
        }

        assistantContent += decoder.decode();
        const completedMessage = { ...assistantMessage, content: assistantContent };
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? completedMessage : message,
          ),
        );
        await onFinish?.(completedMessage);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;

        const nextError = caught instanceof Error ? caught : new Error('Chat request failed.');
        setError(nextError);
        onError?.(nextError);
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [api, body, id, input, isLoading, onError, onFinish, onResponse],
  );

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    setInput,
  };
}
