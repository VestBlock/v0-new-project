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
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function getSafeRedirectTarget(value: string | null, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  return value;
}

function RegisterPageContent() {
  const defaultRedirectTarget = '/dashboard/services';
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const { signUp, isLoading, authError, isAuthenticated } = useAuth();
  const router = useRouter();
  const redirectTarget = getSafeRedirectTarget(searchParams.get('redirect'), defaultRedirectTarget);

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
    <div className="vb-page flex min-h-screen items-center justify-center px-4 py-24">
      <Card className="mx-auto w-full max-w-md border-white/10 bg-[#0e1114] shadow-none">
        <CardHeader>
          <p className="vb-eyebrow">Start your VestBlock workspace</p>
          <h1 className="text-3xl font-medium tracking-tight">Keep your next move in one place.</h1>
          <CardDescription>
            Save capital requests, deal work, opportunities, and DealVault activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                placeholder="Your name"
                autoComplete="name"
                className="border-white/15 bg-[#090a08]"
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
                placeholder="you@example.com"
                autoComplete="email"
                className="border-white/15 bg-[#090a08]"
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
                autoComplete="new-password"
                className="border-white/15 bg-[#090a08]"
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
            <Button asChild variant="link" className="min-h-11 px-1">
              <Link
                href={
                  redirectTarget && redirectTarget !== defaultRedirectTarget
                    ? `/login?redirect=${encodeURIComponent(redirectTarget)}${email ? `&email=${encodeURIComponent(email)}` : ''}`
                    : `/login?redirect=/dashboard/services${email ? `&email=${encodeURIComponent(email)}` : ''}`
                }
              >
                Sign in
              </Link>
            </Button>
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
        <div className="vb-page flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
