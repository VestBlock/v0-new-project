'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Bug, Code, FileText, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

export default function CreditReportDebugPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [rawResponse, setRawResponse] = useState('');
  const [activeTab, setActiveTab] = useState('file');
  const [manualText, setManualText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    try {
      const text = await selectedFile.text();
      setFileContent(text);
    } catch (error) {
      console.error('Error reading file:', error);
      setFileContent(
        `Error reading file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const analyzeFile = async () => {
    if (!file && !manualText) return;

    setIsLoading(true);
    setResult(null);
    setRawResponse('');

    try {
      let response;

      if (activeTab === 'file' && file) {
        // Create FormData and append file
        const formData = new FormData();
        formData.append('file', file);

        // Send file for analysis
        response = await fetch('/api/analyze-document', {
          method: 'POST',
          body: formData,
        });
      } else if (activeTab === 'text' && manualText) {
        // Send text directly
        response = await fetch('/api/analyze-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: manualText,
            fileName: 'manual-text.txt',
          }),
        });
      } else if (activeTab === 'direct' && manualText && apiKey) {
        // Send directly to OpenAI (bypassing our API)
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'Extract credit information from the following text. Return a JSON object with creditScore, negativeItems, accounts, etc.',
              },
              { role: 'user', content: manualText },
            ],
            temperature: 0.7,
          }),
        });
      } else {
        throw new Error('Invalid input configuration');
      }

      // Check if response is OK
      if (!response.ok) {
        let errorText = `Server returned ${response.status}`;
        try {
          const errorData = await response.json();
          errorText = `${errorText}: ${JSON.stringify(errorData)}`;
        } catch (e) {
          try {
            const text = await response.text();
            errorText = `${errorText}: ${text}`;
          } catch (e2) {
            // Ignore
          }
        }
        throw new Error(errorText);
      }

      // Parse response
      const data = await response.json();
      setResult(data);

      // Store raw response if available
      if (data.rawAnalysis) {
        setRawResponse(data.rawAnalysis);
      } else if (activeTab === 'direct') {
        setRawResponse(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-32">
        <h1 className="text-3xl font-bold mb-8">
          Credit Report Analysis Debug Tool
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="file">File Upload</TabsTrigger>
                  <TabsTrigger value="text">Text Input</TabsTrigger>
                  <TabsTrigger value="direct">Direct API</TabsTrigger>
                </TabsList>

                <TabsContent value="file" className="space-y-4">
                  <div>
                    <Label htmlFor="file">Upload Credit Report</Label>
                    <Input
                      id="file"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.txt,.jpg,.jpeg,.png"
                    />
                  </div>

                  {file && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-cyan-500" />
                        <span className="font-medium">{file.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Type: {file.type || 'Unknown'}</p>
                        <p>Size: {(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                  )}

                  {fileContent && (
                    <div>
                      <Label>File Content Preview</Label>
                      <Textarea
                        value={
                          fileContent.substring(0, 500) +
                          (fileContent.length > 500 ? '...' : '')
                        }
                        readOnly
                        className="h-40 font-mono text-xs"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="text" className="space-y-4">
                  <div>
                    <Label htmlFor="manualText">Enter Credit Report Text</Label>
                    <Textarea
                      id="manualText"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Paste credit report text here..."
                      className="h-60"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="direct" className="space-y-4">
                  <div>
                    <Label htmlFor="apiKey">OpenAI API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This key is used only for this request and not stored.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="directText">Credit Report Text</Label>
                    <Textarea
                      id="directText"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Paste credit report text here..."
                      className="h-40"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                onClick={analyzeFile}
                disabled={
                  isLoading ||
                  (!file && !manualText) ||
                  (activeTab === 'direct' && !apiKey)
                }
                className="w-full mt-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Credit Report'
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <Tabs defaultValue="parsed">
                  <TabsList className="grid grid-cols-3 mb-4">
                    <TabsTrigger value="parsed">Parsed Data</TabsTrigger>
                    <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                    <TabsTrigger value="response">API Response</TabsTrigger>
                  </TabsList>

                  <TabsContent value="parsed" className="space-y-4">
                    {result.success === false ? (
                      <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          <p className="font-medium text-red-500">
                            Analysis Failed
                          </p>
                        </div>
                        <p className="text-sm">
                          {result.error || 'Unknown error'}
                        </p>
                        {result.details && (
                          <p className="text-sm mt-2">{result.details}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Credit Score */}
                        <div className="p-4 rounded-lg border">
                          <p className="font-medium mb-2">Credit Score</p>
                          {result.creditScore ? (
                            <div className="text-3xl font-bold text-center">
                              {result.creditScore}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-center">
                              No credit score found
                            </p>
                          )}
                        </div>

                        {/* Negative Items */}
                        <div className="p-4 rounded-lg border">
                          <p className="font-medium mb-2">
                            Negative Items ({result.negativeItems?.length || 0})
                          </p>
                          {result.negativeItems?.length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1">
                              {result.negativeItems.map(
                                (item: string, index: number) => (
                                  <li key={index} className="text-sm">
                                    {item}
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground">
                              No negative items found
                            </p>
                          )}
                        </div>

                        {/* Accounts */}
                        <div className="p-4 rounded-lg border">
                          <p className="font-medium mb-2">
                            Accounts ({result.accounts?.length || 0})
                          </p>
                          {result.accounts?.length > 0 ? (
                            <div className="space-y-2">
                              {result.accounts.map(
                                (account: any, index: number) => (
                                  <div
                                    key={index}
                                    className="p-2 bg-muted rounded"
                                  >
                                    <p className="font-medium">
                                      {account.creditor || 'Unknown Creditor'}
                                    </p>
                                    <div className="text-sm grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                                      <p>
                                        Account:{' '}
                                        {account.accountNumber || 'N/A'}
                                      </p>
                                      <p>Balance: {account.balance || 'N/A'}</p>
                                      <p>Status: {account.status || 'N/A'}</p>
                                      <p>
                                        Negative:{' '}
                                        {account.isNegative ? 'Yes' : 'No'}
                                      </p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">
                              No accounts found
                            </p>
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="p-4 rounded-lg border">
                          <p className="font-medium mb-2">Metadata</p>
                          <div className="text-sm grid grid-cols-2 gap-x-2 gap-y-1">
                            <p>
                              Processing Method:{' '}
                              {result.processingMethod || 'N/A'}
                            </p>
                            <p>
                              Processing Time:{' '}
                              {result.processingTime
                                ? `${result.processingTime}ms`
                                : 'N/A'}
                            </p>
                            <p>Bureau: {result.bureau || 'N/A'}</p>
                            <p>Report Date: {result.reportDate || 'N/A'}</p>
                            {result.metadata?.textLength && (
                              <p>
                                Text Length: {result.metadata.textLength} chars
                              </p>
                            )}
                            {result.metadata?.extractionNotes && (
                              <p className="col-span-2">
                                Notes: {result.metadata.extractionNotes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raw">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Raw JSON Response</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              JSON.stringify(result, null, 2)
                            );
                          }}
                        >
                          <Code className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <Textarea
                        value={JSON.stringify(result, null, 2)}
                        readOnly
                        className="h-96 font-mono text-xs"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="response">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Raw OpenAI Response</p>
                        {rawResponse && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(rawResponse);
                            }}
                          >
                            <Code className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                        )}
                      </div>
                      {rawResponse ? (
                        <Textarea
                          value={rawResponse}
                          readOnly
                          className="h-96 font-mono text-xs"
                        />
                      ) : (
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-muted-foreground">
                            No raw response available
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <Bug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Upload a credit report and click "Analyze" to see results
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
