'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { updatePassword, isLoading, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [isRecoveryFlow] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      new URLSearchParams(window.location.search).get('type') === 'recovery'
    );
  });

  useEffect(() => {
    if (!isLoading && !isRecoveryFlow && !user) {
      toast({
        title: 'Invalid or expired reset link',
        description: 'Please request a fresh password reset.',
        variant: 'destructive',
      });
      router.push('/forgot-password');
    }
  }, [isLoading, isRecoveryFlow, user, toast, router]);

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password
    const error = validatePassword(password);
    if (error) {
      setPasswordError(error);
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError('');
    await updatePassword(password);
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background circuit-bg">
      <main className="pt-32 px-4">
        <div className="container mx-auto max-w-md">
          <Card className="p-8 bg-card/80 backdrop-blur">
            <h1 className="text-2xl font-bold mb-6 text-center gradient-text">
              Set New Password
            </h1>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError('');
                  }}
                  disabled={isLoading}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError('');
                  }}
                  disabled={isLoading}
                  required
                />
                {passwordError && (
                  <p className="text-red-500 text-xs mt-1">{passwordError}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-600"
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
