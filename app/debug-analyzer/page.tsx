'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

const DebugReportAnalyzer = dynamic(
  () =>
    import('@/components/debug-report-analyzer').then(
      (mod) => mod.DebugReportAnalyzer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    ),
  }
);

export default function DebugAnalyzerPage() {
  return (
    <div className="min-h-screen bg-background circuit-bg">
      <main className="container mx-auto pt-32 px-4">
        <h1 className="text-3xl font-bold mb-8 gradient-text text-center">
          Credit Report Debug Analyzer
        </h1>
        <DebugReportAnalyzer />
      </main>
    </div>
  );
}
