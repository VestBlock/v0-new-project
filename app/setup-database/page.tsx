'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Database, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function SetupDatabasePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    output?: string;
  } | null>(null);

  const setupDatabase = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/setup-database');
      const data = await response.json();

      if (data.error) {
        setResult({
          success: false,
          message: data.error,
          output: data.output,
        });
      } else {
        setResult({
          success: true,
          message: 'Database setup completed successfully!',
          output: data.output,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: `Failed to setup database: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-2">
              Database Setup
            </h1>
            <p className="text-muted-foreground">
              Create the necessary database tables and storage buckets for
              VestBlock.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Setup Supabase Database</CardTitle>
              <CardDescription>
                This will create all required tables, security policies, and
                storage buckets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium flex items-center">
                    <Database className="h-5 w-5 mr-2 text-cyan-500" />
                    Tables to be created:
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• user_profiles - User information and preferences</li>
                    <li>• chat_history - AI chat conversation history</li>
                    <li>• user_documents - Uploaded document metadata</li>
                    <li>• credit_reports - Credit report analysis results</li>
                    <li>• dispute_letters - Generated dispute letters</li>
                  </ul>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium flex items-center">
                    <Database className="h-5 w-5 mr-2 text-cyan-500" />
                    Storage buckets to be created:
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>
                      • credit-reports - For storing uploaded credit reports
                    </li>
                    <li>
                      • dispute-letters - For storing generated dispute letters
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={setupDatabase}
                disabled={loading}
                className="bg-cyan-500 hover:bg-cyan-600 w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Setting up database...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Create Database Tables
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {result && (
            <div className="mt-6">
              <Alert variant={result.success ? 'default' : 'destructive'}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>{result.success ? 'Success' : 'Error'}</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>

              {result.output && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Setup Output</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm whitespace-pre-wrap">
                      {result.output}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
