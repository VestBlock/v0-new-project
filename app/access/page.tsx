'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

export default function AccessPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bypassEnabled, setBypassEnabled] = useState(false);
  const router = useRouter();

  // Check if bypass is already enabled
  useEffect(() => {
    const bypassAuth =
      localStorage.getItem('bypass_auth') === 'true' ||
      document.cookie.includes('bypass_auth=true');
    setBypassEnabled(bypassAuth);
  }, []);

  const enableBypass = () => {
    // Set both cookie and localStorage for maximum compatibility
    document.cookie = 'bypass_auth=true; path=/; max-age=86400'; // 24 hours
    localStorage.setItem('bypass_auth', 'true');
    setBypassEnabled(true);
  };

  const disableBypass = () => {
    document.cookie = 'bypass_auth=; path=/; max-age=0';
    localStorage.removeItem('bypass_auth');
    setBypassEnabled(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'vestblock' || password === 'admin') {
      enableBypass();
      setError(null);
    } else {
      setError('Incorrect password');
    }
  };

  const navigateTo = (path: string) => {
    if (!bypassEnabled) {
      enableBypass();
    }
    router.push(path);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 bg-card/80 backdrop-blur">
        <h1 className="text-2xl font-bold mb-6 text-center gradient-text">
          VestBlock.ai Access
        </h1>

        {bypassEnabled ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-500/20 border border-green-500 rounded-md">
              <p className="font-medium text-green-400">
                ✅ Bypass Mode Enabled
              </p>
              <p className="text-sm mt-1">
                You now have full access to all features of the website.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => navigateTo('/')} className="w-full">
                Home
              </Button>
              <Button
                onClick={() => navigateTo('/dashboard')}
                className="w-full"
              >
                Dashboard
              </Button>
              <Button onClick={() => navigateTo('/chat')} className="w-full">
                AI Chat
              </Button>
              <Button
                onClick={() => navigateTo('/tools/dispute-letters')}
                className="w-full"
              >
                Dispute Letters
              </Button>
              <Button onClick={() => navigateTo('/profile')} className="w-full">
                Profile
              </Button>
              <Button
                onClick={() => navigateTo('/tools/upload-report')}
                className="w-full"
              >
                Upload Report
              </Button>
            </div>

            <Button
              onClick={disableBypass}
              variant="outline"
              className="w-full"
            >
              Disable Bypass Mode
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Access Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access password"
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
              <p className="text-xs text-muted-foreground mt-2">
                Hint: Try "vestblock" or "admin" as the password
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-600"
            >
              Enable Access
            </Button>

            <div className="text-center">
              <Button variant="link" onClick={enableBypass} className="text-sm">
                Skip verification (development only)
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
