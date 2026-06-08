'use client';

import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import {
  ArrowLeft,
  FileText,
  Loader2,
  MailWarning,
  Scale,
  ShieldIcon as ShieldZap,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// Dynamically import the generator to avoid SSR issues with its dependencies
const DisputeLetterGenerator = dynamic(
  () =>
    import('@/components/dispute-letter-generator').then(
      (mod) => mod.DisputeLetterGenerator
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="ml-3 mt-2">Loading Generator...</p>
      </div>
    ),
  }
);

// Define the letter types
const letterTypes = [
  {
    key: 'debt_validation',
    title: 'Debt Validation Letter',
    description:
      'Request proof that a debt collector has the right to collect a debt from you.',
    icon: Scale,
  },
  {
    key: 'incorrect_information',
    title: 'Incorrect Information Dispute',
    description:
      'Dispute inaccurate personal information, account details, or payment history on your report.',
    icon: FileText,
  },
  {
    key: 'cease_and_desist',
    title: 'Cease and Desist Letter',
    description:
      'Demand that a debt collector stops contacting you regarding a debt.',
    icon: MailWarning,
  },
];

function DisputeLettersToolPageContent() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultLetter = (() => {
    const typeFromUrl = searchParams.get('type');
    const foundType = typeFromUrl
      ? letterTypes.find((lt) => lt.key === typeFromUrl)
      : null;
    return foundType ? { key: foundType.key, title: foundType.title } : null;
  })();
  const [selectedLetter, setSelectedLetter] = useState<{
    key: string;
    title: string;
  } | null>(() => defaultLetter);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 text-center">
          <p>Please log in to use the Dispute Letter tools.</p>
          <Button
            onClick={() =>
              router.push('/login?redirect=/tools/dispute-letters')
            }
            className="mt-4"
          >
            Go to Login
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 md:pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          {selectedLetter ? (
            <div>
              <Button
                variant="ghost"
                onClick={() => setSelectedLetter(null)}
                className="mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Letter Types
              </Button>
              <h1 className="text-3xl font-bold mb-2 gradient-text">
                {selectedLetter.title}
              </h1>
              <p className="text-muted-foreground mb-8">
                Fill in the details below to generate your letter.
              </p>
              <DisputeLetterGenerator
                recommendedStrategy={selectedLetter.key}
              />
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold mb-2 text-center gradient-text">
                Dispute Letter Tools
              </h1>
              <p className="text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
                Choose a tool to get started. Generate standard letters or use
                the advanced dispute draft builder for more guided support.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Advanced dispute builder card */}
                <Link href="/super-dispute" className="block">
                  <Card className="h-full hover:border-cyan-500 transition-colors duration-300 flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3">
                        <ShieldZap className="h-8 w-8 text-cyan-500" />
                        <div>
                          Advanced Dispute Draft Builder
                          <span className="ml-2 inline-block text-xs font-semibold text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded-full">
                            AI-Powered
                          </span>
                        </div>
                      </CardTitle>
                      <CardDescription>
                        AI reviews your report details and helps create more
                        tailored dispute-letter drafts and follow-up steps than
                        generic templates.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto">
                      <Button className="w-full bg-cyan-500 hover:bg-cyan-600">
                        Launch Draft Builder
                      </Button>
                    </CardContent>
                  </Card>
                </Link>

                {/* Standard Letters */}
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>Standard Dispute Letters</CardTitle>
                    <CardDescription>
                      Select a standard letter type to generate.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {letterTypes.map((letter) => (
                      <button
                        key={letter.key}
                        onClick={() =>
                          setSelectedLetter({
                            key: letter.key,
                            title: letter.title,
                          })
                        }
                        className="w-full text-left p-4 rounded-lg border hover:bg-muted transition-colors flex items-start gap-4"
                      >
                        <letter.icon className="h-6 w-6 mt-1 text-muted-foreground flex-shrink-0" />
                        <div>
                          <h3 className="font-semibold">{letter.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {letter.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DisputeLettersToolPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col">
          <main className="flex-grow flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
          </main>
        </div>
      }
    >
      <DisputeLettersToolPageContent />
    </Suspense>
  );
}
