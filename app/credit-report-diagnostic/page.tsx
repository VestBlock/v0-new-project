'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  ArrowRight,
  Bug,
  CheckCircle,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface StepResult {
  success: boolean;
  data?: any;
  error?: string;
  time?: number;
}

interface DiagnosticStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  result?: StepResult;
}

export default function CreditReportDiagnosticPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<DiagnosticStep[]>([
    { id: 'file-selection', name: 'File Selection', status: 'pending' },
    { id: 'file-reading', name: 'File Content Reading', status: 'pending' },
    { id: 'content-validation', name: 'Content Validation', status: 'pending' },
    { id: 'api-connection', name: 'API Connection Test', status: 'pending' },
    { id: 'api-request', name: 'API Request', status: 'pending' },
    { id: 'response-parsing', name: 'Response Parsing', status: 'pending' },
    { id: 'data-extraction', name: 'Data Extraction', status: 'pending' },
  ]);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [networkStatus, setNetworkStatus] = useState<{
    online: boolean;
    latency: number | null;
  }>({
    online: true,
    latency: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Check network status
  useEffect(() => {
    const checkNetwork = async () => {
      const startTime = Date.now();
      try {
        const response = await fetch('/api/test-openai-connection', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        const latency = Date.now() - startTime;
        setNetworkStatus({
          online: true,
          latency,
        });
      } catch (error) {
        setNetworkStatus({
          online: false,
          latency: null,
        });
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const updateStep = (stepId: string, update: Partial<DiagnosticStep>) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === stepId ? { ...step, ...update } : step
      )
    );
  };

  const resetSteps = () => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => ({
        ...step,
        status: 'pending',
        result: undefined,
      }))
    );
    setFinalResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      resetSteps();
      updateStep('file-selection', {
        status: 'success',
        result: {
          success: true,
          data: {
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
          },
        },
      });
    }
  };

  const testApiConnection = async (): Promise<boolean> => {
    updateStep('api-connection', { status: 'running' });
    try {
      const startTime = Date.now();
      const response = await fetch('/api/test-openai-connection');
      const endTime = Date.now();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API connection test failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          `OpenAI connection failed: ${data.error || 'Unknown error'}`
        );
      }

      updateStep('api-connection', {
        status: 'success',
        result: {
          success: true,
          time: endTime - startTime,
          data: {
            model: data.model,
            message: data.message,
            status: response.status,
          },
        },
      });
      return true;
    } catch (error) {
      updateStep('api-connection', {
        status: 'error',
        result: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return false;
    }
  };

  const runDiagnostic = async () => {
    if (!file) return;

    setIsRunning(true);
    setFinalResult(null);
    resetSteps();

    try {
      // Step 1: File Reading
      updateStep('file-reading', { status: 'running' });
      let content: string;
      try {
        const startTime = Date.now();
        content = await file.text();
        const endTime = Date.now();

        setFileContent(content);

        updateStep('file-reading', {
          status: 'success',
          result: {
            success: true,
            time: endTime - startTime,
            data: {
              length: content.length,
              preview: content.substring(0, 100) + '...',
            },
          },
        });
      } catch (error) {
        updateStep('file-reading', {
          status: 'error',
          result: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw new Error('Failed to read file content');
      }

      // Step 2: Content Validation
      updateStep('content-validation', { status: 'running' });
      try {
        const startTime = Date.now();

        // Basic validation
        if (!content || content.trim().length === 0) {
          throw new Error('File content is empty');
        }

        // Check if content looks like a credit report
        const creditReportIndicators = [
          'credit score',
          'fico',
          'equifax',
          'experian',
          'transunion',
          'account',
          'balance',
          'payment',
          'history',
          'inquiry',
          'late',
          'collection',
        ];

        const contentLower = content.toLowerCase();
        const foundIndicators = creditReportIndicators.filter((indicator) =>
          contentLower.includes(indicator)
        );

        const endTime = Date.now();

        updateStep('content-validation', {
          status: 'success',
          result: {
            success: true,
            time: endTime - startTime,
            data: {
              validContent: content.length > 0,
              possibleCreditReport: foundIndicators.length >= 2,
              foundIndicators,
              contentSample: content.substring(0, 200) + '...',
            },
          },
        });
      } catch (error) {
        updateStep('content-validation', {
          status: 'error',
          result: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw new Error('Content validation failed');
      }

      // Step 3: Test API Connection
      const apiConnectionSuccess = await testApiConnection();
      if (!apiConnectionSuccess) {
        throw new Error('API connection test failed');
      }

      // Step 4: API Request
      updateStep('api-request', { status: 'running' });
      let response;
      try {
        const startTime = Date.now();

        // Create a new FormData instance
        const formData = new FormData();

        // Append the file with the correct field name
        formData.append('file', file);

        // Log what we're sending
        console.log('Sending file:', {
          name: file.name,
          type: file.type,
          size: file.size,
        });

        // Make the fetch request with proper error handling
        try {
          response = await fetch('/api/analyze-document', {
            method: 'POST',
            body: formData,
          });
        } catch (fetchError) {
          console.error('Fetch error:', fetchError);
          throw new Error(
            `Network error: ${
              fetchError instanceof Error
                ? fetchError.message
                : String(fetchError)
            }`
          );
        }

        // Check if the response is ok
        if (!response.ok) {
          let errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage += ` - ${
              errorData.error || errorData.message || JSON.stringify(errorData)
            }`;
          } catch (e) {
            // If we can't parse the error as JSON, try to get the text
            try {
              const errorText = await response.text();
              errorMessage += ` - ${errorText}`;
            } catch (e2) {
              // If we can't get the text either, just use the status
              errorMessage += ' (could not parse error details)';
            }
          }
          throw new Error(errorMessage);
        }

        const endTime = Date.now();

        updateStep('api-request', {
          status: 'success',
          result: {
            success: true,
            time: endTime - startTime,
            data: {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
            },
          },
        });
      } catch (error) {
        updateStep('api-request', {
          status: 'error',
          result: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw new Error('API request failed');
      }

      // Step 5: Response Parsing
      updateStep('response-parsing', { status: 'running' });
      let responseData;
      try {
        const startTime = Date.now();

        // Get the response text first
        let responseText;
        try {
          responseText = await response.text();
          console.log('Response text:', responseText.substring(0, 500) + '...');
        } catch (textError) {
          throw new Error(
            `Failed to read response text: ${
              textError instanceof Error ? textError.message : String(textError)
            }`
          );
        }

        // Try to parse as JSON
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(
            `Failed to parse response as JSON: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }. Response text: ${responseText.substring(0, 200)}...`
          );
        }

        const endTime = Date.now();

        updateStep('response-parsing', {
          status: 'success',
          result: {
            success: true,
            time: endTime - startTime,
            data: {
              success: responseData.success,
              hasRawAnalysis: !!responseData.rawAnalysis,
              responseKeys: Object.keys(responseData),
            },
          },
        });
      } catch (error) {
        updateStep('response-parsing', {
          status: 'error',
          result: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw new Error('Response parsing failed');
      }

      // Step 6: Data Extraction
      updateStep('data-extraction', { status: 'running' });
      try {
        const startTime = Date.now();

        // Check if we have the expected data
        const hasScore =
          responseData.creditScore !== undefined &&
          responseData.creditScore !== null;
        const hasNegativeItems =
          Array.isArray(responseData.negativeItems) &&
          responseData.negativeItems.length > 0;
        const hasAccounts =
          Array.isArray(responseData.accounts) &&
          responseData.accounts.length > 0;

        const endTime = Date.now();

        updateStep('data-extraction', {
          status: 'success',
          result: {
            success: true,
            time: endTime - startTime,
            data: {
              hasScore,
              scoreValue: responseData.creditScore,
              hasNegativeItems,
              negativeItemsCount: responseData.negativeItems?.length || 0,
              hasAccounts,
              accountsCount: responseData.accounts?.length || 0,
              processingMethod: responseData.processingMethod,
            },
          },
        });

        setFinalResult(responseData);

        toast({
          title: 'Diagnostic complete',
          description: hasScore
            ? `Found credit score: ${responseData.creditScore}`
            : 'Analysis completed but no credit score found',
        });
      } catch (error) {
        updateStep('data-extraction', {
          status: 'error',
          result: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw new Error('Data extraction failed');
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast({
        title: 'Diagnostic failed',
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (step: DiagnosticStep) => {
    switch (step.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-400" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      case 'skipped':
        return <ArrowRight className="h-5 w-5 text-yellow-400" />;
      default:
        return <Bug className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold mb-8 gradient-text">
            Credit Report Analysis Diagnostic
          </h1>

          <div className="space-y-6">
            {/* Network Status Card */}
            <Card
              className={`p-4 ${
                networkStatus.online ? 'bg-green-500/10' : 'bg-red-500/10'
              } border ${
                networkStatus.online ? 'border-green-500' : 'border-red-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {networkStatus.online ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  )}
                  <span className="font-medium">
                    {networkStatus.online
                      ? 'Network Connected'
                      : 'Network Disconnected'}
                  </span>
                </div>
                {networkStatus.latency !== null && (
                  <span className="text-sm text-muted-foreground">
                    Latency: {networkStatus.latency}ms
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNetworkStatus({ online: true, latency: null });
                    testApiConnection();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            </Card>

            <Card className="p-6 bg-card/80 backdrop-blur">
              <h2 className="text-xl font-semibold mb-4">
                Upload Credit Report
              </h2>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Select Credit Report File</Label>
                  <Input
                    id="file"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png,.txt"
                  />
                </div>

                {file && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-cyan-400" />
                      <span className="font-medium">{file.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Type: {file.type || 'Unknown'}</p>
                      <p>Size: {(file.size / 1024).toFixed(2)} KB</p>
                      <p>
                        Modified: {new Date(file.lastModified).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={runDiagnostic}
                  disabled={!file || isRunning}
                  className="w-full bg-cyan-500 hover:bg-cyan-600"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Diagnostic...
                    </>
                  ) : (
                    'Run Diagnostic'
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-6 bg-card/80 backdrop-blur">
              <h2 className="text-xl font-semibold mb-4">Diagnostic Steps</h2>

              <div className="space-y-4">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`p-4 rounded-lg border ${
                      step.status === 'error'
                        ? 'bg-red-500/10 border-red-500'
                        : step.status === 'success'
                        ? 'bg-green-500/10 border-green-500'
                        : step.status === 'running'
                        ? 'bg-blue-500/10 border-blue-500'
                        : 'bg-muted border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getStepIcon(step)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{step.name}</p>
                          {step.result?.time && (
                            <span className="text-xs text-muted-foreground">
                              {step.result.time}ms
                            </span>
                          )}
                        </div>

                        {step.result && (
                          <div className="mt-2">
                            {step.status === 'error' ? (
                              <p className="text-sm text-red-400">
                                {step.result.error}
                              </p>
                            ) : (
                              <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded max-h-40 overflow-auto">
                                {JSON.stringify(step.result.data, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {finalResult && (
              <Card className="p-6 bg-card/80 backdrop-blur">
                <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>

                <div className="space-y-4">
                  {finalResult.creditScore && (
                    <div className="p-4 bg-green-500/10 border border-green-500 rounded-lg">
                      <p className="font-medium text-green-400">
                        Credit Score Found
                      </p>
                      <p className="text-2xl font-bold">
                        {finalResult.creditScore}
                      </p>
                    </div>
                  )}

                  {finalResult.negativeItems &&
                    finalResult.negativeItems.length > 0 && (
                      <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
                        <p className="font-medium text-red-400 mb-2">
                          Negative Items ({finalResult.negativeItems.length})
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          {finalResult.negativeItems.map(
                            (item: string, index: number) => (
                              <li key={index} className="text-sm">
                                {item}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium mb-2">Raw Response</p>
                    <Textarea
                      className="font-mono text-xs h-60"
                      value={JSON.stringify(finalResult, null, 2)}
                      readOnly
                    />
                  </div>
                </div>
              </Card>
            )}

            {fileContent && (
              <Card className="p-6 bg-card/80 backdrop-blur">
                <h2 className="text-xl font-semibold mb-4">File Content</h2>
                <Textarea
                  className="font-mono text-xs h-60"
                  value={fileContent}
                  readOnly
                />
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
