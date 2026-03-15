'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

const EnhancedCreditAnalyzerClient = dynamic(
  () =>
    import('@/components/enhanced-credit-analyzer').then(
      (mod) => mod.EnhancedCreditAnalyzer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-2xl mx-auto space-y-6 p-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    ),
  }
);

export default function EnhancedCreditAnalyzerPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 flex items-center justify-center">
        <EnhancedCreditAnalyzerClient />
      </main>
    </div>
  );
}
