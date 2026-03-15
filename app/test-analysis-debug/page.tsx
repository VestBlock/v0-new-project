'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  Bug,
  CheckCircle,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';

interface DebugLog {
  timestamp: string;
  step: string;
  data: any;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function TestAnalysisDebugPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [manualText, setManualText] = useState('');
  const [testMode, setTestMode] = useState<'file' | 'text' | 'sample'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sample credit report text for testing
  const sampleCreditReport = `
CREDIT REPORT
Report Date: January 15, 2024
Credit Bureau: Equifax

PERSONAL INFORMATION
Name: John Doe
SSN: XXX-XX-1234

CREDIT SCORE
FICO Score: 680

ACCOUNT INFORMATION
1. Chase Freedom Credit Card
   Account #: XXXX-1234
   Type: Revolving
   Balance: $2,500
   Status: Current
   
2. Wells Fargo Auto Loan
   Account #: XXXX-5678
   Type: Installment
   Balance: $15,000
   Status: 30 days late

NEGATIVE ITEMS
- Late payment on Wells Fargo Auto Loan (30 days)
- Collection account from ABC Medical ($500)

INQUIRIES
- Capital One (03/15/2023)
- Discover Card (06/20/2023)
`;

  const addLog = (step: string, data: any, type: DebugLog['type'] = 'info') => {
    const log: DebugLog = {
      timestamp: new Date().toISOString(),
      step,
      data,
      type,
    };
    setDebugLogs((prev) => [...prev, log]);
    console.log(`[DEBUG] ${step}:`, data);
  };

  const clearLogs = () => {
    setDebugLogs([]);
    setAnalysis(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      clearLogs();

      addLog('File Selected', {
        name: selectedFile.name,
        type: selectedFile.type,
        size: `${(selectedFile.size / 1024).toFixed(2)} KB`,
        lastModified: new Date(selectedFile.lastModified).toISOString(),
      });
    }
  };

  const processFile = async () => {
    if (!file) return;

    clearLogs();
    setIsProcessing(true);
    setError(null);
    setAnalysis(null);

    try {
      addLog('Starting File Processing', { fileName: file.name });

      // Read file content
      const fileContent = await file.text();
      addLog('File Content Read', {
        contentLength: fileContent.length,
        preview: fileContent.substring(0, 200) + '...',
      });

      const formData = new FormData();
      formData.append('file', file);

      addLog('FormData Created', {
        hasFile: formData.has('file'),
      });

      const startTime = Date.now();

      addLog('Sending Request', {
        url: '/api/analyze-document',
        method: 'POST',
        fileSize: file.size,
      });

      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      });

      const responseTime = Date.now() - startTime;

      addLog('Response Received', {
        status: res.status,
        statusText: res.statusText,
        responseTime: `${responseTime}ms`,
        headers: Object.fromEntries(res.headers.entries()),
      });

      const responseText = await res.text();
      let data;

      try {
        data = JSON.parse(responseText);
        addLog(
          'Response Parsed',
          {
            success: data.success,
            hasScore: data.hasScore,
            processingTime: data.processingTime,
          },
          data.success ? 'success' : 'warning'
        );
      } catch (parseError) {
        addLog(
          'JSON Parse Error',
          {
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
            responsePreview: responseText.substring(0, 500),
          },
          'error'
        );
        throw new Error('Failed to parse server response');
      }

      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      if (data.rawAnalysis) {
        addLog(
          'Raw Analysis Received',
          {
            length: data.rawAnalysis.length,
            preview: data.rawAnalysis.substring(0, 200),
          },
          'warning'
        );
      }

      if (data.creditScore) {
        addLog('Credit Score Found', { score: data.creditScore }, 'success');
      }

      if (data.negativeItems && data.negativeItems.length > 0) {
        addLog(
          'Negative Items Found',
          {
            count: data.negativeItems.length,
            items: data.negativeItems,
          },
          'success'
        );
      }

      setAnalysis(data);

      toast({
        title: 'Analysis complete',
        description: `Processed in ${responseTime}ms`,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      addLog(
        'Processing Error',
        {
          error: errorMessage,
          stack: e instanceof Error ? e.stack : undefined,
        },
        'error'
      );

      setError(errorMessage);

      toast({
        title: 'Error processing file',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processText = async (text: string) => {
    clearLogs();
    setIsProcessing(true);
    setError(null);
    setAnalysis(null);

    try {
      addLog('Starting Text Processing', {
        textLength: text.length,
        preview: text.substring(0, 200) + '...',
      });

      const startTime = Date.now();

      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          fileName: 'manual-text.txt',
        }),
      });

      const responseTime = Date.now() - startTime;

      addLog('Response Received', {
        status: res.status,
        responseTime: `${responseTime}ms`,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      addLog(
        'Analysis Complete',
        {
          success: data.success,
          hasScore: data.hasScore,
          creditScore: data.creditScore,
          negativeItemsCount: data.negativeItems?.length || 0,
        },
        'success'
      );

      setAnalysis(data);

      toast({
        title: 'Analysis complete',
        description: `Processed in ${responseTime}ms`,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      addLog('Processing Error', { error: errorMessage }, 'error');

      setError(errorMessage);

      toast({
        title: 'Error processing text',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getLogIcon = (type: DebugLog['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
      default:
        return <Bug className="h-4 w-4 text-blue-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold mb-8 gradient-text">
            Credit Report Analysis Debugger
          </h1>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <div className="space-y-6">
              <Card className="p-6 bg-card/80 backdrop-blur">
                <Tabs
                  value={testMode}
                  onValueChange={(v) => setTestMode(v as any)}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="file">File Upload</TabsTrigger>
                    <TabsTrigger value="text">Manual Text</TabsTrigger>
                    <TabsTrigger value="sample">Sample Report</TabsTrigger>
                  </TabsList>

                  <TabsContent value="file" className="space-y-4">
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
                            Modified:{' '}
                            {new Date(file.lastModified).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={processFile}
                      disabled={!file || isProcessing}
                      className="w-full bg-cyan-500 hover:bg-cyan-600"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Process File
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="text" className="space-y-4">
                    <Textarea
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      className="min-h-[300px] font-mono text-xs"
                      placeholder="Paste credit report text here..."
                    />
                    <Button
                      onClick={() => processText(manualText)}
                      disabled={!manualText.trim() || isProcessing}
                      className="w-full bg-cyan-500 hover:bg-cyan-600"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Analyze Text'
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="sample" className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {sampleCreditReport}
                      </pre>
                    </div>
                    <Button
                      onClick={() => processText(sampleCreditReport)}
                      disabled={isProcessing}
                      className="w-full bg-cyan-500 hover:bg-cyan-600"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Analyze Sample Report'
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>
              </Card>

              {/* Analysis Results */}
              {analysis && (
                <Card className="p-6 bg-card/80 backdrop-blur">
                  <h2 className="text-xl font-semibold mb-4">
                    Analysis Results
                  </h2>

                  <div className="space-y-4">
                    {analysis.creditScore && (
                      <div className="p-4 bg-green-500/10 border border-green-500 rounded-lg">
                        <p className="font-medium text-green-400">
                          Credit Score Found
                        </p>
                        <p className="text-2xl font-bold">
                          {analysis.creditScore}
                        </p>
                      </div>
                    )}

                    {analysis.negativeItems &&
                      analysis.negativeItems.length > 0 && (
                        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
                          <p className="font-medium text-red-400 mb-2">
                            Negative Items ({analysis.negativeItems.length})
                          </p>
                          <ul className="list-disc pl-5 space-y-1">
                            {analysis.negativeItems.map(
                              (item: string, index: number) => (
                                <li key={index} className="text-sm">
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                    {analysis.metadata && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-medium mb-2">Metadata</p>
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(analysis.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    {analysis.rawAnalysis && (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg">
                        <p className="font-medium text-yellow-400 mb-2">
                          Raw AI Response
                        </p>
                        <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-auto">
                          {analysis.rawAnalysis}
                        </pre>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {error && (
                <Card className="p-6 bg-red-500/10 border border-red-500">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-400">Error</p>
                      <p className="text-sm mt-1">{error}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Debug Logs Section */}
            <Card className="p-6 bg-card/80 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Debug Logs</h2>
                <Button variant="outline" size="sm" onClick={clearLogs}>
                  Clear Logs
                </Button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {debugLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No logs yet. Process a file to see debug information.
                  </p>
                ) : (
                  debugLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        log.type === 'error'
                          ? 'bg-red-500/10 border-red-500'
                          : log.type === 'success'
                          ? 'bg-green-500/10 border-green-500'
                          : log.type === 'warning'
                          ? 'bg-yellow-500/10 border-yellow-500'
                          : 'bg-muted border-border'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {getLogIcon(log.type)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-sm">{log.step}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
