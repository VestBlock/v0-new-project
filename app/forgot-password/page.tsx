'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { forgotPassword, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await forgotPassword(email);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background circuit-bg">
      <main className="pt-32 px-4">
        <div className="container mx-auto max-w-md">
          <Card className="p-8 bg-card/80 backdrop-blur">
            <h1 className="text-2xl font-bold mb-6 text-center gradient-text">
              Reset Your Password
            </h1>

            {submitted ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  If an account exists with the email you provided, you will
                  receive a password reset link shortly.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/login">Return to Login</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{' '}
                  <Link href="/login" className="text-cyan-400 hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
