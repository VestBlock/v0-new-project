'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart,
  CheckCircle,
  FileText,
  FileUp,
  Loader2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function TestDocumentAnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<
    'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'
  >('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Simulate analysis progress
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (processingStage === 'analyzing') {
      interval = setInterval(() => {
        setAnalysisProgress((prev) => {
          const newProgress = prev + Math.random() * 5;
          return newProgress >= 100 ? 100 : newProgress;
        });
      }, 300);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [processingStage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setAnalysis(null);
      setRawResponse(null);
      setProcessingStage('idle');
      setUploadProgress(0);
      setAnalysisProgress(0);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setAnalysis(null);
    setRawResponse(null);
    setProcessingStage('uploading');
    setUploadProgress(0);
    setAnalysisProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      toast({
        title: 'Processing file',
        description: 'This may take a few moments...',
      });

      // Simulate upload progress
      const uploadInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(uploadInterval);
            setProcessingStage('analyzing');
            return 100;
          }
          return newProgress;
        });
      }, 200);

      const startTime = Date.now();
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      });

      clearInterval(uploadInterval);
      setUploadProgress(100);
      setProcessingStage('analyzing');

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Set analysis progress to 100% when complete
      setAnalysisProgress(100);
      setProcessingStage('complete');

      // If we got raw analysis instead of structured data
      if (data.rawAnalysis) {
        setRawResponse(data.rawAnalysis);
        toast({
          title: 'Document processed with warnings',
          description:
            "The document was processed but couldn't be fully structured.",
        });
      } else {
        setAnalysis({
          ...data,
          processingTime,
        });

        toast({
          title: 'Document analysis complete',
          description: `Processed in ${processingTime}ms`,
        });
      }
    } catch (e) {
      console.error('Processing error:', e);
      setError(e instanceof Error ? e.message : String(e));
      setProcessingStage('error');

      toast({
        title: 'Error processing file',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processText = async () => {
    if (!manualText.trim()) return;

    setIsProcessing(true);
    setError(null);
    setAnalysis(null);
    setRawResponse(null);
    setProcessingStage('analyzing');
    setAnalysisProgress(0);

    try {
      toast({
        title: 'Processing text',
        description: 'This may take a few moments...',
      });

      // Simulate analysis progress
      const analysisInterval = setInterval(() => {
        setAnalysisProgress((prev) => {
          const newProgress = prev + Math.random() * 5;
          if (newProgress >= 95) {
            clearInterval(analysisInterval);
            return 95;
          }
          return newProgress;
        });
      }, 300);

      const startTime = Date.now();
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: manualText,
          fileName: 'manual-text.txt',
        }),
      });

      clearInterval(analysisInterval);
      setAnalysisProgress(100);

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      setProcessingStage('complete');

      // If we got raw analysis instead of structured data
      if (data.rawAnalysis) {
        setRawResponse(data.rawAnalysis);
        toast({
          title: 'Text processed with warnings',
          description:
            "The text was processed but couldn't be fully structured.",
        });
      } else {
        setAnalysis({
          ...data,
          processingTime,
        });

        toast({
          title: 'Text analysis complete',
          description: `Processed in ${processingTime}ms`,
        });
      }
    } catch (e) {
      console.error('Processing error:', e);
      setError(e instanceof Error ? e.message : String(e));
      setProcessingStage('error');

      toast({
        title: 'Error processing text',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getProcessingStageIcon = () => {
    switch (processingStage) {
      case 'uploading':
        return <FileUp className="h-5 w-5 text-blue-400 animate-pulse" />;
      case 'analyzing':
        return <BarChart className="h-5 w-5 text-yellow-400 animate-pulse" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getProcessingStageText = () => {
    switch (processingStage) {
      case 'uploading':
        return 'Uploading file...';
      case 'analyzing':
        return 'Analyzing document...';
      case 'complete':
        return 'Analysis complete!';
      case 'error':
        return 'Analysis failed';
      default:
        return 'Ready to process';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 gradient-text">
            Document Analysis Test
          </h1>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="p-6 bg-card/80 backdrop-blur">
              <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Select File</Label>
                  <Input
                    id="file"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png,.txt"
                  />
                </div>

                {file && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="h-5 w-5 text-cyan-400" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.type || 'Unknown type'} •{' '}
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>

                    {processingStage !== 'idle' && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {getProcessingStageIcon()}
                            <span>{getProcessingStageText()}</span>
                          </div>
                          {processingStage === 'uploading' && (
                            <span>{uploadProgress.toFixed(0)}%</span>
                          )}
                          {processingStage === 'analyzing' && (
                            <span>{analysisProgress.toFixed(0)}%</span>
                          )}
                        </div>

                        {processingStage === 'uploading' && (
                          <Progress value={uploadProgress} className="h-1.5" />
                        )}

                        {processingStage === 'analyzing' && (
                          <Progress
                            value={analysisProgress}
                            className="h-1.5 bg-yellow-500/20"
                          />
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                <Button
                  onClick={processFile}
                  disabled={!file || isProcessing}
                  className="w-full bg-cyan-500 hover:bg-cyan-600"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {processingStage === 'uploading'
                        ? 'Uploading...'
                        : 'Analyzing...'}
                    </>
                  ) : (
                    'Process Document'
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-6 bg-card/80 backdrop-blur">
              <h2 className="text-xl font-semibold mb-4">
                Manual Text Analysis
              </h2>
              <div className="space-y-4">
                <Textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="min-h-[200px]"
                  placeholder="Paste text from a credit report to analyze..."
                />

                {processingStage === 'analyzing' && !file && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-yellow-400 animate-pulse" />
                        <span>Analyzing text...</span>
                      </div>
                      <span>{analysisProgress.toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={analysisProgress}
                      className="h-1.5 bg-yellow-500/20"
                    />
                  </div>
                )}

                <Button
                  onClick={processText}
                  disabled={!manualText.trim() || isProcessing}
                  className="w-full bg-cyan-500 hover:bg-cyan-600"
                >
                  {isProcessing && !file ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                      Analyzing...
                    </>
                  ) : (
                    'Analyze Text'
                  )}
                </Button>
              </div>
            </Card>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-500/20 border border-red-500 rounded-lg mb-6"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400 mb-1">
                      Error Processing Document:
                    </p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {rawResponse && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="p-6 bg-card/80 backdrop-blur mb-6">
                  <h2 className="text-xl font-semibold mb-4">Raw Analysis</h2>
                  <div className="p-4 bg-yellow-500/20 border border-yellow-500 rounded-lg mb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <p className="text-sm">
                        The AI response couldn't be fully structured. Here's the
                        raw analysis:
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px]">
                    <pre className="text-xs whitespace-pre-wrap">
                      {rawResponse}
                    </pre>
                  </div>
                </Card>
              </motion.div>
            )}

            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="p-6 bg-card/80 backdrop-blur">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Analysis Results</h2>
                    <div className="flex items-center gap-2 text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Complete</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500 rounded-lg">
                      <p className="font-medium text-cyan-400">
                        Processing Time: {analysis.processingTime}ms
                      </p>
                      <p className="text-sm mt-1">
                        Method: {analysis.processingMethod}
                      </p>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      {analysis.hasScore ? (
                        <>
                          <p className="font-medium">Credit Score:</p>
                          <p className="text-2xl font-bold text-cyan-400">
                            {analysis.creditScore}
                          </p>
                        </>
                      ) : (
                        <div className="p-3 bg-yellow-500/20 border border-yellow-500 rounded-md">
                          <p className="font-medium">No Credit Score Found</p>
                          <p className="text-sm mt-1">
                            This report doesn't appear to contain a credit
                            score.
                          </p>
                        </div>
                      )}

                      {analysis.bureau && (
                        <p className="text-sm mt-2">
                          Bureau: {analysis.bureau}
                        </p>
                      )}
                      {analysis.reportDate && (
                        <p className="text-sm mt-2">
                          Report Date: {analysis.reportDate}
                        </p>
                      )}
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <p className="font-medium mb-2">Summary:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li className="text-sm">
                          Accounts: {analysis.accounts?.length || 0}
                        </li>
                        <li className="text-sm">
                          Negative Items: {analysis.negativeItems?.length || 0}
                        </li>
                        <li className="text-sm">
                          Inquiries: {analysis.inquiries?.length || 0}
                        </li>
                        <li className="text-sm">
                          Public Records: {analysis.publicRecords?.length || 0}
                        </li>
                      </ul>
                    </div>

                    {analysis.accounts && analysis.accounts.length > 0 && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-medium mb-2">Accounts:</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {analysis.accounts.map(
                            (account: any, index: number) => (
                              <div
                                key={index}
                                className={`p-2 rounded ${
                                  account.isNegative
                                    ? 'bg-red-500/20 border border-red-500'
                                    : 'bg-gray-700/20'
                                }`}
                              >
                                <p className="font-medium">
                                  {account.creditor}
                                </p>
                                {account.accountNumber && (
                                  <p className="text-xs">
                                    Account: {account.accountNumber}
                                  </p>
                                )}
                                {account.type && (
                                  <p className="text-xs">
                                    Type: {account.type}
                                  </p>
                                )}
                                {account.balance && (
                                  <p className="text-xs">
                                    Balance: {account.balance}
                                  </p>
                                )}
                                {account.status && (
                                  <p className="text-xs">
                                    Status: {account.status}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {analysis.negativeItems &&
                      analysis.negativeItems.length > 0 && (
                        <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg">
                          <p className="font-medium mb-2">Negative Items:</p>
                          <ul className="list-disc pl-5 space-y-1 max-h-40 overflow-y-auto">
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

                    {analysis.text && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-medium mb-2">Document Preview:</p>
                        <div className="max-h-40 overflow-y-auto">
                          <p className="text-xs">{analysis.text}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
