'use client';

import type React from 'react';
import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
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
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function RegisterPageContent() {
  const defaultRedirectTarget = '/dashboard/services';
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const { signUp, isLoading, authError, isAuthenticated } = useAuth();
  const router = useRouter();
  const redirectTarget = searchParams.get('redirect') || defaultRedirectTarget;

  useEffect(() => {
    if (prefilledEmail) {
      setEmail((current) => current || prefilledEmail);
    }
  }, [prefilledEmail]);

  useEffect(() => {
    // Redirect if the user is already authenticated
    if (isAuthenticated) {
      router.replace(redirectTarget);
    }
  }, [isAuthenticated, redirectTarget, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginTarget =
      redirectTarget && redirectTarget !== defaultRedirectTarget
        ? `/login?redirect=${encodeURIComponent(redirectTarget)}`
        : '/login';
    await signUp(email, password, fullName, loginTarget);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create your VestBlock account</CardTitle>
          <CardDescription>
            Your Growth System dashboard will be ready after signup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                placeholder="John Doe"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {authError && (
              <p className="text-sm font-medium text-destructive">
                {authError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Create an account'
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link
              href={
                redirectTarget && redirectTarget !== defaultRedirectTarget
                  ? `/login?redirect=${encodeURIComponent(redirectTarget)}${email ? `&email=${encodeURIComponent(email)}` : ''}`
                  : `/login?redirect=/dashboard/services${email ? `&email=${encodeURIComponent(email)}` : ''}`
              }
              passHref
            >
              <Button variant="link" className="p-0">
                Sign in
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
