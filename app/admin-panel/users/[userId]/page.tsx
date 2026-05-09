'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  try {
    return format(parseISO(value), 'MMM d, yyyy h:mm a');
  } catch {
    return value;
  }
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            router.replace(`/login?redirect=/admin-panel/users/${userId}`);
            return;
          }
          if (response.status === 403) {
            router.replace('/dashboard');
            return;
          }
          throw new Error(result.error || 'Unable to load user.');
        }
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load user.');
      } finally {
        setLoading(false);
      }
    };

    if (authLoading) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=/admin-panel/users/${userId}`);
      return;
    }
    loadUser();
  }, [authLoading, isAuthenticated, userId, router]);

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-24">
        <Alert variant="destructive">
          <AlertTitle>User unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  const profile = data.profile;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="container mx-auto max-w-6xl space-y-6">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/admin-panel">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to admin
          </Link>
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Admin notice</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {profile?.full_name || profile?.email || 'User Detail'}
          </h1>
          <p className="text-muted-foreground">{profile?.email || userId}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Role</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge>{profile?.role || 'user'}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={profile?.is_subscribed ? 'default' : 'secondary'}>
                {profile?.is_subscribed ? 'paid' : 'free'}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reports</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {data.reports.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payments</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {data.payments.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Credit Reports</CardTitle>
            <CardDescription>Uploads and workflow status for this user.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reports.map((report: any) => (
                  <TableRow key={report.id}>
                    <TableCell>{report.file_name || 'Credit report'}</TableCell>
                    <TableCell>{report.status || 'uploaded'}</TableCell>
                    <TableCell>
                      {formatDate(report.uploaded_at || report.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin-panel/reports/${report.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Email Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.emailEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No email events.</p>
              ) : (
                data.emailEvents.slice(0, 20).map((event: any) => (
                  <div key={event.id} className="rounded-md border p-3">
                    <p className="font-medium">{event.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.status} - {formatDate(event.created_at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments And Leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...data.payments, ...data.leads].length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments or leads.</p>
              ) : (
                [...data.payments, ...data.leads].slice(0, 20).map((item: any) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <p className="font-medium">
                      {item.status || item.lead_type || item.payment_method}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.amount ? `$${item.amount} - ` : ''}
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
