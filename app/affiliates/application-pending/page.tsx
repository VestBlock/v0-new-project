'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';

export default function ApplicationPendingPage() {
  return (
    <div className="min-h-screen bg-background circuit-bg">
      <main className="pt-24 md:pt-32 px-4 pb-16 flex items-center justify-center">
        <div className="container mx-auto max-w-lg text-center">
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <MailCheck className="h-16 w-16 mx-auto text-cyan-500 mb-4" />
              <CardTitle className="text-3xl font-bold gradient-text">
                Application Received!
              </CardTitle>
              <CardDescription className="text-muted-foreground text-base mt-2">
                Thank you for applying to the VestBlock Affiliate Program.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Our team will review your application, and you'll receive an
                email regarding its status within 3-5 business days.
              </p>
              <p>
                If approved, you'll gain access to your affiliate dashboard with
                your unique referral link and resources.
              </p>
              <Button asChild className="mt-6 bg-cyan-500 hover:bg-cyan-600">
                <Link href="/dashboard">Go to Main Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
