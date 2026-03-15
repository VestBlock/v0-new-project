'use client';

import { EnvDebug } from '@/components/env-debug';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';

export default function TestStreamingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [streamingText, setStreamingText] = useState('');
  const [simpleResponse, setSimpleResponse] = useState('');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const { toast } = useToast();

  const testOpenAIConnection = async () => {
    setIsLoading(true);
    setResult(null);
    setErrorDetails(null);
    try {
      const response = await fetch('/api/test-openai');
      const data = await response.json();
      setResult(data);
      if (data.success) {
        toast({
          title: 'Success!',
          description: 'OpenAI connection is working correctly.',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: data.error || 'Failed to connect to OpenAI.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Test failed:', error);
      setResult({
        success: false,
        error: 'Failed to test connection',
        details: error instanceof Error ? error.message : String(error),
      });
      toast({
        title: 'Error',
        description: 'Failed to test OpenAI connection.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ... other test functions remain the same ...
  const testSimpleChat = async () => {
    setIsLoading(true);
    setSimpleResponse('');
    setErrorDetails(null);
    try {
      const response = await fetch('/api/chat-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Tell me a short joke about programming.',
            },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${
            data.error || 'Unknown error'
          }`
        );
      }
      setSimpleResponse(data.content);
      toast({
        title: 'Success!',
        description: 'Simple chat API is working correctly.',
      });
    } catch (error) {
      console.error('Simple chat test failed:', error);
      setErrorDetails(error instanceof Error ? error.message : String(error));
      toast({
        title: 'Error',
        description: 'Failed to test simple chat API.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testChatStreaming = async () => {
    setIsLoading(true);
    setStreamingText('');
    setErrorDetails(null);
    try {
      const response = await fetch('/api/chat-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Tell me a short joke about programming.',
            },
          ],
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setStreamingText((prev) => prev + chunk);
        }
      }
      toast({
        title: 'Streaming Complete',
        description: 'Successfully received streaming response.',
      });
    } catch (error) {
      console.error('Chat streaming test failed:', error);
      setErrorDetails(error instanceof Error ? error.message : String(error));
      toast({
        title: 'Error',
        description: 'Failed to test chat streaming.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 gradient-text">
            API Testing Dashboard
          </h1>
          <Tabs defaultValue="connection" className="w-full">
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="connection">OpenAI Connection</TabsTrigger>
              <TabsTrigger value="simple">Simple Chat</TabsTrigger>
              <TabsTrigger value="streaming">Streaming Chat</TabsTrigger>
            </TabsList>
            <TabsContent value="connection">
              <Card className="p-6 bg-card/80 backdrop-blur">
                <h2 className="text-xl font-semibold mb-4">
                  OpenAI API Connection Test
                </h2>
                <p className="text-muted-foreground mb-4">
                  This test checks if your server-side OpenAI API key is
                  configured correctly and can connect to the API.
                </p>
                <Button
                  onClick={testOpenAIConnection}
                  disabled={isLoading}
                  className="mb-4"
                >
                  {isLoading ? 'Testing...' : 'Test Connection'}
                </Button>
                {result && (
                  <div
                    className={`p-4 rounded-lg ${
                      result.success
                        ? 'bg-green-500/20 border-green-500'
                        : 'bg-red-500/20 border-red-500'
                    } border`}
                  >
                    <p
                      className={
                        result.success ? 'text-green-400' : 'text-red-400'
                      }
                    >
                      {result.success
                        ? '✓ Server Connection Working'
                        : '✗ Server Connection Failed'}
                    </p>
                    {result.error && (
                      <p className="text-sm mt-2">Error: {result.error}</p>
                    )}
                  </div>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="simple">
              <Card className="p-6 bg-card/80 backdrop-blur">
                <h2 className="text-xl font-semibold mb-4">
                  Simple Chat API Test
                </h2>
                <p className="text-muted-foreground mb-4">
                  This test checks if the non-streaming chat API is working
                  correctly.
                </p>
                <Button
                  onClick={testSimpleChat}
                  disabled={isLoading}
                  className="mb-4"
                >
                  {isLoading ? 'Testing...' : 'Test Simple Chat API'}
                </Button>

                {simpleResponse && (
                  <div className="p-4 bg-green-500/20 border border-green-500 rounded-lg">
                    <p className="text-green-400 font-medium mb-2">
                      ✓ Simple Chat API Working
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="text-sm">{simpleResponse}</p>
                    </div>
                  </div>
                )}

                {errorDetails && (
                  <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg mt-4">
                    <p className="text-red-400 font-medium mb-2">
                      ✗ Error Details
                    </p>
                    <pre className="text-xs whitespace-pre-wrap bg-background/50 p-2 rounded">
                      {errorDetails}
                    </pre>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="streaming">
              <Card className="p-6 bg-card/80 backdrop-blur">
                <h2 className="text-xl font-semibold mb-4">
                  Streaming Chat API Test
                </h2>
                <p className="text-muted-foreground mb-4">
                  This test checks if the streaming chat API is working
                  correctly.
                </p>
                <Button
                  onClick={testChatStreaming}
                  disabled={isLoading}
                  className="mb-4"
                >
                  {isLoading ? 'Testing...' : 'Test Streaming Chat API'}
                </Button>

                {streamingText && (
                  <div className="p-4 bg-green-500/20 border border-green-500 rounded-lg">
                    <p className="text-green-400 font-medium mb-2">
                      ✓ Streaming Response
                    </p>
                    <div className="bg-muted p-3 rounded">
                      <p className="text-sm">{streamingText}</p>
                    </div>
                  </div>
                )}

                {errorDetails && (
                  <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg mt-4">
                    <p className="text-red-400 font-medium mb-2">
                      ✗ Error Details
                    </p>
                    <pre className="text-xs whitespace-pre-wrap bg-background/50 p-2 rounded">
                      {errorDetails}
                    </pre>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
          <EnvDebug />
        </div>
      </main>
    </div>
  );
}
