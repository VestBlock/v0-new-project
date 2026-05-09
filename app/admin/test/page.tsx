import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { OpenAITest } from '@/components/openai-test';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminDiagnosticSections } from '@/lib/admin/diagnostics';
import { checkAdminAccess } from '@/lib/auth/admin';

export const metadata: Metadata = {
  title: 'Admin Diagnostics',
  description:
    'Protected internal diagnostics for VestBlock operators. Not intended for public navigation or indexing.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TestPage() {
  const adminCheck = await checkAdminAccess();
  if (!adminCheck.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="px-4 py-24">
        <div className="container mx-auto max-w-6xl space-y-8">
          <div className="space-y-4">
            <Badge variant="outline">Protected internal tools</Badge>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  Admin diagnostics hub
                </h1>
                <p className="max-w-3xl text-muted-foreground">
                  Use this page for operator QA, environment checks, and internal
                  debugging. These routes are protected, noindexed, and meant for
                  support and release verification only.
                </p>
              </div>
              <Link href="/admin-panel" className="text-sm font-medium text-cyan-600 hover:underline">
                Back to admin panel
              </Link>
            </div>
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  Internal-use reminder
                </CardTitle>
                <CardDescription>
                  Do not route customers here. Use customer-facing pages for normal
                  flows and keep diagnostics limited to QA, incident review, and
                  operator troubleshooting.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {adminDiagnosticSections.map((section) => (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {section.links.map((link) => (
                    <div
                      key={link.href}
                      className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{link.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {link.description}
                        </p>
                      </div>
                      <Link
                        href={link.href}
                        className="text-sm font-medium text-cyan-600 hover:underline"
                      >
                        Open tool
                      </Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">OpenAI connection test</h2>
              <p className="text-sm text-muted-foreground">
                Keep one quick connectivity check here so operators can confirm the
                model path before diving deeper into workflow issues.
              </p>
            </div>
            <OpenAITest />
          </div>
        </div>
      </main>
    </div>
  );
}
