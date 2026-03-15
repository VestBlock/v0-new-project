'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function TestOpenAISimplePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    model?: string;
  } | null>(null);

  const testConnection = async () => {
    try {
      setIsLoading(true);
      setResult(null);

      const response = await fetch('/api/test-openai-simple');
      const data = await response.json();

      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-32">
        <h1 className="text-3xl font-bold mb-8">Simple OpenAI API Test</h1>

        <Card className="p-6 max-w-md mx-auto">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              This test makes a simple request to the OpenAI API to verify
              connectivity.
            </p>

            <Button
              onClick={testConnection}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test OpenAI Connection'
              )}
            </Button>

            {result && (
              <div
                className={`p-4 rounded-lg ${
                  result.success ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <p
                    className={`font-medium ${
                      result.success ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {result.success
                      ? 'Connection Successful'
                      : 'Connection Failed'}
                  </p>
                </div>

                {result.success ? (
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium">Response:</span>{' '}
                      {result.message}
                    </p>
                    <p>
                      <span className="font-medium">Model:</span> {result.model}
                    </p>
                  </div>
                ) : (
                  <p className="text-red-500">{result.error}</p>
                )}
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
