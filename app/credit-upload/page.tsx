'use client';

import type React from 'react';
import { Suspense } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/auth-context';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Loader2,
  Rocket,
  Shield,
  ShieldCheck,
  Star,
  Upload,
  Zap,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';

function CreditUploadContent() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, userProfile, isAuthenticated, fetchUserProfile } = useAuth();
  console.log('🚀 ~ CreditUploadPage ~ userProfile:', userProfile);
  console.log('🚀 ~ CreditUploadPage ~ user:', user);
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  useEffect(() => {
    if (!token || !user) return;
    setPaymentLoading(true);
    // Call capture endpoint and update DB
    fetch('/api/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID: token, userId: user.id }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          // Refresh your auth/userProfile context
          fetchUserProfile(user);
          // Remove ?token= from URL
          router.replace('/credit-upload');
        } else throw new Error(json.error);
      })
      .catch(console.error)
      .finally(() => setPaymentLoading(false));
  }, [token, user, fetchUserProfile, router]);

  const handleCheckout = useCallback(async () => {
    setLoading(true);
    try {
      console.debug('🚀 ~ DashboardPage ~ user:', user?.id);
      const res = await fetch('/api/create-order', {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.id,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.debug('🚀 ~ PricingSection ~ res:', res);
      if (!res.ok) {
        const errText = await res.text();
        console.error('Create-order failed:', errText);
        throw new Error('Unable to initiate payment.');
      }

      const json = await res.json();
      console.log('PayPal create response:', json);

      if (!json.success) {
        console.error('PayPal API error:', json.error);
        throw new Error(json.error || 'Payment initialization failed.');
      }

      const links = json.data.links;
      if (!Array.isArray(links)) {
        console.error('Missing links in PayPal response:', json.data);
        throw new Error('Invalid PayPal response format.');
      }

      const approveLink = links.find((l: any) => l.rel === 'approve')?.href;
      console.log('Approve link:', approveLink);
      if (!approveLink) {
        throw new Error('PayPal approval link not found.');
      }

      router.replace(approveLink);
    } catch (error) {
      console.error(error);
      alert('Unable to start payment. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError('');

    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.type.startsWith('image/')
    ) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a PDF file of your credit report.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please upload a file smaller than 25MB.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (selectedFile.size < 100) {
      toast({
        title: 'File Too Small',
        description: 'The selected file appears to be empty or corrupted.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to upload your credit report.',
        variant: 'destructive',
      });
      router.push('/login?redirect=/credit-upload');
      return;
    }

    if (!file) {
      toast({
        title: 'No File Selected',
        description: 'Please select a credit report file to upload.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setError('');

    try {
      setUploadProgress(20);

      // Create form data for the API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);
      formData.append('additionalInfo', additionalInfo);
      if (userProfile?.full_name) {
        formData.append('username', userProfile.full_name);
      }
      // if (user.email) {
      //   formData.append('email', user.email);
      // }

      setUploadProgress(40);

      // Call our API route that handles everything server-side
      const response = await fetch('/api/upload-credit-report', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadProgress(100);
      setUploadedFileName(result.fileName);
      setUploadedFilePath(result.filePath);
      setSuccess(true);

      toast({
        title: 'Upload Successful!',
        description:
          'Your credit report has been uploaded successfully to secure storage.',
      });
    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to upload credit report';
      setError(errorMessage);

      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewUpload = () => {
    setFile(null);
    setAdditionalInfo('');
    setSuccess(false);
    setUploadProgress(0);
    setUploadedFileName(null);
    setUploadedFilePath(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user && user.email === adminEmail) {
      setIsAdmin(true);
    }
  }, [user]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 pb-16">
          <div className="container mx-auto max-w-2xl text-center">
            <Card>
              <CardHeader>
                <CardTitle>Authentication Required</CardTitle>
                <CardDescription>
                  Please log in to upload and analyze your credit report.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => router.push('/login?redirect=/credit-upload')}
                >
                  Log In to Continue
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const isProMember = userProfile?.is_subscribed || isAdmin;

  if (!userProfile || paymentLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="flex-1 p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Welcome back!</h2>
            <p className="text-muted-foreground">
              Here's your financial command center.
            </p>
          </div>
          {isProMember && (
            <Badge
              variant="secondary"
              className="flex items-center gap-2 text-lg py-2 px-4 bg-green-100 text-green-800 border-green-200"
            >
              <ShieldCheck className="h-5 w-5" />
              <span>Pro Member</span>
            </Badge>
          )}
        </div>

        {!isProMember && (
          <Alert>
            <Rocket className="h-4 w-4" />
            <AlertTitle>Unlock Your Full Potential!</AlertTitle>
            <AlertDescription>
              Upgrade to Pro to access our full suite of AI-powered tools,
              including the Super Dispute Letter generator and personalized
              financial roadmaps.
            </AlertDescription>
            <div className="mt-4">
              <Button
                asChild
                className="cursor-pointer"
                onClick={handleCheckout}
                disabled={loading}
              >
                <a>
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                  ) : (
                    <Star className="mr-2 h-4 w-4" />
                  )}
                  Upgrade to Pro - $75
                </a>
              </Button>
            </div>
          </Alert>
        )}
      </main>
      <main className="pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold gradient-text mb-4">
              Credit Report Upload
            </h1>
            <p className="text-xl text-foreground mb-6">
              Securely upload your credit report to our encrypted storage system
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200 dark:from-cyan-950 dark:to-blue-950 dark:border-cyan-800">
                <FileCheck className="h-8 w-8 text-cyan-600 mx-auto mb-2" />
                <h3 className="font-semibold text-cyan-900 dark:text-cyan-100">
                  Secure Storage
                </h3>
                <p className="text-sm text-cyan-800 dark:text-cyan-200">
                  Your files are encrypted and stored securely in the cloud
                </p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 dark:from-green-950 dark:to-emerald-950 dark:border-green-800">
                <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  Privacy Protected
                </h3>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Your personal information is never shared with third parties
                </p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200 dark:from-purple-950 dark:to-violet-950 dark:border-purple-800">
                <Zap className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                  Instant Upload
                </h3>
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  Fast and reliable file upload with progress tracking
                </p>
              </Card>
            </div>
          </div>

          {success ? (
            <div className="space-y-6">
              <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                    <CheckCircle2 className="h-6 w-6" />
                    Upload Successful!
                  </CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    Your credit report has been uploaded successfully to secure
                    storage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-green-700 dark:text-green-300">
                  <div className="space-y-4">
                    <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3 text-green-800 dark:text-green-200">
                        Upload Details:
                      </h4>
                      <div className="space-y-2 text-sm">
                        <p>
                          <strong>File Name:</strong> {uploadedFileName}
                        </p>
                        <p>
                          <strong>Storage Path:</strong> {uploadedFilePath}
                        </p>
                        <p>
                          <strong>Upload Time:</strong>{' '}
                          {new Date().toLocaleString()}
                        </p>
                        <p>
                          <strong>Status:</strong> Securely stored in
                          credit-reports bucket
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2 text-green-800 dark:text-green-200">
                        Your file is now safely stored and ready for:
                      </h4>
                      <ul className="space-y-1 text-sm">
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Manual review and analysis
                        </li>
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3" />
                          AI-powered credit analysis
                        </li>
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Dispute letter generation
                        </li>
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Credit improvement recommendations
                        </li>
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      {/* <Button
                        onClick={() => router.push('/dashboard')}
                        className="flex-1"
                      >
                        Go to Dashboard
                      </Button> */}
                      <Button
                        onClick={handleNewUpload}
                        variant="outline"
                        className="flex-1 bg-transparent"
                      >
                        Upload Another Report
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Your Credit Report</CardTitle>
                  <CardDescription>
                    Upload your credit report from Experian, Equifax, or
                    TransUnion (PDF format only)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label htmlFor="file-upload">Credit Report File *</Label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/30 rounded-lg p-8 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
                      <Upload className="h-12 w-12 mb-4 text-primary/60" />
                      <h3 className="text-lg font-medium mb-2 text-foreground">
                        {file ? file.name : 'Select Your Credit Report'}
                      </h3>
                      <p className="mb-4 text-muted-foreground">
                        {file
                          ? `${(file.size / 1024).toFixed(1)} KB • PDF file`
                          : 'Drag and drop your file here, or click to browse'}
                      </p>
                      <Input
                        id="file-upload"
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf, image/"
                        className="hidden"
                        disabled={loading}
                      />
                      <Button asChild variant="outline" disabled={loading}>
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          Choose File
                        </label>
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supported format: PDF/IMAGE • Max size: 25MB
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="additional-info">
                        Additional Notes (Optional)
                      </Label>
                      <Textarea
                        id="additional-info"
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        placeholder="Any additional notes about this credit report upload..."
                        rows={3}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={!file || loading}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading... {uploadProgress}%
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload to Secure Storage
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {loading && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {uploadProgress < 40
                            ? 'Preparing upload...'
                            : uploadProgress < 85
                            ? 'Uploading to secure storage...'
                            : 'Finalizing upload...'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {uploadProgress}%
                        </span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Upload Failed</AlertTitle>
                  <AlertDescription>
                    {error}
                    <br />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 bg-transparent"
                      onClick={() => setError('')}
                    >
                      Try Again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Your Data is 100% Secure</AlertTitle>
                <AlertDescription>
                  Your credit report is encrypted during upload and stored
                  securely. We never share your personal information with third
                  parties. Files are stored in isolated user folders with
                  enterprise-grade security.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CreditUploadPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading...</p>
      </div>
    }>
      <CreditUploadContent />
    </Suspense>
  );
}
