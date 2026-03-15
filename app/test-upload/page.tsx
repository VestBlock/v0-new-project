'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRef, useState } from 'react';

export default function TestUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResponse(null);
    }
  };

  const testFormData = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('test', 'value');

      console.log('Testing FormData endpoint...');

      const res = await fetch('/api/test-formdata', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setResponse(data);
    } catch (e) {
      console.error('FormData test error:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(false);
    }
  };

  const testDocumentAnalysis = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('Testing document analysis endpoint...');

      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setResponse(data);
    } catch (e) {
      console.error('Document analysis test error:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(false);
    }
  };

  const testWithXHR = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          setResponse(data);
        } catch (e) {
          setError('Failed to parse response: ' + xhr.responseText);
        }
        setIsUploading(false);
      };

      xhr.onerror = () => {
        setError('XHR request failed');
        setIsUploading(false);
      };

      xhr.open('POST', '/api/analyze-document');
      xhr.send(formData);
    } catch (e) {
      console.error('XHR test error:', e);
      setError(e instanceof Error ? e.message : String(e));
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 gradient-text">
            File Upload Test
          </h1>

          <Card className="p-6 bg-card/80 backdrop-blur">
            <div className="space-y-4 mb-6">
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
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">Selected File:</p>
                  <p className="text-sm">Name: {file.name}</p>
                  <p className="text-sm">
                    Type: {file.type || 'not specified'}
                  </p>
                  <p className="text-sm">
                    Size: {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
            </div>

            <Tabs defaultValue="analyze" className="w-full">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="formdata">Test FormData</TabsTrigger>
                <TabsTrigger value="analyze">Test Analysis</TabsTrigger>
                <TabsTrigger value="xhr">Test XHR</TabsTrigger>
              </TabsList>

              <TabsContent value="formdata">
                <Button
                  onClick={testFormData}
                  disabled={!file || isUploading}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 mb-4"
                >
                  {isUploading ? 'Testing...' : 'Test FormData Endpoint'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Tests basic FormData parsing at /api/test-formdata
                </p>
              </TabsContent>

              <TabsContent value="analyze">
                <Button
                  onClick={testDocumentAnalysis}
                  disabled={!file || isUploading}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 mb-4"
                >
                  {isUploading ? 'Testing...' : 'Test Document Analysis'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Tests the document analysis endpoint at /api/analyze-document
                </p>
              </TabsContent>

              <TabsContent value="xhr">
                <Button
                  onClick={testWithXHR}
                  disabled={!file || isUploading}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 mb-4"
                >
                  {isUploading ? 'Testing...' : 'Test with XMLHttpRequest'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Tests using XMLHttpRequest instead of fetch API
                </p>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg mt-4">
                <p className="font-medium text-red-400 mb-2">Error:</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {response && (
              <div className="p-4 bg-green-500/20 border border-green-500 rounded-lg mt-4">
                <p className="font-medium text-green-400 mb-2">Response:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-[300px]">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}

            <div className="p-4 bg-blue-500/20 border border-blue-500 rounded-lg mt-4">
              <p className="font-medium text-blue-400 mb-2">
                Debug Information:
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>
                  The browser should automatically set Content-Type for FormData
                </li>
                <li>Empty Content-Type often indicates FormData</li>
                <li>Check browser Network tab for actual headers sent</li>
                <li>Try different test methods to isolate any issues</li>
              </ul>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
