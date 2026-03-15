'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { redirect, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  FileText,
  Loader2,
  AlertTriangle,
  Download,
  Recycle,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

import { Database } from '@/types/supabase';

type DisputeLetterRow = Database['public']['Tables']['dispute_letters']['Row'];

export default function MyDisputeLettersPage() {
  const {
    user,
    isLoading: authLoading,
    isAuthenticated,
    userProfile,
  } = useAuth();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const { toast } = useToast();

  const [letters, setLetters] = useState<DisputeLetterRow[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [isLoadingLetters, setIsLoadingLetters] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/tools/my-dispute-letters');
      return;
    }

    const fetchLetters = async () => {
      if (!user) return;
      setIsLoadingLetters(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from('dispute_letters')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        console.log('🚀 ~ fetchLetters ~ data:', data);
        if (dbError) throw dbError;
        setLetters(data || []);
      } catch (err: any) {
        console.error('Error fetching dispute letters:', err);
        const errorMessage =
          err.message || 'Failed to load your saved letters.';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsLoadingLetters(false);
      }
    };

    fetchLetters();
  }, [user, authLoading, isAuthenticated, router, supabase, toast]);

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user && user.email === adminEmail) {
      setIsAdmin(true);
    }
  }, [user]);

  async function getSignedPdfUrl(
    letterId: string,
    userId: string,
    mode: 'view' | 'download'
  ) {
    const qs = new URLSearchParams({
      userId,
      download: mode === 'download' ? '1' : '0',
    });
    const res = await fetch(
      `/api/dispute-letters/${letterId}/pdf?` + qs.toString(),
      { method: 'GET' }
    );
    if (!res.ok) throw new Error('Failed to create signed URL');
    const json = await res.json();
    if (!json?.url) throw new Error('No signed URL returned');
    return json.url as string;
  }

  async function handleView(letter: DisputeLetterRow) {
    if (!user) return;
    try {
      setRowBusy(letter.id as string);
      const url = await getSignedPdfUrl(letter.id as string, user.id, 'view');
      // open preview in a new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast({
        title: 'Unable to preview PDF',
        description: e.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setRowBusy(null);
    }
  }

  async function handleDownload(letter: DisputeLetterRow) {
    if (!user) return;
    try {
      setRowBusy(letter.id as string);
      const url = await getSignedPdfUrl(
        letter.id as string,
        user.id,
        'download'
      );
      // Force download by navigating to the signed URL
      window.location.href = url;
    } catch (e: any) {
      toast({
        title: 'Unable to download',
        description: e.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setRowBusy(null);
    }
  }

  async function handleRegenerate(letter: DisputeLetterRow) {
    if (!user) return;
    try {
      setRowBusy(letter.id as string);
      const res = await fetch(`/api/dispute-letters/${letter.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Regenerate failed');
      }
      toast({
        title: 'Letter regenerated',
        description: 'A new version is ready.',
      });
      // refresh list
      const { data } = await supabase
        .from('dispute_letters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setLetters(data || []);
    } catch (e: any) {
      toast({
        title: 'Could not regenerate',
        description: e.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setRowBusy(null);
    }
  }

  const isProMember = userProfile?.is_subscribed || isAdmin;

  if (!isProMember) {
    router.push('/credit-upload');

    // redirect('/dashboard');
  }

  if (authLoading || (isAuthenticated && isLoadingLetters)) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* <Navigation /> */}
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* <Navigation /> */}
      <main className="flex-grow pt-24 md:pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold gradient-text">
                My Saved Dispute Letters
              </h1>
              <p className="text-muted-foreground mt-1">
                View and manage your generated dispute letters.
              </p>
            </div>
            <Button
              asChild
              className="bg-cyan-500 hover:bg-cyan-600 text-primary-foreground"
            >
              <Link href="/tools/dispute-letters">
                <FileText className="mr-2 h-4 w-4" /> Create New Letter
              </Link>
            </Button>
          </div>

          {error && (
            <Card className="mb-6 bg-destructive/10 border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle /> Error Loading Letters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{error}</p>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="mt-4"
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {!isLoadingLetters && !error && letters.length === 0 && (
            <Card className="text-center py-12">
              <CardHeader>
                <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <CardTitle>No Saved Letters Yet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  You haven't generated any dispute letters yet.
                  <br />
                  Start by creating one!
                </p>
                <Button
                  asChild
                  size="lg"
                  className="bg-cyan-500 hover:bg-cyan-600 text-primary-foreground"
                >
                  <Link href="/tools/dispute-letters">
                    Generate Your First Letter
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!isLoadingLetters && !error && (
            <Card>
              <CardHeader>
                <CardTitle>Your Letters</CardTitle>
                <CardDescription>
                  Here are the dispute letters you've generated. You can view
                  them again or create new ones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bureau</TableHead>
                      <TableHead>Letter Type</TableHead>
                      <TableHead># of items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {letters.map((letter) => (
                      <TableRow key={letter.id}>
                        <TableCell>
                          {format(parseISO(letter.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {letter.bureau || 'N/A'}
                        </TableCell>
                        <TableCell>{letter.letter_type || 'N/A'}</TableCell>
                        <TableCell>{letter.num_items || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {' '}
                            {letter.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        {/* <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TableCell> */}
                        <TableCell className="whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(letter)}
                            disabled={rowBusy === (letter.id as string)}
                            title="View PDF"
                          >
                            {rowBusy === letter.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(letter)}
                            disabled={rowBusy === (letter.id as string)}
                            title="Download PDF"
                          >
                            {rowBusy === letter.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegenerate(letter)}
                            disabled={rowBusy === (letter.id as string)}
                            title="Regenerate"
                          >
                            {rowBusy === letter.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
